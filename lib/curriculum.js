import { els } from './dom.js';
import { normalizeName } from './normalize.js';

function findCurriculumTable() {
  const container = els.result();
  const tables = Array.from(container?.querySelectorAll('table') || []);
  if (!tables.length) throw new Error('尚未查詢到必修表（請先按「查詢」）');

  let best = null, bestScore = -1;
  for (const t of tables) {
    const txt = t.innerText || t.textContent || '';
    let score = 0;
    if (/必修學分數/.test(txt)) score += 5;
    if (/畢業學分數/.test(txt)) score += 5;
    if (/必修\s*Department Required Courses/i.test(txt)) score += 6;
    if (/選修\s*Elective/i.test(txt)) score += 3;
    if (t.querySelector('thead')) score += 1;
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best || tables[0];
}

function detectFirstCourseColumns(table, sectionHeaderRowIndex) {
  const headRow = table.tHead?.rows?.[0] || table.rows[0];
  const headers = Array.from(headRow?.cells || []).map(th => (th.textContent || '').trim());
  let nameCol = 0;
  let creditCol = headers.findIndex(h => /學分/i.test(h));
  if (creditCol < 0) creditCol = 1;

  const allRows = table.tBodies?.[0]?.rows?.length ? Array.from(table.tBodies[0].rows) : Array.from(table.rows).slice(1);
  const sampleRow = allRows[sectionHeaderRowIndex + 1] || allRows[0];
  if (sampleRow) {
    const cells = Array.from(sampleRow.cells).map(td => (td.textContent || '').trim());
    const nameIdx = cells.findIndex(c => /^[0-9A-Za-z]{3,}\s*-\s*/.test(c));
    if (nameIdx >= 0) nameCol = nameIdx;
    if (creditCol < 0 || creditCol <= nameCol) {
      const after = cells.slice(nameCol + 1);
      const rel = after.findIndex(c => /^\d+(\.\d+)?$/.test(c));
      if (rel >= 0) creditCol = nameCol + 1 + rel;
    }
  }
  return { nameCol, creditCol };
}

export function parseMustListFromPopup() {
  const table = findCurriculumTable();
  if (!table) throw new Error('找不到課綱表格');

  const rows = table.tBodies?.[0]?.rows?.length ? Array.from(table.tBodies[0].rows) : Array.from(table.rows).slice(1);
  if (!rows.length) throw new Error('課綱表格沒有資料列');

  const rowText = (tr) => Array.from(tr.cells).map(td => (td.textContent || '').trim()).join(' ');

  let requiredStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const txt = rowText(rows[i]);
    if (/必修\s*Department Required Courses/i.test(txt) || /^必修\s*$/.test(txt)) {
      requiredStart = i;
      break;
    }
  }
  if (requiredStart < 0) throw new Error('未能定位到「必修」區段標題');

  const { nameCol, creditCol } = detectFirstCourseColumns(table, requiredStart);

  const requiredCourses = [];
  let requiredCreditsTarget = null, electiveCreditsTarget = null, graduateCreditsTarget = null;

  for (let i = requiredStart; i < rows.length; i++) {
    const tr = rows[i];
    const txt = rowText(tr);

    if (/必修學分數/i.test(txt)) { const m = txt.match(/必修學分數.*?(\d+)/); if (m) requiredCreditsTarget = parseInt(m[1],10); break; }
    if (/選修學分數/i.test(txt)) { const m = txt.match(/選修學分數.*?(\d+)/); if (m) electiveCreditsTarget = parseInt(m[1],10); continue; }
    if (/畢業學分數/i.test(txt)) { const m = txt.match(/畢業學分數.*?(\d+)/); if (m) graduateCreditsTarget = parseInt(m[1],10); continue; }

    const cellText = (tr.cells[nameCol]?.textContent || '').trim();
    if(!cellText) continue;

    let nameRaw = cellText;
    const mCN = nameRaw.match(/[0-9A-Za-z]{3,}\s*-\s*.*/);
    if (mCN) nameRaw = mCN[0];

    const creditRaw = (tr.cells[creditCol]?.textContent || '').trim();
    const looksLikeCourse =
      /^[0-9A-Za-z]{3,}\s*-\s*/.test(nameRaw) ||
      /專題|論文|研究|導論|實作|實驗|課程/.test(nameRaw);

    if (looksLikeCourse) {
      const credit = parseFloat(creditRaw);
      requiredCourses.push({
        name: nameRaw,
        key:  normalizeName(nameRaw),
        credit: isNaN(credit) ? 0 : credit
      });
    }
  }

  if (!requiredCourses.length) {
    throw new Error('未能解析必修課程列（表格格式可能與預期不同）');
  }
  if (requiredCreditsTarget == null) {
    requiredCreditsTarget = requiredCourses.reduce((s, x) => s + (x.credit || 0), 0);
  }

  return { requiredCourses, requiredCreditsTarget, electiveCreditsTarget, graduateCreditsTarget };
}
