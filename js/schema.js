// Struttura della scheda di rilievo (versione 1.2). Tipi di campo:
//  chips = scelta singola (secondo tocco sullo stesso valore lo deseleziona)
//  multi = scelta multipla
//  text  = testo breve
//  area  = testo lungo
// "req" = obbligatorio per poter chiudere l'ambiente o l'immobile.
//
// Tre livelli:
//  - EDIFICIO  : dati comuni a tutte le unità dello stesso edificio (struttura, facciata, parti comuni)
//  - IMMOBILE  : dati propri di ciascuna unità (finiture interne, infissi, impianti), mai condivisi tra unità
//  - AMBIENTE  : soltanto problematiche (umidità, lesioni…), giudizio, foto e note

export const STATO = ['Ottimo', 'Buono', 'Mediocre', 'Scadente', 'Da rifare', 'N.a.'];
const F = (k, l, t, o, extra) => ({ k, l, t, o, ...(extra || {}) });

const O = {
  pav: ['Gres porcellanato', 'Ceramica', 'Cotto', 'Marmo o pietra', 'Graniglia o cementine', 'Parquet', 'Laminato', 'Battuto di cls', 'Resina', 'Altro', 'Assente'],
  riv: ['Ceramica', 'Gres', 'Marmo o pietra', 'Pittura lavabile', 'Carta da parati', 'Altro', 'Assente'],
  par: ['Tinteggiatura', 'Idropittura', 'Intonaco civile', 'Intonaco grezzo', 'Carta da parati', 'Pietra a vista', 'Altro'],
  sof: ['Tinteggiatura', 'Controsoffitto', 'Travi a vista', 'Volta', 'Solaio a vista', 'Altro'],
  iesMat: ['Legno', 'Alluminio', 'Alluminio a taglio termico', 'PVC', 'Ferro', 'Altro', 'Assenti'],
  iesVet: ['Singolo', 'Doppio', 'Basso emissivo', 'N.d.'],
  iesOsc: ['Persiana', 'Tapparella', 'Scuro', 'Veneziana', 'Inferriata', 'Assenti'],
  iinTip: ['Legno tamburato', 'Legno massello', 'Laminato', 'Vetro', 'Scorrevole', 'Altro', 'Assenti'],
  el: ['Sottotraccia', 'A vista', 'Assente', 'Non verificabile'],
  id: ['Presente', 'Assente', 'Non verificabile'],
  te: ['Radiatori', 'Ventilconvettori', 'Pannelli radianti', 'Stufa o camino', 'Assente'],
  cl: ['Split', 'Canalizzata', 'Predisposizione', 'Assente'],
  cit: ['Citofono', 'Videocitofono', 'Assente'],
};

// ---------- Ambiente (dalla 1.2: solo problematiche, giudizio e note) ----------
export const AMB_GROUPS = [
  { id: 'deg', titolo: 'Umidità e degrado', campi: [
    F('deg_um', 'Umidità', 'chips', ['Assente', 'Tracce', 'Diffusa', 'Da infiltrazione']),
    F('deg_mu', 'Muffe', 'chips', ['Assenti', 'Puntuali', 'Diffuse']),
    F('deg_fe', 'Lesioni e fessurazioni', 'chips', ['Assenti', 'Capillari', 'Evidenti', 'Da approfondire'], { h: 'Fessurazioni' }),
    F('deg_di', 'Distacchi di intonaco', 'chips', ['Assenti', 'Localizzati', 'Estesi']),
    F('deg_nt', 'Dove e note sul degrado', 'area', undefined, { h: 'Dove e note' }),
  ] },
  { id: 'gen', titolo: 'Giudizio sull\'ambiente', campi: [
    F('cons', 'Conservazione complessiva', 'chips', STATO, { req: true }),
    F('ecc_nt', 'Differenze rispetto alle finiture, agli infissi o agli impianti dell\'immobile', 'area'),
    F('amb_nt', 'Note (fatti inconsueti)', 'area', undefined, { h: 'Note' }),
  ] },
];

