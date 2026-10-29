// Importazione di un archivio prodotto da «Esporta archivio» (ZIP con dati.json e file): ripristina nell'archivio del browser
// procedimento, immobili, ambienti, foto, documenti ed edifici, con le stesse chiavi del file. Accetta dati.json di versione 1 e 2.
// Non tocca i record oltre a questo: nessun edificio creato in automatico, nessun riporto (restano azioni manuali).
// Si importa solo su un archivio vuoto: non esiste alcuna unione o sovrascrittura di dati presenti.
import * as DB from './db.js';
import * as M from './model.js';
import { h, toast, infoDialog, modal, fmtBytes } from './util.js';
import { unzipFile } from './unzip.js';
import { decodeOriented, renderJpeg } from './photo.js';

const STORES = ['immobili', 'ambienti', 'foto', 'docs', 'edifici'];
const NOMI = { immobili: 'immobili', ambienti: 'ambienti', foto: 'foto', docs: 'documenti', edifici: 'edifici' };

// ---------- Lettura e controllo dello ZIP ----------
async function leggiZip(file) {
  let voci;
  try { voci = await unzipFile(file); } catch (e) { throw new Error('Il file scelto non è un archivio ZIP leggibile: ' + e.message + '.'); }
  const dati = voci.find(v => v.percorso && /(^|\/)dati\.json$/.test(v.percorso));
  if (!dati) throw new Error('Nello ZIP manca il file dati.json: non è un archivio prodotto da «Esporta archivio».');
  let json;
  try { json = JSON.parse((await dati.text()).replace(/^\uFEFF/, '')); } catch (e) { throw new Error('Il file dati.json non è leggibile: ' + e.message + '.'); }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('Il file dati.json non ha la struttura di un archivio.');
  if (json.versione !== 1 && json.versione !== 2) {
    throw new Error(`Versione dell'archivio non supportata (${json.versione === undefined ? 'assente' : '«' + json.versione + '»'}): si importano solo archivi di versione 1 e 2.`);
  }
  for (const k of ['immobili', 'ambienti', 'foto', 'documenti']) {
    if (!Array.isArray(json[k])) throw new Error(`Nel file dati.json manca l'elenco «${k}».`);
  }
  if (!json.immobili.length) throw new Error('L\'archivio non contiene immobili.');
  const radice = dati.percorso.replace(/dati\.json$/, ''); // «<radice>/» (vuota se dati.json sta alla base dello ZIP)
  return { json, voci, radice };
}

// Coerenza interna: chiavi presenti e uniche, riferimenti a immobili esistenti. Un archivio incoerente viene rifiutato per intero.
function controlla(json, edifici) {
  const err = [];
  const chiavi = (nome, l, campo = 'id') => {
    const visti = new Set();
    for (const r of l) {
      if (!r || typeof r !== 'object' || typeof r[campo] !== 'string' || !r[campo]) { err.push(`${nome}: record senza «${campo}».`); continue; }
      if (visti.has(r[campo])) err.push(`${nome}: chiave duplicata «${r[campo]}».`);
      visti.add(r[campo]);
    }
    return visti;
  };
  const imm = chiavi('Immobili', json.immobili);
  const amb = chiavi('Ambienti', json.ambienti);
  chiavi('Foto', json.foto); chiavi('Documenti', json.documenti); const edi = chiavi('Edifici', edifici);
  for (const a of json.ambienti) if (a && !imm.has(a.imm)) err.push(`Ambiente «${a.id}» di un immobile non presente.`);
  for (const f of json.foto) if (f && !imm.has(f.imm)) err.push(`Foto «${f.id}» di un immobile non presente.`);
  for (const f of json.foto) if (f && f.amb && !amb.has(f.amb)) err.push(`Foto «${f.id}» di un ambiente non presente.`);
  for (const d of json.documenti) if (d && !imm.has(d.imm)) err.push(`Documento «${d.id}» di un immobile non presente.`);
  for (const i of json.immobili) if (i && i.edificio && !edi.has(i.edificio)) err.push(`Immobile «${i.id}» collegato a un edificio non presente.`);
  return err;
}

