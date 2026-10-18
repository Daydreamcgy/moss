import type { EditorView } from '@codemirror/view';

import { inlineHtml } from './inline';

export interface Cell {
  index: number;
  text: string;
  from: number;
  to: number;
}

export interface TableModel {
  base: number;
  aligns: Array<'left' | 'center' | 'right'>;
  header: Cell[];
  rows: Cell[][];
  cells: Cell[];
}

interface Line {
  text: string;
  start: number;
}

function splitLines(source: string, base: number): Line[] {
  const lines: Line[] = [];
  let offset = 0;
  for (const text of source.split('\n')) {
    lines.push({ text, start: base + offset });
    offset += text.length + 1;
  }
  return lines;
}

function cellsOfLine(line: Line): Cell[] {
  const { text, start } = line;
  const segments: Array<[number, number]> = [];
  let segmentStart = 0;

  for (let i = 0; i <= text.length; i += 1) {
    const isPipe = i < text.length && text[i] === '|' && text[i - 1] !== '\\';
    if (i === text.length || isPipe) {
      segments.push([segmentStart, i]);
      segmentStart = i + 1;
    }
  }

  if (segments.length > 1 && segments[0][0] === segments[0][1] && text.trimStart().startsWith('|')) {
    segments.shift();
  }
  const tail = segments[segments.length - 1];
  if (segments.length > 0 && tail && tail[0] === tail[1] && text.trimEnd().endsWith('|')) {
    segments.pop();
  }

  return segments.map(([rawStart, rawEnd]) => {
    let s = rawStart;
    let e = rawEnd;
    while (s < e && /\s/.test(text[s])) s += 1;
    while (e > s && /\s/.test(text[e - 1])) e -= 1;
    return { index: 0, text: text.slice(s, e), from: start + s, to: start + e };
  });
}

function isDelimiter(line: Line): boolean {
  const cells = cellsOfLine(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{1,}:?$/.test(cell.text));
}

function alignOf(cell: Cell | undefined): 'left' | 'center' | 'right' {
  if (!cell) return 'left';
  const left = cell.text.startsWith(':');
  const right = cell.text.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

export function parseTable(source: string, base: number): TableModel {
  const lines = splitLines(source, base).filter((line) => line.text.trim().length > 0);
  if (lines.length === 0) {
    return { base, aligns: [], header: [], rows: [], cells: [] };
  }

  const header = cellsOfLine(lines[0]);
  const hasDelimiter = lines.length > 1 && isDelimiter(lines[1]);
  const aligns = hasDelimiter ? cellsOfLine(lines[1]).map((cell) => alignOf(cell)) : [];
  const rows = lines.slice(hasDelimiter ? 2 : 1).map((line) => cellsOfLine(line));

  const cells: Cell[] = [];
  for (const cell of header) {
    cell.index = cells.length;
    cells.push(cell);
  }
  for (const row of rows) {
    for (const cell of row) {
      cell.index = cells.length;
      cells.push(cell);
    }
  }

  return { base, aligns, header, rows, cells };
}

export function tableHtml(model: TableModel): string {
  const head = model.header
    .map(
      (cell, column) =>
        `<th data-cell-index="${cell.index}" data-from="${cell.from}" data-to="${cell.to}" style="text-align:${
          model.aligns[column] ?? 'left'
        }">${inlineHtml(cell.text.replace(/\\\|/g, '|'))}</th>`,
    )
    .join('');

  const body = model.rows
    .map((row) => {
      const tds = row
        .map(
          (cell, column) =>
            `<td data-cell-index="${cell.index}" data-from="${cell.from}" data-to="${cell.to}" style="text-align:${
              model.aligns[column] ?? 'left'
            }">${inlineHtml(cell.text.replace(/\\\|/g, '|'))}</td>`,
        )
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/* ----------------------------- in-place editing ---------------------------- */

interface ActiveCell {
  input: HTMLInputElement;
  finish: (commit: boolean, move: 'none' | 'next' | 'prev') => void;
}

let active: ActiveCell | null = null;

function cellElement(base: number, index: number): HTMLElement | null {
  const table = document.querySelector<HTMLElement>(`.cm-table-widget[data-base="${base}"]`);
  return table?.querySelector<HTMLElement>(`[data-cell-index="${index}"]`) ?? null;
}

export function openCellEditor(view: EditorView, base: number, index: number): void {
  closeCellEditor(false);

  const element = cellElement(base, index);
  if (!element) return;

  const from = Number(element.dataset.from);
  const to = Number(element.dataset.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return;

  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const input = document.createElement('input');
  input.className = 'cm-cell-editor';
  input.value = view.state.sliceDoc(from, to).replace(/\\\|/g, '|');
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top}px`;
  input.style.width = `${Math.max(rect.width, 96)}px`;
  input.style.height = `${Math.max(rect.height, 24)}px`;
  input.style.fontSize = style.fontSize;
  input.style.fontFamily = style.fontFamily;

  document.body.appendChild(input);
  input.focus();
  input.select();

  let finished = false;

  const finish = (commit: boolean, move: 'none' | 'next' | 'prev') => {
    if (finished) return;
    finished = true;

    const value = input.value;
    input.remove();
    active = null;

    if (commit) {
      const text = value.replace(/(?<!\\)\|/g, '\\|');
      const current = view.state.sliceDoc(from, to);
      if (text !== current) {
        view.dispatch({ changes: { from, to, insert: text } });
      }
    }

    if (move !== 'none') {
      const forward = move === 'next';

      const tryOpen = (attempt: number): void => {
        const table = document.querySelector<HTMLElement>(`.cm-table-widget[data-base="${base}"]`);
        const count = table?.querySelectorAll('[data-cell-index]').length ?? 0;

        if (count === 0) {
          if (attempt < 6) window.setTimeout(() => tryOpen(attempt + 1), 40);
          return;
        }

        const next = forward ? (index + 1) % count : (index - 1 + count) % count;
        if (cellElement(base, next)) openCellEditor(view, base, next);
      };

      window.setTimeout(() => tryOpen(0), 30);
    }

    view.focus();
  };

  active = { input, finish };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true, 'none');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false, 'none');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      finish(true, event.shiftKey ? 'prev' : 'next');
    }
    event.stopPropagation();
  });

  input.addEventListener('blur', () => finish(true, 'none'));
}

export function closeCellEditor(commit: boolean): void {
  if (!active) return;
  const { finish } = active;
  finish(commit, 'none');
}

export function isCellEditorOpen(): boolean {
  return active !== null;
}
