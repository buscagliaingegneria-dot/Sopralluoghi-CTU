// Avvio dell'applicazione: router, service worker, schermo acceso, ripristino dopo chiusura.
import * as DB from './db.js';
import * as M from './model.js';
import * as V from './views.js';
import { scaricaSalvataggi, rilasciaUrl } from './ui.js';
import { h } from './util.js';

const app = document.getElementById('app');
const dec = decodeURIComponent;
let generazione = 0;

function vistaErrore(e) {
  console.error(e);
  return h('div', { class: 'page' }, h('main', { class: 'content' },
    h('div', { class: 'card errbox' }, h('h2', { class: 'sec inl' }, 'Errore dell\'applicazione'),
      h('p', null, String(e && e.message || e)),
      h('p', { class: 'hint' }, 'I dati già salvati non sono stati toccati. Tornare all\'elenco e riprovare; se il problema persiste, chiudere e riaprire l\'app.'),
      h('a', { class: 'btn primary', href: '#/' }, 'Elenco immobili'))));
}

async function route() {
  const mia = ++generazione;
  await scaricaSalvataggi();
  const hash = location.hash || '#/';
  let el, m;
  try {
    if ((m = hash.match(/^#\/i\/([^/]+)\/a\/([^/]+)$/))) el = await V.vistaAmbiente(dec(m[1]), dec(m[2]));
    else if ((m = hash.match(/^#\/i\/([^/]+?)(?:\/(dati|verifica|ambienti|foto|chiusura))?$/))) el = await V.vistaImmobile(dec(m[1]), m[2] || 'ambienti');
    else if (hash === '#/backup') el = await V.vistaBackup();
    else if (hash === '#/impostazioni') el = await V.vistaImpostazioni();
    else el = await V.vistaHome();
  } catch (e) { el = vistaErrore(e); }
  if (mia !== generazione) return;
  document.getElementById('overlay-root').replaceChildren();
  V.rilasciaUrl();
  app.replaceChildren(el);
  window.scrollTo(0, 0);
  try { await DB.setMeta('lastRoute', { hash, at: Date.now() }); } catch { /* non critico */ }
}
V.stato.rerender = () => { const y = window.scrollY; route().then(() => window.scrollTo(0, y)); };

addEventListener('hashchange', route);
const aggiornaRete = () => { const n = document.getElementById('net'); if (n) { n.className = navigator.onLine ? 'on' : 'off'; n.textContent = navigator.onLine ? 'Connesso' : 'Senza rete'; } };
addEventListener('online', aggiornaRete); addEventListener('offline', aggiornaRete);

// ---------- Schermo acceso (solo se attivo nelle impostazioni, con spegnimento dopo inattività) ----------
let wl = null, idle = null;
async function wakeOn() {
  try {
    const cfg = await M.getCfg();
    if (!cfg.wake || !navigator.wakeLock || document.visibilityState !== 'visible' || wl) return;
    wl = await navigator.wakeLock.request('screen');
    wl.addEventListener('release', () => { wl = null; });
  } catch { /* facoltativo */ }
}
function wakeOff() { if (wl) { wl.release().catch(() => { }); wl = null; } }
function bump() { if (!wl) wakeOn(); clearTimeout(idle); idle = setTimeout(wakeOff, 5 * 60 * 1000); }
['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, bump, { passive: true }));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') bump(); });
V.stato.riavvioWake = () => { wakeOff(); bump(); };

// ---------- Service worker e aggiornamenti controllati ----------
function avviaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let richiesto = false;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const nuova = w => { V.stato.aggiornamento = w; if ((location.hash || '#/') === '#/') V.stato.rerender(); };
    if (reg.waiting && navigator.serviceWorker.controller) V.stato.aggiornamento = reg.waiting;
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) nuova(w); });
    });
    V.stato.controllaAggiornamenti = async () => { try { await reg.update(); if (reg.waiting && navigator.serviceWorker.controller) V.stato.aggiornamento = reg.waiting; return true; } catch { return false; } };
    V.stato.applicaAggiornamento = async () => {
      await scaricaSalvataggi(); richiesto = true;
      const w = reg.waiting || V.stato.aggiornamento; if (w) w.postMessage({ type: 'SKIP_WAITING' });
    };
  }).catch(e => console.warn('Service worker non registrato:', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (richiesto) location.reload(); });
}

// ---------- Avvio ----------
(async function avvio() {
  try {
    await DB.db();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    // Dopo una chiusura forzata (es. durante l'uso della fotocamera) si riparte dalla schermata in cui si era.
    if (!location.hash || location.hash === '#/') {
      const ult = await DB.getMeta('lastRoute', null);
      if (ult && ult.hash && ult.hash !== '#/' && Date.now() - ult.at < 6 * 3600 * 1000) location.hash = ult.hash;
    }
    await route();
    bump();
  } catch (e) { app.replaceChildren(vistaErrore(e)); }
  avviaServiceWorker();
})();
