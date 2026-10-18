import './styles/theme.css';
import './styles/base.css';
import './styles/editor.css';
import 'katex/dist/katex.min.css';

import { EditorState } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';

import { formatKeymap } from './editor/format';
import { createEditorState } from './editor/setup';
import { setUiMode, uiModeField } from './editor/state';
import { closeCellEditor } from './editor/table';
import { setImageResolver } from './editor/widgets';
import { standaloneHtml } from './export/html';
import { applyStatic, getLocale, onLocaleChange, setLocale, t } from './i18n';
import {
  downloadText,
  makeImageResolver,
  pickFile,
  pickFolder,
  readHandle,
  readTree,
  statHandle,
  supportsFileSystem,
  writeHandle,
  type TreeEntry,
} from './io/files';
import { extractHeadings, highlightOutline, renderOutline } from './ui/outline';
import { renderTree, resetTreeExpansion } from './ui/tree';
import welcomeEn from './welcome.md?raw';
import welcomeZh from './welcome.zh.md?raw';

const welcomeText = (): string => (getLocale() === 'zh' ? welcomeZh : welcomeEn);
const untitledName = (): string => `${t('doc.untitled')}.md`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T =>
  document.querySelector(selector) as T;

const dom = {
  app: $('#app'),
  tabs: $('#tabs'),
  host: $('#editor-host'),
  tree: $('#file-tree'),
  outline: $('#outline'),
  menu: $('#menu'),
  toast: $('#toast'),
  stDoc: $('#st-doc'),
  stWords: $('#st-words'),
  stChars: $('#st-chars'),
  btnMode: $('#btn-mode'),
  themeSelect: $('#theme-select') as unknown as HTMLSelectElement,
  paneFiles: $('#pane-files'),
  paneOutline: $('#pane-outline'),
  btnShowSide: $('#btn-show-side'),
};

interface Tab {
  id: string;
  name: string;
  path: string | null;
  nativePath: string | null;
  handle: any;
  dir: any;
  state: EditorState;
  dirty: boolean;
  scrollTop: number;
}

const tabs: Tab[] = [];
let activeId = '';
let view: EditorView;
let treeEntries: TreeEntry[] | null = null;
let treeRoot: any = null;
let statusTimer: number | undefined;
let outlineTimer: number | undefined;
let toastTimer: number | undefined;
let scrollTimer: number | undefined;
let lastTreeScan = 0;

const mtimes = new Map<string, number>();

const activeTab = (): Tab | undefined => tabs.find((tab) => tab.id === activeId);

function makeState(text: string): EditorState {
  return createEditorState(text, formatKeymap, onUpdate);
}

/* ---------------------------------- editor --------------------------------- */

function onUpdate(update: ViewUpdate): void {
  const tab = activeTab();
  if (!tab) return;
  tab.state = update.state;

  if (update.docChanged) {
    if (!tab.dirty) {
      tab.dirty = true;
      renderTabs();
    }
    scheduleStatus();
    scheduleOutline();
    if (update.state.field(uiModeField).typewriter) centerCaret();
  } else if (update.selectionSet) {
    scheduleStatus();
  }
}

function centerCaret(): void {
  const head = view.state.selection.main.head;
  const block = view.lineBlockAt(head);
  const scroller = view.scrollDOM;
  const target = block.top - scroller.clientHeight / 2 + block.height / 2;
  scroller.scrollTop = Math.max(0, target);
}

function createView(): void {
  view = new EditorView({ parent: dom.host, state: makeState('') });
  view.scrollDOM.addEventListener(
    'scroll',
    () => {
      closeCellEditor(true);
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(syncOutline, 70);
    },
    { passive: true },
  );
}

function syncOutline(): void {
  if (!activeTab() || dom.paneOutline.classList.contains('hidden')) return;
  const pos = view.lineBlockAtHeight(Math.max(0, view.scrollDOM.scrollTop + 90)).from;
  highlightOutline(dom.outline, pos);
}

/* ----------------------------------- tabs ---------------------------------- */

