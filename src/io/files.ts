export interface TreeEntry {
  name: string;
  path: string;
  kind: 'file' | 'dir';
  handle: any;
  children?: TreeEntry[];
}

const IGNORED = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  '.turbo',
  '__pycache__',
  '.DS_Store',
]);

/** Only these make sense in a text editor; everything else stays out of the tree. */
const DOCUMENT_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd', 'mdx', 'txt']);

function isDocument(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  return DOCUMENT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

let entryBudget = 4000;

export function supportsFileSystem(): boolean {
  return typeof (window as any).showOpenFilePicker === 'function';
}

async function collect(dirHandle: any, base: string, depth: number): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = [];
  if (depth > 8) return entries;

  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (IGNORED.has(name) || name.startsWith('.')) continue;
    if (handle.kind !== 'directory' && !isDocument(name)) continue;
    if (entryBudget-- <= 0) break;

    const path = base ? `${base}/${name}` : name;
    if (handle.kind === 'directory') {
      entries.push({ name, path, kind: 'dir', handle, children: [] });
    } else {
      entries.push({ name, path, kind: 'file', handle });
    }
  }

  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  for (const entry of entries) {
    if (entry.kind === 'dir' && depth < 3) {
      entry.children = await collect(entry.handle, entry.path, depth + 1);
    }
  }

  // Drop folders that were scanned and hold no documents at all.
  return entries.filter(
    (entry) => entry.kind === 'file' || entry.children === undefined || entry.children.length > 0,
  );
}

export async function pickFile(): Promise<{ handle: any; name: string; text: string } | null> {
  try {
    const handles = await (window as any).showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: 'Markdown',
          accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.txt'] },
        },
      ],
    });
    const handle = handles?.[0];
    if (!handle) return null;
    const file = await handle.getFile();
    const text = await file.text();
    return { handle, name: handle.name, text };
  } catch {
    return null;
  }
}

export async function pickFolder(): Promise<{ handle: any; name: string; tree: TreeEntry[] } | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    if (!handle) return null;
    entryBudget = 4000;
    const tree = await collect(handle, '', 0);
    return { handle, name: handle.name, tree };
  } catch {
    return null;
  }
}

export async function readHandle(handle: any): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function readTree(handle: any): Promise<TreeEntry[]> {
  entryBudget = 4000;
  return collect(handle, '', 0);
}

export async function statHandle(handle: any): Promise<number> {
  try {
    const file = await handle.getFile();
    return file.lastModified;
  } catch {
    return 0;
  }
}

export async function writeHandle(handle: any, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export function downloadText(text: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const objectUrls = new Map<string, string>();

export function makeImageResolver(dir: any | null) {
  if (!dir) return null;

  return (rawSrc: string): string | Promise<string> | null => {
    if (/^(https?:|data:|blob:|file:)/i.test(rawSrc)) return rawSrc;

    let src = rawSrc;
    try {
      src = decodeURIComponent(src);
    } catch {
      /* keep raw */
    }
    if (src.startsWith('/')) return null;

    const key = `${dir.name}|${src}`;
    const cached = objectUrls.get(key);
    if (cached) return cached;

    return (async () => {
      const parts = src.replace(/^\.\//, '').split('/').filter(Boolean);
      const filename = parts.pop();
      if (!filename) throw new Error('empty image path');
      let cursor = dir;
      for (const part of parts) {
        if (part === '..') {
          cursor = await cursor.getParent?.();
          if (!cursor) throw new Error('outside folder');
          continue;
        }
        cursor = await cursor.getDirectoryHandle(part);
      }
      const handle = await cursor.getFileHandle(filename);
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      objectUrls.set(key, url);
      return url;
    })();
  };
}
