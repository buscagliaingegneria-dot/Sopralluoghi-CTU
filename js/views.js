// Schermate dell'applicazione.
import * as DB from './db.js';
import * as M from './model.js';
import { h, toast, fmtBytes, fmtDT, fmtTime, confirmDialog, infoDialog, promptDialog, modal } from './util.js';
import { icon, appbar, vuoto, barra, chips, campo, gruppo, salva, scaricaSalvataggi, urlBlob, rilasciaUrl, marchio } from './ui.js';
import { IMM_GROUPS, VERIF_GROUPS, CONCL_GROUPS, AMB_GROUPS, ANAG_FIELDS, TAGS, AMB_TIPICI } from './schema.js';
import { parseProgramma } from './programma.js';
import { prepareFile, getPosition } from './photo.js';
import { apriPlanimetria, apriFoto, apriDocumento } from './viewers.js';
import { esportaArchivio } from './export.js';
import { espandi, abbina, riepilogo as riepDoc, importa as importaDoc } from './bulk.js';
import { riepilogo, condizioni, eseguiBackup, testConnessione } from './backup.js';
import { APP_VERSION } from './version.js';

export const stato = { rerender: () => location.reload(), aggiornamento: null, applicaAggiornamento: null, controllaAggiornamenti: null, tag: '', riavvioWake: () => { } };

const STATI_AMB = { rilevato: 'Rilevato', non_accessibile: 'Non accessibile', non_presente: 'Non presente' };

// ============================================================ HOME
export async function vistaHome() {
  const proc = await M.getProc();
  const { righe, pendenti } = await riepilogo();
  const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  const lastBk = await DB.getMeta('lastBackup', null);
  const server = await DB.getMeta('server', null);
  const inFile = h('input', { type: 'file', accept: '.csv,.json,.txt,text/csv,application/json,text/plain', hidden: true, onchange: e => importaProgramma(e.target.files[0], e.target) });
  const inDoc = h('input', { type: 'file', multiple: true, accept: 'image/*,application/pdf,.pdf,.zip,application/zip,application/x-zip-compressed', hidden: true, onchange: e => importaDocumenti(e.target.files, e.target) });

  const stat = h('section', { class: 'card status' },
    h('div', { class: 'st-main ' + (pendenti ? 'warn' : 'okk') },
      h('span', { class: 'st-ico' }, icon(pendenti ? 'warn' : 'check', 26)),
      h('div', null,
        h('div', { class: 'st-t' }, !righe.length ? 'Nessun dato sul telefono' : pendenti ? `${pendenti} element${pendenti === 1 ? 'o' : 'i'} non ancora in backup` : 'Tutto è in backup'),
        h('div', { class: 'st-s' }, lastBk ? `Ultimo backup: ${fmtDT(lastBk.at)}${lastBk.errori ? ' (con errori)' : ''}` : 'Backup non ancora eseguito'))),
    h('div', { class: 'st-row' },
      h('span', null, est && est.usage != null ? `Memoria usata: ${fmtBytes(est.usage)}` : 'Memoria: n.d.'),
      h('span', { id: 'net', class: navigator.onLine ? 'on' : 'off' }, navigator.onLine ? 'Connesso' : 'Senza rete')));

  const banner = stato.aggiornamento ? h('div', { class: 'card notice' },
    h('div', null, h('b', null, 'Nuova versione disponibile.'), ' Applicarla quando non si è in mezzo a un rilievo: i dati sul telefono non vengono toccati.'),
    h('button', { class: 'btn primary', onclick: () => stato.applicaAggiornamento && stato.applicaAggiornamento() }, 'Aggiorna ora')) : null;

  const lista = h('div', { class: 'cards' });
  for (const r of righe) {
    const ambs = await M.listAmb(r.imm.id);
    const lavorabili = ambs.filter(a => a.codice !== 'A00');
    const compl = lavorabili.filter(M.ambCompleto).length;
    const pct = lavorabili.length ? (compl / lavorabili.length) * 100 : 0;
    lista.append(h('a', { class: 'card imm', href: `#/i/${encodeURIComponent(r.imm.id)}/ambienti` },
      h('div', { class: 'imm-top' },
        h('span', { class: 'code' }, r.imm.codice),
        h('span', { class: 'pill ' + (r.imm.chiuso ? (r.imm.lacune ? 'warn' : 'ok') : '') }, r.imm.chiuso ? (r.imm.lacune ? 'Chiuso con lacune' : 'Chiuso') : 'Aperto'),
        r.pend ? h('span', { class: 'dot', title: 'Da salvare in backup' }) : null),
      h('div', { class: 'imm-addr' }, r.imm.anag.indirizzo || 'Indirizzo da inserire'),
      h('div', { class: 'imm-sub' }, [r.imm.anag.comune, r.imm.anag.piano && 'piano ' + r.imm.anag.piano, r.imm.anag.interno && 'int. ' + r.imm.anag.interno].filter(Boolean).join(' · ')),
      barra(pct),
      h('div', { class: 'imm-meta' }, `Ambienti ${compl}/${lavorabili.length} · Foto ${r.foto.tot}`)));
  }

  const page = h('div', { class: 'page' },
    appbar({ titolo: proc ? proc.codice : 'Sopralluoghi CTU', sotto: proc ? (proc.titolo || 'Procedimento attivo') : 'Nessun procedimento caricato', azioni: [h('a', { class: 'iconbtn', href: '#/impostazioni', 'aria-label': 'Impostazioni' }, icon('gear'))] }),
    h('main', { class: 'content' },
      banner, stat,
      righe.length ? h('h2', { class: 'sec' }, 'Immobili') : null,
      righe.length ? lista : vuoto('Nessun immobile', 'Caricare il file di programma preparato in studio (CSV o JSON) oppure aggiungere gli immobili a mano.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => aggiungiImmobile() }, icon('plus', 18), ' Aggiungi immobile'),
        h('button', { class: 'btn', onclick: () => inFile.click() }, icon('file', 18), ' Importa programma'),
        inFile),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', disabled: !righe.length, onclick: () => inDoc.click() }, icon('plan', 18), ' Importa planimetrie e visure (in blocco)'),
        inDoc),
      h('div', { class: 'actions two' },
        h('a', { class: 'btn primary', href: '#/backup' }, icon('cloud', 18), ' Backup di fine giornata'),
        h('button', { class: 'btn', disabled: !righe.length, onclick: e => esporta(e.currentTarget) }, icon('download', 18), ' Esporta archivio')),
      server && server.sheetUrl ? h('p', { class: 'hint' }, 'Foglio dei dati: ', h('a', { href: server.sheetUrl, target: '_blank', rel: 'noopener' }, 'apri su Google Fogli'), ' · ', h('a', { href: server.folderUrl, target: '_blank', rel: 'noopener' }, 'cartella su Drive')) : null,
      h('p', { class: 'foot' }, h('span', { class: 'fm' }, marchio(18)), ` FB Engineering · Sopralluoghi CTU ${APP_VERSION}`)));
  return page;
}

