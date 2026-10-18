// Données de l'application + petites fonctions utilitaires qui ne touchent pas au DOM.
// Rien ici n'affiche quoi que ce soit à l'écran : c'est juste "la mémoire" du programme.

// Numéro de version affiché dans les Réglages : à garder identique à CACHE_VERSION (service-worker.js).
export const APP_VERSION = '45';

export const INTERVALS = [0, 1, 3, 7, 16, 30]; // en jours, façon Leitner

export const CALM_COLORS = {
  revisions: 'var(--revisions)',
  langues: 'var(--langues)',
  sage: 'var(--sage)',
  gold: 'var(--gold)',
  slate: 'var(--slate)',
  lavender: 'var(--lavender)'
};

// Langues proposées pour la lecture audio d'un paquet (voix du téléphone).
export const SPEAK_LANGS = [
  { code: '', label: 'Pas de lecture audio' },
  { code: 'it-IT', label: 'Italien' },
  { code: 'en-GB', label: 'Anglais' },
  { code: 'es-ES', label: 'Espagnol' },
  { code: 'de-DE', label: 'Allemand' },
  { code: 'pt-PT', label: 'Portugais' },
  { code: 'pl-PL', label: 'Polonais' }
];

export const TRASH_DAYS = 30;

export const MODES = [
  { id: 'flash', name: 'Flashcard', desc: 'Recto/verso, tu t’auto-évalues', min: 1 },
  { id: 'qcm', name: 'QCM', desc: 'Choix multiple parmi 4 réponses', min: 2 },
  { id: 'texte', name: 'Texte à trous', desc: 'Tu écris la réponse', min: 1 },
  { id: 'appariement', name: 'Appariement', desc: 'Relie les paires (jusqu’à 6)', min: 4 }
];

export const state = {
  rubriques: [],
  decks: [],
  cards: [],
  view: 'home',
  reorderMode: false,
  currentRubriqueId: null,
  currentDeckId: null,
  showAddRubrique: false,
  showAddDeck: false,
  showAddCard: false,
  showEditRubrique: false,
  editingRubriqueId: null,
  showEditDeck: false,
  editingDeckId: null,
  showEditCard: false,
  editingCardId: null,
  showBulk: false,
  trash: [],            // éléments supprimés récemment (voir app.js : corbeille de 30 jours)
  stats: { goal: 10, days: {} }, // objectif quotidien + nombre de cartes révisées par jour ('2026-10-15': 12)
  meta: { premium: false, aiDays: {}, aiTotal: 0, welcomed: false, interests: [], haptics: true, dailyDone: '', reminder: { on: false, time: '18:00' } }, // abonnement (démo), générations IA par jour, rappel quotidien
  onboard: null,           // parcours d'accueil en cours (voir app.js) ; null = pas d'accueil affiché
  profile: { pseudo: 'Toi', avatar: '🙂', email: '', createdAt: '', status: '', study: { level: '', year: '', field: '', other: '', degree: '', exam: '' }, work: { sector: '', other: '', job: '', goal: '' }, courses: [] }, // pseudo et avatar affichés dans les duels et le classement
  showProfile: false,
  showFeedback: false,
  feedbackRating: 0,
  openArticle: null,       // article ouvert dans « Découvrir »
  updateReady: false,      // une nouvelle version de l'appli est prête (voir app.js)
  multi: { weekKey: '', weekPoints: 0, total: 0, played: 0, wins: 0 }, // points de ligue du joueur
  social: { friends: [], pending: {} }, // amis (démo) ; 'pending' = demandes en attente, non sauvegardées
  friendQuery: '',      // texte de la recherche d'amis
  createRubriqueId: null, // rubrique choisie dans l'onglet « Créer »
  deckSel: {},           // contenu coché par paquet : { idDuPaquet: [ids des sous-paquets inclus] } ; absent = tout (non sauvegardé)
  newDeckParentId: null, // paquet dans lequel on crée un sous-paquet (null = directement dans la rubrique)
  dropOpen: null,        // liste déroulante ouverte (voir dropdown() dans render.js)
  medleyModes: ['flash', 'qcm', 'texte', 'appariement'], // modes mélangés dans le Quizz Medley
  multiThemes: null,     // thèmes des duels cochés : null = tous, sinon liste d'ids de paquets
  multiModes: ['medley', 'qcm', 'vf', 'match'], // formats de duel cochés (un est tiré au hasard)
  leagueScope: 'general', // cercle du classement : 'general', 'amis' ou 'promo'
  ai: null,             // assistant IA en cours (formulaire, chargement, relecture)
  duel: null,           // partie multijoueur en cours (voir duel.js)
  showPaywall: false,
  confirmDialog: null,  // { title, body, label, danger, onConfirm } : boîte de confirmation à l'écran
  pendingRubColor: 'sage', // couleur en cours de sélection dans la modale rubrique (ajout ou modif)
  session: null
};