function newTab(options: {
  name: string;
  text: string;
  path?: string | null;
  nativePath?: string | null;
  handle?: any;
  dir?: any;
}): Tab {
  const tab: Tab = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: options.name,
    path: options.path ?? null,
    nativePath: options.nativePath ?? null,
    handle: options.handle ?? null,
    dir: options.dir ?? null,
    state: makeState(options.text),
    dirty: false,
    scrollTop: 0,
  };
  tabs.push(tab);
  activate(tab.id);
  if (tab.handle) watchFile(tab);
  return tab;
}

function activate(id: string): void {
  const current = activeTab();
  if (current && view) {
    current.state = view.state;
    current.scrollTop = view.scrollDOM.scrollTop;
  }

  activeId = id;
  const tab = activeTab();
  if (!tab) return;

  setImageResolver(tab.dir ? makeImageResolver(tab.dir) : null);
  view.setState(tab.state);
  requestAnimationFrame(() => {
    view.scrollDOM.scrollTop = tab.scrollTop;
    view.focus();
  });

  renderTabs();
  updateStatus();
  renderOutlineNow();
  renderTreeNow();
  requestAnimationFrame(syncOutline);
}

function closeTab(id: string): void {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return;

  const tab = tabs[index];
  if (tab.dirty && !window.confirm(t('prompt.close', { name: tab.name }))) return;

  tabs.splice(index, 1);

  if (tabs.length === 0) {
    newTab({ name: untitledName(), text: '' });
    return;
  }

  if (activeId === id) {
    activate(tabs[Math.max(0, index - 1)].id);
  } else {
    renderTabs();
  }
}

function closeAllTabs(): void {
  if (tabs.length === 0) return;

  const dirty = tabs.filter((tab) => tab.dirty).length;
  if (dirty > 0 && !window.confirm(t('prompt.closeAll', { n: dirty }))) return;

  closeCellEditor(false);
  tabs.length = 0;
  activeId = '';
  newTab({ name: untitledName(), text: '' });
}

function renderTabs(): void {
  dom.tabs.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = `tab${tab.id === activeId ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`;
    el.title = tab.path ?? tab.name;

    const dot = document.createElement('span');
    dot.className = 'dot';

    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = tab.name;

    const close = document.createElement('button');
    close.className = 'x';
    close.textContent = '×';
    close.title = 'Close';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });

    el.append(dot, name, close);
    el.addEventListener('click', () => activate(tab.id));
    el.addEventListener('auxclick', (event) => {
      if (event.button === 1) closeTab(tab.id);
    });

    dom.tabs.appendChild(el);
  }
}

function markClean(tab: Tab): void {
  tab.dirty = false;
  renderTabs();
  updateStatus();
}

/* -------------------------------- watching --------------------------------- */

function watchFile(tab: Tab): void {
  if (!tab.handle) return;
  void statHandle(tab.handle).then((value) => {
    if (value) mtimes.set(tab.id, value);
  });
}

async function pollWatchedFiles(): Promise<void> {
  for (const tab of [...tabs]) {
    if (!tab.handle) continue;
    const stamp = await statHandle(tab.handle);
    if (!stamp) continue;

    const known = mtimes.get(tab.id);
    if (known === undefined) {
      mtimes.set(tab.id, stamp);
      continue;
    }
    if (stamp === known) continue;

    mtimes.set(tab.id, stamp);

    if (tab.dirty) {
      toast(t('toast.changed', { name: tab.name }));
      continue;
    }

    try {
      const text = await readHandle(tab.handle);
      if (text === tab.state.doc.toString()) continue;
      reloadTab(tab, text);
      toast(t('toast.reloaded', { name: tab.name }));
    } catch {
      /* permission may have been revoked */
    }
  }
}

function reloadTab(tab: Tab, text: string): void {
  if (tab.id === activeId) {
    const scroll = view.scrollDOM.scrollTop;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    view.scrollDOM.scrollTop = scroll;
  } else {
    tab.state = tab.state.update({
      changes: { from: 0, to: tab.state.doc.length, insert: text },
    }).state;
  }

  tab.dirty = false;
  renderTabs();
  updateStatus();
  renderOutlineNow();
}

