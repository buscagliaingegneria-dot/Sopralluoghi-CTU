// Trasforma schede e foto in righe piatte con intestazioni leggibili.
// Le stesse righe alimentano sia il foglio Google (backup) sia i CSV dell'archivio.
import { ANAG_FIELDS, IMM_GROUPS, ED_GROUPS, VERIF_GROUPS, CONCL_GROUPS, AMB_GROUPS, LEGACY_AMB_GROUPS, hasLegacy } from './schema.js';
import { nomeFoto } from './model.js';

const v2s = v => Array.isArray(v) ? v.join(' | ') : (v == null ? '' : String(v));
const iso = ts => ts ? new Date(ts).toISOString() : '';
const localIso = ts => { if (!ts) return ''; const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const groupCols = (groups, f, out, prefix = '') => { for (const g of groups) for (const c of g.campi) out[`${prefix}${g.titolo}: ${c.h || c.l}`] = v2s(f && f[c.k]); };

export const COLONNE_IMM_FISSE = ['Codice', ...ANAG_FIELDS.map(([, l]) => l)];

export function flatImm(imm, ed) {
  const o = { 'Codice': imm.codice };
  for (const [k, l] of ANAG_FIELDS) o[l] = v2s(imm.anag[k]);
  o['Tipo di immobile'] = imm.tipo === 'terreno' ? 'Terreno' : 'Fabbricato';
  o['Edificio'] = ed ? ed.id : ''; o['Nome edificio'] = ed ? ed.nome : '';
  o['Inizio rilievo'] = localIso(imm.rilievoInizio);
  groupCols(ED_GROUPS, ed ? ed.f : {}, o, 'Edificio — ');
  groupCols(IMM_GROUPS, imm.f, o);
  groupCols(VERIF_GROUPS, imm.f, o);
  groupCols(CONCL_GROUPS, imm.f, o);
  o['Immobile chiuso'] = imm.chiuso ? 'SI' : 'NO';
  o['Chiuso con lacune'] = imm.lacune ? 'SI' : 'NO';
  o['Aggiornato'] = localIso(imm.updatedAt);
  return o;
}

export function flatAmb(a) {
  const o = { 'ID': a.id, 'Immobile': a.imm, 'Ambiente': a.codice, 'Nome': a.nome, 'Ordine': a.ord,
    'Esito rilievo': a.stato === 'rilevato' ? 'Rilevato' : a.stato === 'non_accessibile' ? 'Non accessibile' : 'Non presente' };
  groupCols(AMB_GROUPS, a.f, o);
  if (hasLegacy(a.f)) groupCols(LEGACY_AMB_GROUPS, a.f, o); // dati per ambiente della versione 1.1
  o['Eliminato'] = a.eliminato ? 'SI' : 'NO';
  o['Aggiornato'] = localIso(a.updatedAt);
  return o;
}

export function flatFoto(f, imm, amb) {
  const g = f.gps;
  return {
    'ID': f.id, 'Immobile': f.imm, 'Ambiente': amb ? amb.codice : '', 'Nome ambiente': amb ? amb.nome : '',
    'Progressivo': f.prog, 'Nome file': imm ? nomeFoto(f, imm, amb) : '', 'Etichetta': f.tag || '', 'Nota': f.nota || '',
    'Data scatto': localIso(f.takenAt), 'Fonte data': f.takenSource || '',
    'Latitudine': g ? g.lat.toFixed(6) : '', 'Longitudine': g ? g.lon.toFixed(6) : '', 'Precisione GPS (m)': g && g.acc != null ? g.acc : '', 'Fonte GPS': g ? g.src : '',
    'Origine': f.origine || '', 'Dimensioni originale (byte)': f.size || '', 'Pixel': f.w ? `${f.w}x${f.h}` : '',
    'SHA-256 originale': f.hash || '', 'Eliminata': f.eliminato ? 'SI' : 'NO',
  };
}

export const COLONNE_AMB = Object.keys(flatAmb({ id: '', imm: '', codice: '', nome: '', ord: 0, stato: 'rilevato', f: { pav_mat: 'x' }, eliminato: false }));
export const COLONNE_FOTO = Object.keys(flatFoto({ id: '', imm: '', prog: 0, gps: null }, null, null));
export const COLONNE_IMM = Object.keys(flatImm({ codice: '', anag: {}, f: {}, chiuso: false, lacune: false }, { id: '', nome: '', f: {} }));
export const COLONNE_ED = ['Edificio', 'Nome edificio', 'Unità', ...ED_GROUPS.flatMap(g => g.campi.map(c => `${g.titolo}: ${c.h || c.l}`))];
export function flatEd(ed, unita) {
  const o = { 'Edificio': ed.id, 'Nome edificio': ed.nome, 'Unità': unita.map(i => i.codice).join(' | ') };
  groupCols(ED_GROUPS, ed.f, o); return o;
}
