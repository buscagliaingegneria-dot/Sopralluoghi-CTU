// Scrittore ZIP minimale (metodo "store", nessuna compressione: le foto JPEG sono già compresse).
// I contenuti dei file grandi non vengono mai concatenati in memoria JS: il Blob finale
// referenzia i Blob originali, il browser li assembla al momento del salvataggio.

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

export function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time & 0xFFFF, date & 0xFFFF];
}

// entries: [{ name: 'cartella/file.ext', data: string | Blob | Uint8Array, date?: Date }]
export async function buildZip(entries, onProgress) {
  const enc = new TextEncoder();
  const parts = []; const central = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    let payload = e.data;
    let u8;
    if (typeof payload === 'string') { u8 = enc.encode(payload); payload = u8; }
    else if (payload instanceof Uint8Array) u8 = payload;
    else u8 = new Uint8Array(await payload.arrayBuffer());
    const size = u8.length;
    const crc = crc32(u8);
    u8 = null;
    const nameBytes = enc.encode(e.name);
    const [dt, dd] = dosDateTime(e.date || new Date());

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, dt, true); lh.setUint16(12, dd, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
    lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nameBytes, payload);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, nameBytes.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
    if (onProgress) onProgress(i + 1, entries.length);
  }
  let cdSize = 0; for (const c of central) cdSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
