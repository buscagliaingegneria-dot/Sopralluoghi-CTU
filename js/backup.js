// Backup di fine giornata: invio a una web app Apps Script (Drive + Fogli Google).
// Ogni elemento viene confermato dal server prima di essere segnato come salvato;
// ripetere il backup invia solo ciò che manca o è cambiato, senza creare doppioni.
import * as DB from './db.js';
import { getCfg, getProc, listImm, listAmb, listFoto, sporca, hashImm, hashAmb, hashFoto, nomeFoto } from './model.js';
import { flatImm, flatAmb, flatFoto } from './flatten.js';
import { serviceCopy, blobToBase64 } from './photo.js';
import { sha256Hex } from './util.js';

// ---------- Stato del backup ----------
export async function riepilogo() {
  const out = []; let pendenti = 0;
  for (const imm of await listImm()) {
    const ambs = await listAmb(imm.id, { conEliminati: true });
    const foto = await listFoto(imm.id, { conEliminate: true });
    const r = { imm, scheda: await sporca('imm', imm), amb: { tot: 0, ok: 0 }, foto: { tot: 0, ok: 0 }, pend: 0 };
    if (r.scheda) r.pend++;
    for (const a of ambs) {
      const d = await sporca('amb', a);
      if (!a.eliminato) { r.amb.tot++; if (!d) r.amb.ok++; }
      if (d) r.pend++;
    }
    for (const f of foto) {
      const d = await sporca('foto', f);
      if (!f.eliminato) { r.foto.tot++; if (!d) r.foto.ok++; }
      if (d) r.pend++;
    }
    pendenti += r.pend; out.push(r);
  }
  return { righe: out, pendenti };
}

export async function condizioni() {
  const w = [];
  if (!navigator.onLine) w.push('Il telefono risulta senza connessione.');
  const c = navigator.connection;
  if (c && c.type === 'cellular') w.push('Il telefono è collegato alla rete dati mobile, non al Wi-Fi.');
  if (navigator.getBattery) {
    try { const b = await navigator.getBattery(); if (!b.charging && b.level < 0.3) w.push('Batteria sotto il 30% e telefono non in carica.'); } catch { /* non disponibile */ }
  }
  return w;
}

