// Riporto dei valori rilevati per singolo ambiente (versione 1.1) nella scheda generale dell'immobile (1.2).
// Non cancella nulla: i dati per ambiente restano consultabili. Il riporto compila solo campi ancora vuoti.
// L'ambiente A00 (Generale: esterno, accessi, contatori) è escluso: non descrive le finiture interne dell'unità.
import { LEGACY_MAP, IMM_GROUPS, isFilled } from './schema.js';
import { GENERALE } from './model.js';

const DEF = {};
for (const g of IMM_GROUPS) for (const c of g.campi) DEF[c.k] = c;

export function anteprimaRiporto(imm, ambs) {
  const ris = { applicabili: [], conflitti: [], giaPresenti: [], ambientiConDati: 0, escluso: GENERALE };
  const validi = ambs.filter(a => a.stato === 'rilevato' && a.codice !== GENERALE.codice);
  ris.ambientiConDati = validi.filter(a => LEGACY_MAP.some(([da]) => isFilled(a.f && a.f[da]))).length;
  for (const [da, a] of LEGACY_MAP) {
    const def = DEF[a]; if (!def) continue;
    const vals = [];
    for (const am of validi) {
      const v = am.f && am.f[da]; if (!isFilled(v)) continue;
      (Array.isArray(v) ? v : [v]).forEach(x => vals.push(x));
    }
    if (!vals.length) continue;
    if (isFilled(imm.f[a])) { ris.giaPresenti.push({ k: a, l: def.l }); continue; }
    const dist = [...new Set(vals)];
    if (def.t === 'multi') ris.applicabili.push({ k: a, l: def.l, v: dist });
    else if (dist.length === 1) ris.applicabili.push({ k: a, l: def.l, v: dist[0] });
    else ris.conflitti.push({ k: a, l: def.l, valori: dist });
  }
  return ris;
}

export function applicaRiporto(imm, rip) {
  for (const x of rip.applicabili) imm.f[x.k] = x.v;
  return rip.applicabili.length;
}
