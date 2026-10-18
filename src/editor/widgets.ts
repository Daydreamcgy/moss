import { EditorView, WidgetType } from '@codemirror/view';
import katex from 'katex';

import { parseTable, tableHtml, openCellEditor } from './table';

export type ImageResolver = (src: string) => string | Promise<string> | null;

let imageResolver: ImageResolver | null = null;

export function setImageResolver(fn: ImageResolver | null): void {
  imageResolver = fn;
}

export class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-image-widget';

    const img = document.createElement('img');
    img.alt = this.alt;
    img.draggable = false;
    img.loading = 'lazy';

    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      wrap.classList.add('cm-image-error');
      wrap.textContent = `image not found: ${this.alt || this.src}`;
    };

    img.addEventListener('load', () => {
      settled = true;
    });
    img.addEventListener('error', () => fail());

    wrap.appendChild(img);

    const resolved = imageResolver ? imageResolver(this.src) : this.src;
    if (typeof resolved === 'string') {
      img.src = resolved;
    } else if (resolved && typeof (resolved as Promise<string>).then === 'function') {
      (resolved as Promise<string>)
        .then((url) => {
          if (!settled) img.src = url;
        })
        .catch(() => fail());
    } else {
      img.src = this.src;
    }

    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class RuleWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'moss-hr';
    return el;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export class MathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean) {
    super();
  }

  eq(other: MathWidget): boolean {
    return other.tex === this.tex && other.display === this.display;
  }

  toDOM(): HTMLElement {
    const el = document.createElement(this.display ? 'div' : 'span');
    el.className = this.display ? 'cm-math-block' : 'cm-math';
    try {
      el.innerHTML = katex.renderToString(this.tex, {
        displayMode: this.display,
        throwOnError: false,
        strict: false,
        output: 'html',
      });
    } catch {
      el.textContent = this.tex;
    }
    return el;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly from: number, readonly to: number) {
    super();
  }

  eq(other: TaskWidget): boolean {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'cm-task';
    box.checked = this.checked;
    box.addEventListener('mousedown', (event) => event.preventDefault());
    box.addEventListener('change', () => {
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: box.checked ? '[x]' : '[ ]' },
      });
      view.focus();
    });
    return box;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class BulletWidget extends WidgetType {
  constructor(readonly char = '•') {
    super();
  }

  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-bullet';
    el.textContent = this.char;
    return el;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export class TableWidget extends WidgetType {
  constructor(readonly source: string, readonly base: number) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source && other.base === this.base;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cm-table-widget';
    el.dataset.base = String(this.base);
    el.innerHTML = tableHtml(parseTable(this.source, this.base));

    el.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;

      if (event.altKey) {
        event.preventDefault();
        view.dispatch({ selection: { anchor: this.base }, scrollIntoView: true });
        view.focus();
        return;
      }

      const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-cell-index]');
      if (!cell) return;

      event.preventDefault();
      openCellEditor(view, this.base, Number(cell.dataset.cellIndex));
    });

    return el;
  }

  ignoreEvent(): boolean {
    return true;
  }
}