async function esporta(btn, soloImm = null) {
  btn.disabled = true; const t = btn.innerHTML;
  try {
    toast('Preparazione dell\'archivio…');
    const r = await esportaArchivio({ soloImm, onProgress: (i, n) => { btn.textContent = `Archivio ${i}/${n}…`; } });
    toast(`Archivio salvato in Download: ${r.nome} (${fmtBytes(r.size)})`, 'ok');
  } catch (e) { toast('Esportazione non riuscita: ' + e.message, 'err'); }
  finally { btn.disabled = false; btn.innerHTML = t; }
}

async function importaDocumenti(fileList, input) {
  const scelti = [...fileList]; input.value = '';
  if (!scelti.length) return;
  try {
    toast('Lettura dei file…');
    const { files, errori } = await espandi(scelti);
    const imms = await M.listImm();
    const { abbinati, scartati } = abbina(files, imms.map(i => i.codice));
    const tutti = [...errori, ...scartati];
    if (!abbinati.length) {
      return infoDialog({ title: 'Nessun file abbinato', body: h('div', null,
        h('p', { class: 'modal-text' }, 'Il nome di ogni file deve iniziare con il codice dell\'immobile, ad esempio IMM-07_planimetria.png.'),
        tutti.slice(0, 8).map(x => h('p', { class: 'modal-text err' }, `${x.nome}: ${x.motivo}`))) });
    }
    const per = riepDoc(abbinati);
    const righe = Object.keys(per).sort((a, b) => a.localeCompare(b, 'it', { numeric: true })).map(c => {
      const r = per[c]; const parti = [];
      if (r.planimetria) parti.push(`${r.planimetria} planimetri${r.planimetria === 1 ? 'a' : 'e'}`);
      if (r.visura) parti.push(`${r.visura} document${r.visura === 1 ? 'o' : 'i'}`);
      return h('li', null, h('span', { class: 'code' }, c), ' ', parti.join(', '));
    });
    const corpo = h('div', null,
      h('p', { class: 'modal-text' }, `${abbinati.length} file da importare in ${righe.length} immobili.`),
      h('ul', { class: 'plainlist', style: 'max-height:34vh;overflow:auto' }, righe),
      tutti.length ? h('div', null, h('p', { class: 'modal-text err' }, `${tutti.length} file non importati:`),
        h('ul', { class: 'plainlist miss', style: 'max-height:18vh;overflow:auto' }, tutti.slice(0, 10).map(x => h('li', null, `${x.nome}: ${x.motivo}`)))) : null,
      h('p', { class: 'hint' }, 'I file con lo stesso nome già presenti per quell\'immobile vengono sostituiti.'));
    const ok = await modal({ title: 'Importare i documenti?', body: corpo, actions: [{ label: 'Annulla', value: false }, { label: 'Importa', value: true, kind: 'primary' }] });
    if (!ok) return;
    const r = await importaDoc(abbinati, (i, n) => toast(`Importazione ${i} di ${n}…`));
    toast(`Documenti importati: ${r.nuovi} nuovi${r.sostituiti ? ', ' + r.sostituiti + ' sostituiti' : ''}.`, 'ok');
    stato.rerender();
  } catch (e) { toast(e.message, 'err'); await infoDialog({ title: 'Importazione non riuscita', body: e.message }); }
}