// ---------- Rete ----------
async function post(cfg, payload, timeoutMs = 150000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetch(cfg.scriptUrl, { method: 'POST', body: JSON.stringify({ ...payload, token: cfg.token }), redirect: 'follow', signal: ctl.signal });
    } catch (e) {
      const err = new Error(e.name === 'AbortError' ? 'Tempo scaduto: il server non ha risposto.' : 'Connessione non riuscita. Verificare il Wi-Fi e l\'indirizzo della web app.');
      err.code = 'NET'; throw err;
    }
    const txt = await r.text(); let j;
    try { j = JSON.parse(txt); } catch { const e = new Error('Risposta non valida dal server. Verificare che la web app sia distribuita con accesso "Chiunque".'); e.code = 'FORMAT'; throw e; }
    if (!j.ok) { const e = new Error(j.error || 'Errore del server'); e.code = j.code || 'SERVER'; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
const ATTESE = [1500, 4000];
async function conRiprova(fn, prove = 3) {
  let ultimo;
  for (let i = 0; i < prove; i++) {
    try { return await fn(); }
    catch (e) {
      ultimo = e;
      if (e.code === 'AUTH' || e.code === 'FORMAT') throw e;
      if (i < prove - 1) await new Promise(r => setTimeout(r, ATTESE[i] || 4000));
    }
  }
  throw ultimo;
}

async function marca(store, id, kind, hashInviato, extra = {}) {
  const fresh = await DB.get(store, id);
  if (!fresh) return;
  const h = kind === 'imm' ? await hashImm(fresh) : kind === 'amb' ? await hashAmb(fresh) : await hashFoto(fresh);
  if (h !== hashInviato) return; // modificato durante l'invio: resta da salvare
  fresh.bk = { ...(fresh.bk || {}), h, at: Date.now(), ...extra };
  await DB.put(store, fresh);
}

export async function testConnessione(cfg) {
  if (!cfg.scriptUrl || !cfg.token) throw new Error('Indirizzo della web app o token mancanti.');
  return post(cfg, { action: 'ping' }, 30000);
}

// ---------- Esecuzione ----------
export async function eseguiBackup({ log, progress, annullato }) {
  const t0 = Date.now();
  const cfg = await getCfg(); const proc = await getProc();
  if (!proc) throw new Error('Nessun procedimento caricato.');
  if (!cfg.scriptUrl || !cfg.token) throw new Error('Configurare indirizzo della web app e token in Impostazioni.');
  const res = { schede: 0, ambienti: 0, foto: 0, errori: [], verifica: [] };

  log('Connessione al server…');
  await conRiprova(() => post(cfg, { action: 'ping' }, 30000));
  const init = await conRiprova(() => post(cfg, { action: 'init', proc: { codice: proc.codice, titolo: proc.titolo || '' } }));
  await DB.setMeta('server', { sheetUrl: init.sheetUrl, folderUrl: init.folderUrl, at: Date.now() });
  log('Foglio e cartella del procedimento pronti.', 'ok');

  // --- raccolta elementi da inviare ---
  const immobili = await listImm(); const coda = { schede: [], foto: [] };
  const cache = {};
  for (const imm of immobili) {
    const ambs = await listAmb(imm.id, { conEliminati: true }); cache[imm.id] = ambs;
    const immSporco = await sporca('imm', imm);
    const ambSporchi = []; for (const a of ambs) if (await sporca('amb', a)) ambSporchi.push(a);
    if (immSporco || ambSporchi.length) coda.schede.push({ imm, immSporco, ambSporchi });
    for (const f of await listFoto(imm.id, { conEliminate: true })) if (await sporca('foto', f)) coda.foto.push({ imm, f });
  }
  const totale = coda.schede.length + coda.foto.length;
  if (!totale) log('Nessun elemento da inviare: tutto è già in backup.', 'ok');
  let fatti = 0; let reteKo = 0; progress(0, totale, '');

  // --- schede ---
  for (const { imm, immSporco, ambSporchi } of coda.schede) {
    if (annullato()) throw Object.assign(new Error('Backup interrotto.'), { code: 'STOP' });
    progress(fatti, totale, `Scheda ${imm.codice}`);
    try {
      const hImm = immSporco ? await hashImm(imm) : null;
      const hAmb = {}; for (const a of ambSporchi) hAmb[a.id] = await hashAmb(a);
      await conRiprova(() => post(cfg, {
        action: 'scheda', proc: proc.codice,
        immobile: { codice: imm.codice, indirizzo: imm.anag.indirizzo || '' },
        rigaImmobile: immSporco ? flatImm(imm) : null,
        ambienti: ambSporchi.map(flatAmb),
      }));
      if (immSporco) await marca('immobili', imm.id, 'imm', hImm);
      for (const a of ambSporchi) await marca('ambienti', a.id, 'amb', hAmb[a.id]);
      res.schede++; res.ambienti += ambSporchi.length;
      log(`${imm.codice}: scheda${ambSporchi.length ? ' e ' + ambSporchi.length + ' ambienti' : ''} salvata.`, 'ok');
    } catch (e) {
      if (e.code === 'AUTH' || e.code === 'STOP') throw e;
      res.errori.push(`${imm.codice} (scheda): ${e.message}`); log(`${imm.codice}: scheda NON salvata — ${e.message}`, 'err');
    }
    fatti++;
  }

  // --- foto, una per volta ---
  for (const { imm, f } of coda.foto) {
    if (annullato()) throw Object.assign(new Error('Backup interrotto.'), { code: 'STOP' });
    const amb = cache[imm.id].find(a => a.id === f.amb);
    let nome = nomeFoto(f, imm, amb);
    progress(fatti, totale, nome);
    try {
      const h = await hashFoto(f);
      const payload = { action: 'foto', proc: proc.codice, immobile: { codice: imm.codice, indirizzo: imm.anag.indirizzo || '' }, id: f.id, eliminato: !!f.eliminato, riga: flatFoto(f, imm, amb) };
      const inviaFile = !f.eliminato && !(f.bk && f.bk.file);
      if (inviaFile) {
        let blob = f.blob, mime = f.mime;
        if (cfg.qualita !== 'originale') { blob = await serviceCopy(f.blob); mime = 'image/jpeg'; nome = nome.replace(/\.[a-z0-9]+$/i, '.jpg'); }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        payload.hashInvio = await sha256Hex(bytes);
        payload.mime = mime; payload.dataB64 = await blobToBase64(blob);
        payload.riga['Dimensioni inviate (byte)'] = bytes.length;
      }
      payload.nomeFile = nome;
      const r = await conRiprova(() => post(cfg, payload));
      await marca('foto', f.id, 'foto', h, f.eliminato ? {} : { file: true, fileId: r.fileId || (f.bk && f.bk.fileId) || '', url: r.url || (f.bk && f.bk.url) || '' });
      res.foto++; reteKo = 0; log(`${nome}${f.eliminato ? ' (eliminata)' : ''}: confermata.`, 'ok');
    } catch (e) {
      if (e.code === 'AUTH' || e.code === 'STOP') throw e;
      res.errori.push(`${nome}: ${e.message}`); log(`${nome}: NON salvata — ${e.message}`, 'err');
      reteKo = e.code === 'NET' ? reteKo + 1 : 0;
      if (reteKo >= 2) { log('Connessione interrotta: backup fermato. Quanto già confermato resta salvato; ripetere il backup con la rete disponibile.', 'err'); res.interrotto = true; break; }
    }
    fatti++;
  }
  progress(fatti, totale, '');

  // --- verifica sul server ---
  if (res.interrotto) { res.durata = Date.now() - t0; return res; }
  try {
    log('Verifica della corrispondenza sul server…');
    const st = await conRiprova(() => post(cfg, { action: 'stato', proc: proc.codice }));
    const { righe } = await riepilogo();
    for (const r of righe) {
      const s = (st.immobili || {})[r.imm.codice] || { ambienti: 0, foto: 0 };
      if (r.amb.ok !== r.amb.tot || s.ambienti < r.amb.ok || r.foto.ok !== r.foto.tot || s.foto < r.foto.ok) {
        res.verifica.push({ imm: r.imm.codice, locale: { amb: r.amb.tot, foto: r.foto.tot }, confermato: { amb: r.amb.ok, foto: r.foto.ok }, server: s });
      }
    }
    log(res.verifica.length ? 'Verifica: alcune quantità non coincidono.' : 'Verifica completata: le quantità coincidono.', res.verifica.length ? 'err' : 'ok');
  } catch (e) { log('Verifica non eseguita: ' + e.message, 'err'); res.errori.push('Verifica: ' + e.message); }

  res.durata = Date.now() - t0;
  await DB.setMeta('lastBackup', { at: Date.now(), errori: res.errori.length, foto: res.foto, schede: res.schede });
  return res;
}
