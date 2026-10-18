import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

import { defaultUiMode, uiModeField } from './state';
import { BulletWidget, ImageWidget, MathWidget, RuleWidget, TableWidget, TaskWidget } from './widgets';

const lineCache = new Map<string, Decoration>();
const markCache = new Map<string, Decoration>();

function lineDeco(cls: string): Decoration {
  let deco = lineCache.get(cls);
  if (!deco) {
    deco = Decoration.line({ class: cls });
    lineCache.set(cls, deco);
  }
  return deco;
}

function markDeco(cls: string): Decoration {
  let deco = markCache.get(cls);
  if (!deco) {
    deco = Decoration.mark({ class: cls });
    markCache.set(cls, deco);
  }
  return deco;
}

function buildDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  const mode = state.field(uiModeField, false) ?? defaultUiMode;

  if (mode.source) return Decoration.none;
  if (doc.length > 400_000) return Decoration.none;

  const decos: Range<Decoration>[] = [];
  const covered: Array<[number, number]> = [];
  const codeRanges: Array<[number, number]> = [];
  const selection = state.selection.ranges;
  const seenLines = new Set<string>();

  const touched = (from: number, to: number): boolean =>
    selection.some((range) =>
      range.from === range.to
        ? range.from >= from && range.from <= to
        : range.from < to && range.to > from,
    );

  const coveredBy = (from: number, to: number): boolean =>
    covered.some(([a, b]) => from < b && to > a);

  function addLine(pos: number, cls: string): void {
    const line = doc.lineAt(pos);
    const key = `${line.from}:${cls}`;
    if (seenLines.has(key)) return;
    seenLines.add(key);
    decos.push(lineDeco(cls).range(line.from));
  }

  function addMark(from: number, to: number, cls: string, attributes?: Record<string, string>): void {
    if (to <= from) return;
    const deco = attributes ? Decoration.mark({ class: cls, attributes }) : markDeco(cls);
    decos.push(deco.range(from, to));
  }

  function hide(from: number, to: number): void {
    if (to <= from || coveredBy(from, to)) return;
    covered.push([from, to]);
    decos.push(Decoration.replace({}).range(from, to));
  }

  function replace(from: number, to: number, widget: WidgetType): void {
    if (to <= from || coveredBy(from, to)) return;
    covered.push([from, to]);
    decos.push(Decoration.replace({ widget }).range(from, to));
  }

  function eatSpace(pos: number, limit: number): number {
    return pos < limit && doc.sliceString(pos, pos + 1) === ' ' ? pos + 1 : pos;
  }

  syntaxTree(state).iterate({
    enter: (ref) => {
      const node = ref.node;
      const name = node.name;

      if (name === 'FencedCode' || name === 'CodeBlock') {
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(Math.max(node.from, node.to - 1));
        for (let n = startLine.number; n <= endLine.number; n += 1) {
          addLine(doc.line(n).from, 'cm-codeblock');
        }
        addLine(startLine.from, 'cm-codeblock-start');
        addLine(endLine.from, 'cm-codeblock-end');

        const show = touched(node.from, node.to);
        for (let child = node.firstChild; child; child = child.nextSibling) {
          if (child.name === 'CodeMark' || child.name === 'CodeInfo') {
            if (show) addMark(child.from, child.to, 'cm-formatting');
            else hide(child.from, child.to);
          }
        }
        codeRanges.push([node.from, node.to]);
        return false;
      }

      if (/^(ATX|Setext)Heading[1-6]$/.test(name)) {
        const level = Number(name[name.length - 1]);
        addLine(node.from, `cm-h${level}`);
        const mark = node.getChild('HeaderMark');
        if (mark) {
          const end = eatSpace(mark.to, node.to);
          if (touched(node.from, node.to)) addMark(mark.from, end, 'cm-formatting');
          else hide(mark.from, end);
        }
        return;
      }

      if (name === 'QuoteMark') {
        const line = doc.lineAt(node.from);
        addLine(line.from, 'cm-quote');
        const end = eatSpace(node.to, line.to);
        if (touched(line.from, line.to)) addMark(node.from, end, 'cm-formatting');
        else hide(node.from, end);
        return false;
      }

      if (name === 'ListMark') {
        const item = node.parent;
        const list = item?.parent;
        const isBullet = list?.name === 'BulletList';
        const head = item ? doc.sliceString(item.from, Math.min(item.to, item.from + 16)) : '';
        const hasTask = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/.test(head);

        addLine(doc.lineAt(node.from).from, 'cm-li');

        if (hasTask) {
          hide(node.from, node.to);
          return false;
        }
        if (isBullet) {
          if (touched(node.from, node.to)) addMark(node.from, node.to, 'cm-formatting');
          else replace(node.from, node.to, new BulletWidget());
        }
        return false;
      }

      if (name === 'TaskMarker') {
        const checked = /\[[xX]\]/.test(doc.sliceString(node.from, node.to));
        if (touched(node.from, node.to)) addMark(node.from, node.to, 'cm-formatting');
        else replace(node.from, node.to, new TaskWidget(checked, node.from, node.to));
        return false;
      }

      if (name === 'Emphasis' || name === 'StrongEmphasis' || name === 'Strikethrough') {
        const cls = name === 'Emphasis' ? 'cm-em' : name === 'StrongEmphasis' ? 'cm-strong' : 'cm-strike';
        const show = touched(node.from, node.to);
        for (let child = node.firstChild; child; child = child.nextSibling) {
          if (child.name === 'EmphasisMark' || child.name === 'StrikethroughMark') {
            if (show) addMark(child.from, child.to, 'cm-formatting');
            else hide(child.from, child.to);
          }
        }
        addMark(node.from, node.to, cls);
        return false;
      }

      if (name === 'InlineCode') {
        const show = touched(node.from, node.to);
        for (let child = node.firstChild; child; child = child.nextSibling) {
          if (child.name === 'CodeMark') {
            if (show) addMark(child.from, child.to, 'cm-formatting');
            else hide(child.from, child.to);
          }
        }
        addMark(node.from, node.to, 'cm-inline-code');
        codeRanges.push([node.from, node.to]);
        return false;
      }

      if (name === 'Image') {
        const raw = doc.sliceString(node.from, node.to);
        const match = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)$/.exec(raw);
        if (match && !touched(node.from, node.to)) {
          replace(node.from, node.to, new ImageWidget(match[2], match[1]));
          return false;
        }
        return;
      }

      if (name === 'Link') {
        const url = node.getChild('URL');
        if (!url) return;
        if (touched(node.from, node.to)) return false;

        const textFrom = node.from + 1;
        const textTo = Math.max(textFrom, url.from - 2);
        hide(node.from, textFrom);
        hide(textTo, node.to);
        if (textTo > textFrom) {
          const href = doc.sliceString(url.from, url.to);
          decos.push(
            Decoration.mark({ class: 'cm-link', attributes: { title: href } }).range(textFrom, textTo),
          );
        }
        return false;
      }

      if (name === 'HorizontalRule') {
        if (!touched(node.from, node.to)) replace(node.from, node.to, new RuleWidget());
        return false;
      }

      if (name === 'Table') {
        if (!touched(node.from, node.to)) {
          replace(node.from, node.to, new TableWidget(doc.sliceString(node.from, node.to), node.from));
        }
        return false;
      }

      return;
    },
  });

  /* ---------- math ---------- */
  const inCode = (pos: number): boolean => codeRanges.some(([a, b]) => pos >= a && pos <= b);

  for (let number = 1; number <= doc.lines; number += 1) {
    const line = doc.line(number);
    if (inCode(line.from)) continue;
    const trimmed = line.text.trim();

    // LaTeX display math: \[ ... \]
    if (trimmed.startsWith('\\[')) {
      const openAt = line.text.indexOf('\\[');
      const afterOpen = line.text.slice(openAt + 2);
      const sameLineClose = afterOpen.lastIndexOf('\\]');

      if (sameLineClose >= 0) {
        const start = line.from + openAt;
        const end = start + 2 + sameLineClose + 2;
        if (!touched(start, end)) {
          replace(start, end, new MathWidget(afterOpen.slice(0, sameLineClose).trim(), true));
        }
        continue;
      }

      let closedAt = -1;
      const reach = Math.min(doc.lines, number + 400);
      for (let n = number + 1; n <= reach; n += 1) {
        const candidate = doc.line(n);
        if (inCode(candidate.from)) break;
        if (candidate.text.includes('\\]')) {
          closedAt = n;
          break;
        }
      }

      if (closedAt > 0) {
        const endLine = doc.line(closedAt);
        const closeAt = endLine.text.indexOf('\\]');
        const start = line.from + openAt;
        const end = endLine.from + closeAt + 2;
        const inner = doc.sliceString(start + 2, end - 2).trim();
        if (!touched(start, end)) replace(start, end, new MathWidget(inner, true));
        number = closedAt;
      }
      continue;
    }

    if (trimmed === '$$') {
      let endNumber = -1;
      const limit = Math.min(doc.lines, number + 400);
      for (let n = number + 1; n <= limit; n += 1) {
        const candidate = doc.line(n);
        if (inCode(candidate.from)) break;
        if (candidate.text.trim() === '$$') {
          endNumber = n;
          break;
        }
      }
      if (endNumber > 0) {
        const inner = doc.sliceString(line.to, doc.line(endNumber).from).trim();
        replace(line.from, doc.line(endNumber).to, new MathWidget(inner, true));
        number = endNumber;
      }
      continue;
    }

    const single = /^\$\$(.+)\$\$$/.exec(trimmed);
    if (single) {
      const start = line.from + line.text.indexOf('$$');
      if (!touched(start, line.to)) replace(start, line.to, new MathWidget(single[1].trim(), true));
      continue;
    }

    if (!line.text.includes('$') && !line.text.includes('\\(')) continue;

    const pattern = /(?<!\\)\$([^$\n]{1,200}?)\$/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line.text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (touched(start, end)) continue;
      replace(start, end, new MathWidget(match[1], false));
    }

    const parenPattern = /\\\(([^\n]{1,400}?)\\\)/g;
    while ((match = parenPattern.exec(line.text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (touched(start, end)) continue;
      replace(start, end, new MathWidget(match[1], false));
    }
  }

  /* ---------- focus mode ---------- */
  if (mode.focus) {
    const active = new Set<number>();
    for (const range of selection) {
      active.add(doc.lineAt(range.from).number);
      active.add(doc.lineAt(range.to).number);
    }
    for (let number = 1; number <= doc.lines; number += 1) {
      if (!active.has(number)) addLine(doc.line(number).from, 'cm-dim');
    }
  }

  return Decoration.set(decos, true);
}

export const livePreview = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
  update: (_value, transaction) => buildDecorations(transaction.state),
  provide: (field) => EditorView.decorations.from(field),
});
