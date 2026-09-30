// Visualizzatori a schermo intero: planimetria (zoom con due dita) e dettaglio foto.
import { h, toast, confirmDialog, fmtDT, fmtBytes } from './util.js';
import { icon, salva, urlBlob } from './ui.js';
import { listDocs, eliminaFoto, nomeFoto } from './model.js';
import { TAGS } from './schema.js';

const root = () => document.getElementById('overlay-root');

function panzoom(stage, img) {
  let s = 1, tx = 0, ty = 0, s0 = 1, moved = false, lastTap = 0, pinch = null;
  const pts = new Map();
  const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`; };
  const clamp = v => Math.min(Math.max(v, s0 * 0.8), s0 * 12);
  const fit = () => {
    const r = stage.getBoundingClientRect(); const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    s0 = Math.min(r.width / iw, r.height / ih); s = s0; tx = (r.width - iw * s) / 2; ty = (r.height - ih * s) / 2; apply();
  };
  const zoomAt = (cx, cy, ns) => { ns = clamp(ns); tx = cx - (cx - tx) * (ns / s); ty = cy - (cy - ty) * (ns / s); s = ns; apply(); };
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s }; }
  });
  stage.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { tx += dx; ty += dy; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true; apply(); }
    else if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()]; const r = stage.getBoundingClientRect();
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); moved = true;
    }
  });
  const up = e => {
    const had = pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (had && !moved && pts.size === 0 && e.type === 'pointerup') {
      const now = Date.now();
      if (now - lastTap < 320) {
        const r = stage.getBoundingClientRect();
        if (s > s0 * 1.5) fit(); else zoomAt(e.clientX - r.left, e.clientY - r.top, s0 * 3);
        lastTap = 0;
      } else lastTap = now;
    }
  };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
  addEventListener('resize', fit);
  return { fit, destroy: () => removeEventListener('resize', fit) };
}

export async function apriPlanimetria(immId, { titolo = '', hint = '', docId = null } = {}) {
  const tutti = await listDocs(immId);
  const docs = (docId ? tutti.filter(d => d.id === docId) : tutti.filter(d => d.tipo === 'planimetria' && /^image\//.test(d.mime))).sort((a, b) => a.creato - b.creato);
  if (!docs.length) { toast('Nessuna planimetria in formato immagine per questo immobile. Aggiungerla dalla scheda Dati.', 'err'); return; }
  let idx = 0, pz = null;
  const img = h('img', { alt: 'Planimetria', draggable: 'false', class: 'pz-img' });
  const stage = h('div', { class: 'pz-stage' }, img);
  const sel = h('div', { class: 'pz-sel' });
  const lbl = h('div', { class: 'pz-title' }, titolo);
  const ov = h('div', { class: 'viewer' },
    h('div', { class: 'viewer-bar' }, lbl, h('button', { class: 'iconbtn light', 'aria-label': 'Chiudi', onclick: chiudi }, icon('close'))),
    hint ? h('div', { class: 'pz-hint' }, hint) : null, stage, sel);
  function chiudi() { pz && pz.destroy(); ov.remove(); }
  function mostra(i) {
    idx = i; const u = urlBlob(docs[i].blob);
    img.onload = () => { pz.fit(); };
    img.src = u;
    sel.replaceChildren(...(docs.length > 1 ? docs.map((d, k) => h('button', { class: 'chip light', 'aria-pressed': k === i ? 'true' : 'false', onclick: () => mostra(k) }, `Foglio ${k + 1}`)) : []));
  }
  root().append(ov);
  pz = panzoom(stage, img); mostra(0);
}

export async function apriFoto(lista, indice, ctx) {
  // ctx: { imm, ambs (array), onChange(), }
  let i = indice; const ambById = () => Object.fromEntries(ctx.ambs.map(a => [a.id, a]));
  const img = h('img', { alt: 'Fotografia', class: 'ph-img' });
  const titolo = h('div', { class: 'pz-title' });
  const info = h('div', { class: 'ph-info' });
  const tagBox = h('div', { class: 'chips' });
  const ambBox = h('div', { class: 'chips' });
  const nota = h('textarea', { rows: 2, placeholder: 'Nota sulla foto' });
  const ov = h('div', { class: 'viewer photo' },
    h('div', { class: 'viewer-bar' }, titolo, h('button', { class: 'iconbtn light', 'aria-label': 'Chiudi', onclick: chiudi }, icon('close'))),
    h('div', { class: 'ph-stage' }, img,
      h('button', { class: 'ph-nav prev', 'aria-label': 'Foto precedente', onclick: () => vai(-1) }, icon('back', 28)),
      h('button', { class: 'ph-nav next', 'aria-label': 'Foto successiva', onclick: () => vai(1) }, icon('next', 28))),
    h('div', { class: 'ph-panel' }, info,
      h('div', { class: 'lbl light' }, 'Etichetta'), tagBox,
      h('div', { class: 'lbl light' }, 'Ambiente'), ambBox,
      h('div', { class: 'lbl light' }, 'Nota'), nota,
      h('button', { class: 'btn danger-o', onclick: elimina }, icon('trash', 18), ' Elimina foto')));
  function chiudi() { ov.remove(); ctx.onChange && ctx.onChange(); }
  function vai(d) { if (!lista.length) return; i = (i + d + lista.length) % lista.length; mostra(); }
  async function modifica() { await salva('foto', lista[i], { subito: true }); titolo.textContent = nomeFoto(lista[i], ctx.imm, ambById()[lista[i].amb]); }
  async function elimina() {
    const ok = await confirmDialog({ title: 'Eliminare la foto?', text: 'La foto viene rimossa dal telefono. Se è già stata inviata al backup, la copia su Drive viene spostata nella cartella delle foto eliminate.', ok: 'Elimina', danger: true });
    if (!ok) return;
    await eliminaFoto(lista[i]); lista.splice(i, 1);
    if (!lista.length) return chiudi();
    if (i >= lista.length) i = lista.length - 1;
    mostra();
  }
  function mostra() {
    const f = lista[i]; const amb = ambById()[f.amb];
    img.src = urlBlob(f.blob);
    titolo.textContent = nomeFoto(f, ctx.imm, amb);
    const g = f.gps;
    info.replaceChildren(
      h('div', null, `${i + 1} di ${lista.length} · ${fmtDT(f.takenAt)} (${f.takenSource === 'exif' ? 'dai metadati' : f.takenSource === 'file' ? 'data del file' : 'data di acquisizione'})`),
      h('div', null, `${f.w}×${f.h} px · ${fmtBytes(f.size)}${f.origine === 'galleria' ? ' · importata da galleria' : ''}`),
      h('div', null, g ? `Posizione ${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}${g.acc != null ? ' (±' + g.acc + ' m)' : ''} · fonte: ${g.src === 'exif' ? 'metadati della foto' : g.src === 'app-import' ? 'GPS dell\'app all\'importazione (indicativa)' : 'GPS dell\'app allo scatto'}` : 'Posizione non registrata'));
    tagBox.replaceChildren(...TAGS.map(t => h('button', {
      class: 'chip light', 'aria-pressed': f.tag === t ? 'true' : 'false',
      onclick: async e => { f.tag = f.tag === t ? '' : t; [...tagBox.children].forEach(b => b.setAttribute('aria-pressed', b.textContent === f.tag ? 'true' : 'false')); await modifica(); }
    }, t)));
    ambBox.replaceChildren(...ctx.ambs.map(a => h('button', {
      class: 'chip light', 'aria-pressed': f.amb === a.id ? 'true' : 'false',
      onclick: async () => { f.amb = a.id; [...ambBox.children].forEach((b, k) => b.setAttribute('aria-pressed', ctx.ambs[k].id === f.amb ? 'true' : 'false')); await modifica(); }
    }, `${a.codice} ${a.codice === 'A00' ? 'Generale' : a.nome}`)));
    nota.value = f.nota || '';
    nota.oninput = () => { f.nota = nota.value; salva('foto', f); };
  }
  root().append(ov); mostra();
}

export async function apriDocumento(doc) {
  const u = urlBlob(doc.blob);
  const w = window.open(u, '_blank');
  if (!w) toast('Apertura bloccata dal browser: consentire le finestre per questa app.', 'err');
}