async function importaProgramma(file, input) {
  if (!file) return;
  try {
    const testo = await file.text(); input.value = '';
    const prog = parseProgramma(testo);
    if (prog.errori.length && !prog.immobili.length) return infoDialog({ title: 'File non valido', body: h('div', null, prog.errori.map(e => h('p', { class: 'modal-text' }, e))) });
    const cur = await M.getProc();
    if (!prog.proc.codice) {
      const c = await promptDialog({ title: 'Codice del procedimento', label: 'Numero di RG o altro riferimento (es. RG 1234/2026)', value: cur ? cur.codice : '', ok: 'Continua' });
      if (!c) return; prog.proc.codice = c;
    }
    const corpo = h('div', null,
      h('p', { class: 'modal-text' }, `Procedimento ${prog.proc.codice}: ${prog.immobili.length} immobili, ${prog.immobili.reduce((n, i) => n + i.ambienti.length, 0)} ambienti.`),
      h('ul', { class: 'plainlist' }, prog.immobili.slice(0, 12).map(i => h('li', null, h('span', { class: 'code' }, i.codice), ' ', i.anag.indirizzo || '(indirizzo mancante)'))),
      prog.immobili.length > 12 ? h('p', { class: 'hint' }, `… e altri ${prog.immobili.length - 12}`) : null,
      prog.errori.length ? h('p', { class: 'modal-text err' }, 'Attenzione: ' + prog.errori.join(' ')) : null,
      h('p', { class: 'hint' }, 'Gli immobili già presenti vengono aggiornati senza toccare le schede compilate.'));
    const ok = await modal({ title: 'Importare il programma?', body: corpo, actions: [{ label: 'Annulla', value: false }, { label: 'Importa', value: true, kind: 'primary' }] });
    if (!ok) return;
    const r = await M.applicaProgramma(prog);
    toast(`Programma importato: ${r.nuovi} nuovi, ${r.aggiornati} aggiornati.`, 'ok');
    location.hash = '#/'; stato.rerender();
  } catch (e) { toast(e.message, 'err'); await infoDialog({ title: 'Importazione non riuscita', body: e.message }); }
}

function formAnagrafica(titolo, valori) {
  const inputs = {};
  const body = h('div', { class: 'formgrid' }, ANAG_FIELDS.map(([k, l]) => {
    inputs[k] = k === 'intestatari' || k === 'noteAccesso' ? h('textarea', { rows: 2, value: valori[k] || '' }) : h('input', { type: 'text', value: valori[k] || '', autocomplete: 'off' });
    return h('label', { class: 'field' + (['indirizzo', 'intestatari', 'noteAccesso'].includes(k) ? ' wide' : '') }, h('span', { class: 'lbl' }, l), inputs[k]);
  }));
  return modal({
    title: titolo, body, actions: [{ label: 'Annulla', value: null }, {
      label: 'Salva', kind: 'primary', value: () => Object.fromEntries(ANAG_FIELDS.map(([k]) => [k, inputs[k].value.trim()]))
    }]
  });
}

export async function aggiungiImmobile() {
  let proc = await M.getProc();
  if (!proc) {
    const c = await promptDialog({ title: 'Codice del procedimento', label: 'Numero di RG o altro riferimento (es. RG 1234/2026)', ok: 'Continua' });
    if (!c) return; proc = { codice: c, titolo: '', importato: Date.now() }; await M.setProc(proc);
  }
  const anag = await formAnagrafica('Nuovo immobile', {});
  if (!anag) return;
  const codice = await M.prossimoCodiceImm();
  const imm = M.nuovoImmobile(codice, anag);
  await DB.put('immobili', imm); await M.ensureGenerale(imm);
  toast(`Creato ${codice}`, 'ok');
  location.hash = `#/i/${encodeURIComponent(codice)}/ambienti`;
}

// ============================================================ IMMOBILE
const TABS = [['dati', 'Dati'], ['verifica', 'Verifica'], ['ambienti', 'Ambienti'], ['foto', 'Foto'], ['chiusura', 'Chiusura']];

export async function vistaImmobile(immId, tab = 'ambienti') {
  const imm = await M.getImm(immId);
  if (!imm) return vuoto('Immobile non trovato', 'Tornare all\'elenco degli immobili.', h('a', { class: 'btn', href: '#/' }, 'Elenco'));
  if (!imm.rilievoInizio) { imm.rilievoInizio = Date.now(); await salva('immobili', imm, { subito: true }); }
  const gen = await M.ensureGenerale(imm);
  const ambs = await M.listAmb(imm.id);
  const onImm = () => salva('immobili', imm);

  let corpo;
  if (tab === 'dati') corpo = await tabDati(imm, onImm);
  else if (tab === 'verifica') corpo = await tabVerifica(imm, gen, onImm);
  else if (tab === 'foto') corpo = await tabFoto(imm, ambs, gen);
  else if (tab === 'chiusura') corpo = await tabChiusura(imm, ambs, onImm);
  else corpo = await tabAmbienti(imm, ambs);

  const mancanti = M.immMancanti(imm, ambs).length;
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Sezioni dell\'immobile' }, TABS.map(([id, l]) =>
    h('a', { href: `#/i/${encodeURIComponent(imm.id)}/${id}`, class: id === tab ? 'on' : '', 'aria-current': id === tab ? 'page' : null }, l,
      id === 'chiusura' && !imm.chiuso && mancanti ? h('i', { class: 'tb-dot' }) : null)));
  return h('div', { class: 'page with-tabs' },
    appbar({ titolo: imm.codice, sotto: [imm.anag.indirizzo, imm.anag.comune].filter(Boolean).join(', ') || 'Indirizzo da inserire', indietro: '#/',
      azioni: [h('button', { class: 'iconbtn', 'aria-label': 'Apri planimetria', onclick: () => apriPlanimetria(imm.id, { titolo: `${imm.codice} · planimetria` }) }, icon('plan'))] }),
    h('main', { class: 'content' }, corpo), tabbar);
}

