export type Locale = 'zh' | 'en';

const zh: Record<string, string> = {
  'nav.files': '文件',
  'nav.outline': '大纲',

  'btn.openFile': '打开文件',
  'btn.openFolder': '打开文件夹',
  'btn.hideSide': '收起侧栏',
  'btn.showSide': '展开侧栏',
  'btn.new': '新建文档 (Ctrl+N)',
  'btn.menu': '菜单',
  'btn.mode': '切换源码模式 (Ctrl+/)',

  'status.untitled': '未命名',
  'status.words': '{n} 字',
  'status.chars': '{n} 字符',
  'status.live': '实时',
  'status.source': '源码',
  'status.theme': '主题',

  'theme.paper': '纸张',
  'theme.github': 'GitHub',
  'theme.sepia': '棕褐',
  'theme.night': '夜间',
  'theme.mossDark': '苔绿',

  'tree.empty': '还没有打开文件夹。点“打开文件夹”浏览目录，或把 .md 文件直接拖进窗口。',
  'tree.noMatch': '这个文件夹里没有可编辑的文档（.md / .txt）。',
  'outline.empty': '还没有标题。以 # 开头的行会自动出现在这里。',

  'menu.openFile': '打开文件…',
  'menu.openFolder': '打开文件夹…',
  'menu.new': '新建文档',
  'menu.save': '保存',
  'menu.closeTab': '关闭当前标签',
  'menu.closeAll': '关闭全部标签',
  'menu.exportHtml': '导出 HTML…',
  'menu.print': '打印 / PDF',
  'menu.source': '源码模式',
  'menu.focus': '专注模式',
  'menu.typewriter': '打字机模式',
  'menu.sidebar': '收起 / 展开侧栏',
  'menu.theme': '主题',
  'menu.language': '语言',

  'toast.fsUnsupported': '这个浏览器不支持文件系统访问，请改用 Chrome 或 Edge',
  'toast.folderOpened': '已打开文件夹“{name}”',
  'toast.readFailed': '无法读取 {name}',
  'toast.saved': '已保存',
  'toast.saveFailed': '保存失败——授权可能已过期',
  'toast.downloaded': '已下载',
  'toast.exported': '已导出 HTML',
  'toast.popupBlocked': '弹窗被浏览器拦截',
  'toast.focusOn': '已开启专注模式',
  'toast.focusOff': '已关闭专注模式',
  'toast.typewriterOn': '已开启打字机模式',
  'toast.typewriterOff': '已关闭打字机模式',
  'toast.reloaded': '已从磁盘重新载入“{name}”',
  'toast.changed': '“{name}”已被外部修改——保存会覆盖，或关闭后不保存',

  'prompt.close': '关闭“{name}”且不保存？',
  'prompt.closeAll': '有 {n} 个文档还没保存，关闭全部会丢掉这些改动。继续？',
  'close.message': '还有 {n} 个文档没有保存',
  'close.detail': '关闭后这些改动会丢失，且无法恢复。',
  'close.cancel': '取消',
  'close.discard': '不保存并关闭',
  'doc.untitled': '未命名',
  'doc.welcome': '欢迎',
};

const en: Record<string, string> = {
  'nav.files': 'Files',
  'nav.outline': 'Outline',

  'btn.openFile': 'Open file',
  'btn.openFolder': 'Open folder',
  'btn.hideSide': 'Hide sidebar',
  'btn.showSide': 'Show sidebar',
  'btn.new': 'New document (Ctrl+N)',
  'btn.menu': 'Menu',
  'btn.mode': 'Toggle source mode (Ctrl+/)',

  'status.untitled': 'Untitled',
  'status.words': '{n} words',
  'status.chars': '{n} chars',
  'status.live': 'Live',
  'status.source': 'Source',
  'status.theme': 'Theme',

  'theme.paper': 'Paper',
  'theme.github': 'GitHub',
  'theme.sepia': 'Sepia',
  'theme.night': 'Night',
  'theme.mossDark': 'Moss Dark',

  'tree.empty': 'No folder open. Use “Open folder” to browse a directory, or drop a .md file anywhere on the window.',
  'tree.noMatch': 'No editable documents (.md / .txt) in this folder.',
  'outline.empty': 'No headings yet. Start a line with # to build an outline.',

  'menu.openFile': 'Open file…',
  'menu.openFolder': 'Open folder…',
  'menu.new': 'New document',
  'menu.save': 'Save',
  'menu.closeTab': 'Close tab',
  'menu.closeAll': 'Close all tabs',
  'menu.exportHtml': 'Export HTML…',
  'menu.print': 'Print / PDF',
  'menu.source': 'Source mode',
  'menu.focus': 'Focus mode',
  'menu.typewriter': 'Typewriter mode',
  'menu.sidebar': 'Toggle sidebar',
  'menu.theme': 'Theme',
  'menu.language': 'Language',

  'toast.fsUnsupported': 'This browser has no File System Access API — use Chrome or Edge',
  'toast.folderOpened': 'Opened folder “{name}”',
  'toast.readFailed': 'Could not read {name}',
  'toast.saved': 'Saved',
  'toast.saveFailed': 'Save failed — permission may have expired',
  'toast.downloaded': 'Downloaded',
  'toast.exported': 'Exported HTML',
  'toast.popupBlocked': 'Popup blocked',
  'toast.focusOn': 'Focus mode on',
  'toast.focusOff': 'Focus mode off',
  'toast.typewriterOn': 'Typewriter mode on',
  'toast.typewriterOff': 'Typewriter mode off',
  'toast.reloaded': 'Reloaded “{name}” from disk',
  'toast.changed': '“{name}” changed on disk — save to overwrite, or close without saving',

  'prompt.close': 'Close “{name}” without saving?',
  'prompt.closeAll': '{n} document(s) have unsaved changes. Close everything and discard them?',
  'close.message': '{n} document(s) have unsaved changes',
  'close.detail': 'Closing now will discard them.',
  'close.cancel': 'Cancel',
  'close.discard': 'Close without saving',
  'doc.untitled': 'Untitled',
  'doc.welcome': 'Welcome',
};

const dictionaries: Record<Locale, Record<string, string>> = { zh, en };

const stored = localStorage.getItem('moss.locale');
let current: Locale = stored === 'en' || stored === 'zh' ? stored : 'zh';

type Listener = (locale: Locale) => void;
const listeners = new Set<Listener>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  localStorage.setItem('moss.locale', locale);
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  applyStatic(document);
  listeners.forEach((listener) => listener(locale));
}

export function onLocaleChange(listener: Listener): void {
  listeners.add(listener);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let value = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

export function applyStatic(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n as string);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle as string);
  });
}

document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
