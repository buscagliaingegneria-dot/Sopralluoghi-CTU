// Esportazione dell'archivio: foto originali (non ricodificate), CSV delle schede, dati completi in JSON.
import * as DB from './db.js';
import { listImm, listAmb, listFoto, listDocs, getProc, nomeFoto } from './model.js';
import { flatImm, flatAmb, flatFoto, COLONNE_IMM, COLONNE_AMB, COLONNE_FOTO } from './flatten.js';
import { buildZip } from './zip.js';
import { toCSV, slug, stamp, downloadBlob } from './util.js';

export async function esportaArchivio({ soloImm = null, onProgress } = {}) {
  const proc = (await getProc()) || { codice: 'senza-codice' };
  let immobili = await listImm();
  if (soloImm) immobili = immobili.filter(i => i.id === soloImm);
  if (!immobili.length) throw new Error('Nessun immobile da esportare.');
  const radice = `CTU_${slug(proc.codice, 40) || 'procedimento'}`;
  const entries = []; const rImm = [], rAmb = [], rFoto = [], json = { versione: 1, procedimento: proc, esportato: new Date().toISOString(), immobili: [], ambienti: [], foto: [], documenti: [] };
  const ora = new Date();

  for (const imm of immobili) {
    const ambs = await listAmb(imm.id, { conEliminati: true });
    const byId = Object.fromEntries(ambs.map(a => [a.id, a]));
    rImm.push(flatImm(imm)); json.immobili.push(imm);
    ambs.forEach(a => { rAmb.push(flatAmb(a)); json.ambienti.push(a); });
    for (const f of await listFoto(imm.id, { conEliminate: true })) {
      const amb = byId[f.amb];
      rFoto.push(flatFoto(f, imm, amb));
      const { blob, thumb, ...meta } = f; json.foto.push({ ...meta, nomeFile: nomeFoto(f, imm, amb) });
      if (!f.eliminato && f.blob) entries.push({ name: `${radice}/${imm.codice}/foto/${nomeFoto(f, imm, amb)}`, data: f.blob, date: new Date(f.takenAt || ora) });
    }
    for (const d of await listDocs(imm.id)) {
      const { blob, ...meta } = d; json.documenti.push(meta);
      entries.push({ name: `${radice}/${imm.codice}/documenti/${d.nome}`, data: d.blob, date: new Date(d.creato) });
    }
  }
  entries.unshift(
    { name: `${radice}/dati.json`, data: JSON.stringify(json, null, 1) },
    { name: `${radice}/immobili.csv`, data: toCSV(rImm, COLONNE_IMM) },
    { name: `${radice}/ambienti.csv`, data: toCSV(rAmb, COLONNE_AMB) },
    { name: `${radice}/foto.csv`, data: toCSV(rFoto, COLONNE_FOTO) },
    { name: `${radice}/LEGGIMI.txt`, data: 'Archivio esportato da Sopralluoghi CTU.\r\n\r\n' +
      'Le fotografie in ogni cartella "foto" sono i file originali acquisiti, senza ricodifica.\r\n' +
      'Il file foto.csv riporta per ciascuna foto data e ora di scatto, posizione (se disponibile) e impronta SHA-256 dell\'originale.\r\n' +
      'I file CSV usano il punto e virgola come separatore e la codifica UTF-8: si aprono direttamente in Excel.\r\n' });
  const blob = await buildZip(entries, onProgress);
  const nome = `${radice}_${stamp()}${soloImm ? '_' + soloImm : ''}.zip`;
  downloadBlob(blob, nome);
  await DB.setMeta('lastExport', { at: Date.now(), nome, files: entries.length, size: blob.size });
  return { nome, size: blob.size, files: entries.length };
}
