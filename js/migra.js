// Riporto dei valori rilevati per singolo ambiente (versione 1.1) nella scheda generale dell'immobile (1.2).
// Non cancella nulla: i dati per ambiente (A00 compreso) restano consultabili. Il riporto compila solo campi ancora vuoti.
// Per ogni campo: 1) se la scheda ha già un valore, resta invariato; 2) altrimenti vale A00 (Generale) se lo ha compilato, e le altre
// stanze non si confrontano su quel campo; 3) altrimenti si usano le altre stanze (valori uguali o uniti; i conflitti non si risolvono da soli).
import { LEGACY_MAP, IMM_GROUPS, isFilled } from './schema.js';
import { GENERALE } from './model.js';

const DEF = {};
for (const g of IMM_GROUPS) for (const c of g.campi) DEF[c.k] = c;

const valoriDi = (ambienti, da) => {
  const vals = [];
  for (const am of ambienti) {
    const v = am.f && am.f[da]; if (!isFilled(v)) continue;
    (Array.isArray(v) ? v : [v]).forEach(x => vals.push({ v: x, cod: am.codice }));
  }
  return vals;
};

// Raggruppa i valori con i codici delle stanze in cui compaiono (stesso ordine di prima comparsa).
const stanzePerValore = vals => {
  const m = new Map();
  for (const { v, cod } of vals) { if (!m.has(v)) m.set(v, []); if (!m.get(v).includes(cod)) m.get(v).push(cod); }
  return [...m].map(([valore, stanze]) => ({ valore, stanze }));
};

export function anteprimaRiporto(imm, ambs) {
  const ris = { applicabili: [], conflitti: [], giaPresenti: [], ambientiConDati: 0, daA00: 0 };
  const attivi = ambs.filter(a => a.stato === 'rilevato' && !a.eliminato);
  const a00 = attivi.filter(a => a.codice === GENERALE.codice);
  const stanze = attivi.filter(a => a.codice !== GENERALE.codice);
  ris.ambientiConDati = stanze.filter(a => LEGACY_MAP.some(([da]) => isFilled(a.f && a.f[da]))).length;
  for (const [da, a] of LEGACY_MAP) {
    const def = DEF[a]; if (!def) continue;
    const valsA00 = valoriDi(a00, da), valsStanze = valoriDi(stanze, da);
    if (!valsA00.length && !valsStanze.length) continue;
    if (isFilled(imm.f[a])) { ris.giaPresenti.push({ k: a, l: def.l }); continue; }
    const origine = valsA00.length ? 'A00' : 'stanze';
    const fonte = valsA00.length ? valsA00 : valsStanze;
    const dist = [...new Set(fonte.map(x => x.v))];
    if (def.t === 'multi') ris.applicabili.push({ k: a, l: def.l, v: dist, origine });
    else if (dist.length === 1) ris.applicabili.push({ k: a, l: def.l, v: dist[0], origine });
    else ris.conflitti.push({ k: a, l: def.l, valori: dist, dettaglio: stanzePerValore(fonte), origine });
  }
  ris.daA00 = ris.applicabili.filter(x => x.origine === 'A00').length;
  if (ris.daA00) ris.ambientiConDati++; // A00 conta tra gli ambienti con dati solo quando contribuisce con almeno un campo riportabile
  return ris;
}

// Scrive solo nei campi ancora vuoti (anche se nel frattempo sono stati compilati): ripetere il riporto non cambia nulla.
export function applicaRiporto(imm, rip) {
  let n = 0;
  for (const x of rip.applicabili) if (!isFilled(imm.f[x.k])) { imm.f[x.k] = Array.isArray(x.v) ? [...x.v] : x.v; n++; }
  return n;
}
