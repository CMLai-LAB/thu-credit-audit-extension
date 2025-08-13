export const $ = (sel) => document.querySelector(sel);
export const createEl = (tag, cls) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

export const els = {
  status: () => $('#status'),
  result: () => $('#result'),
  setyear: () => $('#setyear'),
  stype: () => $('#stype'),
  majr: () => $('#majr'),
  subMajr: () => $('#subMajr'),
  subMajrOptions: () => $('[name="p_grop"]'),
  fetchBtn: () => $('#fetchBtn'),
  exportBtn: () => $('#exportBtn'),
  compareBtn: () => $('#compareBtn'),
};
