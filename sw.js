// Service worker: rende l'app disponibile senza rete.
// Per pubblicare una nuova versione: cambiare VERSIONE qui e APP_VERSION in js/version.js.
const VERSIONE = 'sopralluoghi-1.1.1';
const FILE = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/version.js', 'js/util.js', 'js/db.js', 'js/schema.js', 'js/model.js', 'js/programma.js',
  'js/flatten.js', 'js/bulk.js', 'js/unzip.js', 'js/export.js', 'js/zip.js', 'js/photo.js', 'js/backup.js', 'js/ui.js', 'js/viewers.js', 'js/views.js',
  'fonts/space-grotesk-500.woff2', 'fonts/space-grotesk-600.woff2',
  'fonts/plex-sans-400.woff2', 'fonts/plex-sans-500.woff2', 'fonts/plex-sans-600.woff2',
  'fonts/plex-mono-400.woff2', 'fonts/plex-mono-500.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  // Nessun skipWaiting automatico: l'aggiornamento si applica solo su richiesta dell'utente.
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSIONE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // le chiamate ad Apps Script non passano dalla cache
  e.respondWith((async () => {
    const cache = await caches.open(VERSIONE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const idx = await cache.match('index.html'); if (idx) return idx; }
    try { return await fetch(req); } catch { return new Response('Non disponibile offline', { status: 503 }); }
  })());
});
