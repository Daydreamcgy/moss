import { EditorState } from '@codemirror/state';
import {
  EditorView,
  KeyBinding,
  ViewUpdate,
  crosshairCursor,
  drawSelection,
  dropCursor,
  keymap,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';

import { livePreview } from './live-preview';
import { uiModeField } from './state';

const codeHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.definitionKeyword], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character], color: 'var(--code-string)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--code-number)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--code-func)' },
  { tag: [tags.typeName, tags.className, tags.tagName, tags.namespace], color: 'var(--code-type)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--code-prop)' },
  { tag: [tags.operator, tags.punctuation, tags.bracket], color: 'var(--code-punct)' },
  { tag: tags.heading, fontWeight: '600' },
  { tag: tags.strong, fontWeight: '650' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--link)' },
  { tag: tags.monospace, fontFamily: 'var(--mono)' },
  { tag: tags.quote, color: 'var(--fg-dim)' },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--fg-faint)' },
  { tag: tags.invalid, color: '#e5534b' },
]);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--content-font)',
    lineHeight: '1.72',
    overflowY: 'auto',
  },
  '.cm-content': {
    padding: '58px max(26px, calc((100% - 740px) / 2)) 45vh',
    fontSize: '16.5px',
    caretColor: 'var(--accent)',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--sel)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
});

export function createEditorState(
  doc: string,
  extraKeys: KeyBinding[],
  onUpdate: (update: ViewUpdate) => void,
): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      rectangularSelection(),
      crosshairCursor(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        ...extraKeys,
        indentWithTab,
      ]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(codeHighlight),
      EditorView.lineWrapping,
      uiModeField,
      livePreview,
      editorTheme,
      EditorView.editorAttributes.compute([uiModeField], (state) => ({
        class: state.field(uiModeField).source ? 'cm-source' : '',
      })),
      EditorView.contentAttributes.of({ spellcheck: 'false' }),
      EditorView.updateListener.of(onUpdate),
    ],
  });
}