// ---------- Ambiente: campi della versione 1.1, conservati per non perdere i dati già raccolti ----------
export const LEGACY_AMB_GROUPS = [
  { id: 'pav', titolo: 'Pavimento', campi: [F('pav_mat', 'Materiale', 'chips', O.pav), F('pav_fmt', 'Formato, posa, note', 'text'), F('pav_st', 'Stato di conservazione', 'chips', STATO)] },
  { id: 'riv', titolo: 'Rivestimenti', campi: [F('riv_mat', 'Materiale', 'chips', O.riv), F('riv_h', 'Altezza e ubicazione', 'text'), F('riv_st', 'Stato di conservazione', 'chips', STATO)] },
  { id: 'par', titolo: 'Pareti', campi: [F('par_fin', 'Finitura', 'chips', O.par), F('par_st', 'Stato di conservazione', 'chips', STATO)] },
  { id: 'sof', titolo: 'Soffitto', campi: [F('sof_fin', 'Finitura', 'chips', O.sof), F('sof_h', 'Altezza rilevata a vista', 'text'), F('sof_st', 'Stato di conservazione', 'chips', STATO)] },
  { id: 'ies', titolo: 'Infissi esterni', campi: [F('ies_n', 'Numero e dimensione indicativa', 'text'), F('ies_mat', 'Materiale', 'chips', O.iesMat), F('ies_vet', 'Vetro', 'chips', O.iesVet), F('ies_osc', 'Oscuranti', 'multi', O.iesOsc), F('ies_st', 'Stato di conservazione', 'chips', STATO)] },
  { id: 'iin', titolo: 'Porte interne', campi: [F('iin_tip', 'Tipologia', 'chips', O.iinTip), F('iin_st', 'Stato di conservazione', 'chips', STATO)] },
  { id: 'imp', titolo: 'Impianti', campi: [
    F('imp_el', 'Impianto elettrico', 'chips', O.el), F('imp_el_st', 'Stato impianto elettrico', 'chips', STATO),
    F('imp_id', 'Impianto idrico-sanitario', 'chips', O.id), F('imp_id_st', 'Stato impianto idrico', 'chips', STATO),
    F('imp_te', 'Riscaldamento (terminali)', 'multi', O.te), F('imp_te_st', 'Stato riscaldamento', 'chips', STATO),
    F('imp_cl', 'Climatizzazione', 'chips', O.cl), F('imp_gas', 'Impianto gas', 'chips', O.id), F('imp_cit', 'Citofono', 'chips', O.cit),
    F('imp_tv', 'Prese TV e dati', 'chips', ['Presenti', 'Assenti']), F('imp_cf', 'Conformità apparente', 'chips', ['Apparentemente conforme', 'Dubbia', 'Non conforme', 'Non verificabile']),
    F('imp_nt', 'Note sugli impianti', 'area')] },
  { id: 'san', titolo: 'Sanitari e apparecchi', campi: [F('san_ap', 'Apparecchi presenti', 'multi', ['Lavabo', 'WC', 'Bidet', 'Doccia', 'Vasca', 'Lavello', 'Piano cottura', 'Attacco lavatrice', 'Scaldabagno']), F('san_st', 'Stato apparecchi e rubinetteria', 'chips', STATO)] },
];
export const hasLegacy = f => LEGACY_AMB_GROUPS.some(g => g.campi.some(c => isFilled(f && f[c.k])));

// Corrispondenza tra i campi per ambiente (1.1) e la scheda generale dell'immobile (1.2), per il riporto dei valori comuni
export const LEGACY_MAP = [
  ['pav_mat', 'fin_pav'], ['pav_st', 'fin_pav_st'], ['riv_mat', 'fin_riv'], ['riv_st', 'fin_riv_st'],
  ['par_fin', 'fin_par'], ['par_st', 'fin_par_st'], ['sof_fin', 'fin_sof'], ['sof_st', 'fin_sof_st'],
  ['ies_mat', 'ies_mat'], ['ies_vet', 'ies_vet'], ['ies_osc', 'ies_osc'], ['ies_st', 'ies_st'],
  ['iin_tip', 'iin_tip'], ['iin_st', 'iin_st'],
  ['imp_el', 'imp_el'], ['imp_el_st', 'imp_el_st'], ['imp_id', 'imp_id'], ['imp_id_st', 'imp_id_st'], ['imp_te', 'imp_te'], ['imp_te_st', 'imp_te_st'],
  ['imp_cl', 'imp_cl'], ['imp_gas', 'imp_gas'], ['imp_cit', 'imp_cit'], ['imp_tv', 'imp_tv'], ['imp_cf', 'imp_cf'], ['san_st', 'san_st'],
];

