export async function scrapeTranscriptFromActiveTab() {
  const normalWins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  let targetTab = null;
  const focusedWin = normalWins.find(w => w.focused);
  if (focusedWin) targetTab = focusedWin.tabs.find(t => t.active);

  const allTabs = normalWins.flatMap(w => w.tabs || []);
  if (!targetTab || !/^https?:/i.test(targetTab.url)) {
    targetTab =
      allTabs.find(t => /^https?:/i.test(t.url) && /thu\.edu\.tw/i.test(t.url)) ||
      allTabs.find(t => /^https?:/i.test(t.url));
  }

  if (!targetTab || !/^https?:/i.test(targetTab.url)) {
    throw new Error('找不到可注入的瀏覽器分頁。請先切到學校的「歷年成績」頁，再按一次「抓成績＋比對」。');
  }

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