async function tabDati(imm, onImm) {
  const docs = await M.listDocs(imm.id);
  const righe = ANAG_FIELDS.filter(([k]) => imm.anag[k]).map(([k, l]) => [h('dt', null, l), h('dd', null, imm.anag[k])]);
  const inPl = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: e => aggiungiDocs(imm, 'planimetria', e.target) });
  const inVi = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', multiple: true, hidden: true, onchange: e => aggiungiDocs(imm, 'visura', e.target) });
  const elenco = h('ul', { class: 'doclist' }, docs.length ? docs.map(d => h('li', null,
    h('button', { class: 'doclink', onclick: () => /^image\//.test(d.mime) ? apriPlanimetria(imm.id, { docId: d.id, titolo: d.nome }) : apriDocumento(d) }, icon('file', 18), h('span', null, d.nome), h('small', null, `${d.tipo} · ${fmtBytes(d.size)}`)),
    h('button', { class: 'iconbtn', 'aria-label': 'Rimuovi documento', onclick: async () => { if (await confirmDialog({ title: 'Rimuovere il documento?', text: d.nome, ok: 'Rimuovi', danger: true })) { await DB.del('docs', d.id); stato.rerender(); } } }, icon('trash', 18)))) : [h('li', { class: 'hint' }, 'Nessun documento caricato.')]);
  return h('div', null,
    h('section', { class: 'card' }, h('h2', { class: 'sec inl' }, 'Dati catastali'),
      righe.length ? h('dl', { class: 'dl' }, righe) : h('p', { class: 'hint' }, 'Nessun dato inserito.'),
      h('button', { class: 'btn', onclick: async () => { const a = await formAnagrafica('Dati dell\'immobile', imm.anag); if (a) { imm.anag = { ...imm.anag, ...a }; await salva('immobili', imm, { subito: true }); stato.rerender(); } } }, icon('edit', 18), ' Modifica dati')),
    h('section', { class: 'card' }, h('h2', { class: 'sec inl' }, 'Documenti'), elenco,
      h('p', { class: 'hint' }, 'Le planimetrie vanno caricate come immagini ritagliate sull\'unità, con i vani numerati (A01, A02…). Le visure possono essere anche PDF.'),
      h('div', { class: 'actions two' },
        h('button', { class: 'btn', onclick: () => inPl.click() }, icon('plan', 18), ' Aggiungi planimetria'),
        h('button', { class: 'btn', onclick: () => inVi.click() }, icon('file', 18), ' Aggiungi visura o altro'), inPl, inVi)),
    ...IMM_GROUPS.map((g, i) => gruppo(g, imm.f, onImm, { aperto: i === 0 })));
}
async function aggiungiDocs(imm, tipo, input) {
  const files = [...input.files]; input.value = '';
  try { for (const f of files) await M.aggiungiDoc(imm.id, tipo, f); toast(`${files.length} documento/i aggiunto/i`, 'ok'); stato.rerender(); }
  catch (e) { toast('Caricamento non riuscito: ' + e.message, 'err'); }
}

async function tabVerifica(imm, gen, onImm) {
  return h('div', null,
    h('section', { class: 'card' },
      h('p', null, 'Confrontare la planimetria con lo stato dei luoghi. Per ogni difformità scattare una foto con l\'etichetta «difformità».'),
      h('button', { class: 'btn', onclick: () => apriPlanimetria(imm.id, { titolo: `${imm.codice} · planimetria` }) }, icon('plan', 18), ' Apri planimetria')),
    ...VERIF_GROUPS.map(g => gruppo(g, imm.f, onImm, { aperto: true })),
    h('h2', { class: 'sec' }, 'Foto delle difformità'),
    await bloccoFoto(imm, gen, { tagIniziale: 'difformità' }));
}

async function tabAmbienti(imm, ambs) {
  const fotoTutte = await M.listFoto(imm.id);
  const conta = id => fotoTutte.filter(f => f.amb === id).length;
  const righe = ambs.map(a => {
    const compl = M.ambCompleto(a);
    const lab = a.stato !== 'rilevato' ? STATI_AMB[a.stato] : compl ? 'Compilato' : 'Da compilare';
    return h('a', { class: 'card row', href: `#/i/${encodeURIComponent(imm.id)}/a/${encodeURIComponent(a.codice)}` },
      h('span', { class: 'code' }, a.codice), h('span', { class: 'rname' }, a.codice === 'A00' ? 'Generale' : a.nome),
      h('span', { class: 'pill ' + (a.stato !== 'rilevato' ? 'mute' : compl ? 'ok' : '') }, lab),
      h('span', { class: 'cnt' }, `${conta(a.id)} foto`), icon('next', 18));
  });
  const aggiungi = async nome => {
    if (!nome) return;
    const base = nome.trim(); const stessi = ambs.filter(a => a.nome === base || a.nome.startsWith(base + ' ')).length;
    const a = await M.aggiungiAmbiente(imm, stessi ? `${base} ${stessi + 1}` : base);
    location.hash = `#/i/${encodeURIComponent(imm.id)}/a/${a.codice}`;
  };
  return h('div', null, h('div', { class: 'cards' }, righe),
    h('h2', { class: 'sec' }, 'Aggiungi ambiente'),
    h('div', { class: 'chips' }, AMB_TIPICI.map(n => h('button', { class: 'chip', onclick: () => aggiungi(n) }, n)),
      h('button', { class: 'chip', onclick: async () => aggiungi(await promptDialog({ title: 'Nuovo ambiente', label: 'Nome dell\'ambiente', ok: 'Aggiungi' })) }, 'Altro…')));
}

async function tabFoto(imm, ambs, gen) {
  const tutte = await M.listFoto(imm.id);
  const gruppi = ambs.map(a => ({ a, l: tutte.filter(f => f.amb === a.id) })).filter(x => x.l.length);
  const ctx = { imm, ambs, onChange: () => stato.rerender() };
  return h('div', null,
    h('h2', { class: 'sec' }, 'Foto generali (esterno, accessi, contatori)'),
    await bloccoFoto(imm, gen, {}),
    h('h2', { class: 'sec' }, `Tutte le foto (${tutte.length})`),
    gruppi.length ? gruppi.map(({ a, l }) => h('section', { class: 'card' }, h('h3', { class: 'sub' }, `${a.codice} · ${a.codice === 'A00' ? 'Generale' : a.nome}`),
      h('div', { class: 'thumbs' }, l.map(f => miniatura(f, () => apriFoto(tutte, tutte.indexOf(f), ctx)))))) : vuoto('Nessuna foto', 'Le foto scattate compaiono qui, raggruppate per ambiente.'));
}

async function tabChiusura(imm, ambs, onImm) {
  const manc = M.immMancanti(imm, ambs);
  const cont = h('div', { class: 'card' });
  const paint = () => {
    const m = M.immMancanti(imm, ambs);
    cont.replaceChildren(
      h('h2', { class: 'sec inl' }, imm.chiuso ? (imm.lacune ? 'Immobile chiuso con lacune' : 'Immobile chiuso') : 'Controllo di completezza'),
      m.length ? h('div', null, h('p', null, `Campi obbligatori mancanti: ${m.length}`), h('ul', { class: 'plainlist miss' }, m.slice(0, 20).map(x => h('li', null, x))), m.length > 20 ? h('p', { class: 'hint' }, `… e altri ${m.length - 20}`) : null)
        : h('p', { class: 'okline' }, icon('check', 18), ' Tutti i campi obbligatori sono compilati.'),
      h('div', { class: 'actions two' },
        imm.chiuso ? h('button', { class: 'btn', onclick: async () => { imm.chiuso = false; imm.lacune = false; await salva('immobili', imm, { subito: true }); stato.rerender(); } }, 'Riapri immobile')
          : h('button', { class: 'btn primary', onclick: chiudi }, 'Chiudi immobile'),
        h('button', { class: 'btn', onclick: e => esporta(e.currentTarget, imm.id) }, icon('download', 18), ' Esporta questo immobile')));
  };
  async function chiudi() {
    const m = M.immMancanti(imm, ambs);
    if (m.length) {
      const r = await modal({
        title: 'Scheda incompleta', body: h('div', null, h('p', { class: 'modal-text' }, `Mancano ${m.length} campi obbligatori:`), h('ul', { class: 'plainlist miss' }, m.slice(0, 12).map(x => h('li', null, x))), m.length > 12 ? h('p', { class: 'hint' }, `… e altri ${m.length - 12}`) : null),
        actions: [{ label: 'Torna alla scheda', value: 'no', kind: 'primary' }, { label: 'Chiudi con lacune', value: 'forza' }]
      });
      if (r !== 'forza') return; imm.lacune = true;
    } else { if (!await confirmDialog({ title: 'Chiudere l\'immobile?', text: 'Si potrà sempre riaprirlo.', ok: 'Chiudi' })) return; imm.lacune = false; }
    imm.chiuso = true; await salva('immobili', imm, { subito: true }); toast('Immobile chiuso', 'ok'); stato.rerender();
  }
  paint();
  return h('div', null, ...CONCL_GROUPS.map(g => gruppo(g, imm.f, () => { onImm(); }, { aperto: true })), cont);
}

// ============================================================ FOTO: blocco acquisizione
function miniatura(f, onclick) {
  return h('button', { class: 'thumb', onclick, 'aria-label': `Foto ${f.prog}` }, h('img', { src: urlBlob(f.thumb), alt: '', loading: 'lazy' }), h('span', { class: 'tn' }, String(f.prog).padStart(3, '0')), f.tag ? h('span', { class: 'tt' }, f.tag) : null);
}

async function bloccoFoto(imm, amb, { tagIniziale = '' } = {}) {
  if (tagIniziale) stato.tag = tagIniziale;
  const box = h('section', { class: 'card photoblock' });
  const ambs = await M.listAmb(imm.id);
  let occupato = false;
  const inCam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => acquisisci(e.target, 'fotocamera') });
  const inGal = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: e => acquisisci(e.target, 'galleria') });

  async function acquisisci(input, origine) {
    const files = [...input.files]; input.value = '';
    if (!files.length || occupato) return; occupato = true;
    const cfg = await M.getCfg();
    const gpsP = cfg.gps ? getPosition(6000) : Promise.resolve(null);
    files.sort((a, b) => (a.lastModified || 0) - (b.lastModified || 0));
    let ok = 0; const ko = [];
    for (let i = 0; i < files.length; i++) {
      toast(`Salvataggio foto ${i + 1} di ${files.length}…`);
      try {
        const prep = await prepareFile(files[i]);
        let g = null; if (!prep.gps) { const p = await gpsP; if (p) g = origine === 'galleria' ? { ...p, src: 'app-import' } : p; }
        await M.aggiungiFoto(imm.id, amb.id, prep, { tag: stato.tag, gps: g, origine });
        ok++;
      } catch (e) { ko.push(`${files[i].name || 'foto'}: ${e.message}`); }
    }
    occupato = false;
    if (ko.length) await infoDialog({ title: `${ko.length} foto non salvate`, body: h('div', null, ko.map(k => h('p', { class: 'modal-text err' }, k))) });
    if (ok) toast(`${ok} foto salvat${ok === 1 ? 'a' : 'e'} in ${amb.codice}`, 'ok');
    await paint();
  }
  async function paint() {
    const l = await M.listFotoAmb(amb.id);
    const ctx = { imm, ambs, onChange: () => paint() };
    box.replaceChildren(
      h('div', { class: 'lbl' }, 'Etichetta per i prossimi scatti'),
      h('div', { class: 'chips' }, TAGS.map(t => h('button', { class: 'chip', 'aria-pressed': stato.tag === t ? 'true' : 'false', onclick: e => { stato.tag = stato.tag === t ? '' : t; [...e.currentTarget.parentNode.children].forEach(b => b.setAttribute('aria-pressed', b.textContent === stato.tag ? 'true' : 'false')); } }, t))),
      h('div', { class: 'actions two' },
        h('button', { class: 'btn primary big', onclick: () => inCam.click() }, icon('camera', 22), ' Scatta'),
        h('button', { class: 'btn big', onclick: () => inGal.click() }, icon('image', 22), ' Da galleria'), inCam, inGal),
      h('div', { class: 'lbl' }, `Foto di questo ambiente: ${l.length}`),
      l.length ? h('div', { class: 'thumbs' }, [...l].reverse().map(f => miniatura(f, () => apriFoto(l, l.indexOf(f), ctx)))) : h('p', { class: 'hint' }, 'Nessuna foto ancora.'));
  }
  await paint(); return box;
}

