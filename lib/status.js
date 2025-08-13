import { els } from './dom.js';

export function setStatus(msg) {
  const el = els.status();
  if (el) el.textContent = msg || '';
}

export function wireGlobalErrorStatus() {
  window.addEventListener('error', (e) =>
    setStatus('JS 錯誤：' + (e?.error?.message || e.message))
  );
  window.addEventListener('unhandledrejection', (e) =>
    setStatus('Promise 錯誤：' + (e?.reason?.message || e.reason))
  );
}
