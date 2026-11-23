// Offline check for the production build, using a separate headless Chrome
// with its own temporary profile (the user's Chrome profile is not touched).
//
//   node scripts/verify_offline.mjs online  <profileDir> [url]   # server running
//   node scripts/verify_offline.mjs offline <profileDir> [url]   # server stopped
//
// "online" loads the app, waits for the service worker, creates a test
// experiment, and reloads. "offline" must be run after the server is stopped:
// it reopens the same profile and checks the app and its data still load.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const [phase, profile, url = 'http://localhost:4173/'] = process.argv.slice(2);
if (!['online', 'offline'].includes(phase) || !profile) {
  console.error('usage: node scripts/verify_offline.mjs online|offline <profileDir> [url]');
  process.exit(2);
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const chrome = spawn(
  CHROME,
  [`--headless=new`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { stdio: 'ignore' },
);

async function json(path, method = 'GET') {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method });
      return await r.json();
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Chrome did not start');
}

let ws;
let seq = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
  return r.result.value;
}

const result = { phase };
try {
  await json('/json/version');
  const target = await json(`/json/new?about:blank`, 'PUT');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');

  const status = () =>
    evaluate(`(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const keys = await caches.keys();
      let cached = 0;
      for (const k of keys) cached += (await (await caches.open(k)).keys()).length;
      return {
        title: document.title,
        sw: reg?.active?.state ?? null,
        controlled: !!navigator.serviceWorker.controller,
        cached,
        online: navigator.onLine,
        experiments: [...document.querySelectorAll('.row-title')].map((e) => e.textContent),
        heading: document.querySelector('main h2')?.textContent ?? null,
      };
    })()`);

  await send('Page.navigate', { url });
  await sleep(3000);

  if (phase === 'online') {
    result.firstLoad = await status();
    // Create an experiment through the UI form (React-controlled input).
    await evaluate(`(async () => {
      const input = document.getElementById('new-exp-name');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(input, 'Offline check (test)');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
      input.form.requestSubmit();
      await new Promise((r) => setTimeout(r, 800));
      location.hash = '#/';
    })()`);
    await send('Page.reload');
    await sleep(2500);
    result.afterReload = await status();
  } else {
    result.serverReachable = await fetch(url).then(
      () => true,
      () => false,
    );
    result.offlineLoad = await status();
    await evaluate(`location.hash = '#/templates'`);
    await sleep(800);
    result.templatesPage = await evaluate(`document.querySelector('main h2')?.textContent ?? null`);
    await evaluate(`location.hash = '#/'`);
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = `${profile}/offline.png`;
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    result.screenshot = file;
  }
} catch (e) {
  result.error = String(e);
} finally {
  console.log(JSON.stringify(result, null, 2));
  try {
    ws?.close();
  } catch {}
  chrome.kill();
}
