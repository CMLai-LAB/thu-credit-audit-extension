import { els } from './dom.js';
import { setStatus } from './status.js';
import { parseYearOptions, pickLatestNumeric, renderOptions, parseMajrOptions } from './options.js';
import { parseMustTable, renderTable } from './table.js';
import { setLastRows } from './store.js';

export async function loadYears() {
  setStatus('載入學年度清單…');
  const { ok, html, error } = await chrome.runtime.sendMessage({ type: 'LOAD_SETYEAR_OPTIONS' });
  if (!ok) { setStatus('學年度載入失敗：' + error); return; }

  const years = parseYearOptions(html);
  if (!years.length) {
    renderOptions(els.setyear(), [{ value: '114', text: '114' }], '114');
    setStatus('找不到遠端學年度，下拉以後援資料顯示');
    return;
  }
  const latest = pickLatestNumeric(years);
  renderOptions(els.setyear(), years, latest);
  setStatus(`學年度已載入（預設：${latest}）`);
}

function renderMajrOptionsInDOM(opts) {
  const sel = els.majr();
  sel.innerHTML = '';
  for (const o of opts) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.text;
    sel.appendChild(op);
  }
}

export async function loadMajr() {
  setStatus('載入學系清單…');
  const { ok, html, error } = await chrome.runtime.sendMessage({
    type: 'LOAD_MAJR_OPTIONS',
    payload: { stype: els.stype().value }
  });
  if (!ok) { setStatus('載入失敗：' + error); return; }
  const opts = parseMajrOptions(html);
  if (!opts.length) {
    setStatus('找不到學系清單，可能站方回傳格式變更');
  } else {
    renderMajrOptionsInDOM(opts);
    setStatus('學系清單已載入');
  }
}

export async function handleFetch() {
  setStatus('查詢中…');
  els.result().innerHTML = '';
  els.exportBtn().disabled = true;
  setLastRows({ columns: [], rows: [] });

  const setyear = els.setyear().value;
  const stype = els.stype().value;
  const majr  = els.majr().value;

  const { ok, html, error } = await chrome.runtime.sendMessage({
    type: 'FETCH_MUSTLIST',
    payload: { setyear, stype, majr }
  });
  if (!ok) { setStatus('查詢失敗：' + error); return; }

  const parsed = parseMustTable(html);
  setLastRows(parsed);
  renderTable(parsed);
  setStatus('完成');
}
