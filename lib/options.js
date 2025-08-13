import { htmlToDoc } from './html.js';

export function parseYearOptions(html) {
  const doc = htmlToDoc(html);
  const select = doc.querySelector('#setyear, select[name="setyear"]');
  const opts = [];
  if (select) {
    for (const opt of select.querySelectorAll('option')) {
      const value = (opt.value || '').trim();
      const text = (opt.textContent || '').trim();
      if (value) opts.push({ value, text, selected: !!opt.selected });
    }
  }
  return opts;
}

export function pickLatestNumeric(options) {
  const nums = options
    .map(o => o.value)
    .filter(v => /^\d+$/.test(v))
    .map(v => parseInt(v, 10));
  if (!nums.length) return options[0]?.value ?? '';
  return String(Math.max(...nums));
}

export function renderOptions(selectEl, opts, preferred) {
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

export function parseMajrOptions(html) {
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
