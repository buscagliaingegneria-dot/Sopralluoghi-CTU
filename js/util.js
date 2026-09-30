// Utilità generali: costruzione DOM, hash, CSV, dialoghi, notifiche.

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  return append(el, kids);
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export const pad = (n, w = 2) => String(n).padStart(w, '0');

export function slug(s, max = 24) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/, '');
}

export function stableStringify(o) {
  if (o === null || typeof o !== 'object') return JSON.stringify(o === undefined ? null : o);
  if (Array.isArray(o)) return '[' + o.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(t); return f; };

export function fmtBytes(n) {
  if (n == null || isNaN(n)) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

export function fmtDT(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtTime(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function stamp(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- CSV ----------
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join(' | ') : String(v);
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
// Separatore ';' e BOM UTF-8: si apre correttamente in Excel italiano.
export function toCSV(rows, cols) {
  const head = cols.map(csvCell).join(';');
  const body = rows.map(r => cols.map(c => csvCell(r[c])).join(';'));
  return '\ufeff' + [head, ...body].join('\r\n') + '\r\n';
}
export function parseCSV(text) {
  text = text.replace(/^\ufeff/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const cnt = c => first.split(c).length - 1;
  const delim = [';', '\t', ','].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

// ---------- Dialoghi e notifiche ----------
export function modal({ title, body, actions }) {
  return new Promise(resolve => {
    const root = document.getElementById('overlay-root');
    const close = v => { back.remove(); resolve(v); };
    const back = h('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal' },
        title && h('h2', null, title),
        body,
        h('div', { class: 'modal-actions' },
          actions.map(a => h('button', {
            type: 'button', class: 'btn ' + (a.kind || ''),
            onclick: () => close(typeof a.value === 'function' ? a.value() : a.value)
          }, a.label)))));
    root.append(back);
    const first = back.querySelector('input,textarea,select');
    if (first) first.focus();
  });
}
export const confirmDialog = ({ title, text, ok = 'Conferma', cancel = 'Annulla', danger }) =>
  modal({
    title, body: h('p', { class: 'modal-text' }, text),
    actions: [{ label: cancel, value: false }, { label: ok, value: true, kind: danger ? 'danger' : 'primary' }]
  });
export const infoDialog = ({ title, body, ok = 'Chiudi' }) =>
  modal({ title, body: typeof body === 'string' ? h('p', { class: 'modal-text' }, body) : body, actions: [{ label: ok, value: true, kind: 'primary' }] });
export function promptDialog({ title, label, value = '', ok = 'Salva', placeholder = '' }) {
  const inp = h('input', { type: 'text', value, placeholder });
  return modal({
    title, body: h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), inp),
    actions: [{ label: 'Annulla', value: null }, { label: ok, value: () => inp.value.trim(), kind: 'primary' }]
  });
}

let toastTimer;
export function toast(msg, kind = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, kind === 'err' ? 7000 : 2600);
}