// Abbina ogni foto e ogni documento al suo file nello ZIP, per percorso <radice>/<codice immobile>/foto|documenti/<nome>.
// Con più voci di uguale percorso ognuna è usata una sola volta, nell'ordine.
function abbina(json, voci, radice) {
  const per = new Map();
  for (const v of voci) { if (!per.has(v.percorso)) per.set(v.percorso, []); per.get(v.percorso).push(v); }
  const prendi = percorso => { const l = per.get(percorso); return l && l.length ? l.shift() : null; };
  const foto = new Map(), docs = new Map(), fotoSenzaFile = [], docsSenzaFile = [];
  for (const f of json.foto) {
    if (f.eliminato) continue; // le foto eliminate non hanno file e restano senza
    const v = f.nomeFile ? prendi(`${radice}${f.imm}/foto/${f.nomeFile}`) : null;
    if (v) foto.set(f.id, v); else fotoSenzaFile.push(f);
  }
  for (const d of json.documenti) {
    const v = prendi(`${radice}${d.imm}/documenti/${d.nome}`);
    if (v) docs.set(d.id, v); else docsSenzaFile.push(d);
  }
  return { foto, docs, fotoSenzaFile, docsSenzaFile };
}

// ---------- Scrittura ----------
async function miniatura(blob) {
  try {
    const src = await decodeOriented(blob);
    try { return { thumb: (await renderJpeg(src, 360, 0.7)).blob, ok: true }; } finally { if (src.close) src.close(); }
  } catch { return { thumb: blob, ok: false }; } // miniatura non generabile: si usa l'originale, così la foto resta visibile
}

function transazione(d, stores) {
  try { return d.transaction(stores, 'readwrite', { durability: 'strict' }); } catch { return d.transaction(stores, 'readwrite'); }
}
const fine = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transazione annullata')); });
const put = (t, store, rec) => { t.objectStore(store).put(rec); };

// Un immobile alla volta, ciascuno in una sola transazione con ambienti, foto, documenti e l'eventuale edificio non ancora scritto:
// un'interruzione lascia gli immobili completati interi e l'ultimo assente.
async function scrivi(json, edifici, mappa, onProgress) {
  const d = await DB.db();
  const edScritti = new Set();
  const res = { immobili: 0, ambienti: 0, foto: 0, docs: 0, edifici: 0, miniatureNonGenerate: 0 };
  const cod = [...json.immobili].sort((a, b) => String(a.codice || a.id).localeCompare(String(b.codice || b.id), 'it', { numeric: true }));
  for (let n = 0; n < cod.length; n++) {
    const imm = cod[n];
    onProgress(n + 1, cod.length, imm.codice || imm.id);
    const ambs = json.ambienti.filter(a => a.imm === imm.id);
    const docs = json.documenti.filter(x => x.imm === imm.id && mappa.docs.has(x.id));
    const foto = [];
    for (const f of json.foto.filter(x => x.imm === imm.id)) {
      const { nomeFile, ...rec } = f; // «nomeFile» esiste solo nell'esportazione, non nell'archivio
      if (f.eliminato) { rec.blob = null; rec.thumb = null; foto.push(rec); continue; }
      const v = mappa.foto.get(f.id); if (!v) continue;
      rec.blob = new Blob([v], { type: f.mime || v.type });
      const m = await miniatura(rec.blob); rec.thumb = m.thumb; if (!m.ok) res.miniatureNonGenerate++;
      foto.push(rec);
    }
    const docRec = docs.map(x => ({ ...x, blob: new Blob([mappa.docs.get(x.id)], { type: x.mime || mappa.docs.get(x.id).type }) }));
    const ed = imm.edificio && !edScritti.has(imm.edificio) ? edifici.find(e => e.id === imm.edificio) : null;
    const stores = ['immobili', 'ambienti', 'foto', 'docs']; if (ed) stores.push('edifici');
    const t = transazione(d, stores); const fin = fine(t);
    put(t, 'immobili', imm); ambs.forEach(a => put(t, 'ambienti', a)); foto.forEach(f => put(t, 'foto', f)); docRec.forEach(x => put(t, 'docs', x));
    if (ed) { put(t, 'edifici', ed); edScritti.add(ed.id); }
    await fin;
    await M.ensureGenerale(imm);
    res.immobili++; res.ambienti += ambs.length; res.foto += foto.length; res.docs += docRec.length; if (ed) res.edifici++;
  }
  const resto = edifici.filter(e => !edScritti.has(e.id)); // edifici senza unità: in coda, in un'unica transazione
  if (resto.length) { const t = transazione(d, ['edifici']); const fin = fine(t); resto.forEach(e => put(t, 'edifici', e)); await fin; res.edifici += resto.length; }
  return res;
}

// ---------- Funzione principale ----------
const riga = (n, singolare, plurale) => `${n} ${n === 1 ? singolare : plurale}`;