// Date du jour dans le fuseau horaire de l'utilisateur, au format 2026-10-15.
// (toISOString() donnerait la date UTC : entre minuit et 1h-2h du matin en France,
// on serait encore "hier", ce qui fausserait la série de jours.)
export function localDateStr(d) {
  const date = d || new Date();
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function todayStr() {
  return localDateStr();
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// U+0300 à U+036F = les accents une fois séparés de leur lettre par normalize('NFD').
const DIACRITICS_RE = /[\u0300-\u036f]/g;

export function normalize(s) {
  return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');
}

// Lit un texte collé, une carte par ligne : "recto ; verso" (ou recto, tabulation,
// verso — ce que donne un copier-coller depuis Excel/Google Sheets). Seul le
// premier séparateur compte, donc le verso peut contenir des ";". Les lignes
// vides sont ignorées sans bruit ; les lignes sans séparateur ou avec un côté
// vide sont comptées dans "skipped" pour pouvoir prévenir l'utilisateur.
export function parseBulk(text) {
  const cards = [];
  let skipped = 0;
  String(text || '').split(/\r?\n/).forEach(function (line) {
    if (!line.trim()) return;
    const m = line.match(/^([^;\t]*)[;\t](.*)$/);
    const front = m ? m[1].trim() : '';
    const back = m ? m[2].trim() : '';
    if (front && back) cards.push({ front, back });
    else skipped++;
  });
  return { cards, skipped };
}

// Découpe une liste en lots de 'max' éléments au plus, de tailles équilibrées
// (7 cartes -> 4 + 3, pas 6 + 1 : un lot d'une seule paire n'aurait aucun sens).
export function splitBatches(arr, max) {
  if (arr.length === 0) return [];
  const n = Math.ceil(arr.length / max);
  const base = Math.floor(arr.length / n);
  const extra = arr.length % n;
  const out = [];
  let i = 0;
  for (let b = 0; b < n; b++) {
    const size = base + (b < extra ? 1 : 0);
    out.push(arr.slice(i, i + size));
    i += size;
  }
  return out;
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function seedData() {
  const t = todayStr();
  return {
    rubriques: [
      { id: 'r-revisions', name: 'Spécial Révisions', color: 'revisions', emoji: '📚', order: 0, hidden: false, isDefault: true },
      { id: 'r-langues', name: 'Spécial Langues', color: 'langues', emoji: '🗣️', order: 1, hidden: false, isDefault: true }
    ],
    decks: [
      { id: 'd-pm', name: 'Project Management', rubriqueId: 'r-revisions' },
      { id: 'd-km', name: 'Knowledge Management', rubriqueId: 'r-revisions' },
      { id: 'd-pfm', name: 'Performance Management', rubriqueId: 'r-revisions' },
      { id: 'd-bc', name: 'Business Consulting', rubriqueId: 'r-revisions' },
      { id: 'd-icm', name: 'Innovation & Creativity Mgmt', rubriqueId: 'r-revisions' },
      { id: 'd-it', name: 'Italien', rubriqueId: 'r-langues', speakLang: 'it-IT' }
    ],
    cards: [
      { id: 'c1', deckId: 'd-it', front: 'Buongiorno', back: 'Bonjour', box: 0, nextReview: t },
      { id: 'c2', deckId: 'd-it', front: 'Grazie mille', back: 'Merci beaucoup', box: 0, nextReview: t },
      { id: 'c3', deckId: 'd-it', front: 'Arrivederci', back: 'Au revoir', box: 0, nextReview: t },
      { id: 'c4', deckId: 'd-it', front: 'Per favore', back: 'S’il te plaît', box: 0, nextReview: t },
      { id: 'c5', deckId: 'd-bc', front: "Qu'est-ce que la matrice sociodynamique ?", back: "Cartographie des acteurs d'un projet selon leur pouvoir et leur volonté de changement (synergie, inertie, opposition...).", box: 0, nextReview: t },
      { id: 'c6', deckId: 'd-bc', front: "Que signifie PSF ?", back: "Professional Service Firm — une structure vendant du conseil/expertise plutôt qu'un produit.", box: 0, nextReview: t }
    ]
  };
}

// ---- Arborescence des paquets (comme des dossiers) ----
// Un paquet peut contenir des cartes ET d'autres paquets (champ parentId). Les paquets
// d'une même liste (même parent) sont triés par leur champ « order » (posé par le glisser-déposer).
function sortSiblings(list) {
  return list.map((d, i) => ({ d, i })).sort((x, y) => ((x.d.order ?? x.i) - (y.d.order ?? y.i)) || (x.i - y.i)).map(x => x.d);
}
export function decksOf(rid) {            // paquets posés directement dans la rubrique
  return sortSiblings(state.decks.filter(d => d.rubriqueId === rid && !d.parentId));
}
export function allDecksOf(rid) {         // tous les paquets de la rubrique, sous-paquets compris
  return state.decks.filter(d => d.rubriqueId === rid);
}
export function childDecks(id) {
  return sortSiblings(state.decks.filter(d => d.parentId === id));
}
export function nextDeckOrder(rid, parentId) {
  const sib = parentId ? childDecks(parentId) : decksOf(rid);
  return sib.length ? Math.max.apply(null, sib.map((d, i) => d.order ?? i)) + 1 : 0;
}
// Parcours en profondeur : [{ id, depth }] du paquet et de tous ses sous-paquets.
export function treeNodes(id, depth) {
  const out = [{ id, depth: depth || 0 }];
  childDecks(id).forEach(c => { out.push.apply(out, treeNodes(c.id, (depth || 0) + 1)); });
  return out;
}
export function descendantIds(id) {
  return treeNodes(id).map(n => n.id);
}
export function rootDeckId(id) {
  let d = state.decks.find(x => x.id === id);
  let guard = 0;
  while (d && d.parentId && guard++ < 50) d = state.decks.find(x => x.id === d.parentId) || null;
  return d ? d.id : id;
}
export function deckPath(id) {
  const names = [];
  let d = state.decks.find(x => x.id === id);
  let guard = 0;
  while (d && guard++ < 50) { names.unshift(d.name); d = d.parentId ? state.decks.find(x => x.id === d.parentId) : null; }
  return names.join(' › ');
}
export function cardsOf(did) {            // cartes posées directement dans ce paquet
  return state.cards.filter(c => c.deckId === did);
}
export function treeCards(did) {          // cartes du paquet ET de ses sous-paquets
  const ids = new Set(descendantIds(did));
  return state.cards.filter(c => ids.has(c.deckId));
}
export function dueTree(did) {
  const t = todayStr();
  return treeCards(did).filter(c => c.nextReview <= t);
}
// Sous-paquets cochés dans la liste déroulante de l'écran d'un paquet (par défaut : tous).
export function selectedIds(did) {
  const all = descendantIds(did);
  const sel = state.deckSel[did];
  return sel ? all.filter(id => sel.includes(id)) : all;
}
export function scopedCards(did) {
  const ids = new Set(selectedIds(did));
  return state.cards.filter(c => ids.has(c.deckId));
}
export function scopedDue(did) {
  const t = todayStr();
  return scopedCards(did).filter(c => c.nextReview <= t);
}
export function dueCards(did) {
  const t = todayStr();
  return state.cards.filter(c => c.deckId === did && c.nextReview <= t);
}
export function dueInRubrique(rid) {
  const ids = new Set(allDecksOf(rid).map(d => d.id));
  const t = todayStr();
  return state.cards.filter(c => ids.has(c.deckId) && c.nextReview <= t).length;
}
// Cartes à revoir aujourd'hui, hors rubriques masquées (une rubrique masquée ne doit pas s'inviter dans « Aujourd'hui »).
export function allDueCards() {
  const t = todayStr();
  const hidden = new Set(state.rubriques.filter(r => r.hidden).map(r => r.id));
  const skip = new Set(state.decks.filter(d => hidden.has(d.rubriqueId)).map(d => d.id));
  return state.cards.filter(c => c.nextReview <= t && !skip.has(c.deckId));
}
export function colorVar(name) {
  return CALM_COLORS[name] || CALM_COLORS.slate;
}

// Planification façon Leitner : mauvaise réponse -> on repart de la case 0,
// bonne réponse -> on avance d'une case (l'intervalle avant le prochain rappel grandit).
export function scheduleCard(card, success) {
  card.box = success ? Math.min(card.box + 1, INTERVALS.length - 1) : 0;
  const days = INTERVALS[card.box];
  const d = new Date();
  d.setDate(d.getDate() + days);
  card.nextReview = localDateStr(d);
  recordReview();
}

// ---------- Statistiques : série de jours et objectif quotidien ----------
export const GOAL_CHOICES = [5, 10, 20, 30];

// Parcours d'études demandé à l'accueil (sert aux recommandations de cours, d'articles et aux rappels).
export const STUDY_LEVELS = [
  { id: 'lycee', label: 'Lycée', years: ['Seconde', 'Première', 'Terminale'] },
  { id: 'prepa', label: 'Classe préparatoire', years: ['1re année', '2e année'] },
  { id: 'licence', label: 'Licence / Bachelor', years: ['1re année', '2e année', '3e année'] },
  { id: 'master', label: 'Master / MBA', years: ['1re année', '2e année'] },
  { id: 'doctorat', label: 'Doctorat', years: ['1re année', '2e année', '3e année'] },
  { id: 'pro', label: 'Formation continue', years: [] }
];
export const STUDY_FIELDS = [
  { id: 'gestion', label: 'Commerce et gestion', ph: 'ex : Bachelor, Master en management' },
  { id: 'ingenierie', label: 'Ingénierie', ph: 'ex : Diplôme d\'ingénieur, BUT' },
  { id: 'info', label: 'Informatique et données', ph: 'ex : Licence informatique, Master data science' },
  { id: 'droit', label: 'Droit et sciences po', ph: 'ex : Licence de droit, Sciences Po' },
  { id: 'sante', label: 'Santé', ph: 'ex : PASS, soins infirmiers, pharmacie' },
  { id: 'sciences', label: 'Sciences', ph: 'ex : Licence de physique, biologie' },
  { id: 'lettres', label: 'Lettres et langues', ph: 'ex : Licence LLCER, traduction' },
  { id: 'arts', label: 'Arts et design', ph: 'ex : DNMADE, école d\'arts' },
  { id: 'autre', label: 'Autre', ph: 'ex : Baccalauréat général' }
];
// Matières suggérées selon le domaine (l'élève peut aussi en ajouter à la main).
export const FIELD_COURSES = {
  gestion: ['Marketing', 'Finance', 'Comptabilité', 'Gestion de projet', 'Management', 'Économie', 'Statistiques', 'Stratégie', 'Ressources humaines', 'Droit des affaires', 'Entrepreneuriat', 'Conseil'],
  ingenierie: ['Mathématiques', 'Physique', 'Mécanique', 'Électronique', 'Thermodynamique', 'Résistance des matériaux', 'Informatique', 'Gestion de projet', 'Statistiques'],
  info: ['Algorithmique', 'Bases de données', 'Programmation', 'Réseaux', 'Cybersécurité', 'Intelligence artificielle', 'Mathématiques', 'Génie logiciel', 'Statistiques'],
  droit: ['Droit civil', 'Droit pénal', 'Droit constitutionnel', 'Droit européen', 'Droit des affaires', 'Histoire du droit', 'Science politique', 'Relations internationales'],
  sante: ['Anatomie', 'Physiologie', 'Biochimie', 'Pharmacologie', 'Pathologie', 'Santé publique', 'Biologie cellulaire'],
  sciences: ['Mathématiques', 'Physique', 'Chimie', 'Biologie', 'Statistiques', 'Géologie', 'Informatique'],
  lettres: ['Littérature', 'Histoire', 'Philosophie', 'Linguistique', 'Traduction', 'Langues étrangères'],
  arts: ['Histoire de l\'art', 'Design', 'Communication visuelle', 'Photographie', 'Marketing'],
  autre: ['Culture générale', 'Mathématiques', 'Français', 'Histoire-géographie', 'Langues étrangères', 'Économie']
};
// ---- Profil d'apprentissage : étudiant, personne en activité ou simple curieux ----
export const STATUSES = [
  { id: 'student', label: 'Étudiant(e)', desc: 'Lycée, prépa, université, école…' },
  { id: 'working', label: 'En activité', desc: 'Salarié(e), indépendant(e), en reconversion…' },
  { id: 'curious', label: 'Simple curieux(se)', desc: 'J\'apprends pour le plaisir ou un projet perso' }
];
export const WORK_SECTORS = [
  { id: 'commerce', label: 'Commerce et vente', ph: 'ex : Responsable de magasin, commercial' },
  { id: 'finance', label: 'Finance et banque', ph: 'ex : Conseiller clientèle, analyste' },
  { id: 'conseil', label: 'Conseil et services', ph: 'ex : Consultant, chef de projet' },
  { id: 'sante', label: 'Santé et social', ph: 'ex : Infirmier(ère), éducateur(trice)' },
  { id: 'tech', label: 'Informatique et numérique', ph: 'ex : Développeur(se), data analyst' },
  { id: 'industrie', label: 'Industrie et ingénierie', ph: 'ex : Technicien(ne), ingénieur(e)' },
  { id: 'education', label: 'Éducation et formation', ph: 'ex : Enseignant(e), formateur(trice)' },
  { id: 'public', label: 'Administration publique', ph: 'ex : Agent territorial, juriste' },
  { id: 'btp', label: 'Bâtiment et artisanat', ph: 'ex : Artisan, conducteur de travaux' },
  { id: 'tourisme', label: 'Tourisme et restauration', ph: 'ex : Responsable d\'hôtel, chef de rang' },
  { id: 'culture', label: 'Culture et communication', ph: 'ex : Graphiste, journaliste, chargé de com.' },
  { id: 'autre', label: 'Autre', ph: 'ex : Ton poste ou ton métier' }
];
export const WORK_GOALS = [
  { id: 'progresser', label: 'Progresser dans mon métier' },
  { id: 'changer', label: 'Changer de métier ou me reconvertir' },
  { id: 'certif', label: 'Préparer une certification ou un concours' },
  { id: 'langue', label: 'Apprendre ou pratiquer une langue' },
  { id: 'voyage', label: 'Préparer un voyage ou une expatriation' },
  { id: 'plaisir', label: 'Apprendre pour le plaisir' }
];
export const SECTOR_COURSES = {
  commerce: ['Négociation commerciale', 'Marketing', 'Gestion de la relation client', 'Vente en ligne', 'Management', 'Anglais professionnel'],
  finance: ['Finance', 'Comptabilité', 'Réglementation financière', 'Analyse de données', 'Gestion de portefeuille', 'Anglais professionnel'],
  conseil: ['Gestion de projet', 'Conseil et stratégie', 'Management', 'Prise de parole', 'Analyse de données', 'Anglais professionnel'],
  sante: ['Anatomie', 'Pharmacologie', 'Santé publique', 'Gestes et protocoles', 'Psychologie', 'Anglais médical'],
  tech: ['Programmation', 'Cybersécurité', 'Bases de données', 'Intelligence artificielle', 'Gestion de projet', 'Anglais technique'],
  industrie: ['Qualité et normes', 'Gestion de production', 'Mécanique', 'Électronique', 'Gestion de projet', 'Anglais technique'],
  education: ['Pédagogie', 'Psychologie de l\'apprentissage', 'Outils numériques', 'Communication', 'Gestion de classe'],
  public: ['Droit administratif', 'Finances publiques', 'Management public', 'Rédaction administrative'],
  btp: ['Sécurité sur chantier', 'Lecture de plans', 'Réglementation du bâtiment', 'Gestion de chantier', 'Devis et chiffrage'],
  tourisme: ['Accueil et relation client', 'Langues étrangères', 'Gestion hôtelière', 'Marketing touristique', 'Œnologie'],
  culture: ['Communication', 'Design graphique', 'Rédaction web', 'Photographie', 'Réseaux sociaux'],
  autre: ['Gestion de projet', 'Communication', 'Management', 'Anglais professionnel', 'Bureautique']
};
export const CURIOUS_COURSES = ['Histoire', 'Culture générale', 'Sciences', 'Philosophie', 'Musique', 'Art', 'Cuisine', 'Photographie', 'Finance personnelle', 'Informatique', 'Bien-être et santé', 'Développement personnel'];
// Quand on précise « Autre », on repère des mots-clés pour rattacher le texte à un domaine connu
// (prototype : une vraie IA lirait et comprendrait la réponse pour aller bien plus loin).
const DOMAIN_KEYWORDS = [
  [/archi|urbanis|paysag|genie|meca|elec|aero|auto|industri|robot/, 'ingenierie'],
  [/info|code|dev|logiciel|data|donn|numeri|web|cyber|ia\b|intelligence/, 'info'],
  [/droit|juridi|avocat|notaire|police|politique/, 'droit'],
  [/sante|medec|infirm|pharma|dent|kine|psycho|veterin|biolog/, 'sante'],
  [/physique|chimie|math|geolog|astronom|environn|ecolog/, 'sciences'],
  [/lettre|langue|histoire|philo|litter|traduc|journal|edition/, 'lettres'],
  [/art|design|graph|photo|cinema|musique|mode|theatre|danse/, 'arts'],
  [/commerce|gestion|marketing|financ|compta|management|entrepr|rh\b|vente|banque/, 'gestion']
];
export function detectField(text) {
  const t = normalize(String(text || ''));
  if (!t) return '';
  const hit = DOMAIN_KEYWORDS.find(k => k[0].test(t));
  return hit ? hit[1] : '';
}
// Matières ou sujets proposés selon le profil (même ordre à l'affichage et au clic).
export function courseBase(c) {
  if (c.status === 'working') {
    if (c.sector && c.sector !== 'autre') return SECTOR_COURSES[c.sector];
    return FIELD_COURSES[detectField(c.sectorOther)] || SECTOR_COURSES.autre;
  }
  if (c.status === 'curious') return CURIOUS_COURSES;
  const f = c.field && c.field !== 'autre' ? c.field : detectField(c.fieldOther) || 'autre';
  return FIELD_COURSES[f] || FIELD_COURSES.autre;
}
export function courseChoices(c, selected) {
  const base = courseBase(c);
  return base.concat((selected || []).filter(x => !base.includes(x)));
}
export function studySummary() {
  const p = state.profile, s = p.study || {}, w = p.work || {};
  if (p.status === 'working') {
    const sec = WORK_SECTORS.find(x => x.id === w.sector);
    const goal = WORK_GOALS.find(x => x.id === w.goal);
    return [w.job, sec && (sec.id === 'autre' ? (w.other || sec.label) : sec.label), goal && goal.label].filter(Boolean).join(' · ');
  }
  if (p.status === 'curious') return 'Apprendre pour le plaisir';
  const lvl = STUDY_LEVELS.find(l => l.id === s.level);
  const fld = STUDY_FIELDS.find(f => f.id === s.field);
  return [s.degree, lvl && (lvl.label + (s.year ? ' · ' + s.year : '')), fld && (fld.id === 'autre' ? (s.other || fld.label) : fld.label)].filter(Boolean).join(' · ');
}
export function hasStudyProfile() {
  const p = state.profile, s = p.study || {}, w = p.work || {};
  return !!(p.status || s.level || s.field || s.degree || w.sector || w.job || (p.courses || []).length);
}
// « Examen » pour un étudiant, « Échéance » sinon.
export function deadlineLabel() { return state.profile.status === 'student' || !state.profile.status ? 'Examen' : 'Échéance'; }
// Jours restants avant la prochaine échéance saisie (null si aucune ou déjà passée).
export function examDaysLeft() {
  const e = state.profile.study && state.profile.study.exam;
  if (!e) return null;
  const n = Math.round((Date.parse(e + 'T00:00:00') - Date.parse(todayStr() + 'T00:00:00')) / 86400000);
  return n >= 0 ? n : null;
}

// Centres d'intérêt proposés à l'accueil (servent aux recommandations de cours et d'articles).
// Les langues ont pour id le code de la voix ; les matières un mot-clé repris dans MOOC_TOPICS (demo.js).
export const INTERESTS = [
  { id: 'en-GB', label: 'Anglais', group: 'Langues' },
  { id: 'es-ES', label: 'Espagnol', group: 'Langues' },
  { id: 'it-IT', label: 'Italien', group: 'Langues' },
  { id: 'de-DE', label: 'Allemand', group: 'Langues' },
  { id: 'pt-PT', label: 'Portugais', group: 'Langues' },
  { id: 'pl-PL', label: 'Polonais', group: 'Langues' },
  { id: 'projet', label: 'Gestion de projet', group: 'Matières' },
  { id: 'marketing', label: 'Marketing', group: 'Matières' },
  { id: 'finance', label: 'Finance', group: 'Matières' },
  { id: 'data', label: 'Données', group: 'Matières' },
  { id: 'conseil', label: 'Conseil et stratégie', group: 'Matières' },
  { id: 'innov', label: 'Innovation', group: 'Matières' }
];

// Compte une carte révisée aujourd'hui (appelée à chaque réponse enregistrée).
function recordReview() {
  const t = todayStr();
  state.stats.days[t] = (state.stats.days[t] || 0) + 1;
}

export function reviewedToday() {
  return state.stats.days[todayStr()] || 0;
}

// Nombre de jours d'affilée avec au moins une carte révisée. Si tu n'as encore
// rien fait aujourd'hui, la série reste vivante jusqu'à ce soir : on compte
// à partir d'hier.
export function currentStreak() {
  const days = state.stats.days;
  const d = new Date();
  if (!days[localDateStr(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days[localDateStr(d)] > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Les 7 derniers jours (aujourd'hui en dernier) pour la petite frise de l'accueil.
export function last7Days() {
  const letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d);
    out.push({ date: key, count: state.stats.days[key] || 0, letter: letters[d.getDay()], isToday: i === 0 });
  }
  return out;
}

// ---------- Freemium, ligue, niveau, badges (prototype) ----------
export const FREE_AI_PER_DAY = 3;

// Générations IA encore gratuites aujourd'hui (Infinity si Premium).
export function aiLeft() {
  if (state.meta.premium) return Infinity;
  return Math.max(0, FREE_AI_PER_DAY - (state.meta.aiDays[todayStr()] || 0));
}

// Lundi de la semaine en cours : sert d'identifiant à la ligue hebdomadaire.
export function weekKey() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateStr(d);
}
export function daysLeftInWeek() {
  return 7 - ((new Date().getDay() + 6) % 7);
}
// Nouvelle semaine : les points de ligue repartent de zéro (le total est gardé).
export function ensureWeek() {
  if (state.multi.weekKey !== weekKey()) {
    state.multi.weekKey = weekKey();
    state.multi.weekPoints = 0;
  }
}

export function totalReviews() {
  return Object.values(state.stats.days).reduce((a, b) => a + b, 0);
}

export function longestStreak() {
  const keys = Object.keys(state.stats.days).filter(k => state.stats.days[k] > 0).sort();
  let best = 0, cur = 0, prev = null;
  keys.forEach(function (k) {
    const t = Date.parse(k + 'T12:00:00');
    cur = prev !== null && Math.round((t - prev) / 86400000) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  });
  return best;
}

// Niveau du joueur : monte avec les cartes révisées et les points de ligue.
export function playerLevel() {
  const xp = totalReviews() + state.multi.total * 2;
  return { level: 1 + Math.floor(Math.sqrt(xp / 20)), xp };
}

export function badgeList() {
  return [
    { emoji: '🔥', label: 'Série de 3 jours', earned: longestStreak() >= 3 },
    { emoji: '📚', label: '100 cartes révisées', earned: totalReviews() >= 100 },
    { emoji: '✨', label: 'Pionnier de l\'IA', earned: state.meta.aiTotal >= 1 },
    { emoji: '⚔️', label: 'Premier duel', earned: state.multi.played >= 1 },
    { emoji: '🏆', label: 'Première victoire', earned: state.multi.wins >= 1 },
    { emoji: '👥', label: 'Premier ami', earned: state.social.friends.length >= 1 }
  ];
}

// ---------- Statistiques et rappel ----------
// Résumé des 7 derniers jours pour l'écran de statistiques.
export function weekSummary() {
  const days = last7Days();
  const total = days.reduce((a, d) => a + d.count, 0);
  const best = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
  return { days, total, average: Math.round(total / 7 * 10) / 10, best, activeDays: days.filter(d => d.count > 0).length };
}

// Répartition des cartes selon le niveau de maîtrise (cases de Leitner).
export function masteryBreakdown() {
  const out = { fresh: 0, learning: 0, known: 0 };
  state.cards.forEach(function (c) {
    if (c.box === 0) out.fresh++;
    else if (c.box <= 2) out.learning++;
    else out.known++;
  });
  return out;
}

// Vrai quand le rappel est activé, que l'heure choisie est passée et que
// l'objectif du jour n'est pas encore atteint : l'accueil affiche alors un coup de pouce.
export function reminderDue() {
  const r = state.meta.reminder;
  if (!r || !r.on) return false;
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return hhmm >= r.time && reviewedToday() < state.stats.goal;
}
