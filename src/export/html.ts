import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false }) as string;
}

const PRINT_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0 auto;
  padding: 48px 24px 96px;
  max-width: 760px;
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.72;
  color: #2b2b2b;
  background: #fff;
}
h1, h2, h3, h4, h5, h6 { line-height: 1.3; margin: 1.6em 0 .6em; font-weight: 650; }
h1 { font-size: 2em; margin-top: 0; }
h2 { font-size: 1.5em; padding-bottom: .25em; border-bottom: 1px solid #eee; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.05em; }
p { margin: .85em 0; }
a { color: #2f7a5f; text-decoration: none; border-bottom: 1px solid rgba(47,122,95,.35); }
blockquote {
  margin: 1em 0; padding: .2em 1.1em; color: #6b6b66;
  border-left: 3px solid #e2ded6; font-style: italic;
}
code { font-family: "JetBrains Mono", Consolas, monospace; font-size: .88em;
  background: #f6f5f1; padding: .14em .34em; border-radius: 4px; }
pre { background: #f6f5f1; padding: 14px 16px; border-radius: 8px; overflow-x: auto; line-height: 1.55; }
pre code { background: none; padding: 0; font-size: .86em; }
img { max-width: 100%; border-radius: 6px; }
hr { border: none; border-top: 1px solid #e6e4df; margin: 2em 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .92em; }
th, td { border: 1px solid #e2ded6; padding: 7px 11px; text-align: left; }
thead th { background: #f7f6f3; }
ul, ol { padding-left: 1.5em; }
li { margin: .25em 0; }
li input[type="checkbox"] { margin-right: .4em; accent-color: #2f6f5f; }
.katex-display { overflow-x: auto; overflow-y: hidden; padding: .3em 0; }
@page { margin: 18mm 16mm; }
@media print { body { padding: 0; max-width: none; } }
`;

export function standaloneHtml(title: string, markdown: string): string {
  const body = renderMarkdown(markdown);
  const safeTitle = title.replace(/[<>&]/g, '');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
<style>${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
