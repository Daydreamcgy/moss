import type { TreeEntry } from '../io/files';
import { t } from '../i18n';

const expanded = new Set<string>();

export interface TreeHandlers {
  onOpenFile: (entry: TreeEntry) => void;
  activePath: string | null;
  emptyText?: string;
}

export function resetTreeExpansion(): void {
  expanded.clear();
}

export function renderTree(container: HTMLElement, entries: TreeEntry[] | null, handlers: TreeHandlers): void {
  container.innerHTML = '';

  if (!entries || entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tree-empty';
    empty.textContent = handlers.emptyText ?? t('tree.empty');
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  const walk = (list: TreeEntry[], depth: number): void => {
    for (const entry of list) {
      const row = document.createElement('div');
      row.className = 'tree-row';
      if (entry.kind === 'file' && entry.path === handlers.activePath) row.classList.add('active');
      row.style.paddingLeft = `${6 + depth * 14}px`;

      const tw = document.createElement('span');
      tw.className = 'tw';
      tw.textContent = entry.kind === 'dir' ? (expanded.has(entry.path) ? '▾' : '▸') : '';

      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = entry.name;

      row.append(tw, nm);
      row.addEventListener('click', () => {
        if (entry.kind === 'dir') {
          if (expanded.has(entry.path)) expanded.delete(entry.path);
          else expanded.add(entry.path);
          renderTree(container, entries, handlers);
          return;
        }
        handlers.onOpenFile(entry);
      });

      fragment.appendChild(row);

      if (entry.kind === 'dir' && expanded.has(entry.path) && entry.children?.length) {
        walk(entry.children, depth + 1);
      }
    }
  };

  walk(entries, 0);
  container.appendChild(fragment);
}