// ---------- Edificio: dati comuni a tutte le unità ----------
export const ED_GROUPS = [
  { id: 'str', titolo: 'Struttura', campi: [
    F('str_tip', 'Tipologia strutturale', 'chips', ['Muratura portante', 'Telaio in c.a.', 'Struttura mista (muratura e c.a.)', 'Struttura in acciaio', 'Struttura in legno', 'Altro', 'N.d.'], { req: true }),
    F('str_mur', 'Materiale della muratura', 'multi', ['Pietra', 'Laterizio pieno', 'Laterizio forato', 'Blocchi di cls', 'Tufo', 'Altro']),
    F('str_sol', 'Solai', 'multi', ['Latero-cemento', 'Travi in ferro e voltine', 'Legno', 'C.a. pieno', 'Volte', 'Altro', 'N.d.']),
    F('str_cop', 'Copertura', 'chips', ['Piana (terrazza)', 'A falde', 'Mista', 'N.d.']),
    F('str_st', 'Stato apparente delle strutture', 'chips', STATO),
    F('str_nt', 'Note sulla struttura', 'area'),
  ] },
  { id: 'fac', titolo: 'Facciata ed esterni', campi: [
    F('fac_fin', 'Finiture esterne', 'multi', ['Intonaco e tinteggiatura', 'Intonaco civile', 'Pietra a vista', 'Laterizio a vista', 'Rivestimento ceramico o klinker', 'Cemento a vista', 'Altro']),
    F('fac_st', 'Stato di conservazione della facciata', 'chips', STATO),
    F('fac_nt', 'Note su facciata e prospetti', 'text'),
  ] },
  { id: 'com', titolo: 'Parti comuni e dotazioni', campi: [
    F('epoca', 'Epoca di costruzione (presunta)', 'chips', ['Ante 1942', '1942-1967', '1968-1990', '1991-2010', 'Dopo il 2010', 'N.d.']),
    F('asc', 'Ascensore', 'chips', ['Presente', 'Assente', 'N.a.']),
    F('acc', 'Accessibilità', 'chips', ['Senza barriere', 'Con barriere architettoniche', 'N.d.']),
    F('dot', 'Dotazioni condominiali', 'multi', ['Portineria', 'Cortile o giardino', 'Parcheggio', 'Impianto centralizzato', 'Autoclave', 'Videosorveglianza', 'Terrazza comune']),
    F('edi_st', 'Stato di parti comuni e scale', 'chips', STATO, { nota: 'Nella versione precedente comprendeva anche la facciata.' }),
  ] },
];

// ---------- Edificio: dati generali (tipologia edilizia, numero di unità, note), facoltativi ----------
// Gruppo a parte: si mostra per primo, ma le colonne si accodano a quelle di ED_GROUPS.
// La tipologia edilizia non deriva dal numero di unità associate nel rilievo e non è la tipologia strutturale (str_tip).
// "se" = il campo si mostra solo quando la funzione, applicata ai dati dell'edificio, è vera.
export const ED_TIP = ['Villa isolata', 'Villa a schiera', 'Villa bifamiliare', 'Villa trifamiliare', 'Villa quadrifamiliare', 'Edificio condominiale o palazzina', 'Fabbricato rurale', 'Edificio commerciale o direzionale', 'Edificio produttivo', 'Altro'];
export const ED_GEN_GROUPS = [
  { id: 'gen', titolo: 'Generale', campi: [
    F('ed_tip', 'Tipologia edilizia', 'chips', ED_TIP),
    F('ed_tip_alt', 'Altra tipologia (specificare)', 'text', undefined, { h: 'Tipologia edilizia (altro)', se: f => f && f.ed_tip === 'Altro' }),
    F('ed_nu', 'Unità immobiliari nell\'edificio', 'num', undefined, { nota: 'Dato inserito a mano: è distinto dal numero di unità associate nel rilievo.' }),
    F('ed_nt', 'Note generali', 'area'),
  ] },
];