// ============================================================ AMBIENTE
export async function vistaAmbiente(immId, codice) {
  const imm = await M.getImm(immId);
  const amb = imm && await DB.get('ambienti', M.ambId(immId, codice));
  if (!amb) return vuoto('Ambiente non trovato', 'Tornare alla scheda dell\'immobile.', h('a', { class: 'btn', href: `#/i/${encodeURIComponent(immId)}/ambienti` }, 'Ambienti'));
  const ambs = await M.listAmb(immId);
  const pos = ambs.findIndex(a => a.id === amb.id);
  const prec = ambs[pos - 1], succ = ambs[pos + 1];
  const onAmb = () => salva('ambienti', amb);
  const link = a => `#/i/${encodeURIComponent(immId)}/a/${encodeURIComponent(a.codice)}`;
  const nomeVis = amb.codice === 'A00' ? 'Generale' : amb.nome;

  const esito = h('div', { class: 'chips seg' }, Object.entries(STATI_AMB).map(([k, l]) => h('button', {
    class: 'chip', 'aria-pressed': amb.stato === k ? 'true' : 'false',
    onclick: async e => { amb.stato = k; [...e.currentTarget.parentNode.children].forEach((b, i) => b.setAttribute('aria-pressed', Object.keys(STATI_AMB)[i] === k ? 'true' : 'false')); await salva('ambienti', amb, { subito: true }); corpoGruppi.classList.toggle('off', k !== 'rilevato'); }
  }, l)));
  const corpoGruppi = h('div', { class: 'groups' + (amb.stato !== 'rilevato' ? ' off' : '') }, AMB_GROUPS.map((g, i) => gruppo(g, amb.f, onAmb, { aperto: i === 0 })));

  const altre = amb.codice === 'A00' ? null : h('section', { class: 'card' }, h('div', { class: 'actions two' },
    h('button', { class: 'btn', onclick: async () => { const n = await promptDialog({ title: 'Rinomina ambiente', label: 'Nome', value: amb.nome }); if (n) { amb.nome = n; await salva('ambienti', amb, { subito: true }); stato.rerender(); } } }, icon('edit', 18), ' Rinomina'),
    h('button', { class: 'btn danger-o', onclick: async () => {
      const n = (await M.listFotoAmb(amb.id)).length;
      if (n) return infoDialog({ title: 'Ambiente con foto', body: `Ci sono ${n} foto in questo ambiente. Spostarle o eliminarle dal dettaglio foto prima di eliminare l'ambiente.` });
      if (!await confirmDialog({ title: 'Eliminare l\'ambiente?', text: `${amb.codice} ${amb.nome}`, ok: 'Elimina', danger: true })) return;
      amb.eliminato = true; await salva('ambienti', amb, { subito: true }); location.hash = `#/i/${encodeURIComponent(immId)}/ambienti`;
    } }, icon('trash', 18), ' Elimina')));

  return h('div', { class: 'page with-foot' },
    appbar({ titolo: `${amb.codice} · ${nomeVis}`, sotto: `${imm.codice} · ${imm.anag.indirizzo || ''}`, indietro: `#/i/${encodeURIComponent(immId)}/ambienti`,
      azioni: [h('button', { class: 'iconbtn', 'aria-label': 'Apri planimetria', onclick: () => apriPlanimetria(immId, { titolo: `${amb.codice} · ${nomeVis}`, hint: amb.codice === 'A00' ? '' : `Cercare il vano ${amb.codice} (${amb.nome})` }) }, icon('plan'))] }),
    h('main', { class: 'content' },
      amb.codice === 'A00' ? null : esito,
      await bloccoFoto(imm, amb, {}),
      corpoGruppi, altre),
    h('nav', { class: 'footnav' },
      prec ? h('a', { class: 'btn', href: link(prec) }, icon('back', 18), ` ${prec.codice}`) : h('a', { class: 'btn', href: `#/i/${encodeURIComponent(immId)}/ambienti` }, 'Elenco'),
      succ ? h('a', { class: 'btn primary', href: link(succ) }, `${succ.codice} ${succ.nome}`, icon('next', 18)) : h('a', { class: 'btn primary', href: `#/i/${encodeURIComponent(immId)}/chiusura` }, 'Vai alla chiusura', icon('next', 18))));
}

