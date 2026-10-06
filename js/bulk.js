// Importazione in blocco di planimetrie e visure.
// Ogni file viene abbinato all'immobile il cui codice compare all'inizio del nome:
//   IMM-07_planimetria.png      -> planimetria di IMM-07
//   IMM-17_planimetria_2.png    -> secondo foglio della planimetria di IMM-17
//   IMM-07_visura.pdf           -> documento "visura" di IMM-07
// Possono essere selezionati più file insieme, oppure uno ZIP che li contiene.
import * as DB from './db.js';
import { listDocs } from './model.js';
import { unzipFile, mimeDa } from './unzip.js';
import { uid } from './util.js';

const IMG = /\.(png|jpe?g|webp)$/i;
const PDF = /\.pdf$/i;
const senzaEstensione = n => n.replace(/\.[^.]+$/, '');

// Riconosce il tipo di file dai primi byte: il selettore di Android spesso omette l'estensione dal nome.
const NO_ZIP = /\.(docx|xlsx|pptx|odt|ods|odp|apk|jar|epub)$/i;
export async function riconosci(f) {
  const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
  if (b[0] === 0x50 && b[1] === 0x4B && (b[2] === 3 || b[2] === 5) && !NO_ZIP.test(f.name)) return { tipo: 'zip' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { tipo: 'img', ext: 'png', mime: 'image/png' };
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { tipo: 'img', ext: 'jpg', mime: 'image/jpeg' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { tipo: 'img', ext: 'webp', mime: 'image/webp' };
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { tipo: 'pdf', ext: 'pdf', mime: 'application/pdf' };
  return null;
}

// Espande gli eventuali ZIP in elenco di file singoli e ripristina estensione e tipo dei file senza.
export async function espandi(files) {
  const out = [], errori = [];
  for (const f of files) {
    const k = await riconosci(f);
    if (k && k.tipo === 'zip') {
      try { out.push(...await unzipFile(f)); } catch (e) { errori.push({ nome: f.name, motivo: e.message }); }
    } else if (k) {
      const haExt = /\.[A-Za-z0-9]{2,5}$/.test(f.name);
      out.push(haExt && f.type === k.mime ? f : new File([f], haExt ? f.name : `${f.name}.${k.ext}`, { type: k.mime }));
    } else out.push(f);
  }
  return { files: out, errori };
}

// Funzione pura: decide a quale immobile appartiene ciascun file.
export function abbina(files, codici) {
  const ord = [...codici].sort((a, b) => b.length - a.length); // prima i codici più lunghi
  const abbinati = [], scartati = [];
  for (const f of files) {
    const low = f.name.toLowerCase();
    const cod = ord.find(c => { const cl = c.toLowerCase(); return low.startsWith(cl) && !/[a-z0-9]/.test(low.charAt(cl.length) || ' '); });
    if (!cod) { scartati.push({ nome: f.name, motivo: 'il nome non inizia con il codice di un immobile del programma' }); continue; }
    const img = IMG.test(f.name) || /^image\//.test(f.type), pdf = PDF.test(f.name) || f.type === 'application/pdf';
    if (!img && !pdf) { scartati.push({ nome: f.name, motivo: 'formato non supportato (solo immagini e PDF)' }); continue; }
    const tipo = (/visura/i.test(f.name) || !img) ? 'visura' : 'planimetria';
    abbinati.push({ file: f, imm: cod, tipo });
  }
  abbinati.sort((a, b) => a.imm.localeCompare(b.imm, 'it', { numeric: true }) ||
    senzaEstensione(a.file.name).localeCompare(senzaEstensione(b.file.name), 'it', { numeric: true }));
  return { abbinati, scartati };
}

export function riepilogo(abbinati) {
  const per = {};
  for (const a of abbinati) { const r = per[a.imm] || (per[a.imm] = { planimetria: 0, visura: 0 }); r[a.tipo]++; }
  return per;
}

// Scrive i documenti. Un file con lo stesso nome già presente per quell'immobile viene sostituito.
export async function importa(abbinati, onProgress) {
  const res = { nuovi: 0, sostituiti: 0 };
  const cache = {}; const t0 = Date.now();
  for (let i = 0; i < abbinati.length; i++) {
    const { file, imm, tipo } = abbinati[i];
    const docs = cache[imm] || (cache[imm] = await listDocs(imm));
    const mime = file.type || mimeDa(file.name);
    const blob = new Blob([await file.arrayBuffer()], { type: mime });
    const ex = docs.find(d => d.nome === file.name);
    if (ex) { ex.blob = blob; ex.size = file.size; ex.mime = mime; ex.tipo = tipo; await DB.put('docs', ex); res.sostituiti++; }
    else {
      const rec = { id: uid(), imm, tipo, nome: file.name, mime, size: file.size, blob, creato: t0 + i };
      await DB.put('docs', rec); docs.push(rec); res.nuovi++;
    }
    if (onProgress) onProgress(i + 1, abbinati.length);
  }
  return res;
}