async function refreshTree(): Promise<void> {
  if (!treeRoot) return;
  const now = Date.now();
  if (now - lastTreeScan < 2500) return;
  lastTreeScan = now;
  try {
    treeEntries = await readTree(treeRoot);
    renderTreeNow();
  } catch {
    /* folder permission may have been revoked */
  }
}

/* ---------------------------------- files ---------------------------------- */

async function openFile(): Promise<void> {
  if (!supportsFileSystem()) {
    toast(t('toast.fsUnsupported'));
    return;
  }

  const picked = await pickFile();
  if (!picked) return;

  const existing = tabs.find((tab) => tab.handle && tab.name === picked.name && tab.path === picked.name);
  if (existing) {
    activate(existing.id);
    return;
  }

  newTab({ name: picked.name, text: picked.text, path: picked.name, handle: picked.handle });
}

async function openFolder(): Promise<void> {
  if (!supportsFileSystem()) {
    toast(t('toast.fsUnsupported'));
    return;
  }

  const picked = await pickFolder();
  if (!picked) return;

  treeRoot = picked.handle;
  treeEntries = picked.tree;
  resetTreeExpansion();
  renderTreeNow();
  switchPane('files');
  toast(t('toast.folderOpened', { name: picked.name }));
}

async function openTreeEntry(entry: TreeEntry): Promise<void> {
  const existing = tabs.find((tab) => tab.path === entry.path);
  if (existing) {
    activate(existing.id);
    return;
  }

  try {
    const text = await readHandle(entry.handle);
    newTab({ name: entry.name, text, path: entry.path, handle: entry.handle, dir: treeRoot });
  } catch {
    toast(t('toast.readFailed', { name: entry.name }));
  }
}

async function saveTab(): Promise<void> {
  const tab = activeTab();
  if (!tab) return;

  const text = tab.state.doc.toString();

  if (tab.nativePath) {
    const shell = (window as any).moss;
    try {
      await shell?.saveFile?.(tab.nativePath, text);
      markClean(tab);
      toast(t('toast.saved'));
    } catch {
      toast(t('toast.saveFailed'));
    }
    return;
  }

  if (tab.handle) {
    try {
      await writeHandle(tab.handle, text);
      markClean(tab);
      void statHandle(tab.handle).then((value) => {
        if (value) mtimes.set(tab.id, value);
      });
      toast(t('toast.saved'));
    } catch {
      toast(t('toast.saveFailed'));
    }
    return;
  }

  const filename = tab.name.endsWith('.md') ? tab.name : `${tab.name}.md`;
  downloadText(text, filename, 'text/markdown');
  markClean(tab);
  toast(t('toast.downloaded'));
}

function exportHtml(): void {
  const tab = activeTab();
  if (!tab) return;
  const title = tab.name.replace(/\.\w+$/, '');
  downloadText(standaloneHtml(title, tab.state.doc.toString()), `${title}.html`, 'text/html');
  toast(t('toast.exported'));
}

function printDocument(): void {
  const tab = activeTab();
  if (!tab) return;
  const title = tab.name.replace(/\.\w+$/, '');
  const html = standaloneHtml(title, tab.state.doc.toString());
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    toast(t('toast.popupBlocked'));
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

/* ---------------------------------- panels --------------------------------- */

function renderTreeNow(): void {
  renderTree(dom.tree, treeEntries, {
    activePath: activeTab()?.path ?? null,
    emptyText: treeRoot ? t('tree.noMatch') : undefined,
    onOpenFile: (entry) => {
      void openTreeEntry(entry);
    },
  });
}

function renderOutlineNow(): void {
  const tab = activeTab();
  if (!tab) return;
  renderOutline(dom.outline, extractHeadings(tab.state.doc.toString()), (pos) => {
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  });
}

function switchPane(pane: string): void {
  document.querySelectorAll<HTMLElement>('.side-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.pane === pane);
  });
  dom.paneFiles.classList.toggle('hidden', pane !== 'files');
  dom.paneOutline.classList.toggle('hidden', pane !== 'outline');
  if (pane === 'outline') renderOutlineNow();
}

