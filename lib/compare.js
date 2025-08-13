import { normalizeName, isPassed } from './normalize.js';
import { els } from './dom.js';

export function compareTranscriptWithMust(transcript, mustInfo){
  const { requiredCourses, requiredCreditsTarget, electiveCreditsTarget, graduateCreditsTarget } = mustInfo;

  const mustMap = new Map();
  for (const m of requiredCourses) {
    if (m.key) mustMap.set(m.key, { name: m.name, credit: m.credit });
  }

  let earnedTotalCredits = 0;
  let earnedRequiredCredits = 0;
  const passedRequired = new Map();
  const unmatchedPassed = [];

  for (const r of transcript){
    const credit = parseFloat(r.credit);
    const passed = isPassed(r.gpa);
    const key = normalizeName(r.name);

    if (passed && !isNaN(credit)) earnedTotalCredits += credit;
    if (!passed || !key) continue;

    if (mustMap.has(key)){
      if (!passedRequired.has(key)){
        const req = mustMap.get(key);
        const useCredit = req.credit || credit || 0;
        passedRequired.set(key, { name: req.name, credit: useCredit, source: r });
        earnedRequiredCredits += useCredit;
      }
    } else {
      unmatchedPassed.push(r);
    }
  }

  const missingRequired = [];
  for (const [k, req] of mustMap.entries()){
    if (!passedRequired.has(k)) missingRequired.push({ name: req.name, credit: req.credit });
  }

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

export function renderComparisonReport(report) {
  const wrap = document.createElement('div');
  wrap.className = 'compare-report';
  const s = report.summary;

  const lines = [];
  lines.push('<h3>比對結果</h3>');
  lines.push('<ul class="stat">');
  lines.push(`<li>已修總學分：<b>${s.earnedTotalCredits}</b></li>`);
  lines.push(`<li>必修應修學分合計：<b>${s.mustTotalCredits}</b></li>`);
  lines.push(`<li>必修已修學分：<b>${s.earnedRequiredCredits}</b></li>`);
  lines.push(`<li>必修尚缺學分：<b>${s.missingRequiredCredits}</b></li>`);
  if (s.electiveCreditsTarget != null) {
    lines.push(`<li>選修應修學分：<b>${s.electiveCreditsTarget}</b>（已修選修估算：<b>${s.earnedElectiveCredits}</b>）</li>`);
  }
  if (s.graduateCreditsTarget != null) {
    lines.push(`<li>畢業學分門檻：<b>${s.graduateCreditsTarget}</b>（距離畢業還差：<b>${s.remainingToGraduate}</b>）</li>`);
  }
  lines.push('</ul>');

  lines.push(`<details open><summary>已通過的必修（${report.details.passedRequired.length} 門）</summary>`);
  lines.push(`<ol>${report.details.passedRequired.map(x => `<li>${x.name}（${x.credit}學分）</li>`).join('')}</ol>`);
  lines.push('</details>');

  const missCnt = report.details.missingRequired.length;
  lines.push(`<details ${missCnt ? 'open' : ''}><summary>尚未通過的必修（${missCnt} 門）</summary>`);
  lines.push(missCnt
    ? `<ol>${report.details.missingRequired.map(x => `<li>${x.name}（${x.credit}學分）</li>`).join('')}</ol>`
    : '<div>目前無尚未通過的必修。</div>');
  lines.push('</details>');

  if (s.missingRequiredCredits === 0 && report.details.missingRequired.length === 0) {
    lines.push('<div>🎉 必修皆已通過！</div>');
  }

  wrap.innerHTML = lines.join('');
  const resultEl = els.result();
  const sep = document.createElement('hr');
  resultEl.appendChild(sep);
  resultEl.appendChild(wrap);
}
