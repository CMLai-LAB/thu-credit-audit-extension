// 輕量狀態集中管理（避免跨檔案全域變數）
const state = {
  lastRows: { columns: [], rows: [] },
  lastReport: null,
};

export const getLastRows = () => state.lastRows;
export const setLastRows = (v) => { state.lastRows = v || { columns: [], rows: [] }; };

export const getLastReport = () => state.lastReport;
export const setLastReport = (v) => { state.lastReport = v ?? null; };
