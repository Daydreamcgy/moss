# Moss

A quiet Markdown editor. You type into the text and the page takes shape around it — no preview pane, because the sentence you are reading *is* the source.

> Good tools disappear. What is left is the sentence you were trying to write.

## What already works

- **Live styling** — headings, **bold**, *italic*, `inline code`, ~~strikethrough~~ and [links](https://example.com) render while you type.
- **Structure** — quotes, lists, task lists and rules are drawn in place.
- **Math** — inline like $E = mc^2$, and display:

$$\int_{-\infty}^{\infty} e^{-x^{2}}\,dx = \sqrt{\pi}$$

- **Code** — fenced blocks keep syntax highlighting, with the fence itself faded out.
- **Tables** — rendered as real tables until your caret steps inside one.

### Code

```ts
type Note = { title: string; body: string };

export function wordCount(note: Note): number {
  const cjk = (note.body.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = note.body.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}
```

### Keys

| Action | Shortcut | Notes |
| --- | --- | --- |
| Live / source | `Ctrl` + `/` | toggle the syntax layer |
| Focus mode | `Ctrl` + `Shift` + `F` | dim every line but yours |
| Typewriter | `F8` | keep the caret mid-screen |
| Bold / italic | `Ctrl` + `B` / `Ctrl` + `I` | wraps the selection |
| Heading | `Ctrl` + `1` … `6` | `Ctrl` + `0` clears it |
| Save | `Ctrl` + `S` | writes back to the opened file |

### Today

- [x] Parse Markdown as you type
- [x] Render math, tables and images in place
- [x] Tabs, folder tree, outline
- [ ] Export a clean standalone HTML
- [ ] Sync scroll between outline and text

---

Put the caret inside anything above — the underlying syntax reappears, dimmed, so you can edit it directly. Move the caret away and it fades back into the page.
