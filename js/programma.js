// Lettura del file di programma preparato in studio (CSV da Excel/Fogli Google oppure JSON).
import { parseCSV, pad } from './util.js';

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const ALIAS = {
  codice: 'codice', immobile: 'codice', id: 'codice',
  indirizzo: 'indirizzo', via: 'indirizzo', ubicazione: 'indirizzo',
  comune: 'comune', citta: 'comune',
  piano: 'piano', interno: 'interno', int: 'interno', scala: 'scala',
  foglio: 'foglio', fg: 'foglio', particella: 'particella', part: 'particella', mappale: 'particella', p_lla: 'particella',
  sub: 'sub', subalterno: 'sub',
  categoria: 'categoria', cat: 'categoria', classe: 'classe', consistenza: 'consistenza',
  superficie: 'superficie', superficie_catastale: 'superficie', sup: 'superficie', sup_catastale: 'superficie',
  rendita: 'rendita', intestatari: 'intestatari', intestatario: 'intestatari', proprieta: 'intestatari',
  referente: 'referente', referente_accesso: 'referente',
  note_accesso: 'noteAccesso', noteaccesso: 'noteAccesso', note: 'noteAccesso', accesso: 'noteAccesso',
  data_planimetria: 'dataPlanimetria', dataplanimetria: 'dataPlanimetria', planimetria: 'dataPlanimetria',
  ambienti: 'ambienti', vani: 'ambienti', locali: 'ambienti',
};
const ANAG_KEYS = ['indirizzo', 'comune', 'piano', 'interno', 'foglio', 'particella', 'sub', 'categoria', 'classe', 'consistenza', 'superficie', 'rendita', 'intestatari', 'referente', 'noteAccesso', 'dataPlanimetria'];

function splitAmb(v) {
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : x && x.nome) || '').map(s => s.trim()).filter(Boolean);
  return String(v || '').split(/[|;\n]+/).map(s => s.trim()).filter(Boolean);
}

function costruisci(procIn, righe) {
  const errori = [];
  const proc = { codice: String(procIn.codice || '').trim(), titolo: String(procIn.titolo || '').trim(), tribunale: String(procIn.tribunale || '').trim() };
  const visti = new Set(); const immobili = [];
  righe.forEach((r, i) => {
    const codice = String(r.codice || '').trim() || `IMM-${pad(i + 1)}`;
    if (visti.has(codice)) { errori.push(`Codice immobile duplicato: ${codice}`); return; }
    if (!/^[A-Za-z0-9._-]+$/.test(codice)) { errori.push(`Codice immobile non valido "${codice}": usare solo lettere, numeri, punto, trattino.`); return; }
    visti.add(codice);
    const anag = {};
    for (const k of ANAG_KEYS) anag[k] = r[k] == null ? '' : String(r[k]).trim();
    if (r.scala && !anag.interno) anag.interno = 'scala ' + r.scala;
    immobili.push({ codice, anag, ambienti: splitAmb(r.ambienti) });
  });
  if (!immobili.length) errori.push('Il file non contiene immobili.');
  return { proc, immobili, errori };
}

export function parseProgramma(testo) {
  const t = testo.replace(/^\ufeff/, '').trim();
  if (!t) return { errori: ['Il file è vuoto.'], immobili: [], proc: {} };
  if (t[0] === '{' || t[0] === '[') {
    let j; try { j = JSON.parse(t); } catch (e) { return { errori: ['JSON non valido: ' + e.message], immobili: [], proc: {} }; }
    const arr = Array.isArray(j) ? j : j.immobili;
    if (!Array.isArray(arr)) return { errori: ['Nel JSON manca l\'elenco "immobili".'], immobili: [], proc: {} };
    const righe = arr.map(o => {
      const r = {};
      for (const [k, v] of Object.entries(o || {})) { const a = ALIAS[norm(k)]; if (a) r[a] = v; }
      return r;
    });
    return costruisci((!Array.isArray(j) && (j.procedimento || j.proc)) || {}, righe);
  }
  // CSV: prima riga facoltativa "procedimento;RG 123/2026;Titolo"
  let rows = parseCSV(t);
  let procIn = {};
  if (rows.length && norm(rows[0][0]) === 'procedimento') {
    procIn = { codice: rows[0][1] || '', titolo: rows[0][2] || '' };
    rows = rows.slice(1);
  }
  if (rows.length < 2) return { errori: ['Il CSV deve avere una riga di intestazione e almeno un immobile.'], immobili: [], proc: procIn };
  const cols = rows[0].map(c => ALIAS[norm(c)] || null);
  if (!cols.includes('indirizzo')) return { errori: ['Nell\'intestazione del CSV manca la colonna "indirizzo".'], immobili: [], proc: procIn };
  const righe = rows.slice(1).map(cells => {
    const r = {}; cols.forEach((k, i) => { if (k && cells[i] != null) r[k] = cells[i]; }); return r;
  });
  return costruisci(procIn, righe);
}
