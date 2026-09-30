// Struttura della scheda di rilievo. Tipi di campo:
//  chips = scelta singola (secondo tocco sullo stesso valore lo deseleziona)
//  multi = scelta multipla
//  text  = testo breve
//  area  = testo lungo
// "req" = obbligatorio per poter chiudere l'ambiente o l'immobile.

export const STATO = ['Ottimo', 'Buono', 'Mediocre', 'Scadente', 'Da rifare', 'N.a.'];
const SND = ['Sì', 'No', 'N.d.'];
const F = (k, l, t, o, extra) => ({ k, l, t, o, ...(extra || {}) });

// ---------- Ambiente ----------
export const AMB_GROUPS = [
  { id: 'pav', titolo: 'Pavimento', campi: [
    F('pav_mat', 'Materiale', 'chips', ['Gres porcellanato', 'Ceramica', 'Cotto', 'Marmo o pietra', 'Graniglia o cementine', 'Parquet', 'Laminato', 'Battuto di cls', 'Resina', 'Altro', 'Assente']),
    F('pav_fmt', 'Formato, posa, note', 'text'),
    F('pav_st', 'Stato di conservazione', 'chips', STATO, { req: true }),
  ] },
  { id: 'riv', titolo: 'Rivestimenti', campi: [
    F('riv_mat', 'Materiale', 'chips', ['Ceramica', 'Gres', 'Marmo o pietra', 'Pittura lavabile', 'Carta da parati', 'Altro', 'Assente']),
    F('riv_h', 'Altezza e ubicazione', 'text'),
    F('riv_st', 'Stato di conservazione', 'chips', STATO),
  ] },
  { id: 'par', titolo: 'Pareti', campi: [
    F('par_fin', 'Finitura', 'chips', ['Tinteggiatura', 'Idropittura', 'Intonaco civile', 'Intonaco grezzo', 'Carta da parati', 'Pietra a vista', 'Altro']),
    F('par_st', 'Stato di conservazione', 'chips', STATO, { req: true }),
  ] },
  { id: 'sof', titolo: 'Soffitto', campi: [
    F('sof_fin', 'Finitura', 'chips', ['Tinteggiatura', 'Controsoffitto', 'Travi a vista', 'Volta', 'Solaio a vista', 'Altro']),
    F('sof_h', 'Altezza rilevata a vista', 'text'),
    F('sof_st', 'Stato di conservazione', 'chips', STATO),
  ] },
  { id: 'deg', titolo: 'Umidità e degrado', campi: [
    F('deg_um', 'Umidità', 'chips', ['Assente', 'Tracce', 'Diffusa', 'Da infiltrazione']),
    F('deg_mu', 'Muffe', 'chips', ['Assenti', 'Puntuali', 'Diffuse']),
    F('deg_fe', 'Fessurazioni', 'chips', ['Assenti', 'Capillari', 'Evidenti', 'Da approfondire']),
    F('deg_di', 'Distacchi di intonaco', 'chips', ['Assenti', 'Localizzati', 'Estesi']),
    F('deg_nt', 'Dove e note', 'area'),
  ] },
  { id: 'ies', titolo: 'Infissi esterni', campi: [
    F('ies_n', 'Numero e dimensione indicativa', 'text'),
    F('ies_mat', 'Materiale', 'chips', ['Legno', 'Alluminio', 'Alluminio a taglio termico', 'PVC', 'Ferro', 'Altro', 'Assenti']),
    F('ies_vet', 'Vetro', 'chips', ['Singolo', 'Doppio', 'Basso emissivo', 'N.d.']),
    F('ies_osc', 'Oscuranti', 'multi', ['Persiana', 'Tapparella', 'Scuro', 'Veneziana', 'Inferriata', 'Assenti']),
    F('ies_st', 'Stato di conservazione', 'chips', STATO),
  ] },
  { id: 'iin', titolo: 'Porte interne', campi: [
    F('iin_tip', 'Tipologia', 'chips', ['Legno tamburato', 'Legno massello', 'Laminato', 'Vetro', 'Scorrevole', 'Altro', 'Assenti']),
    F('iin_st', 'Stato di conservazione', 'chips', STATO),
  ] },
  { id: 'imp', titolo: 'Impianti', campi: [
    F('imp_el', 'Impianto elettrico', 'chips', ['Sottotraccia', 'A vista', 'Assente', 'Non verificabile']),
    F('imp_el_st', 'Stato impianto elettrico', 'chips', STATO),
    F('imp_id', 'Impianto idrico-sanitario', 'chips', ['Presente', 'Assente', 'Non verificabile']),
    F('imp_id_st', 'Stato impianto idrico', 'chips', STATO),
    F('imp_te', 'Riscaldamento (terminali)', 'multi', ['Radiatori', 'Ventilconvettori', 'Pannelli radianti', 'Stufa o camino', 'Assente']),
    F('imp_te_st', 'Stato riscaldamento', 'chips', STATO),
    F('imp_cl', 'Climatizzazione', 'chips', ['Split', 'Canalizzata', 'Predisposizione', 'Assente']),
    F('imp_gas', 'Impianto gas', 'chips', ['Presente', 'Assente', 'Non verificabile']),
    F('imp_cit', 'Citofono', 'chips', ['Citofono', 'Videocitofono', 'Assente']),
    F('imp_tv', 'Prese TV e dati', 'chips', ['Presenti', 'Assenti']),
    F('imp_cf', 'Conformità apparente', 'chips', ['Apparentemente conforme', 'Dubbia', 'Non conforme', 'Non verificabile']),
    F('imp_nt', 'Note sugli impianti', 'area'),
  ] },
  { id: 'san', titolo: 'Sanitari e apparecchi', campi: [
    F('san_ap', 'Apparecchi presenti', 'multi', ['Lavabo', 'WC', 'Bidet', 'Doccia', 'Vasca', 'Lavello', 'Piano cottura', 'Attacco lavatrice', 'Scaldabagno']),
    F('san_st', 'Stato apparecchi e rubinetteria', 'chips', STATO),
  ] },
  { id: 'gen', titolo: 'Giudizio sull\'ambiente', campi: [
    F('cons', 'Conservazione complessiva', 'chips', STATO, { req: true }),
    F('amb_nt', 'Note', 'area'),
  ] },
];

