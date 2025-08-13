const BASE = 'https://fsis.thu.edu.tw/wwwstud/info/MustList-submajr-server.php';
const FORM_PAGE = 'https://fsis.thu.edu.tw/wwwstud/info/MustList.php';

async function fetchWithTimeout(input, init = {}, ms = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'LOAD_SETYEAR_OPTIONS') {
        const res = await fetchWithTimeout(FORM_PAGE, { method: 'GET' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        sendResponse({ ok: true, html });
        return;
      }

      if (message.type === 'LOAD_MAJR_OPTIONS') {
        const url = `${BASE}?job=majr`;
        const body = new URLSearchParams();
        body.set('ic-request', 'true');
        body.set('ic-element-id', 'main');
        body.set('ic-element-name', 'main');
        body.set('ic-id', '1');
        body.set('ic-target-id', 'majrout');
        body.set('ic-trigger-id', 'main');
        body.set('ic-trigger-name', 'main');
        body.set('ic-current-url', '/wwwstud/info/MustList.php');

        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        sendResponse({ ok: true, html });
        return;
      }

      if (message.type === 'LOAD_SUBMAJR_OPTIONS') {
        const url = new URL(`${BASE}?job=group`);
        const body = url.searchParams;
        body.set('ic-request', 'true');
        body.set('ic-element-id', 'majr');
        body.set('ic-element-name', 'majr');
        body.set('ic-id', '3');
        body.set('ic-target-id', 'submajr');
        body.set('ic-trigger-id', 'majr');
        body.set('ic-trigger-name', 'majr');
        body.set('ic-current-url', '/wwwstud/info/MustList.php');
        body.set('majr', String(message.payload.majr));
        body.set('stype', String(message.payload.stype));

        const res = await fetchWithTimeout(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        sendResponse({ ok: true, html });
        return;
      }

      if (message.type === 'FETCH_MUSTLIST') {
        const { setyear, stype, majr, subMajr } = message.payload;
        const url = `${BASE}?job=list`;
        const body = new URLSearchParams();
        body.set('ic-request', 'true');
        body.set('setyear', String(setyear));
        body.set('stype', String(stype));
        body.set('majr', String(majr));
        subMajr && body.set('p_grop', String(subMajr));
        body.set('ic-element-id', 'main');
        body.set('ic-element-name', 'main');
        body.set('ic-id', '1');
        body.set('ic-target-id', 'outputdiv');
        body.set('ic-trigger-id', 'main');
        body.set('ic-trigger-name', 'main');
        body.set('ic-current-url', '/wwwstud/info/MustList.php');

        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        sendResponse({ ok: true, html });
        return;
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true; // keep channel open for async sendResponse
});

let appWindowId = null;

chrome.action.onClicked.addListener(async () => {
  if (appWindowId !== null) {
    try {
      await chrome.windows.update(appWindowId, { focused: true });
      return;
    } catch {
      appWindowId = null;
    }
  }
  const url = chrome.runtime.getURL('popup.html');
  const w = await chrome.windows.create({ url, type: 'popup', width: 1100, height: 800 });
  appWindowId = w.id;
});

chrome.windows.onRemoved.addListener((wid) => { if (wid === appWindowId) appWindowId = null; });
