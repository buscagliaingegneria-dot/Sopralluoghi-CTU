// Gestione delle fotografie: EXIF, orientamento, miniature, copia di servizio per il backup.
import { sha256Hex } from './util.js';

// ---------- Lettura EXIF (data di scatto e coordinate GPS) ----------
export function readExif(buf) {
  const out = {};
  try {
    const v = new DataView(buf);
    if (v.byteLength < 12 || v.getUint16(0) !== 0xFFD8) return out;
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off); off += 2;
      if (marker === 0xFFDA || marker < 0xFF00) break;
      const len = v.getUint16(off);
      if (marker === 0xFFE1 && v.getUint32(off + 2) === 0x45786966) { // "Exif"
        parseTiff(v, off + 8, out);
        break;
      }
      off += len;
    }
  } catch { /* EXIF danneggiato: si prosegue senza */ }
  return out;
}

function parseTiff(v, base, out) {
  const le = v.getUint16(base) === 0x4949;
  const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
  if (u16(base + 2) !== 42) return;
  const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const readIfd = rel => {
    const o = base + rel; const n = u16(o); const tags = {};
    for (let i = 0; i < n && i < 512; i++) {
      const e = o + 2 + i * 12;
      const type = u16(e + 2), count = u32(e + 4);
      const size = (SIZES[type] || 1) * count;
      tags[u16(e)] = { type, count, ptr: size > 4 ? base + u32(e + 8) : e + 8 };
    }
    return tags;
  };
  const ascii = t => { let s = ''; for (let i = 0; i < t.count - 1; i++) s += String.fromCharCode(v.getUint8(t.ptr + i)); return s; };
  const rat = p => { const d = u32(p + 4); return d ? u32(p) / d : 0; };
  const ifd0 = readIfd(u32(base + 4));
  let dt = null;
  if (ifd0[0x8769]) {
    const exif = readIfd(u32(ifd0[0x8769].ptr));
    if (exif[0x9003]) dt = ascii(exif[0x9003]);
  }
  if (!dt && ifd0[0x0132]) dt = ascii(ifd0[0x0132]);
  if (dt) {
    const m = dt.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (m) out.takenAt = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  }
  if (ifd0[0x8825]) {
    const g = readIfd(u32(ifd0[0x8825].ptr));
    if (g[1] && g[2] && g[3] && g[4] && g[2].count === 3 && g[4].count === 3) {
      const dms = t => rat(t.ptr) + rat(t.ptr + 8) / 60 + rat(t.ptr + 16) / 3600;
      let lat = dms(g[2]), lon = dms(g[4]);
      if (ascii(g[1]) === 'S') lat = -lat;
      if (ascii(g[3]) === 'W') lon = -lon;
      if (isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0)) out.gps = { lat, lon, acc: null, src: 'exif' };
    }
  }
}

// ---------- Decodifica con orientamento corretto ----------
// Le foto scattate in verticale spesso hanno i pixel in orizzontale e un'etichetta EXIF di rotazione.
// Qui la rotazione viene applicata in modo esplicito, così miniature e copie di servizio escono dritte.
export async function decodeOriented(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch { /* si prova il percorso alternativo */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode();
    return img; // <img> in Chrome applica già l'orientamento EXIF
  } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
const dims = s => ({ w: s.width || s.naturalWidth, h: s.height || s.naturalHeight });

export async function renderJpeg(source, maxSide, quality) {
  const { w, h } = dims(source);
  const k = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  let blob;
  if (typeof OffscreenCanvas === 'function') {
    const c = new OffscreenCanvas(cw, ch); c.getContext('2d').drawImage(source, 0, 0, cw, ch);
    blob = await c.convertToBlob({ type: 'image/jpeg', quality });
  } else {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(source, 0, 0, cw, ch);
    blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  }
  return { blob, w: cw, h: ch };
}

// Copia ridotta per il backup su Drive. L'originale resta sul telefono e nell'archivio ZIP.
export async function serviceCopy(fotoBlob, maxSide = 2000, quality = 0.82) {
  const src = await decodeOriented(fotoBlob);
  try { return (await renderJpeg(src, maxSide, quality)).blob; }
  finally { if (src.close) src.close(); }
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Prepara i dati di una foto da archiviare (senza scriverla): originale intatto + miniatura + hash + metadati.
export async function prepareFile(file) {
  const buf = await file.arrayBuffer();
  const type = file.type || 'image/jpeg';
  if (!EXT[type]) throw new Error(`Formato non supportato (${type || 'sconosciuto'}). Usare foto in formato JPEG.`);
  const exif = type === 'image/jpeg' ? readExif(buf) : {};
  const hash = await sha256Hex(new Uint8Array(buf));
  const blob = new Blob([buf], { type });
  const src = await decodeOriented(blob);
  let thumb, w, h;
  try {
    ({ w, h } = dims(src));
    thumb = (await renderJpeg(src, 360, 0.7)).blob;
  } finally { if (src.close) src.close(); }
  let takenAt = exif.takenAt, takenSource = 'exif';
  if (!takenAt) { takenAt = file.lastModified || Date.now(); takenSource = file.lastModified ? 'file' : 'app'; }
  return { blob, thumb, w, h, hash, mime: type, ext: EXT[type], size: buf.byteLength, takenAt, takenSource, gps: exif.gps || null };
}

// ---------- Posizione ----------
export function getPosition(timeoutMs = 8000) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), src: 'app' }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 120000 });
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