// ---------- Immobile: dati generali ----------
export const IMM_GROUPS = [
  { id: 'ril', titolo: 'Rilievo e occupazione', campi: [
    F('presenti', 'Presenti all\'accesso', 'text'),
    F('occ', 'Stato di occupazione', 'chips', ['Libero', 'Occupato dal proprietario', 'Occupato da terzi con titolo', 'Occupato senza titolo', 'Non accessibile'], { req: true }),
    F('occ_nt', 'Dettagli sull\'occupazione', 'text'),
    F('uso', 'Utilizzo attuale', 'chips', ['Abitazione', 'Ufficio', 'Negozio', 'Magazzino o deposito', 'Garage o box', 'Non utilizzato', 'Altro']),
    F('cons_g', 'Conservazione generale', 'chips', STATO, { req: true }),
    F('epoca', 'Epoca di costruzione (presunta)', 'chips', ['Ante 1942', '1942-1967', '1968-1990', '1991-2010', 'Dopo il 2010', 'N.d.']),
    F('ristr', 'Interventi di ristrutturazione visibili', 'text'),
  ] },
  { id: 'edi', titolo: 'Edificio e dotazioni', campi: [
    F('asc', 'Ascensore', 'chips', ['Presente', 'Assente', 'N.a.']),
    F('acc', 'Accessibilità', 'chips', ['Senza barriere', 'Con barriere architettoniche', 'N.d.']),
    F('dot', 'Dotazioni condominiali', 'multi', ['Portineria', 'Cortile o giardino', 'Parcheggio', 'Impianto centralizzato', 'Autoclave', 'Videosorveglianza', 'Terrazza comune']),
    F('edi_st', 'Stato di parti comuni e facciata', 'chips', STATO),
  ] },
  { id: 'ig', titolo: 'Impianti generali dell\'unità', campi: [
    F('acs', 'Produzione acqua calda', 'chips', ['Caldaia murale', 'Scaldabagno elettrico', 'Centralizzata', 'Pompa di calore', 'Solare termico', 'Assente']),
    F('quadro', 'Quadro elettrico', 'chips', ['Magnetotermico differenziale', 'Solo fusibili', 'Non verificabile']),
    F('cont', 'Contatori presenti', 'multi', ['Elettrico', 'Gas', 'Acqua']),
    F('ape', 'Attestato di prestazione energetica', 'chips', ['Presente', 'Assente', 'N.d.']),
    F('ig_nt', 'Note', 'area'),
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
  const tot = g.campi.length;
  const ok = g.campi.filter(c => isFilled(f && f[c.k])).length;
  return [ok, tot];
}
