// Componenti di interfaccia riutilizzabili e salvataggio automatico.
import { h, toast, fmtTime } from './util.js';
import * as DB from './db.js';
import { groupCount, isFilled } from './schema.js';

// ---------- Icone (tracciati semplici, 24x24) ----------
const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 16l5-5 4 4 3-3 4 4"/><circle cx="9" cy="9.5" r="1.3"/>',
  plan: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
  cloud: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18"/><path d="M12 19v-7M9 15l3-3 3 3"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  trash: '<path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12"/>',
  edit: '<path d="M5 19l1-4 10-10 3 3-10 10z"/>',
  file: '<path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4"/>',
};
export function icon(name, size = 22) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = P[name] || '';
  return s;
}

// Monogramma FB (asset del brand dello studio)
export function marchio(size = 26) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 106 100'); s.setAttribute('width', size); s.setAttribute('height', Math.round(size * 100 / 106));
  s.setAttribute('fill', 'currentColor'); s.setAttribute('aria-label', 'FB Engineering'); s.setAttribute('role', 'img');
  s.innerHTML = '<rect x="8" y="14" width="13" height="72"/><rect x="8" y="14" width="40" height="13"/><rect x="8" y="43" width="32" height="13"/><rect x="62" y="14" width="12" height="72"/><rect x="62" y="14" width="33" height="11"/><rect x="84" y="14" width="11" height="22"/><rect x="62" y="36" width="29" height="11"/><rect x="88" y="36" width="11" height="38"/><rect x="62" y="74" width="37" height="12"/>';
  return s;
}

// ---------- Salvataggio automatico ----------
const pending = new Map(); // chiave store:id -> { store, rec, timer }
let lastSaved = 0;
function paintSave(state, msg) {
  const el = document.getElementById('savestate');
  if (!el) return;
  el.className = 'savestate ' + state; el.textContent = msg;
}
export function segnaSalvato() { lastSaved = Date.now(); paintSave('ok', 'Salvato ' + fmtTime(lastSaved)); }

async function scrivi(store, rec) {
  rec.updatedAt = Date.now();
  try { await DB.put(store, rec); segnaSalvato(); }
  catch (e) { paintSave('err', 'ERRORE SALVATAGGIO'); toast('Salvataggio non riuscito: ' + (e && e.message || e) + '. Non chiudere l\'app, esportare i dati.', 'err'); throw e; }
}
export function salva(store, rec, { subito = false } = {}) {
  const key = store + ':' + rec.id;
  const p = pending.get(key);
  if (p) clearTimeout(p.timer);
  paintSave('busy', 'Salvataggio…');
  if (subito) { pending.delete(key); return scrivi(store, rec); }
  const timer = setTimeout(() => { pending.delete(key); scrivi(store, rec).catch(() => { }); }, 350);
  pending.set(key, { store, rec, timer });
  return Promise.resolve();
}
export async function scaricaSalvataggi() {
  const items = [...pending.values()]; pending.clear();
  for (const p of items) { clearTimeout(p.timer); try { await scrivi(p.store, p.rec); } catch { /* già segnalato */ } }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') scaricaSalvataggi(); });
addEventListener('pagehide', () => { scaricaSalvataggi(); });

// ---------- Controlli scheda ----------
export function chips(campo, f, onChange) {
  const multi = campo.t === 'multi';
  const wrap = h('div', { class: 'chips', role: multi ? 'group' : 'radiogroup', 'aria-label': campo.l });
  const on = v => multi ? (Array.isArray(f[campo.k]) && f[campo.k].includes(v)) : f[campo.k] === v;
  const paint = () => [...wrap.children].forEach(b => b.setAttribute('aria-pressed', on(b.dataset.v) ? 'true' : 'false'));
  for (const o of campo.o) {
    wrap.append(h('button', {
      type: 'button', class: 'chip', 'data-v': o, 'aria-pressed': 'false',
      onclick: () => {
        if (multi) {
          const cur = Array.isArray(f[campo.k]) ? [...f[campo.k]] : [];
          const i = cur.indexOf(o); if (i >= 0) cur.splice(i, 1); else cur.push(o);
          f[campo.k] = cur;
        } else f[campo.k] = f[campo.k] === o ? '' : o;
        paint(); onChange(campo);
      }
    }, o));
  }
  paint(); return wrap;
}

export function campo(c, f, onChange) {
  const lbl = h('span', { class: 'lbl' }, c.l, c.req ? h('b', { class: 'req', title: 'Obbligatorio per la chiusura' }, ' *') : null);
  let ctl;
  if (c.t === 'chips' || c.t === 'multi') ctl = chips(c, f, onChange);
  else if (c.t === 'area') ctl = h('textarea', { rows: 3, value: f[c.k] || '', oninput: e => { f[c.k] = e.target.value; onChange(c); } });
  else ctl = h('input', { type: 'text', value: f[c.k] || '', autocomplete: 'off', oninput: e => { f[c.k] = e.target.value; onChange(c); } });
  return h('div', { class: 'field' + (c.t === 'chips' || c.t === 'multi' ? ' field-chips' : '') }, lbl, ctl);
}

// Gruppo a fisarmonica con contatore dei campi compilati
export function gruppo(g, f, onChange, { aperto = false } = {}) {
  const badge = h('span', { class: 'badge' });
  const paint = () => { const [ok, tot] = groupCount(g, f); badge.textContent = `${ok}/${tot}`; badge.classList.toggle('full', ok === tot); };
  const mancaReq = () => g.campi.some(c => c.req && !isFilled(f[c.k]));
  const det = h('details', { class: 'group', open: aperto ? '' : null },
    h('summary', null, h('span', { class: 'gtitle' }, g.titolo), badge),
    h('div', { class: 'gbody' }, g.campi.map(c => campo(c, f, x => { paint(); det.classList.toggle('needs', mancaReq()); onChange(x); }))));
  paint(); det.classList.toggle('needs', mancaReq());
  return det;
}

// ---------- Barra superiore ----------
export function appbar({ titolo, sotto, indietro, azioni = [] }) {
  return h('header', { class: 'appbar' },
    indietro ? h('a', { class: 'iconbtn', href: indietro, 'aria-label': 'Indietro' }, icon('back')) : h('span', { class: 'brandmark' }, marchio(30)),
    h('div', { class: 'apptitle' }, h('div', { class: 'at1' }, titolo), sotto ? h('div', { class: 'at2' }, sotto) : null),
    h('span', { id: 'savestate', class: 'savestate' }, ''),
    ...azioni);
}

export function vuoto(titolo, testo, azione) {
  return h('div', { class: 'empty' }, h('h2', null, titolo), h('p', null, testo), azione || null);
}

export function barra(pct) {
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round(pct) }, h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));
}

// ---------- Gestione URL degli oggetti (miniature) ----------
const urls = new Set();
export function urlBlob(blob) { const u = URL.createObjectURL(blob); urls.add(u); return u; }
export function rilasciaUrl() { urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); }
