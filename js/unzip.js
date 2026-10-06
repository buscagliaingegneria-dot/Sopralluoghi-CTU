// Lettura di un archivio ZIP (metodi "store" e "deflate"), senza dipendenze.
// Serve all'importazione in blocco: un solo file ZIP con tutte le planimetrie.

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };
export const mimeDa = nome => MIME[(nome.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

export async function unzipFile(file) {
  const tail = await file.slice(Math.max(0, file.size - 65557)).arrayBuffer();
  const t = new DataView(tail);
  let e = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) { if (t.getUint32(i, true) === 0x06054b50) { e = i; break; } }
  if (e < 0) throw new Error('non è un archivio ZIP valido');
  const n = t.getUint16(e + 10, true), cdSize = t.getUint32(e + 12, true), cdOff = t.getUint32(e + 16, true);
  if (n === 0xFFFF || cdOff === 0xFFFFFFFF) throw new Error('archivio ZIP troppo grande (zip64 non supportato)');
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder('utf-8');
  const out = [];
  let p = 0;
  for (let i = 0; i < n; i++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('indice dell\'archivio ZIP danneggiato');
    const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true);
    const csize = cd.getUint32(p + 20, true), nl = cd.getUint16(p + 28, true), el = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true);
    const lho = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, p + 46, nl));
    p += 46 + nl + el + cl;
    if (name.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/i.test(name)) continue;
    if (flags & 1) throw new Error('archivio ZIP protetto da password');
    const lh = new DataView(await file.slice(lho, lho + 30).arrayBuffer());
    if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('voce dell\'archivio ZIP danneggiata');
    const start = lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const raw = file.slice(start, start + csize);
    let blob;
    if (method === 0) blob = raw;
    else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('questo browser non sa decomprimere gli ZIP: usare uno ZIP senza compressione');
      blob = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    } else throw new Error(`metodo di compressione ${method} non supportato`);
    const base = name.split('/').pop();
    out.push(new File([blob], base, { type: mimeDa(base) }));
  }
  return out;
}