function toggleSidebar(): void {
  dom.app.classList.toggle('collapsed');
  dom.btnShowSide.classList.toggle('hidden', !dom.app.classList.contains('collapsed'));
}

/* ---------------------------------- status --------------------------------- */

function countWords(text: string): number {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latin = text
    .replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .split(/\s+/)
    .filter((piece) => /[A-Za-z0-9]/.test(piece)).length;
  return cjk + latin;
}

function updateStatus(): void {
  const tab = activeTab();
  if (!tab) return;

  const text = tab.state.doc.toString();
  dom.stWords.textContent = t('status.words', { n: countWords(text).toLocaleString('en-US') });
  dom.stChars.textContent = t('status.chars', { n: text.length.toLocaleString('en-US') });
  dom.stDoc.textContent = tab.path ?? tab.name;

  const source = tab.state.field(uiModeField).source;
  dom.btnMode.textContent = source ? t('status.source') : t('status.live');
  dom.btnMode.classList.toggle('on', source);
}

function scheduleStatus(): void {
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(updateStatus, 120);
}

function scheduleOutline(): void {
  window.clearTimeout(outlineTimer);
  outlineTimer = window.setTimeout(renderOutlineNow, 320);
}

/* ----------------------------------- modes --------------------------------- */

function toggleSource(): void {
  const tab = activeTab();
  if (!tab) return;
  const next = !tab.state.field(uiModeField).source;
  view.dispatch({ effects: setUiMode.of({ source: next }) });
  updateStatus();
}

function toggleFocus(): void {
  const tab = activeTab();
  if (!tab) return;
  const next = !tab.state.field(uiModeField).focus;
  view.dispatch({ effects: setUiMode.of({ focus: next }) });
  view.focus();
  toast(next ? t('toast.focusOn') : t('toast.focusOff'));
}

function toggleTypewriter(): void {
  const tab = activeTab();
  if (!tab) return;
  const next = !tab.state.field(uiModeField).typewriter;
  view.dispatch({ effects: setUiMode.of({ typewriter: next }) });
  if (next) centerCaret();
  toast(next ? t('toast.typewriterOn') : t('toast.typewriterOff'));
}

/* ----------------------------------- theme --------------------------------- */

const THEMES = ['paper', 'github', 'sepia', 'night', 'moss-dark'];

function applyTheme(name: string): void {
  document.documentElement.dataset.theme = name;
  localStorage.setItem('moss.theme', name);
  dom.themeSelect.value = name;

  const dark = name === 'night' || name === 'moss-dark';
  const mark = document.querySelector<HTMLImageElement>('.brand-icon');
  if (mark) mark.src = dark ? './mark-light.png' : './mark-dark.png';

  syncWindowChrome();
}

/** Keeps the native window frame (title bar overlay) in step with the theme. */
function syncWindowChrome(): void {
  const shell = (window as any).moss;
  if (!shell?.setTheme) return;

  const styles = getComputedStyle(document.documentElement);
  shell.setTheme({
    color: styles.getPropertyValue('--bg').trim(),
    symbolColor: styles.getPropertyValue('--fg-dim').trim(),
  });
}

/* ----------------------------------- menus --------------------------------- */

type MenuItem =
  | { kind: 'item'; label: string; hint?: string; action: () => void }
  | { kind: 'sep' }
  | { kind: 'label'; text: string };

function closeMenu(): void {
  dom.menu.classList.add('hidden');
}

