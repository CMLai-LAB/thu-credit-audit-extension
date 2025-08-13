import { wireGlobalErrorStatus, setStatus } from './status.js';
import { els } from './dom.js';
import { loadYears, loadMajr, handleFetch } from './mustlist_fetch.js';
import { handleExport } from './csv.js';
import { handleCompare } from './actions.js';

wireGlobalErrorStatus();

function bindEvents() {
  els.stype().addEventListener('change', loadMajr);
  els.setyear().addEventListener('change', loadMajr);
  els.fetchBtn().addEventListener('click', handleFetch);
  els.exportBtn().addEventListener('click', handleExport);
  els.compareBtn()?.addEventListener('click', handleCompare);
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  try {
    await loadYears();
  } catch (e) {
    setStatus('初始化年度失敗：' + e);
  }
  try {
    await loadMajr();
  } catch (e) {
    setStatus('初始化學系失敗：' + e);
  }
});
