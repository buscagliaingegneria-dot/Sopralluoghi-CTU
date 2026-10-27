// Modello dati e operazioni sull'archivio.
import * as DB from './db.js';
import { slug, pad, sha256Hex, stableStringify, uid } from './util.js';
import { AMB_GROUPS, IMM_GROUPS, ED_GROUPS, VERIF_GROUPS, CONCL_GROUPS, reqMissing, isFilled } from './schema.js';

export const GENERALE = { codice: 'A00', nome: 'Generale (esterno, accessi, contatori)' };

// ---------- Procedimento e configurazione ----------
export const getProc = () => DB.getMeta('proc', null);
export const setProc = p => DB.setMeta('proc', p);
export async function getCfg() {
  return { scriptUrl: '', token: '', wake: true, gps: true, qualita: 'ridotta', ...(await DB.getMeta('cfg', {})) };
}
export const setCfg = c => DB.setMeta('cfg', c);

// ---------- Immobili ----------
export function nuovoImmobile(codice, anag = {}) {
  return {
    id: codice, codice, anag: { indirizzo: '', comune: '', piano: '', interno: '', foglio: '', particella: '', sub: '', categoria: '', classe: '', consistenza: '', superficie: '', rendita: '', intestatari: '', referente: '', noteAccesso: '', dataPlanimetria: '', ...anag },
    f: {}, tipo: 'fabbricato', edificio: null, chiuso: false, lacune: false, nextFoto: 1, nextAmb: 1, creato: Date.now(), updatedAt: Date.now(), rilievoInizio: null, bk: null,
  };
}
export const getImm = id => DB.get('immobili', id);
export async function listImm() {
  const l = await DB.all('immobili');
  return l.sort((a, b) => a.codice.localeCompare(b.codice, 'it', { numeric: true }));
}
export async function prossimoCodiceImm() {
  const l = await DB.all('immobili'); let max = 0;
  for (const i of l) { const m = i.codice.match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `IMM-${pad(max + 1)}`;
}

// ---------- Ambienti ----------
export const ambId = (imm, cod) => `${imm}:${cod}`;
export function nuovoAmbiente(imm, codice, nome, ord) {
  return { id: ambId(imm, codice), imm, codice, nome, ord, stato: 'rilevato', f: {}, eliminato: false, updatedAt: Date.now(), bk: null };
}
export async function listAmb(immId, { conEliminati = false } = {}) {
  const l = await DB.byIndex('ambienti', 'imm', immId);
  return l.filter(a => conEliminati || !a.eliminato).sort((a, b) => a.ord - b.ord);
}
export async function ensureGenerale(imm) {
  const id = ambId(imm.id, GENERALE.codice);
  let a = await DB.get('ambienti', id);
  if (!a) { a = nuovoAmbiente(imm.id, GENERALE.codice, GENERALE.nome, 0); a.fisso = true; await DB.put('ambienti', a); }
  return a;
}
export async function aggiungiAmbiente(imm, nome) {
  const cur = await DB.get('immobili', imm.id);
  const n = cur.nextAmb++;
  const all = await listAmb(cur.id, { conEliminati: true });
  const ord = all.reduce((m, a) => Math.max(m, a.ord), 0) + 1;
  const a = nuovoAmbiente(cur.id, 'A' + pad(n), nome, ord);
  await DB.put('immobili', cur);
  await DB.put('ambienti', a);
  imm.nextAmb = cur.nextAmb;
  return a;
}

// ---------- Programma dei sopralluoghi ----------
export async function applicaProgramma(prog) {
  const cur = await getProc();
  const esistenti = await DB.all('immobili');
  if (cur && cur.codice !== prog.proc.codice && esistenti.length) {
    throw new Error(`Sul telefono ci sono già dati del procedimento "${cur.codice}". Eseguire il backup e chiudere quel procedimento (Impostazioni) prima di caricarne un altro.`);
  }
  await setProc({ ...(cur || {}), ...prog.proc, importato: Date.now() });
  const res = { nuovi: 0, aggiornati: 0, ambienti: 0 };
  for (const p of prog.immobili) {
    let imm = await DB.get('immobili', p.codice);
    if (imm) {
      for (const [k, v] of Object.entries(p.anag)) if (v !== '' && v != null) imm.anag[k] = v;
      imm.updatedAt = Date.now(); res.aggiornati++;
    } else { imm = nuovoImmobile(p.codice, p.anag); res.nuovi++; }
    await DB.put('immobili', imm);
    await ensureGenerale(imm);
    const presenti = (await listAmb(imm.id, { conEliminati: true })).map(a => a.nome.trim().toLowerCase());
    for (const nome of p.ambienti) {
      if (presenti.includes(nome.trim().toLowerCase())) continue;
      await aggiungiAmbiente(imm, nome.trim()); res.ambienti++;
      presenti.push(nome.trim().toLowerCase());
    }
  }
  return res;
}

// ---------- Foto ----------
export async function listFoto(immId, { conEliminate = false } = {}) {
  const l = await DB.byIndex('foto', 'imm', immId);
  return l.filter(f => conEliminate || !f.eliminato).sort((a, b) => a.prog - b.prog);
}
export async function listFotoAmb(ambIdent) {
  const l = await DB.byIndex('foto', 'amb', ambIdent);
  return l.filter(f => !f.eliminato).sort((a, b) => a.prog - b.prog);
}
export async function aggiungiFoto(immId, ambIdent, prep, extra = {}) {
  const imm = await DB.get('immobili', immId);
  const prog = imm.nextFoto++;
  const rec = {
    id: uid(), imm: immId, amb: ambIdent, prog, tag: extra.tag || '', nota: '',
    blob: prep.blob, thumb: prep.thumb, w: prep.w, h: prep.h, hash: prep.hash, mime: prep.mime, ext: prep.ext, size: prep.size,
    takenAt: prep.takenAt, takenSource: prep.takenSource, gps: prep.gps || extra.gps || null,
    origine: extra.origine || 'app', creato: Date.now(), eliminato: false, bk: null,
  };
  // una sola transazione logica per contatore e foto: se la seconda scrittura fallisce, il contatore non va perso
  await DB.put('foto', rec);
  await DB.put('immobili', imm);
  return rec;
}
export async function eliminaFoto(f) {
  f.eliminato = true; f.blob = null; f.thumb = null; f.eliminatoAt = Date.now();
  await DB.put('foto', f);
}
export function nomeFoto(f, imm, amb) {
  const a = amb ? `${amb.codice}-${slug(amb.nome)}` : 'A00';
  return `${imm.codice}_${a}_${pad(f.prog, 3)}${f.tag ? '_' + slug(f.tag) : ''}.${f.ext || 'jpg'}`;
}

// ---------- Documenti (planimetrie, visure) ----------
export const listDocs = immId => DB.byIndex('docs', 'imm', immId);
export async function aggiungiDoc(immId, tipo, file) {
  const rec = { id: uid(), imm: immId, tipo, nome: file.name || 'documento', mime: file.type || 'application/octet-stream', size: file.size, blob: new Blob([await file.arrayBuffer()], { type: file.type }), creato: Date.now() };
  await DB.put('docs', rec); return rec;
}

// ---------- Completezza ----------
export function ambCompleto(a) {
  if (a.eliminato) return true;
  if (a.stato !== 'rilevato') return true;
  return reqMissing(AMB_GROUPS, a.f).length === 0;
}
export function immMancanti(imm, ambienti, ed) {
  if (imm.tipo === 'terreno') return [];
  const m = [];
  for (const g of [IMM_GROUPS, VERIF_GROUPS, CONCL_GROUPS]) for (const x of reqMissing(g, imm.f)) m.push(`${x.g}: ${x.campo}`);
  if (!ed) m.push('Edificio: Tipologia strutturale');
  else for (const x of reqMissing(ED_GROUPS, ed.f)) m.push(`Edificio, ${x.g}: ${x.campo}`);
  for (const a of ambienti) {
    if (a.codice === GENERALE.codice) continue;
    if (!ambCompleto(a)) for (const x of reqMissing(AMB_GROUPS, a.f)) m.push(`${a.codice} ${a.nome}: ${x.campo}`);
  }
  return m;
}

// ---------- Edifici: dati comuni a più unità; ogni unità conserva la propria scheda completa ----------
export const getEd = id => id ? DB.get('edifici', id) : Promise.resolve(null);
export async function listEd() {
  const l = await DB.all('edifici');
  return l.sort((a, b) => a.id.localeCompare(b.id, 'it', { numeric: true }));
}
async function prossimoCodiceEd() {
  let max = 0; for (const e of await DB.all('edifici')) { const m = e.id.match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `EDI-${pad(max + 1)}`;
}
export async function unitaDi(edId) { return (await DB.all('immobili')).filter(i => i.edificio === edId).sort((a, b) => a.codice.localeCompare(b.codice, 'it', { numeric: true })); }
// Restituisce l'edificio dell'immobile; se non esiste e crea=true ne apre uno nuovo,
// portandovi i dati d'edificio eventualmente già inseriti sull'immobile con la versione 1.1.
export async function edificioDi(imm, { crea = false } = {}) {
  if (imm.edificio) { const e = await DB.get('edifici', imm.edificio); if (e) return e; }
  if (!crea) return null;
  const e = { id: await prossimoCodiceEd(), nome: imm.anag.indirizzo || '', f: {}, creato: Date.now(), updatedAt: Date.now() };
  for (const k of ['epoca', 'asc', 'acc', 'dot', 'edi_st']) if (isFilled(imm.f[k])) e.f[k] = imm.f[k];
  await DB.put('edifici', e);
  imm.edificio = e.id; imm.updatedAt = Date.now(); await DB.put('immobili', imm);
  return e;
}
// Associa l'immobile a un edificio esistente (id) o ne crea uno nuovo ('nuovo').
// Se il precedente edificio era usato solo da questo immobile, i suoi dati compilati vengono portati
// nei campi ancora vuoti del nuovo e l'edificio vuoto viene eliminato. Nessuna scheda di unità viene toccata.
export async function associaEdificio(imm, target) {
  const corrente = imm.edificio ? await DB.get('edifici', imm.edificio) : null;
  if (target === 'nuovo') {
    if (corrente && (await unitaDi(corrente.id)).length === 1) return { copiati: 0, id: corrente.id };
    const e = { id: await prossimoCodiceEd(), nome: imm.anag.indirizzo || '', f: {}, creato: Date.now(), updatedAt: Date.now() };
    await DB.put('edifici', e); imm.edificio = e.id; imm.updatedAt = Date.now(); await DB.put('immobili', imm);
    return { copiati: 0, id: e.id };
  }
  if (corrente && corrente.id === target) return { copiati: 0, id: target };
  const dest = await DB.get('edifici', target); if (!dest) throw new Error('Edificio non trovato.');
  let copiati = 0;
  if (corrente && (await unitaDi(corrente.id)).length === 1) {
    for (const [k, v] of Object.entries(corrente.f)) if (isFilled(v) && !isFilled(dest.f[k])) { dest.f[k] = v; copiati++; }
    if (copiati) { dest.updatedAt = Date.now(); await DB.put('edifici', dest); }
    await DB.del('edifici', corrente.id);
  }
  imm.edificio = dest.id; imm.updatedAt = Date.now(); await DB.put('immobili', imm);
  return { copiati, id: dest.id };
}

// ---------- Impronte per il backup ----------
export async function hashImm(i, ed) { return sha256Hex(stableStringify({ a: i.anag, f: i.f, c: i.chiuso, l: i.lacune, r: i.rilievoInizio, t: i.tipo || 'fabbricato', e: ed ? { id: ed.id, n: ed.nome, f: ed.f } : null })); }
export async function hashAmb(a) { return sha256Hex(stableStringify({ n: a.nome, s: a.stato, f: a.f, o: a.ord, e: a.eliminato })); }
export async function hashFoto(f) { return sha256Hex(stableStringify({ i: f.imm, a: f.amb, p: f.prog, t: f.tag, n: f.nota, d: f.takenAt, g: f.gps, e: f.eliminato, h: f.hash })); }
export async function sporca(kind, rec) {
  const h = kind === 'imm' ? await hashImm(rec, await getEd(rec.edificio)) : kind === 'amb' ? await hashAmb(rec) : await hashFoto(rec);
  if (!rec.bk || rec.bk.h !== h) return true;
  if (kind === 'foto' && !rec.eliminato && !rec.bk.file) return true;
  return false;
}
