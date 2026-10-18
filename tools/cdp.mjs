import fs from 'node:fs';

const [, , url, out, exprArg = '', w = '1440', h = '900', waitMs = '1400'] = process.argv;
const expr = exprArg.startsWith('@') ? fs.readFileSync(exprArg.slice(1), 'utf8') : exprArg;
const base = 'http://127.0.0.1:9222';

const list = await (await fetch(`${base}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

await new Promise((resolve) => ws.addEventListener('open', resolve));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(w),
  height: Number(h),
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });
await new Promise((resolve) => setTimeout(resolve, Number(waitMs)));

if (expr) {
  const result = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    console.error('EVAL_ERROR', JSON.stringify(result.exceptionDetails).slice(0, 600));
  } else {
    console.log('EVAL_OK', JSON.stringify(result.result?.value ?? null).slice(0, 600));
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('WROTE', out);
ws.close();