// ============================================================ BACKUP
export async function vistaBackup() {
  const cfg = await M.getCfg(); const proc = await M.getProc();
  const avv = await condizioni();
  const { righe, pendenti } = await riepilogo();
  const server = await DB.getMeta('server', null);
  const log = h('ul', { class: 'log', 'aria-live': 'polite' });
  const prog = h('div', { class: 'progress hidden' }, h('div', { class: 'ptxt' }), barra(0));
  const esito = h('div', { class: 'esito' });
  let stop = false; let inCorso = false;

  const tab = h('div', { class: 'card' }, h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, h('th', null, 'Immobile'), h('th', null, 'Ambienti'), h('th', null, 'Foto'), h('th', null, 'Stato'))),
    h('tbody', null, righe.length ? righe.map(r => h('tr', null,
      h('td', null, h('span', { class: 'code' }, r.imm.codice)),
      h('td', null, `${r.amb.ok}/${r.amb.tot}`), h('td', null, `${r.foto.ok}/${r.foto.tot}`),
      h('td', null, r.pend ? h('span', { class: 'pill warn' }, `${r.pend} da inviare`) : h('span', { class: 'pill ok' }, 'In backup')))) : h('tr', null, h('td', { colspan: 4 }, 'Nessun dato.')))));

  const btn = h('button', { class: 'btn primary big', disabled: !proc || !righe.length, onclick: avvia }, icon('cloud', 22), ' Avvia backup');
  const btnStop = h('button', { class: 'btn hidden', onclick: () => { stop = true; btnStop.disabled = true; btnStop.textContent = 'Interruzione…'; } }, 'Interrompi');

  async function avvia() {
    if (inCorso) return;
    if (!cfg.scriptUrl || !cfg.token) { toast('Configurare prima indirizzo e token in Impostazioni.', 'err'); location.hash = '#/impostazioni'; return; }
    if (avv.length && !await confirmDialog({ title: 'Condizioni non ideali', text: avv.join(' ') + ' Procedere comunque?', ok: 'Procedi' })) return;
    inCorso = true; stop = false; btn.disabled = true; btnStop.classList.remove('hidden'); prog.classList.remove('hidden'); log.replaceChildren(); esito.replaceChildren();
    await scaricaSalvataggi();
    let wl = null; try { wl = navigator.wakeLock && await navigator.wakeLock.request('screen'); } catch { /* facoltativo */ }
    try {
      const r = await eseguiBackup({
        log: (m, k) => { log.append(h('li', { class: k || '' }, `${fmtTime(Date.now())} ${m}`)); log.lastChild.scrollIntoView({ block: 'nearest' }); },
        progress: (i, n, lab) => { prog.firstChild.textContent = n ? `${i} di ${n}${lab ? ' · ' + lab : ''}` : ''; prog.lastChild.firstChild.style.width = (n ? (i / n) * 100 : 100) + '%'; },
        annullato: () => stop,
      });
      const ok = !r.errori.length && !r.verifica.length;
      esito.replaceChildren(h('div', { class: 'card ' + (ok ? 'okbox' : 'errbox') },
        h('h2', { class: 'sec inl' }, ok ? 'Backup completato' : 'Backup concluso con segnalazioni'),
        h('p', null, `Inviati: ${r.schede} schede, ${r.ambienti} ambienti, ${r.foto} foto in ${Math.round(r.durata / 1000)} s.`),
        r.errori.length ? h('ul', { class: 'plainlist miss' }, r.errori.slice(0, 8).map(e => h('li', null, e))) : null,
        r.verifica.length ? h('p', null, 'Quantità non coincidenti per: ' + r.verifica.map(v => v.imm).join(', ') + '. Ripetere il backup.') : null,
        ok ? h('p', null, 'La giornata può considerarsi chiusa. Conservare anche l\'archivio esportato via cavo come seconda copia.') : h('p', null, 'Ripetere il backup: verranno inviati solo gli elementi mancanti.')));
    } catch (e) {
      log.append(h('li', { class: 'err' }, e.code === 'STOP' ? 'Backup interrotto. Quanto già confermato resta salvato.' : 'Errore: ' + e.message));
      if (e.code === 'AUTH') toast('Token non valido: controllare Impostazioni.', 'err');
    } finally {
      inCorso = false; btnStop.classList.add('hidden'); btnStop.disabled = false; btnStop.textContent = 'Interrompi'; btn.disabled = false;
      if (wl) try { wl.release(); } catch { /* ignora */ }
    }
  }

  return h('div', { class: 'page' },
    appbar({ titolo: 'Backup di fine giornata', sotto: proc ? proc.codice : '', indietro: '#/' }),
    h('main', { class: 'content' },
      avv.length ? h('div', { class: 'card notice' }, h('b', null, 'Prima di iniziare'), h('ul', { class: 'plainlist' }, avv.map(a => h('li', null, a)))) : h('p', { class: 'hint' }, 'Consigliato: Wi-Fi dello studio e telefono in carica.'),
      tab,
      h('p', { class: 'hint' }, `Qualità di invio delle foto: ${cfg.qualita === 'originale' ? 'originali' : 'copia ridotta (lato lungo 2000 px)'}. Gli originali restano sul telefono e nell'archivio esportato.`),
      h('div', { class: 'actions two' }, btn, btnStop), prog, log, esito,
      server && server.sheetUrl ? h('p', { class: 'hint' }, h('a', { href: server.sheetUrl, target: '_blank', rel: 'noopener' }, 'Apri il foglio Google'), ' · ', h('a', { href: server.folderUrl, target: '_blank', rel: 'noopener' }, 'Apri la cartella su Drive')) : null,
      h('h2', { class: 'sec' }, 'Copia locale'),
      h('p', { class: 'hint' }, 'Seconda copia indipendente dal cloud: esporta un archivio ZIP con le foto originali e i CSV, poi copialo sul computer via cavo.'),
      h('button', { class: 'btn', disabled: !righe.length, onclick: e => esporta(e.currentTarget) }, icon('download', 18), ' Esporta archivio completo')));
}

