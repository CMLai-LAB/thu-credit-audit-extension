import { setStatus } from './status.js';
import { scrapeTranscriptFromActiveTab } from './transcript.js';
import { parseMustListFromPopup } from './curriculum.js';
import { compareTranscriptWithMust, renderComparisonReport } from './compare.js';
import { setLastReport } from './store.js';

export async function handleCompare() {
  try {
    setStatus('擷取成績中（請先打開「歷年成績」頁面）…');
    const transcript = await scrapeTranscriptFromActiveTab();
    setStatus(`擷取到 ${transcript.length} 筆成績，解析必修表中…`);

    const mustCourses = parseMustListFromPopup();
    const report = compareTranscriptWithMust(transcript, mustCourses);

    renderComparisonReport(report);
    setLastReport(report);
    setStatus('比對完成');
  } catch (e) {
    setStatus('比對失敗：' + e.message);
    console.error(e);
  }
}
