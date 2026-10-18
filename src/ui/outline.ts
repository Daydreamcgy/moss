import { t } from '../i18n';

export interface Heading {
  level: number;
  text: string;
  pos: number;
}

export function extractHeadings(source: string): Heading[] {
  const headings: Heading[] = [];
  const lines = source.split('\n');
  let inFence = false;
  let offset = 0;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
    } else if (!inFence) {
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].replace(/\s+#+\s*$/, '').trim(),
          pos: offset,
        });
      }
    }
    offset += line.length + 1;
  }

  return headings;
}

export function renderOutline(
  container: HTMLElement,
  headings: Heading[],
  onJump: (pos: number) => void,
): void {
  container.innerHTML = '';

  if (headings.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'outline-empty';
    empty.textContent = t('outline.empty');
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const heading of headings) {
    const row = document.createElement('div');
    row.className = `outline-row lv${heading.level}`;
    row.style.paddingLeft = `${6 + (heading.level - 1) * 13}px`;
    row.textContent = heading.text || '(empty heading)';
    row.title = heading.text;
    row.dataset.pos = String(heading.pos);
    row.addEventListener('click', () => onJump(heading.pos));
    fragment.appendChild(row);
  }

  container.appendChild(fragment);
}

/** Highlights the last heading at or above `pos`, and keeps it in view. */
export function highlightOutline(container: HTMLElement, pos: number): void {
  const rows = [...container.querySelectorAll<HTMLElement>('.outline-row')];
  if (rows.length === 0) return;

  let current: HTMLElement | null = null;
  for (const row of rows) {
    row.classList.remove('active');
    const value = Number(row.dataset.pos);
    if (Number.isFinite(value) && value <= pos) current = row;
  }

  if (!current) return;
  current.classList.add('active');

  const box = container.getBoundingClientRect();
  const row = current.getBoundingClientRect();
  if (row.top < box.top + 4 || row.bottom > box.bottom - 4) {
    current.scrollIntoView({ block: 'nearest' });
  }
}
