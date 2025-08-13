import { htmlToDoc } from './html.js';
import { els, createEl } from './dom.js';

export function parseMustTable(html) {
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

export function renderTable({ columns, rows }) {
  const resultEl = els.result();
  resultEl.innerHTML = '';
  if (!rows.length) {
    resultEl.innerHTML = '<div class="empty">查無資料或格式未解析</div>';
    els.exportBtn().disabled = true;
    return;
  }

  const table = createEl('table', 'table');
  const thead = createEl('thead');
  const trh = createEl('tr');
  for (const c of columns) {
    const th = createEl('th');
    th.textContent = c;
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = createEl('tbody');
  for (const r of rows) {
    const tr = createEl('tr');
    for (const v of r) {
      const td = createEl('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  resultEl.appendChild(table);
  els.exportBtn().disabled = false;
}
