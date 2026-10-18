import { EditorSelection } from '@codemirror/state';
import { EditorView, KeyBinding } from '@codemirror/view';

export function toggleWrap(view: EditorView, before: string, after = before): boolean {
  const { state } = view;
  const transaction = state.changeByRange((range) => {
    const pre = state.sliceDoc(Math.max(0, range.from - before.length), range.from);
    const post = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + after.length));

    if (pre === before && post === after) {
      return {
        changes: [
          { from: range.from - before.length, to: range.from },
          { from: range.to, to: range.to + after.length },
        ],
        range: EditorSelection.range(
          range.from - before.length,
          Math.max(range.from - before.length, range.to - before.length),
        ),
      };
    }

    const selected = state.sliceDoc(range.from, range.to);
    const caret = range.empty
      ? range.from + before.length
      : range.to + before.length;

    return {
      changes: { from: range.from, to: range.to, insert: before + selected + after },
      range: EditorSelection.range(caret, caret),
    };
  });

  view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input' });
  return true;
}

export function setHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const transaction = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const existing = /^(#{1,6})\s+/.exec(line.text);
    const text = existing ? line.text.slice(existing[0].length) : line.text;
    const prefix = level > 0 ? `${'#'.repeat(level)} ` : '';
    const insert = prefix + text;
    const shift = insert.length - line.text.length;

    return {
      changes: { from: line.from, to: line.to, insert },
      range: EditorSelection.cursor(Math.min(line.from + insert.length, Math.max(line.from, range.from + shift))),
    };
  });

  view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input' });
  return true;
}

export function insertLink(view: EditorView, url = ''): boolean {
  const { state } = view;
  const transaction = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    if (!text) {
      const insert = `[](${url})`;
      return {
        changes: { from: range.from, insert },
        range: EditorSelection.cursor(range.from + 1),
      };
    }
    const insert = `[${text}](${url})`;
    const urlFrom = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlFrom, urlFrom + url.length),
    };
  });

  view.dispatch(transaction, { scrollIntoView: true, userEvent: 'input' });
  return true;
}

export function insertCodeBlock(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const body = selected || '';
  const insert = '```\n' + body + '\n```';
  const caret = range.from + 4 + body.length;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(caret),
    scrollIntoView: true,
    userEvent: 'input',
  });
  return true;
}

export const formatKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: (view) => toggleWrap(view, '**'), preventDefault: true },
  { key: 'Mod-i', run: (view) => toggleWrap(view, '*'), preventDefault: true },
  { key: 'Mod-Shift-x', run: (view) => toggleWrap(view, '~~'), preventDefault: true },
  { key: 'Mod-e', run: (view) => toggleWrap(view, '`'), preventDefault: true },
  { key: 'Mod-k', run: (view) => insertLink(view), preventDefault: true },
  { key: 'Mod-Alt-c', run: (view) => insertCodeBlock(view), preventDefault: true },
  { key: 'Mod-1', run: (view) => setHeading(view, 1), preventDefault: true },
  { key: 'Mod-2', run: (view) => setHeading(view, 2), preventDefault: true },
  { key: 'Mod-3', run: (view) => setHeading(view, 3), preventDefault: true },
  { key: 'Mod-4', run: (view) => setHeading(view, 4), preventDefault: true },
  { key: 'Mod-5', run: (view) => setHeading(view, 5), preventDefault: true },
  { key: 'Mod-6', run: (view) => setHeading(view, 6), preventDefault: true },
  { key: 'Mod-0', run: (view) => setHeading(view, 0), preventDefault: true },
];