// ---------- Immobile (unità): dati propri, mai condivisi con le altre unità ----------
export const IMM_GROUPS = [
  { id: 'ril', titolo: 'Rilievo e occupazione', campi: [
    F('presenti', 'Presenti all\'accesso', 'text'),
    F('occ', 'Stato di occupazione', 'chips', ['Libero', 'Occupato dal proprietario', 'Occupato da terzi con titolo', 'Occupato senza titolo', 'Non accessibile'], { req: true }),
    F('occ_nt', 'Dettagli sull\'occupazione', 'text'),
    F('uso', 'Utilizzo attuale', 'chips', ['Abitazione', 'Ufficio', 'Negozio', 'Magazzino o deposito', 'Garage o box', 'Non utilizzato', 'Altro']),
    F('cons_g', 'Conservazione generale', 'chips', STATO, { req: true }),
    F('ristr', 'Interventi di ristrutturazione visibili', 'text'),
  ] },
  { id: 'fin', titolo: 'Finiture interne', campi: [
    F('fin_pav', 'Pavimenti', 'multi', O.pav), F('fin_pav_st', 'Stato dei pavimenti', 'chips', STATO),
    F('fin_riv', 'Rivestimenti', 'multi', O.riv), F('fin_riv_st', 'Stato dei rivestimenti', 'chips', STATO),
    F('fin_par', 'Pareti', 'multi', O.par), F('fin_par_st', 'Stato delle pareti', 'chips', STATO),
    F('fin_sof', 'Soffitti', 'multi', O.sof), F('fin_sof_st', 'Stato dei soffitti', 'chips', STATO),
    F('fin_nt', 'Note sulle finiture', 'area'),
  ] },
  { id: 'inf', titolo: 'Infissi e porte', campi: [
    F('ies_mat', 'Infissi esterni: materiale', 'multi', O.iesMat), F('ies_vet', 'Infissi esterni: vetro', 'multi', O.iesVet),
    F('ies_osc', 'Oscuranti', 'multi', O.iesOsc), F('ies_st', 'Stato degli infissi esterni', 'chips', STATO),
    F('iin_tip', 'Porte interne', 'multi', O.iinTip), F('ing_porta', 'Porta d\'ingresso', 'chips', ['Blindata', 'Legno', 'Altro']),
    F('iin_st', 'Stato delle porte', 'chips', STATO), F('inf_nt', 'Note su infissi e porte', 'area'),
  ] },
  { id: 'imp', titolo: 'Impianti', campi: [
    F('imp_el', 'Impianto elettrico', 'chips', O.el), F('imp_el_st', 'Stato impianto elettrico', 'chips', STATO),
    F('quadro', 'Quadro elettrico', 'chips', ['Magnetotermico differenziale', 'Solo fusibili', 'Non verificabile']),
    F('imp_id', 'Impianto idrico-sanitario', 'chips', O.id), F('imp_id_st', 'Stato impianto idrico', 'chips', STATO),
    F('acs', 'Produzione acqua calda', 'chips', ['Caldaia murale', 'Scaldabagno elettrico', 'Centralizzata', 'Pompa di calore', 'Solare termico', 'Assente']),
    F('imp_te', 'Riscaldamento (terminali)', 'multi', O.te), F('imp_te_st', 'Stato riscaldamento', 'chips', STATO),
    F('imp_cl', 'Climatizzazione', 'multi', O.cl), F('imp_gas', 'Impianto gas', 'chips', O.id), F('imp_cit', 'Citofono', 'chips', O.cit),
    F('imp_tv', 'Prese TV e dati', 'chips', ['Presenti', 'Assenti']),
    F('cont', 'Contatori presenti', 'multi', ['Elettrico', 'Gas', 'Acqua']),
    F('ape', 'Attestato di prestazione energetica', 'chips', ['Presente', 'Assente', 'N.d.']),
    F('imp_cf', 'Conformità apparente', 'chips', ['Apparentemente conforme', 'Dubbia', 'Non conforme', 'Non verificabile']),
    F('ig_nt', 'Note sugli impianti', 'area'),
  ] },
  { id: 'san', titolo: 'Sanitari e rubinetteria', campi: [
    F('san_st', 'Stato di sanitari e rubinetteria', 'chips', STATO), F('san_nt', 'Note', 'text'),
  ] },
];

