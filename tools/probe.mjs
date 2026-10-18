import fs from 'node:fs';

const port = process.argv[2] ?? '9222';
const arg = process.argv[3] ?? '1';
const expr = arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8') : arg;

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((target) => target.type === 'page');
if (!page) throw new Error('no page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

await new Promise((resolve) => ws.addEventListener('open', resolve));

const result = await send('Runtime.evaluate', {
  expression: expr,
  awaitPromise: true,
  returnByValue: true,
});

if (result.exceptionDetails) {
  console.error('EVAL_ERROR', JSON.stringify(result.exceptionDetails).slice(0, 400));
  process.exitCode = 1;
} else {
  console.log('EVAL_OK', JSON.stringify(result.result?.value ?? null).slice(0, 800));
}

ws.close();