// ============================================================ IMPOSTAZIONI
export async function vistaImpostazioni() {
  const cfg = await M.getCfg(); const proc = await M.getProc();
  const persist = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
  const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  const n = { imm: await DB.count('immobili'), amb: await DB.count('ambienti'), foto: await DB.count('foto'), doc: await DB.count('docs') };
  const salvaCfg = async () => { await M.setCfg(cfg); stato.riavvioWake(); };
  const url = h('input', { type: 'url', value: cfg.scriptUrl, placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', oninput: e => { cfg.scriptUrl = e.target.value.trim(); salvaCfg(); } });
  const tok = h('input', { type: 'password', value: cfg.token, autocomplete: 'off', oninput: e => { cfg.token = e.target.value.trim(); salvaCfg(); } });
  const esitoTest = h('p', { class: 'hint' });
  const togg = (chiave, etichetta, aiuto) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: !!cfg[chiave], onchange: e => { cfg[chiave] = e.target.checked; salvaCfg(); } }), h('span', null, h('b', null, etichetta), h('small', null, aiuto)));
  const qual = h('div', { class: 'chips' }, [['ridotta', 'Copia ridotta (2000 px)'], ['originale', 'Originali']].map(([k, l]) => h('button', { class: 'chip', 'aria-pressed': cfg.qualita === k ? 'true' : 'false', onclick: e => { cfg.qualita = k; [...e.currentTarget.parentNode.children].forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false')); salvaCfg(); } }, l)));

  return h('div', { class: 'page' },
    appbar({ titolo: 'Impostazioni', indietro: '#/' }),
    h('main', { class: 'content' },
      h('section', { class: 'card' }, h('h2', { class: 'sec inl' }, 'Collegamento al backup'),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Indirizzo della web app (Apps Script)'), url),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Token segreto'), tok),
        h('button', { class: 'btn', onclick: async () => { esitoTest.textContent = 'Verifica in corso…'; try { const r = await testConnessione(cfg); esitoTest.textContent = `Collegamento riuscito (versione script ${r.versione}).`; esitoTest.className = 'hint okline'; } catch (e) { esitoTest.textContent = e.message; esitoTest.className = 'hint err'; } } }, 'Verifica collegamento'), esitoTest,
        h('h3', { class: 'sub' }, 'Foto inviate al backup'), qual),
      h('section', { class: 'card' }, h('h2', { class: 'sec inl' }, 'Comportamento'),
        togg('gps', 'Registra la posizione', 'Coordinate GPS salvate con ogni foto, come riscontro.'),
        togg('wake', 'Schermo acceso durante la compilazione', 'Si spegne dopo alcuni minuti di inattività.')),
      h('section', { class: 'card' }, h('h2', { class: 'sec inl' }, 'Memoria del telefono'),
        h('p', null, `Immobili ${n.imm} · ambienti ${n.amb} · foto ${n.foto} · documenti ${n.doc}`),
        h('p', null, est && est.usage != null ? `Spazio occupato dall'app: ${fmtBytes(est.usage)}` : 'Spazio occupato: n.d.'),
        h('p', null, persist ? 'Archiviazione persistente attiva: il sistema non cancella i dati automaticamente.' : 'Archiviazione persistente non ancora concessa: in caso di memoria quasi piena il sistema potrebbe cancellare i dati.'),
        persist ? null : h('button', { class: 'btn', onclick: async () => { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; toast(ok ? 'Archiviazione persistente attivata' : 'Il browser non ha concesso l\'archiviazione persistente. Installare l\'app sulla schermata principale e riprovare.', ok ? 'ok' : 'err'); if (ok) stato.rerender(); } }, 'Richiedi archiviazione persistente')),
      h('section', { class: 'card' }, h('h2', { class: 'sec inl' }, 'Aggiornamento dell\'app'),
        h('p', null, `Versione installata: ${APP_VERSION}`),
        h('button', { class: 'btn', onclick: async () => { toast('Ricerca aggiornamenti…'); const r = stato.controllaAggiornamenti ? await stato.controllaAggiornamenti() : null; if (stato.aggiornamento) toast('Nuova versione disponibile: si applica dalla schermata iniziale.', 'ok'); else toast(r === false ? 'Senza rete: impossibile controllare.' : 'L\'app è aggiornata.'); } }, 'Controlla aggiornamenti')),
      h('section', { class: 'card danger-zone' }, h('h2', { class: 'sec inl' }, 'Chiudere il procedimento'),
        h('p', null, 'Cancella dal telefono tutti i dati del procedimento attivo. È possibile solo quando tutto risulta in backup.'),
        h('button', { class: 'btn danger-o', disabled: !proc, onclick: chiudiProcedimento }, icon('trash', 18), ' Svuota il telefono'))));
}

async function chiudiProcedimento() {
  const { pendenti } = await riepilogo();
  if (pendenti) return infoDialog({ title: 'Dati non ancora in backup', body: `Ci sono ${pendenti} elementi non confermati sul cloud. Eseguire il backup ed esportare l'archivio prima di svuotare il telefono.` });
  const exp = await DB.getMeta('lastExport', null);
  if (!exp && !await confirmDialog({ title: 'Nessuna copia locale', text: 'Non è mai stato esportato un archivio ZIP. Le foto originali sono solo su questo telefono e nella galleria. Procedere comunque?', ok: 'Procedi' })) return;
  if (!await confirmDialog({ title: 'Svuotare il telefono?', text: 'Schede, foto e documenti del procedimento vengono rimossi da questa app. Operazione non reversibile.', ok: 'Svuota', danger: true })) return;
  await DB.clearStores(['immobili', 'ambienti', 'foto', 'docs']);
  for (const k of ['proc', 'server', 'lastBackup', 'lastExport', 'lastRoute']) await DB.del('meta', k);
  toast('Telefono svuotato', 'ok'); location.hash = '#/';
}

export { rilasciaUrl };