function openMenu(items: MenuItem[], x: number, y: number): void {
  dom.menu.innerHTML = '';

  for (const item of items) {
    if (item.kind === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'menu-sep';
      dom.menu.appendChild(sep);
      continue;
    }
    if (item.kind === 'label') {
      const label = document.createElement('div');
      label.className = 'menu-label';
      label.textContent = item.text;
      dom.menu.appendChild(label);
      continue;
    }

    const button = document.createElement('button');
    button.className = 'menu-item';
    const left = document.createElement('span');
    left.textContent = item.label;
    button.appendChild(left);
    if (item.hint) {
      const hint = document.createElement('span');
      hint.className = 'k';
      hint.textContent = item.hint;
      button.appendChild(hint);
    }
    button.addEventListener('click', () => {
      closeMenu();
      item.action();
    });
    dom.menu.appendChild(button);
  }

  dom.menu.style.left = '0px';
  dom.menu.style.top = '0px';
  dom.menu.classList.remove('hidden');

  const rect = dom.menu.getBoundingClientRect();
  dom.menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 12))}px`;
  dom.menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 12))}px`;
}

function buildMenu(): MenuItem[] {
  const tab = activeTab();
  const mode = tab?.state.field(uiModeField) ?? { source: false, focus: false, typewriter: false };
  const mark = (on: boolean): string => (on ? '✓ ' : '');

  return [
    { kind: 'item', label: t('menu.openFile'), hint: 'Ctrl O', action: () => void openFile() },
    { kind: 'item', label: t('menu.openFolder'), hint: 'Ctrl ⇧ O', action: () => void openFolder() },
    { kind: 'item', label: t('menu.new'), hint: 'Ctrl N', action: () => newTab({ name: untitledName(), text: '' }) },
    { kind: 'item', label: t('menu.save'), hint: 'Ctrl S', action: () => void saveTab() },
    { kind: 'item', label: t('menu.closeTab'), hint: 'Ctrl W', action: () => closeTab(activeId) },
    { kind: 'item', label: t('menu.closeAll'), hint: 'Ctrl ⇧ W', action: closeAllTabs },
    { kind: 'sep' },
    { kind: 'item', label: t('menu.exportHtml'), action: exportHtml },
    { kind: 'item', label: t('menu.print'), action: printDocument },
    { kind: 'sep' },
    {
      kind: 'item',
      label: `${mark(mode.source)}${t('menu.source')}`,
      hint: 'Ctrl /',
      action: toggleSource,
    },
    {
      kind: 'item',
      label: `${mark(mode.focus)}${t('menu.focus')}`,
      hint: 'Ctrl ⇧ F',
      action: toggleFocus,
    },
    {
      kind: 'item',
      label: `${mark(mode.typewriter)}${t('menu.typewriter')}`,
      hint: 'F8',
      action: toggleTypewriter,
    },
    { kind: 'item', label: t('menu.sidebar'), hint: 'Ctrl \\', action: toggleSidebar },
    { kind: 'sep' },
    { kind: 'label', text: t('menu.theme') },
    ...THEMES.map<MenuItem>((theme) => ({
      kind: 'item',
      label: `${mark(document.documentElement.dataset.theme === theme)}${t(
        `theme.${theme === 'moss-dark' ? 'mossDark' : theme}`,
      )}`,
      action: () => applyTheme(theme),
    })),
    { kind: 'sep' },
    { kind: 'label', text: t('menu.language') },
    {
      kind: 'item',
      label: `${mark(getLocale() === 'zh')}中文`,
      action: () => setLocale('zh'),
    },
    {
      kind: 'item',
      label: `${mark(getLocale() === 'en')}English`,
      action: () => setLocale('en'),
    },
  ];
}

/* ----------------------------------- toast --------------------------------- */

function toast(message: string): void {
  dom.toast.textContent = message;
  dom.toast.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.add('hidden'), 1700);
}

/* ----------------------------------- wiring -------------------------------- */

