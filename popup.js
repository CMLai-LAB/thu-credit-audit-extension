window.addEventListener('error', (e) => setStatus('JS 錯誤：' + (e?.error?.message || e.message), 'error'));
window.addEventListener('unhandledrejection', (e) => setStatus('Promise 錯誤：' + (e?.reason?.message || e.reason), 'error'));


const $ = (sel) => document.querySelector(sel);
const statusEl = $('#status');
const resultEl = $('#result');
const setyearEl = $('#setyear');
const stypeEl = $('#stype');
const majrEl = $('#majr');
const subMajrEl = $('#subMajr');
const fetchBtn = $('#fetchBtn');
const exportBtn = $('#exportBtn');
const compareBtn = $('#compareBtn');
const rawFrame = $('#rawFrame');
const refreshYearsBtn = $('#refreshYearsBtn');

let lastRows = [];
let lastReport = null; // ⬅️ 儲存最近一次比對結果
let lastFetchedHtml = ''; // ⬅️ 新增：儲存最近一次校方回傳原始 HTML，供 iframe 失敗時解析
let lastFlattenedCurriculum = null; // ⬅️ 新增：展平後的校方原始課綱表 (matrix)
let lastMustInfo = null; // ⬅️ 新增：最近一次解析出的必修課程資訊（compare 或 export 用）

function setStatus(msg, type = 'info') { 
  statusEl.textContent = msg || ''; 
  // 清除所有状态类
  statusEl.className = 'status';
  // 添加对应的状态类
  if (type && msg) {
    statusEl.classList.add(type);
  }
}

// 友好的错误显示函数
function showError(error, context = '') {
  let message = String(error?.message || error || '未知錯誤');
  
  // 为常见错误提供更友好的消息
  if (message.includes('Failed to fetch')) {
    message = '網路連線失敗，請檢查網路連線或稍後重試';
  } else if (message.includes('Extension context invalidated')) {
    message = '擴充功能需要重新載入，請重新開啟此視窗';
  } else if (message.includes('Cannot access contents')) {
    message = '無法存取頁面內容，請確認已在學校網站上';
  }
  
  if (context) {
    message = `${context}：${message}`;
  }
  
  setStatus(message, 'error');
}

function htmlToDoc(html) {
  const doc = document.implementation.createHTMLDocument('resp');
  doc.documentElement.innerHTML = html;
  return doc;
}

// ===== 全形轉半形（含英數、＋：：等常見符號）=====
function toHalfWidth(str) {
  if (!str) return '';
  return String(str).replace(/[\uFF01-\uFF5E]/g, ch => {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  }).replace(/\u3000/g, ' '); // 全形空白
}

// ===== 學期順序（上=1，下=2，其它盡量拉在後）=====
function termOrder(t) {
  const s = String(t || '').trim();
  if (/^上$/.test(s)) return 1;
  if (/^下$/.test(s)) return 2;
  if (/暑|夏/i.test(s)) return 3;
  // fallback：未知放最後
  return 9;
}

// 比較「(year, term)」誰更新
function isNewer(a, b) {
  // a / b: { year, term }
  const ya = parseInt(a.year, 10) || 0;
  const yb = parseInt(b.year, 10) || 0;
  if (ya !== yb) return ya > yb;
  return termOrder(a.term) > termOrder(b.term);
}

