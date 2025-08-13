export function toHalfParen(s){ return s.replace(/（/g,'(').replace(/）/g,')'); }
export function chineseOrdinalToRoman(s){
  return s.replace(/一/g,'I').replace(/二/g,'II').replace(/三/g,'III').replace(/四/g,'IV').replace(/五/g,'V');
}
export function romanParenToHash(s){
  return s
    .replace(/\(III\)/gi,'#3')
    .replace(/\(IV\)/gi,'#4')
    .replace(/\(II\)/gi,'#2')
    .replace(/\(V\)/gi,'#5')
    .replace(/\(I\)/gi,'#1');
}

export function normalizeName(nameRaw){
  if(!nameRaw) return '';
  let s = String(nameRaw);
  s = toHalfParen(s);
  s = s.replace(/\((.*?)\)/g,(m,inner)=>'('+chineseOrdinalToRoman(inner)+')');
  s = romanParenToHash(s);
  s = s.replace(/\([^)]*#(\d+)[^)]*\)/g, '#$1');
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/^[0-9A-Za-z]+-\s*/, '');
  s = s.replace(/[()．.，,。；;：:\s]/g,'');
  s = s.replace(/#(\d+)(?:#\1)+/g, '#$1');
  return s.toLowerCase();
}

export function isPassed(gpaText){
  const t = String(gpaText||'').trim();
  if(!t) return false;
  if(/抵免|免修|採計|通過/i.test(t)) return true;
  if(/^f$/i.test(t) || /^w/i.test(t) || /不及格/.test(t)) return false;
  return true;
}