function wire(): void {
  $('#btn-menu').addEventListener('click', (event) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openMenu(buildMenu(), rect.right - 226, rect.bottom + 6);
  });

  $('#btn-new').addEventListener('click', () => newTab({ name: untitledName(), text: '' }));
  $('#btn-open-file').addEventListener('click', () => void openFile());
  $('#btn-open-folder').addEventListener('click', () => void openFolder());
  $('#btn-hide-side').addEventListener('click', toggleSidebar);
  dom.btnShowSide.addEventListener('click', toggleSidebar);
  dom.btnMode.addEventListener('click', toggleSource);
  dom.themeSelect.addEventListener('change', () => applyTheme(dom.themeSelect.value));

  document.querySelectorAll<HTMLElement>('.side-tab').forEach((button) => {
    button.addEventListener('click', () => switchPane(button.dataset.pane ?? 'files'));
  });

  document.addEventListener('mousedown', (event) => {
    if (!dom.menu.classList.contains('hidden') && !dom.menu.contains(event.target as Node)) {
      closeMenu();
    }
  });

  window.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (!mod) {
      if (event.key === 'F8') {
        event.preventDefault();
        toggleTypewriter();
      }
      if (event.key === 'Escape') closeMenu();
      return;
    }

    if (key === 's') {
      event.preventDefault();
      void saveTab();
    } else if (key === 'o' && event.shiftKey) {
      event.preventDefault();
      void openFolder();
    } else if (key === 'o') {
      event.preventDefault();
      void openFile();
    } else if (key === 'n') {
      event.preventDefault();
      newTab({ name: untitledName(), text: '' });
    } else if (key === 'w') {
      event.preventDefault();
      if (event.shiftKey) closeAllTabs();
      else closeTab(activeId);
    } else if (key === '/') {
      event.preventDefault();
      toggleSource();
    } else if (key === '\\') {
      event.preventDefault();
      toggleSidebar();
    } else if (key === 'f' && event.shiftKey) {
      event.preventDefault();
      toggleFocus();
    }
  });

  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', async (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const text = await file.text();
    newTab({ name: file.name, text });
  });

  const shell = (window as any).moss;

  if (shell?.onBeforeClose) {
    shell.onBeforeClose(() => {
      closeCellEditor(false);
      const dirty = tabs.filter((tab) => tab.dirty).length;
      shell.closeResponse(
        dirty,
        dirty
          ? {
              title: 'Moss',
              message: t('close.message', { n: dirty }),
              detail: t('close.detail'),
              cancel: t('close.cancel'),
              discard: t('close.discard'),
            }
          : undefined,
      );
    });
  } else {
    window.addEventListener('beforeunload', (event) => {
      if (tabs.some((tab) => tab.dirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  }
}

/* ----------------------------------- boot ---------------------------------- */

function openNativeDocument(doc: { path: string; name: string; text: string }): void {
  const existing = tabs.find((tab) => tab.nativePath === doc.path);
  if (existing) {
    activate(existing.id);
    return;
  }
  newTab({ name: doc.name, text: doc.text, path: doc.path, nativePath: doc.path });
}

function init(): void {
  if ((window as any).moss?.desktop) document.documentElement.classList.add('desktop');
  applyStatic(document);
  applyTheme(localStorage.getItem('moss.theme') ?? 'paper');
  createView();
  wire();

  const shell = (window as any).moss;
  const startup = shell?.takeStartupFile ? shell.takeStartupFile() : Promise.resolve(null);

  Promise.resolve(startup)
    .then((doc: any) => {
      if (doc) {
        openNativeDocument(doc);
        return;
      }
      newTab({ name: `${t('doc.welcome')}.md`, text: welcomeText() });
    })
    .catch(() => {
      newTab({ name: `${t('doc.welcome')}.md`, text: welcomeText() });
    });

  shell?.onOpenFile?.((doc: any) => openNativeDocument(doc));

  onLocaleChange(() => {
    applyStatic(document);
    renderTabs();
    updateStatus();
    renderTreeNow();
    renderOutlineNow();
  });

  window.setInterval(() => {
    void pollWatchedFiles();
  }, 2500);

  window.addEventListener('focus', () => {
    void refreshTree();
  });

  // Exposed for local scripting and screenshot automation.
  (window as any).__moss = {
    get view() {
      return view;
    },
    get tabs() {
      return tabs;
    },
    newTab,
    applyTheme,
    toggleSource,
    setLocale,
    readTree,
  };
}

init();