// Restituisce true se l'archivio è stato importato; gestisce da sé errori e finestre di dialogo.
export async function importaArchivio(file) {
  if (!file) return false;
  let iniziata = false;
  try {
    // 1) l'archivio del browser deve essere vuoto
    const presenti = [];
    for (const s of STORES) { const n = await DB.count(s); if (n) presenti.push(`${n} ${NOMI[s]}`); }
    if (presenti.length) {
      await infoDialog({ title: 'Importazione non possibile', body: h('div', null,
        h('p', { class: 'modal-text' }, `L'archivio del telefono contiene già dei dati (${presenti.join(', ')}).`),
        h('p', { class: 'modal-text' }, 'L\'importazione dell\'archivio è consentita solo su un archivio vuoto, per non sovrascrivere nulla. Esportare i dati presenti e svuotare l\'archivio dalle Impostazioni, poi riprovare.')) });
      return false;
    }
    // 2) lettura e controllo del file
    toast('Lettura dell\'archivio…');
    const { json, voci, radice } = await leggiZip(file);
    const edifici = json.versione === 2 && Array.isArray(json.edifici) ? json.edifici : [];
    const err = controlla(json, edifici);
    if (err.length) throw new Error('Archivio incoerente, nulla è stato importato: ' + err.slice(0, 5).join(' ') + (err.length > 5 ? ` … e altri ${err.length - 5} problemi.` : ''));
    const mappa = abbina(json, voci, radice);
    const proc = json.procedimento && typeof json.procedimento === 'object' ? json.procedimento : null;
    const procVero = proc && proc.codice && proc.codice !== 'senza-codice';
    const eliminate = json.foto.filter(f => f.eliminato).length;
    // 3) anteprima e conferma
    const corpo = h('div', null,
      h('p', { class: 'modal-text' }, procVero ? `Procedimento ${proc.codice}${proc.titolo ? ' — ' + proc.titolo : ''}` : 'Procedimento non indicato nell\'archivio.'),
      h('ul', { class: 'plainlist' },
        h('li', null, riga(json.immobili.length, 'immobile', 'immobili')),
        h('li', null, riga(json.ambienti.length, 'ambiente', 'ambienti')),
        h('li', null, `${mappa.foto.size} foto con file${eliminate ? `, ${riga(eliminate, 'foto eliminata', 'foto eliminate')} (senza file)` : ''}`),
        h('li', null, `${mappa.docs.size} document${mappa.docs.size === 1 ? 'o' : 'i'}`),
        edifici.length ? h('li', null, riga(edifici.length, 'edificio', 'edifici')) : null),
      mappa.fotoSenzaFile.length || mappa.docsSenzaFile.length ? h('p', { class: 'modal-text err' },
        `Attenzione: nello ZIP mancano i file di ${mappa.fotoSenzaFile.length} foto e ${mappa.docsSenzaFile.length} documenti: questi elementi non verranno importati.`) : null,
      h('p', { class: 'hint' }, `File ${file.name} (${fmtBytes(file.size)}). I dati vengono scritti nell'archivio vuoto del telefono con le stesse chiavi del file; i marcatori di backup restano come nel file.`));
    const ok = await modal({ title: 'Importare l\'archivio?', body: corpo, actions: [{ label: 'Annulla', value: false }, { label: 'Importa', value: true, kind: 'primary' }] });
    if (!ok) return false;
    // 4) scrittura
    iniziata = true;
    if (procVero) await M.setProc(proc);
    const r = await scrivi(json, edifici, mappa, (i, n, c) => toast(`Importazione ${c}: immobile ${i} di ${n}…`));
    toast(`Archivio importato: ${r.immobili} immobili, ${r.ambienti} ambienti, ${r.foto} foto, ${r.docs} documenti.`, 'ok');
    if (r.miniatureNonGenerate) await infoDialog({ title: 'Importazione completata', body: `${r.miniatureNonGenerate} foto sono state importate senza miniatura propria (si vedono comunque).` });
    return true;
  } catch (e) {
    toast(e.message, 'err');
    await infoDialog({ title: 'Importazione non riuscita', body: h('div', null,
      h('p', { class: 'modal-text' }, e.message),
      iniziata ? h('p', { class: 'hint' }, 'L\'importazione si è interrotta: gli immobili già completati sono interi e quello in corso manca. Per ripeterla svuotare prima l\'archivio dalle Impostazioni.') : null) });
    return false;
  }
}