// 使用 iframe + srcdoc 來完全隔離伺服器回傳的 HTML
function renderRawHtmlInIframe(html, baseHref = 'https://fsis.thu.edu.tw/') {
  if (!rawFrame) return;
  const baseTag = `<base href="${baseHref}" target="_blank">`;
  // 注入表格美化樣式
  const injectStyle = `
    <style>
      body { 
        margin: 15px !important;
        background: #f8fafc !important;
        font-family: "Rubik", Helvetica, Arial, serif;
      }

      table {
        border-collapse: collapse !important;
        width: 100% !important;
        margin: 10px 0 !important;
        background: #fff !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        border-radius: 6px !important;
        overflow: hidden !important;
      }

      table td, table th {
        border: 1px solid #d1d5db !important;
        padding: 8px 6px !important;
        vertical-align: middle !important;
        color: #475F7B !important;
      }

      table th {
        background: #f3f4f6 !important;
        font-weight: bold !important;
        color: #475F7B !important;
      }

      table tbody tr:nth-child(odd) {
        background: #f9fafb !important;
      }

      table tbody tr:hover {
        background: #e5e7eb !important;
      }

      /* 統計行美化 */
      table tr:last-child td, table tr:nth-last-child(2) td {
        background: #fef3c7 !important;
        font-weight: bold !important;
        color: #92400e !important;
      }

      /* 鏈接顏色 */
      a {
        text-decoration: none !important;
      }

      a:hover {
        color: #e83e8c !important;
        text-decoration: underline !important;
      }

      /* 標題顏色 */
      h4 {
        color: #468ff7ff !important;
        margin: 20px 0 15px !important;
        font-size: 20px !important;
        font-weight: normal !important;
      }

      /* 說明文字顏色 */
      p {
        color: #6b7280 !important;
        margin: 15px 0 !important;
      }
    </style>
  `;

  
  let srcdoc = '';
  if (/<html[\s>]/i.test(html)) {
    if (/<head[\s>]/i.test(html)) {
      srcdoc = html.replace(/<head[^>]*>/i, (m) => `${m}\n${baseTag}${injectStyle}`);
    } else {
      srcdoc = html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${baseTag}${injectStyle}</head>`);
    }
  } else {
    srcdoc = `<!doctype html><html><head>${baseTag}<meta charset="utf-8">${injectStyle}</head><body>${html}</body></html>`;
  }
  rawFrame.srcdoc = srcdoc;
}

function getSubMajrOptionEl() {
  // 新版：若 #subMajr 為 <select>，直接回傳其目前選項（供取得 value 與顯示文字）
  const sel = document.querySelector('#subMajr');
  if (sel && sel.tagName === 'SELECT') {
    return sel.options[sel.selectedIndex] || sel; // 保持與舊邏輯相容（取 .value / .textContent）
  }
  // 舊版（radio / checkbox）相容邏輯
  return (
    document.querySelector('#subMajr [name="p_grop"]:checked') ||
    document.querySelector('#subMajr [name="p_grop"]') ||
    document.querySelector('#subMajr [name="p_grop[]"]:checked') ||
    document.querySelector('#subMajr [name="p_grop[]"]')
  );
}

// ---------- 解析工具：學年度 / 學系 ----------
function parseYearOptions(html) {
  const doc = htmlToDoc(html);
  const select = doc.querySelector('#setyear, select[name="setyear"]');
  const opts = [];
  if (select) {
    for (const opt of select.querySelectorAll('option')) {
      const value = (opt.value || '').trim();
      const text = (opt.textContent || '').trim();
      if (value) {
        opts.push({ value, text, selected: opt.selected || false });
      }
    }
  }
  return opts;
}

function pickLatestNumeric(options) {
  const nums = options
    .map(o => o.value)
    .filter(v => /^\d+$/.test(v))
    .map(v => parseInt(v, 10));
  if (nums.length === 0) return options[0]?.value ?? '';
  return String(Math.max(...nums));
}

function renderOptions(selectEl, opts, preferred) {
  selectEl.innerHTML = '';
  for (const o of opts) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.text || o.value;
    if (preferred != null) {
      if (String(o.value) === String(preferred)) op.selected = true;
    } else if (o.selected) {
      op.selected = true;
    }
    selectEl.appendChild(op);
  }
}

function parseMajrOptions(html) {
  const doc = htmlToDoc(html);
  const select = doc.querySelector('select[name="majr"]');
  const opts = [];
  if (select) {
    for (const opt of select.querySelectorAll('option')) {
      const value = (opt.value || '').trim();
      const text = (opt.textContent || '').replace(/^[\s\-–]+/, '').trim();
      if (value && value !== 'XXX') opts.push({ value, text });
    }
  }
  return opts;
}

function renderSubMajrOptionsInDOM(html) {
  // 解析出 option 並塞到 select
  if (!subMajrEl) return;
  // 建立暫存節點抽取 option
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const options = Array.from(temp.querySelectorAll('option'));
  subMajrEl.innerHTML = '';
  for (const op of options) {
    if (!op.value) continue;
    const o = document.createElement('option');
    o.value = op.value.trim();
    o.textContent = (op.textContent || '').replace(/^[\s\-–]+/, '').trim();
    subMajrEl.appendChild(o);
  }
}

// ---------- 動態載入 ----------
async function loadYears() {
  setStatus('載入學年度清單…');
  const { ok, html, error } = await chrome.runtime.sendMessage({ type: 'LOAD_SETYEAR_OPTIONS' });
  if (!ok) { setStatus('學年度載入失敗：' + error, 'error'); return; }

  const years = parseYearOptions(html);
  if (!years.length) {
    // 後援：若站方頁面暫時變更，至少維持一個選項避免阻塞
    renderOptions(setyearEl, [{ value: '114', text: '114' }], '114');
    setStatus('找不到遠端學年度，下拉以後援資料顯示');
    return;
  }
  const latest = pickLatestNumeric(years);
  renderOptions(setyearEl, years, latest);
  setStatus(`學年度已載入（預設：${latest}）`, 'success');
}

function renderMajrOptions(opts) {
  majrEl.innerHTML = '';
  for (const o of opts) {
    const op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.text;
    majrEl.appendChild(op);
  }
}

async function loadMajr() {
  setStatus('載入學系清單…');
  const { ok, html, error } = await chrome.runtime.sendMessage({
    type: 'LOAD_MAJR_OPTIONS',
    payload: { stype: stypeEl.value }
  });
  if (!ok) { setStatus('載入失敗：' + error, 'error'); return; }
  const opts = parseMajrOptions(html);
  if (!opts.length) {
    setStatus('找不到學系清單，可能站方回傳格式變更');
  } else {
    renderMajrOptions(opts);
    setStatus('學系清單已載入', 'success');
  }
}

async function loadSubMajr() {
  setStatus('載入組別…');
  const { ok, html, error } = await chrome.runtime.sendMessage({
    type: 'LOAD_SUBMAJR_OPTIONS',
    payload: { stype: stypeEl.value, majr: majrEl.value }
  });
  if (!ok) { setStatus('組別載入失敗：' + error, 'error'); return; }
  const trimmed_html = html.replace(/&nbsp;/g, '');
  renderSubMajrOptionsInDOM(trimmed_html);
  // 嘗試預選第一個
  if (subMajrEl && subMajrEl.options.length) subMajrEl.selectedIndex = 0;
  setStatus('組別已載入', 'success');
}

// ---------- 解析表格 / 渲染 / 匯出 ----------
function parseMustTable(html) {
  const doc = htmlToDoc(html);
  const tables = Array.from(doc.querySelectorAll('table'));
  if (!tables.length) return { columns: [], rows: [] };
  let best = tables[0], maxCells = 0;
  for (const t of tables) {
    const cells = t.querySelectorAll('td,th').length;
    if (cells > maxCells) { maxCells = cells; best = t; }
  }
  const headers = Array.from(best.querySelectorAll('thead th, tr:first-child th, tr:first-child td'))
    .map(th => th.textContent.trim());
  const rows = [];
  const bodyRows = best.tBodies.length ? best.tBodies[0].rows : best.rows;
  for (let i = 1; i < bodyRows.length; i++) {
    const tr = bodyRows[i];
    const cells = Array.from(tr.cells).map(td => td.textContent.trim());
    if (cells.length) rows.push(cells);
  }
  return { columns: headers, rows };
}

function renderTable({ columns, rows }) {
  resultEl.innerHTML = '';
  if (!rows.length) {
    resultEl.innerHTML = '<div class="empty">查無資料或格式未解析</div>';
    exportBtn.disabled = true;
    return;
  }
  const table = document.createElement('table');
  table.className = 'table';
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const c of columns) {
    const th = document.createElement('th');
    th.textContent = c;
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const v of r) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  resultEl.appendChild(table);
  exportBtn.disabled = false;
}

function toCSV(columns, rows) {
  const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const lines = [];
  if (columns.length) lines.push(columns.map(esc).join(','));
  for (const r of (rows || [])) lines.push(r.map(esc).join(','));
  return lines.join('\r\n');
}

function toCSVLine(arr) {
  const fix = (v) => {
    const s = String(v ?? '');
    // 純數字且長度>=12（Excel 常轉科學記號）
    if (/^\d{12,}$/.test(s)) return "'" + s;
    return s;
  };
  const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  return arr.map(x => esc(fix(x))).join(',');
}

function buildCSVWithReport(rawColumns, rawRows, report) {
  const lines = [];

  // 區段1：原始必修表
  lines.push('=== 必修表 Raw Table ===');
  if (rawColumns?.length) lines.push(toCSVLine(rawColumns));
  for (const r of (rawRows || [])) lines.push(toCSVLine(r));
  lines.push(''); // 空行

  // 若沒有比對結果，就只輸出必修表
  if (!report) return lines.join('\r\n');

  // 區段2：比對摘要
  const s = report.summary || {};
  lines.push('=== 比對摘要 Summary ===');
  lines.push(toCSVLine(['已修總學分', s.earnedTotalCredits]));
  lines.push(toCSVLine(['必修應修學分合計', s.mustTotalCredits]));
  lines.push(toCSVLine(['必修已修學分', s.earnedRequiredCredits]));
  lines.push(toCSVLine(['必修尚缺學分', s.missingRequiredCredits]));
  if (s.electiveCreditsTarget != null) {
    lines.push(toCSVLine(['選修應修學分', s.electiveCreditsTarget]));
    lines.push(toCSVLine(['已修選修(估算)', s.earnedElectiveCredits]));
  }
  if (s.graduateCreditsTarget != null) {
    lines.push(toCSVLine(['畢業學分門檻', s.graduateCreditsTarget]));
    lines.push(toCSVLine(['距離畢業尚缺', s.remainingToGraduate]));
  }
  lines.push('');

  // 區段3：已通過的必修
  lines.push('=== 已通過的必修 Passed Required ===');
  lines.push(toCSVLine(['課程名稱', '學分', '學年度', '學期', '選課代號', 'GPA/備註']));
  for (const x of (report.details?.passedRequired || [])) {
    const src = x.source || {};
    lines.push(toCSVLine([x.name, x.credit, src.year, src.term, src.code, src.gpa]));
  }
  lines.push('');

  // 區段4：尚未通過的必修
  lines.push('=== 尚未通過的必修 Missing Required ===');
  lines.push(toCSVLine(['課程名稱', '學分']));
  for (const x of (report.details?.missingRequired || [])) {
    lines.push(toCSVLine([x.name, x.credit]));
  }
  lines.push('');

  // 區段5：已通過但未對上的課（可能是選修或課名不一致）
  lines.push('=== 已通過但未匹配必修的課程 Unmatched Passed ===');
  lines.push(toCSVLine(['學年度', '學期', '選課代號', '科目名稱', '學分', 'GPA/備註']));
  for (const r of (report.details?.unmatchedPassed || [])) {
    lines.push(toCSVLine([r.year, r.term, r.code, r.name, r.credit, r.gpa]));
  }

  return lines.join('\r\n');
}

// ========== 新版：將校方原始（新版）課綱表 + 必修解析 + 比對結果整合輸出 ==========
function flattenCurriculumTable() {
  try {
    const table = findCurriculumTable();
    if (!table) return null;
    // 展平 colSpan / rowSpan
    const matrix = [];
    const rows = Array.from(table.rows);
    for (let r = 0; r < rows.length; r++) {
      const tr = rows[r];
      if (!matrix[r]) matrix[r] = [];
      let cIndex = 0;
      const cells = Array.from(tr.cells);
      for (const cell of cells) {
        // 找到下一個空欄位
        while (matrix[r][cIndex] !== undefined) cIndex++;
        const text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        const colspan = parseInt(cell.colSpan, 10) || 1;
        const rowspan = parseInt(cell.rowSpan, 10) || 1;
        for (let rr = 0; rr < rowspan; rr++) {
          const targetR = r + rr;
            if (!matrix[targetR]) matrix[targetR] = [];
          for (let cc = 0; cc < colspan; cc++) {
            const targetC = cIndex + cc;
            // 若該格已被占用，往後找下一格（理論上不應發生，防護）
            let finalC = targetC;
            while (matrix[targetR][finalC] !== undefined) finalC++;
            matrix[targetR][finalC] = text;
          }
        }
        cIndex += colspan;
      }
    }
    // 去尾端全部空字串欄位（若有）
    for (let i = 0; i < matrix.length; i++) {
      while (matrix[i].length && /^(?:\s*)$/.test(matrix[i][matrix[i].length - 1] || '')) {
        matrix[i].pop();
      }
    }
    return matrix;
  } catch (e) {
    console.warn('展平課綱表失敗：', e);
    return null;
  }
}

function prettifyNameForExport(name){
  if(!name) return '';
  let out = String(name);
  out = out.replace(/^[0-9A-Za-z]+-\s*/, '');
  let changed = true;
  while (changed) {
    changed = false;
    const m = out.match(/^(.*?)(\s*\((?:[^)]|\)[^)]*?)*\)\s*)$/);
    if (m) {
      const full = m[2];
      if (/[A-Za-z]/.test(full)) { out = m[1].trimEnd(); changed = true; continue; }
    }
    out = out.replace(/\s*\((?=[^)]*[A-Za-z])[\s\S]*$/, '');
  }
  return out.trim();
}

function toCSVLineNew(arr){
  const esc = (v) => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const fix = (s) => {
    const str = String(s ?? '');
    if (/^\d{12,}$/.test(str)) return "'" + str; // 避免科學記號
    return str;
  };
  return arr.map(x => esc(fix(x))).join(',');
}

function buildCSVv2() {
  const lines = [];
  // 僅輸出比對結果（需已執行「抓成績＋比對」）
  if (lastReport) {
    lines.push('=== 比對參數 ===');
    const stypeDisplay = (stypeEl.options[stypeEl.selectedIndex]?.textContent || '').trim() || stypeEl.value;
    const majrDisplay  = (majrEl.options[majrEl.selectedIndex]?.textContent  || '').trim() || majrEl.value;
    const subMajrOpt = getSubMajrOptionEl();
    let subMajrDisplay = '';
    if (subMajrOpt) {
      const label = subMajrOpt.closest('label');
      subMajrDisplay = (label ? label.textContent : subMajrOpt.value || '').trim();
    }
    // 參數列：顯示文字 + (代碼)（若文字與代碼不同才加）
    function combine(display, code){
      if (!code) return display;
      return display && display !== code ? `${display} (${code})` : display || code;
    }
    lines.push(toCSVLineNew(['學年度', setyearEl.value]));
    lines.push(toCSVLineNew(['學生類型', combine(stypeDisplay, stypeEl.value)]));
    lines.push(toCSVLineNew(['學系', combine(majrDisplay, majrEl.value)]));
    if (subMajrDisplay) lines.push(toCSVLineNew(['子學系', subMajrDisplay]));
    lines.push('');

    const s = lastReport.summary || {};
    lines.push('=== 比對摘要 Comparison Summary ===');
    lines.push(toCSVLineNew(['已修總學分 Earned Total Credits', s.earnedTotalCredits]));
    lines.push(toCSVLineNew(['必修應修學分合計 Must Total Credits', s.mustTotalCredits]));
    lines.push(toCSVLineNew(['必修已修學分 Earned Required Credits', s.earnedRequiredCredits]));
    lines.push(toCSVLineNew(['必修尚缺學分 Missing Required Credits', s.missingRequiredCredits]));
    if (s.electiveCreditsTarget != null) {
      lines.push(toCSVLineNew(['選修應修學分 Elective Target', s.electiveCreditsTarget]));
      lines.push(toCSVLineNew(['已修選修(估算) Earned Elective', s.earnedElectiveCredits]));
    }
    if (s.graduateCreditsTarget != null) {
      lines.push(toCSVLineNew(['畢業學分門檻 Graduate Credits Target', s.graduateCreditsTarget]));
      lines.push(toCSVLineNew(['距離畢業尚缺 Remaining To Graduate', s.remainingToGraduate]));
    }
    lines.push('');

    lines.push('=== 已通過的必修 Passed Required ===');
    lines.push(toCSVLineNew(['顯示課名 Display Name', '原始課名 Raw Name', '學分 Credit', '學年度 Year', '學期 Term', '選課代號 Code', 'GPA/備註 GPA']));
    for (const x of (lastReport.details?.passedRequired || [])) {
      const src = x.source || {};
      lines.push(toCSVLineNew([prettifyNameForExport(x.name), x.name, x.credit, src.year, src.term, src.code, src.gpa]));
    }
    lines.push('');

    lines.push('=== 尚未通過的必修 Missing Required ===');
    lines.push(toCSVLineNew(['顯示課名 Display Name', '原始課名 Raw Name', '學分 Credit']));
    for (const x of (lastReport.details?.missingRequired || [])) {
      lines.push(toCSVLineNew([prettifyNameForExport(x.name), x.name, x.credit]));
    }
    lines.push('');

    lines.push('=== 已通過但未匹配必修的課程 Unmatched Passed Courses ===');
    lines.push(toCSVLineNew(['學年度 Year', '學期 Term', '選課代號 Code', '科目名稱 Name', '顯示課名 Display Name', '學分 Credit', 'GPA']));
    for (const r of (lastReport.details?.unmatchedPassed || [])) {
      lines.push(toCSVLineNew([r.year, r.term, r.code, r.name, prettifyNameForExport(r.name), r.credit, r.gpa]));
    }
    lines.push('');
  }

  return lines.join('\r\n');
}

// ---------- 事件 ----------
async function handleFetch() {
  setStatus('查詢中…', 'info');
  // 先把自建表格容器清空/隱藏
  resultEl.innerHTML = '';
  resultEl.style.display = 'none';
  exportBtn.disabled = true;
  lastRows = [];
  lastFlattenedCurriculum = null;
  lastMustInfo = null;

  const setyear = setyearEl.value;
  const stype = stypeEl.value;
  const majr = majrEl.value;
  const groupEl = getSubMajrOptionEl();
  const groupVal = groupEl ? (groupEl.value || groupEl.getAttribute('value') || '').trim() : '';
  const payload = groupVal ? { setyear, stype, majr, subMajr: groupVal } : { setyear, stype, majr };

  const { ok, html, error } = await chrome.runtime.sendMessage({
    type: 'FETCH_MUSTLIST',
    payload
  });
  if (!ok) { setStatus('查詢失敗：' + error, 'error'); return; }

  // 儲存原始 HTML（供後續比對離線解析，不依賴 iframe sandbox）
  lastFetchedHtml = html;

  // ▶︎ 直接顯示校方回傳 HTML 到 iframe
  renderRawHtmlInIframe(html, 'https://fsis.thu.edu.tw/');
  
  // ▶︎ 保留解析資料流程（但不渲染自建表格）
  const parsed = parseMustTable(html);
  lastRows = parsed;          // 讓比對/CSV 照常使用
  // 不呼叫 renderTable(parsed)
  // 另外主動展平整份課綱表供新版 CSV 使用
  lastFlattenedCurriculum = flattenCurriculumTable();
  
  // 如果有解析到資料，啟用匯出按鈕
  if (parsed.rows && parsed.rows.length > 0) {
    exportBtn.disabled = false;
  }
  
  setStatus('完成');
}

async function handleExport() {
  if (!lastReport) { setStatus('請先按「抓成績＋比對」再匯出報告'); return; }
  // 僅包含比對報告
  const csv = buildCSVv2();
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const hasReport = !!lastReport;
  const filename = `THU_compare_report_${setyearEl.value}_${stypeEl.value}_${majrEl.value}.csv`;
  chrome.downloads.download({ url, filename, saveAs: true });
}

// 綁定事件
stypeEl.addEventListener('change', loadMajr);
setyearEl.addEventListener('change', loadMajr);
majrEl.addEventListener('change', loadSubMajr);
fetchBtn.addEventListener('click', handleFetch);
exportBtn.addEventListener('click', handleExport);
compareBtn.addEventListener('click', handleCompare);
if (refreshYearsBtn) {
  refreshYearsBtn.addEventListener('click', () => {
    window.location.reload();
  });
}

// 啟動流程：先載年度，再載學系
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadYears();
  } catch (e) {
    setStatus('初始化年度失敗：' + e, 'error');
  }
  try {
    await loadMajr();
  } catch (e) {
    setStatus('初始化學系失敗：' + e, 'error');
  }
});

// ========= 新增：在當前分頁注入程式，擷取「歷年成績」表格 =========
async function scrapeTranscriptFromActiveTab() {
  // 1) 先找「一般視窗(normal) 的作用中分頁」，且 URL 必須是 http/https
  const normalWins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  // 先找目前聚焦的 normal 視窗裡的 active tab
  let targetTab = null;
  const focusedWin = normalWins.find(w => w.focused);
  if (focusedWin) targetTab = focusedWin.tabs.find(t => t.active);

  // 如果沒找到，找最近一個看起來像學校成績頁的分頁
  const allTabs = normalWins.flatMap(w => w.tabs || []);
  if (!targetTab || !/^https?:/i.test(targetTab.url)) {
    targetTab =
      allTabs.find(t => /^https?:/i.test(t.url) && /thu\.edu\.tw/i.test(t.url)) ||
      allTabs.find(t => /^https?:/i.test(t.url));
  }

  if (!targetTab || !/^https?:/i.test(targetTab.url)) {
    throw new Error('找不到可注入的瀏覽器分頁。請先切到學校的「歷年成績」頁，再按一次「抓成績＋比對」。');
  }

  // 安全護欄：避免對 chrome-extension:// 或 chrome:// 注入
  if (/^chrome(-extension)?:\/\//i.test(targetTab.url)) {
    throw new Error('目前聚焦的是擴充視窗。請切到學校的「歷年成績」頁，再按一次「抓成績＋比對」。');
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: targetTab.id },
    func: () => {
      function norm(s){ return String(s||'').trim(); }
      const targetHeaders = ['學年度','學期','選課代號','科目名稱','學分','GPA'];
      function tableMatches(t){
        const firstRow = t.tHead?.rows?.[0] || t.rows?.[0];
        if (!firstRow) return false;
        const headers = Array.from(firstRow.cells).map(th => norm(th.textContent));
        return targetHeaders.every(h => headers.includes(h));
      }
      const tables = Array.from(document.querySelectorAll('table'));
      const table = tables.find(tableMatches);
      if (!table) return { ok:false, error:'找不到符合格式的歷年成績表格' };

      const headRow = table.tHead?.rows?.[0] || table.rows?.[0];
      const headerIdx = {};
      Array.from(headRow.cells).forEach((th, i) => { headerIdx[norm(th.textContent)] = i; });

      const bodyRows = table.tBodies?.[0]?.rows?.length ? table.tBodies[0].rows : Array.from(table.rows).slice(1);
      const records = [];
      for (const tr of bodyRows) {
        const cells = tr.cells; if (!cells || cells.length === 0) continue;
        records.push({
          year:   norm(cells[headerIdx['學年度']]?.textContent),
          term:   norm(cells[headerIdx['學期']]?.textContent),
          code:   norm(cells[headerIdx['選課代號']]?.textContent),
          name:   norm(cells[headerIdx['科目名稱']]?.textContent),
          credit: norm(cells[headerIdx['學分']]?.textContent),
          gpa:    norm(cells[headerIdx['GPA']]?.textContent)
        });
      }
      return { ok:true, data:records };
    }
  });

  if (!result?.ok) throw new Error(result?.error || '擷取失敗');
  return result.data;
}
// ========= 新增：解析「必修科目表」(從 popup 的 #result 內的表格) =========
// 在 #result 找到最可能的「課綱表」：含 必修/選修/畢業學分 等關鍵字者

function findCurriculumTable() {
  // 優先：從 iframe 取（若 sandbox 可讀）
  let tables = [];
  try {
    if (rawFrame?.contentDocument?.body) {
      tables = Array.from(rawFrame.contentDocument.body.querySelectorAll('table'));
    }
  } catch (e) {
    console.warn('存取 iframe 失敗，改用離線 HTML 解析：', e);
  }

  // 後援：如果 iframe 內無表格或取不到，改用 lastFetchedHtml 手動解析
  if (!tables.length && lastFetchedHtml) {
    const temp = document.createElement('div');
    temp.innerHTML = lastFetchedHtml;
    tables = Array.from(temp.querySelectorAll('table'));
  }

  if (!tables.length) throw new Error('尚未查詢到必修表（請先按「查詢」）');

  let best = null, bestScore = -1;
  for (const t of tables) {
    const txt = t.innerText || t.textContent || '';
    let score = 0;
    if (/必修學分數/.test(txt)) score += 5;
    if (/畢業學分數/.test(txt)) score += 5;
    if (/必修\s*Department Required Courses/i.test(txt)) score += 6;
    if (/Required\s*Credits/i.test(txt)) score += 6;
    if (/選修\s*Elective/i.test(txt)) score += 3;
    if (/Elective\s*Credits/i.test(txt)) score += 3;
    if (/必修Department/i.test(txt)) score += 8;
    if (/科.*目.*Required.*Courses/i.test(txt)) score += 7;
    if (t.querySelector('thead')) score += 1;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best || tables[0];
}

// 由表頭或第一筆資料列來推斷「課名欄 / 學分欄」
function detectFirstCourseColumns(table, sectionHeaderRowIndex) {
  // 嘗試從前兩列（複合表頭）找欄位
  const probeRows = [table.rows[0], table.rows[1]].filter(Boolean);
  let headers = [];
  for (const r of probeRows) {
    headers = headers.concat(Array.from(r.cells).map(c => (c.textContent || '').trim()));
  }
  let nameCol = 1;
  let creditCol = 2;
  const nameIdx = headers.findIndex(h => /科.*目|Required\s*Courses/i.test(h));
  if (nameIdx >= 0) nameCol = nameIdx % (table.rows[0].cells.length || (nameIdx + 1));
  const creditIdx = headers.findIndex(h => /學分|Credits/i.test(h));
  if (creditIdx >= 0) creditCol = creditIdx % (table.rows[0].cells.length || (creditIdx + 1));
  return { nameCol, creditCol };
}

function parseMustListFromPopup() {
  const table = findCurriculumTable();
  if (!table) throw new Error('找不到課綱表格');

  // 收集資料列
  const rows = table.tBodies?.[0]?.rows?.length ? Array.from(table.tBodies[0].rows) : Array.from(table.rows).slice(1);
  if (!rows.length) throw new Error('課綱表格沒有資料列');

  // 將每列合併文字，方便偵測區段
  const rowText = (tr) => Array.from(tr.cells).map(td => (td.textContent || '').trim()).join(' ');

  console.log('表格共有', rows.length, '列資料');
  
  // 先掃一遍找到「必修區段標題」所在索引
  let requiredStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const txt = rowText(rows[i]);
    console.log(`第 ${i} 列內容:`, txt);
    if (/必修\s*Department Required Courses/i.test(txt) || 
        /^必修\s*$/.test(txt) || 
        /Required\s*Courses/i.test(txt) ||
        /必修課程|必修科目/i.test(txt) ||
        /必修Department/i.test(txt)) {  // 新增：匹配 "必修Department Required Courses"
      requiredStart = i;
      console.log('找到必修區段標題在第', i, '列');
      break;
    }
  }
  if (requiredStart < 0) throw new Error('未能定位到「必修」區段標題。請檢查開發者工具查看表格內容。');

  // 推斷欄位位置
  const { nameCol, creditCol } = detectFirstCourseColumns(table, requiredStart);
  console.log('推斷欄位位置 - 課名欄:', nameCol, '學分欄:', creditCol);

  const requiredCourses = [];
  let requiredCreditsTarget = null, electiveCreditsTarget = null, graduateCreditsTarget = null;

  // 從必修區段標題那一列開始往下掃，直到遇到「必修學分數 / 選修學分數 / 畢業學分數」
  for (let i = requiredStart; i < rows.length; i++) {
    const tr = rows[i];
    const txt = rowText(tr);

    // 總結列（遇到就停）- 支援中英文格式
    if (/必修學分數|Required\s*Credits/i.test(txt)) { 
      const m = txt.match(/(?:必修學分數|Required\s*Credits).*?(\d+)/i); 
      if (m) {
        requiredCreditsTarget = parseInt(m[1],10); 
        console.log('找到必修學分數:', requiredCreditsTarget);
      }
      // 不 break，繼續找選修/畢業
      continue;
    }
  if (/選修學分數|Elective\s*Credits/i.test(txt)) { 
      const m = txt.match(/(?:選修學分數|Elective\s*Credits).*?(\d+)/i); 
      if (m) {
        electiveCreditsTarget = parseInt(m[1],10);
        console.log('找到選修學分數:', electiveCreditsTarget);
      }
      continue; 
    }
  if (/畢業學分數|Graduated?\s*Credits/i.test(txt)) { 
      const m = txt.match(/(?:畢業學分數|Graduated?\s*Credits).*?(\d+)/i); 
      if (m) {
        graduateCreditsTarget = parseInt(m[1],10);
        console.log('找到畢業學分數:', graduateCreditsTarget);
      }
      continue; 
    }

    // 跳過真正的區段標題列本身，但⚠️它常常「同一列就含第一筆課程」
    // 解析策略：嘗試抓該列的課名欄，如果像「代碼-課名」就一併當課程列收進來
    const cellElement = tr.cells[nameCol];
    if (!cellElement) continue;
    
    // 先嘗試從 <a> 標籤中提取課程名稱
    const linkElement = cellElement.querySelector('a');
    let cellText = '';
    if (linkElement) {
      cellText = linkElement.textContent.trim();
    } else {
      cellText = cellElement.textContent.trim();
    }
    
    if (!cellText) continue;
    
    // 若同列含區段標題 + 課名，抽出「代碼-課名」子字串
    let nameRaw = cellText;
    const mCN = nameRaw.match(/[0-9A-Za-z]{3,}\s*-\s*.*/);
    if (mCN) nameRaw = mCN[0];

    const creditRaw = (tr.cells[creditCol]?.textContent || '').trim();
    const looksLikeCourse =
      /^[0-9A-Za-z]{3,}\s*-\s*/.test(nameRaw) ||
      /專題|論文|研究|導論|實作|實驗|課程|中文|英文|體育|國防/i.test(nameRaw) ||
      /Seminar|Thesis|Masters|Research|English|Chinese|Physical|Defense/i.test(nameRaw); // 如果學分欄是數字，也認為是課程

    if (looksLikeCourse) {
      const credit = parseFloat(creditRaw);

      // 先排除「通識領域」那些非單一課的列
      if (isGeneralEducationAreaRow(nameRaw, creditRaw)) {
        continue;
      }
      console.log('找到課程:', nameRaw, '學分:', credit);
      requiredCourses.push({
        name: nameRaw,
        key:  makeKeyForMust(nameRaw),  // 已正確
        credit: isNaN(credit) ? 0 : credit
      });

    }
  }

  if (!requiredCourses.length) {
    throw new Error('未能解析必修課程列（表格格式可能與預期不同）');
  }
  
  // 如果還沒找到學分數，嘗試從表格的特殊結構中解析
  if (requiredCreditsTarget == null || electiveCreditsTarget == null || graduateCreditsTarget == null) {
    console.log('嘗試從特殊結構中解析學分數...');
    for (let i = 0; i < rows.length; i++) {
      const tr = rows[i];
      if (tr.cells.length >= 3) {
        const cell1 = tr.cells[0]?.textContent?.trim() || '';
        const cell2 = tr.cells[1]?.textContent?.trim() || '';
        const cell3 = tr.cells[2]?.textContent?.trim() || '';
        
        // 檢查是否是學分數總結列
        const combinedText = cell1 + cell2;
        if (/必修學分數.*Required.*Credits/i.test(combinedText) && /^\d+$/.test(cell3)) {
          requiredCreditsTarget = parseInt(cell3, 10);
          console.log('從特殊結構找到必修學分數:', requiredCreditsTarget);
        } else if (/選修學分數.*Elective.*Credits/i.test(combinedText) && /^\d+$/.test(cell3)) {
          electiveCreditsTarget = parseInt(cell3, 10);
          console.log('從特殊結構找到選修學分數:', electiveCreditsTarget);
        } else if (/畢業學分數.*Graduated.*Credits/i.test(combinedText) && /^\d+$/.test(cell3)) {
          graduateCreditsTarget = parseInt(cell3, 10);
          console.log('從特殊結構找到畢業學分數:', graduateCreditsTarget);
        }
      }
    }
  }
  
  if (requiredCreditsTarget == null) {
    requiredCreditsTarget = requiredCourses.reduce((s, x) => s + (x.credit || 0), 0);
  }

  console.log('最終解析結果:', {
    requiredCourses: requiredCourses.length,
    requiredCreditsTarget,
    electiveCreditsTarget,
    graduateCreditsTarget
  });

  return { requiredCourses, requiredCreditsTarget, electiveCreditsTarget, graduateCreditsTarget };
}
// ========= 新增：比對邏輯 =========


function toHalfParen(s){ return s.replace(/（/g,'(').replace(/）/g,')'); }
function chineseOrdinalToRoman(s){
  return s.replace(/一/g,'I').replace(/二/g,'II').replace(/三/g,'III').replace(/四/g,'IV');
}
function romanParenToHash(s){
  // 注意順序：先 III/IV/II，再 I，避免部分替換
  return s
    .replace(/\(III\)/gi,'#3')
    .replace(/\(IV\)/gi,'#4')
    .replace(/\(II\)/gi,'#2')
    .replace(/\(V\)/gi,'#5')
    .replace(/\(I\)/gi,'#1');
}

function bucketizeName(baseName) {
  const raw = toHalfWidth(String(baseName || ''));
  const s = raw.toLowerCase();

  // 中文
  if (/中文/.test(s) || /\bchinese\b/.test(s)) return 'series:chinese';

  // 英文（大一 / 大二）
  if (/大一英/.test(s) || /freshman\s*english/.test(s) || /english.*\b(i|#1|1)\b/.test(s)) return 'series:eng1';
  if (/大二英/.test(s) || /sophomore\s*english/.test(s) || /english.*\b(ii|#2|2)\b/.test(s)) return 'series:eng2';

  // 體育（0 學分但須通過）
  if (/大一體育|physical education.*(i|1)/i.test(s)) return 'series:pe1';
  if (/大二體育|physical education.*(ii|2)/i.test(s)) return 'series:pe2';
  if (/體育|sports|physical education/i.test(s)) return 'series:pe';

  // 國防（0 學分但須通過）
  if (/全民國防教育|all[- ]?out\s*defense|national\s*defense/i.test(s)) return 'series:defense';

  // AI 思維 與 4 門替代課 → 視為同一必修
  if (/ai思維與程式設計|ai\s*thinking|basic\s*program/i.test(s)) return 'series:ai_basic';
  if (/web程式設計|web\s*program/i.test(s)) return 'series:ai_basic';
  if (/linux/i.test(s)) return 'series:ai_basic';
  if (/數據分析資料工程|data\s*analytics.*engineering/i.test(s)) return 'series:ai_basic';
  if (/物聯網與感測|iot|internet\s*of\s*things.*sensor/i.test(s)) return 'series:ai_basic';

  return null; // 非系列課就不映射
}

function isGeneralEducationAreaRow(nameRaw, creditRaw) {
  const s = toHalfWidth(String(nameRaw || '')).toLowerCase();
  const isArea = /領域/.test(s) ||
                 /humanities|natural\s*sciences|social\s*sciences|civilization|classic|leadership|ethics|issue[-\s]*oriented|sustainability/i.test(s);
  const creditEmpty = !creditRaw || !/^\d+(\.\d+)?$/.test(String(creditRaw).trim());
  return isArea && creditEmpty;
}

function normalizeName(nameRaw){
  if(!nameRaw) return '';
  // 先做全形→半形，解「Ｃ＋＋」「：」等問題
  let s = toHalfWidth(String(nameRaw));

  // 統一括號 → 中文序號轉羅馬 → 轉 #n
  s = toHalfParen(s);
  s = s.replace(/\((.*?)\)/g,(m,inner)=>'('+chineseOrdinalToRoman(inner)+')');
  s = romanParenToHash(s);

  // ★ 只要括號裡包含 #n，就把整段括號收斂成 #n（丟掉英文）
  s = s.replace(/\([^)]*#(\d+)[^)]*\)/g, '#$1');

  // 移除其他括號內容（避免英文副標干擾）
  s = s.replace(/\([^)]*\)/g, '');

  // 去掉代碼前綴「12345-」
  s = s.replace(/^[0-9A-Za-z]+-\s*/, '');

  // 常見全形冒號已轉半形，再做一次一般化
  s = s.replace(/[()．.，,。；;：:\s]/g,'');

  // 去掉重複的 #n（例如 "#1#1" → "#1"）
  s = s.replace(/#(\d+)(?:#\1)+/g, '#$1');

  return s.toLowerCase();
}

function normalizeNameForMust(nameRaw) {
  if (!nameRaw) return '';
  let s = toHalfWidth(String(nameRaw));
  // 去掉代碼與連字，例如：11001-中文 → 中文
  s = s.replace(/^[0-9A-Za-z]+-\s*/, '');
  // 去除括號（常是英文化名）
  s = s.replace(/\([^)]*\)/g, '');
  // 去雜訊標點空白
  s = s.replace(/[()．.，,。；;：:\s]/g, '');
  return s;
}

function normalizeNameForTranscript(nameRaw){
  if(!nameRaw) return '';
  let s = toHalfWidth(String(nameRaw));

  s = toHalfParen(s);
  s = s.replace(/\((.*?)\)/g,(m,inner)=>'('+chineseOrdinalToRoman(inner)+')');
  s = romanParenToHash(s);

  // 若括號中含 #n，收斂成 #n
  s = s.replace(/\([^)]*#(\d+)[^)]*\)/g, '#$1');
  // 其他括號丟掉（英文副標）
  s = s.replace(/\([^)]*\)/g, '');

  // 去課號前綴
  s = s.replace(/^[0-9A-Za-z]+-\s*/, '');

  // 去雜訊
  s = s.replace(/[()．.，,。；;：:\s]/g,'');

  // 去掉重複 #n
  s = s.replace(/#(\d+)(?:#\1)+/g, '#$1');

  return s.toLowerCase();
}


function makeKeyForMust(nameRaw) {
  const base = normalizeNameForMust(nameRaw);        // e.g., "中文"
  const bucket = bucketizeName(base);                 // e.g., "series:chinese"
  return bucket || normalizeName(base);               // 若非系列課，退回一般 normalizeName
}

function makeKeyForTranscript(nameRaw) {
  const base = normalizeNameForTranscript(nameRaw);   // e.g., "中文語文與溝通" → "中文語文與溝通"
  const bucket = bucketizeName(base);                 // e.g., "series:chinese"
  return bucket || normalizeName(base);
}



function isPassed(gpaText){
  const t = String(gpaText||'').trim();

  if (!t) return false;

  // 明確通過關鍵字
  if (/抵免|免修|採計|通過|及格|P(ass)?/i.test(t)) return true;

  // 明確不通過關鍵字與常見代碼
  if (/(未過|不及格)/.test(t)) return false;
  if (/^(E|F|I|X|N|NG)\b/i.test(t)) return false; // E/F/I/X/N/NG
  if (/^W[A-Z]*\b/i.test(t)) return false;        // W, WA, WF...

  // 一般等第：A/B/C/D(+/-) 視為通過
  if (/^[ABCD][\+\-]?$/.test(t)) return true;

  // 其他未知標記：保守視為未通過，避免高估
  return false;
}


function compareTranscriptWithMust(transcript, mustInfo){
  const { requiredCourses, requiredCreditsTarget, electiveCreditsTarget, graduateCreditsTarget } = mustInfo;

  const mustMap = new Map(); // key -> {name, credit}
  for (const m of requiredCourses) {
    if (m.key) mustMap.set(m.key, { name: m.name, credit: m.credit });
  }

  let earnedTotalCredits = 0;

  // 先把所有「通過紀錄」按 key 分桶，等等選「最新一次」
  const passedBuckets = new Map(); // key -> [{record, credit}]
  const unmatchedPassedCandidates = []; // 暫存未對上必修的通過課

  for (const r of transcript){
    const credit = parseFloat(r.credit);
    const passed = isPassed(r.gpa);
    if (passed && !isNaN(credit)) {
      earnedTotalCredits += credit; // 總學分：凡通過即加（0 學分自動不影響）
    }
    if (!passed) continue;

    const key = makeKeyForTranscript(r.name);
    if (!key) { 
      // 名稱無法正規化，又通過 → 放入未匹配候選
      unmatchedPassedCandidates.push(r);
      continue;
    }

    if (mustMap.has(key)) {
      const arr = passedBuckets.get(key) || [];
      arr.push({ record: r, credit });
      passedBuckets.set(key, arr);
    } else {
      unmatchedPassedCandidates.push(r);
    }
  }

  // 從各桶中挑選「最新一次通過」
  const passedRequired = new Map(); // key -> {name, credit, source}
  let earnedRequiredCredits = 0;

  for (const [key, attempts] of passedBuckets.entries()) {
    // 取最後一次（年/學期最大）
    attempts.sort((a, b) => {
      return isNewer(a.record, b.record) ? 1 : -1;
    });
    const latest = attempts[attempts.length - 1]; // 最新一次通過
    const req = mustMap.get(key);
    const useCredit = (req && req.credit) ? req.credit : (latest.credit || 0);
    passedRequired.set(key, { name: req.name, credit: useCredit, source: latest.record });
    earnedRequiredCredits += useCredit;
  }

  // 找出缺的必修
  const missingRequired = [];
  for (const [k, req] of mustMap.entries()){
    if (!passedRequired.has(k)) {
      // 這些可能包含 0 學分必修（體育/國防），名稱對不到就會在這裡
      missingRequired.push({ name: req.name, credit: req.credit });
    }
  }

  // 「未匹配但通過」= 確實通過、又沒被吃進必修的
  const unmatchedPassed = unmatchedPassedCandidates;

  const earnedElectiveCredits = Math.max(0, earnedTotalCredits - earnedRequiredCredits);

  return {
    summary: {
      earnedTotalCredits,
      mustTotalCredits: requiredCreditsTarget ?? 0,
      earnedRequiredCredits,
      missingRequiredCredits: Math.max((requiredCreditsTarget ?? 0) - earnedRequiredCredits, 0),
      electiveCreditsTarget: electiveCreditsTarget ?? null,
      earnedElectiveCredits,
      graduateCreditsTarget: graduateCreditsTarget ?? null,
      remainingToGraduate: (graduateCreditsTarget!=null) ? Math.max(graduateCreditsTarget - earnedTotalCredits, 0) : null
    },
    details: {
      passedRequired: Array.from(passedRequired.values()),
      missingRequired,
      unmatchedPassed
    }
  };
}


// ★ 若仍在缺學分或有未通過必修，就不要顯示「🎉」
function renderComparisonReport(report) {
  const s = report.summary;

  function prettifyCourseName(name){
    if(!name) return '';
    let out = String(name).replace(/^[0-9A-Za-z]+-\s*/, '');
    let changed = true;
    while (changed) {
      changed = false;
      const m = out.match(/^(.*?)(\s*\((?:[^)]|\)[^)]*?)*\)\s*)$/);
      if (m) { const full = m[2]; if (/[A-Za-z]/.test(full)) { out = m[1].trimEnd(); changed = true; continue; } }
      out = out.replace(/\s*\((?=[^)]*[A-Za-z])[\s\S]*$/, '');
    }
    return out.trim();
  }

  const summaryLines = [];
  summaryLines.push('<details open><summary>比對摘要</summary><ol>');
  summaryLines.push(`<li>已修總學分：<b>${s.earnedTotalCredits}</b></li>`);
  summaryLines.push(`<li>必修應修學分合計：<b>${s.mustTotalCredits}</b></li>`);
  summaryLines.push(`<li>必修已修學分：<b>${s.earnedRequiredCredits}</b></li>`);
  summaryLines.push(`<li>必修尚缺學分：<b>${s.missingRequiredCredits}</b></li>`);
  if (s.electiveCreditsTarget != null) summaryLines.push(`<li>選修應修學分：<b>${s.electiveCreditsTarget}</b>（已修選修估算：<b>${s.earnedElectiveCredits}</b>）</li>`);
  if (s.graduateCreditsTarget != null) summaryLines.push(`<li>畢業學分門檻：<b>${s.graduateCreditsTarget}</b>（距離畢業還差：<b>${s.remainingToGraduate}</b>）</li>`);
  summaryLines.push('</ol></details>');

  const passed = report.details.passedRequired || [];
  const missing = report.details.missingRequired || [];
  const passedHTML = `<details open><summary>已通過的必修（${passed.length} 門）</summary><ol>${passed.map(x=>`<li>${prettifyCourseName(x.name)}（${x.credit}學分）</li>`).join('')}</ol></details>`;
  const missingHTML = `<details ${missing.length? 'open':''}><summary>尚未通過的必修（${missing.length} 門）</summary>${missing.length? `<ol>${missing.map(x=>`<li>${prettifyCourseName(x.name)}（${x.credit}學分）</li>`).join('')}</ol>`:'<div>目前無尚未通過的必修。</div>'}</details>`;
  const celebration = (s.missingRequiredCredits===0 && missing.length===0)? '<div class="all-done">🎉 必修皆已通過！</div>':'';

  const wrap = document.createElement('div');
  wrap.className = 'compare-report';
  wrap.innerHTML = `
    <h3>比對結果</h3>
    <div class="compare-content">
      ${summaryLines.join('')}
      ${passedHTML}
      ${missingHTML}
      ${celebration}
    </div>`;

  const rawPanel = document.querySelector('#rawPanel');
  const oldReport = document.querySelector('.compare-report'); if (oldReport) oldReport.remove();
  const oldSep = document.querySelector('#compareSep'); if (oldSep) oldSep.remove();
  const sep = document.createElement('hr'); sep.style.margin='20px 0'; sep.id='compareSep';
  rawPanel.parentNode.insertBefore(sep, rawPanel.nextSibling);
  rawPanel.parentNode.insertBefore(wrap, sep.nextSibling);
}

// ========= 新增：主流程（按鈕事件） =========
async function handleCompare() {
  try {
    setStatus('擷取成績中（請先打開「歷年成績」頁面）…');
    const transcript = await scrapeTranscriptFromActiveTab();
    setStatus(`擷取到 ${transcript.length} 筆成績，解析必修表中…`);

    console.log('開始解析必修表...');
  lastMustInfo = parseMustListFromPopup(); // 需先按「查詢」抓到必修
  console.log('解析到的必修課程:', lastMustInfo);
    
  const report = compareTranscriptWithMust(transcript, lastMustInfo);

    renderComparisonReport(report);
    lastReport = report; // ⬅️ 存起來，匯出用
    setStatus('比對完成');
  } catch (e) {
    setStatus('比對失敗：' + e.message);
  }
}