// ---------- Immobile: verifica di corrispondenza con la planimetria ----------
const CORR = ['Corrispondente', 'Lievi difformità', 'Difformità rilevanti', 'Non verificabile'];
const PRES = ['Assenti', 'Presenti e non rappresentati', 'Non verificabile'];
export const VERIF_GROUPS = [
  { id: 'vc', titolo: 'Corrispondenza con la planimetria catastale', campi: [
    F('vc_dat', 'Data della planimetria', 'text'),
    F('vc_dis', 'Distribuzione degli ambienti e destinazioni', 'chips', CORR),
    F('vc_tra', 'Tramezzi (aggiunti, demoliti, spostati)', 'chips', CORR),
    F('vc_ape', 'Porte e finestre principali', 'chips', CORR),
    F('vc_amp', 'Verande, chiusure di balconi, ampliamenti', 'chips', PRES),
    F('vc_alt', 'Altezza apparente dei locali', 'chips', ['Corrispondente', 'Difforme', 'Non verificabile']),
    F('vc_sop', 'Soppalchi o ambienti nel sottotetto', 'chips', PRES),
    F('vc_per', 'Pertinenze (cantine, box, posti auto)', 'chips', ['Corrispondenti', 'Difformi', 'Non presenti', 'Non verificabile']),
    F('vc_giu', 'Giudizio complessivo', 'chips', ['Corrispondente', 'Lievi difformità distributive', 'Difformità rilevanti', 'Non verificabile'], { req: true }),
    F('vc_ril', 'Rilievo metrico integrativo necessario', 'chips', ['Sì', 'No'], { req: true }),
    F('vc_nt', 'Descrizione delle difformità', 'area'),
  ] },
];

// ---------- Immobile: conclusioni ----------
export const CONCL_GROUPS = [
  { id: 'co', titolo: 'Criticità e approfondimenti', campi: [
    F('anom', 'Anomalie e criticità riscontrate', 'area'),
    F('appr', 'Approfondimenti necessari', 'multi', ['Verifica impianti', 'Indagine strutturale', 'Documentazione da richiedere', 'Rilievo metrico', 'Accertamento urbanistico', 'Nuovo accesso', 'Altro']),
    F('appr_nt', 'Dettaglio degli approfondimenti', 'area'),
    F('giu', 'Giudizio sintetico sullo stato manutentivo', 'chips', STATO, { req: true }),
  ] },
];

export const ANAG_FIELDS = [
  ['indirizzo', 'Indirizzo'], ['comune', 'Comune'], ['piano', 'Piano'], ['interno', 'Interno'],
  ['foglio', 'Foglio'], ['particella', 'Particella'], ['sub', 'Subalterno'], ['categoria', 'Categoria'],
  ['classe', 'Classe'], ['consistenza', 'Consistenza'], ['superficie', 'Superficie catastale'], ['rendita', 'Rendita'],
  ['intestatari', 'Intestatari'], ['referente', 'Referente per l\'accesso'], ['noteAccesso', 'Note di accesso'],
  ['dataPlanimetria', 'Data della planimetria'],
];

export const TAGS = ['insieme', 'dettaglio', 'criticità', 'umidità', 'fessura', 'infisso', 'impianto', 'quadro', 'caldaia', 'contatore', 'difformità', 'facciata'];

export const AMB_TIPICI = ['Ingresso', 'Soggiorno', 'Cucina', 'Camera', 'Bagno', 'Disimpegno', 'Ripostiglio', 'Balcone', 'Terrazzo', 'Cantina', 'Garage', 'Corridoio', 'Studio', 'Lavanderia'];

export const isFilled = v => Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && String(v).trim() !== '');

export function reqMissing(groups, f) {
  const out = [];
  for (const g of groups) for (const c of g.campi) if (c.req && !isFilled(f && f[c.k])) out.push({ g: g.titolo, campo: c.l, k: c.k });
  return out;
}
export function groupCount(g, f) {
  const visibili = g.campi.filter(c => !c.se || c.se(f));
  const tot = visibili.length;
  const ok = visibili.filter(c => isFilled(f && f[c.k])).length;
  return [ok, tot];
}
