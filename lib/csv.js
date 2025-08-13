import { els } from './dom.js';
import { getLastRows, getLastReport } from './store.js';

function toCSVLine(arr) {
  const fix = (v) => {
    const s = String(v ?? '');
    if (/^\d{12,}$/.test(s)) return "'" + s; // 避免 Excel 科學記號
    return s;
  };
  const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  return arr.map(x => esc(fix(x))).join(',');
}

export function buildCSVWithReport(rawColumns, rawRows, report) {
  const lines = [];
  lines.push('=== 必修表 Raw Table ===');
  if (rawColumns?.length) lines.push(toCSVLine(rawColumns));
  for (const r of (rawRows || [])) lines.push(toCSVLine(r));
  lines.push('');

  if (!report) return lines.join('\r\n');

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

  lines.push('=== 已通過的必修 Passed Required ===');
  lines.push(toCSVLine(['課程名稱', '學分', '學年度', '學期', '選課代號', 'GPA/備註']));
  for (const x of (report.details?.passedRequired || [])) {
    const src = x.source || {};
    lines.push(toCSVLine([x.name, x.credit, src.year, src.term, src.code, src.gpa]));
  }
  lines.push('');

  lines.push('=== 尚未通過的必修 Missing Required ===');
  lines.push(toCSVLine(['課程名稱', '學分']));
  for (const x of (report.details?.missingRequired || [])) {
    lines.push(toCSVLine([x.name, x.credit]));
  }
  lines.push('');

  lines.push('=== 已通過但未匹配必修的課程 Unmatched Passed ===');
  lines.push(toCSVLine(['學年度', '學期', '選課代號', '科目名稱', '學分', 'GPA/備註']));
  for (const r of (report.details?.unmatchedPassed || [])) {
    lines.push(toCSVLine([r.year, r.term, r.code, r.name, r.credit, r.gpa]));
  }

  return lines.join('\r\n');
}

export function handleExport() {
  const lastRows = getLastRows();
  if (!lastRows || !lastRows.rows || !lastRows.rows.length) return;

  const lastReport = getLastReport();
  const csv = buildCSVWithReport(lastRows.columns, lastRows.rows, lastReport);
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const hasReport = !!lastReport;
  const filename = `THU_mustlist_${els.setyear().value}_${els.stype().value}_${els.majr().value}${hasReport ? '_with-report' : ''}.csv`;
  chrome.downloads.download({ url, filename, saveAs: true });
}
