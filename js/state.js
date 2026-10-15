// Données de l'application + petites fonctions utilitaires qui ne touchent pas au DOM.
// Rien ici n'affiche quoi que ce soit à l'écran : c'est juste "la mémoire" du programme.

// Numéro de version affiché dans les Réglages : à garder identique à CACHE_VERSION (service-worker.js).
export const APP_VERSION = '35';

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
  { code: 'pt-PT', label: 'Portugais' }
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
  meta: { premium: false, aiDays: {}, aiTotal: 0, welcomed: false, haptics: true, dailyDone: '', reminder: { on: false, time: '18:00' } }, // abonnement (démo), générations IA par jour, rappel quotidien
  profile: { pseudo: 'Toi', avatar: '🙂' }, // pseudo et avatar affichés dans les duels et le classement
  showProfile: false,
  showFeedback: false,
  feedbackRating: 0,
  openArticle: null,       // article ouvert dans « Découvrir »
  updateReady: false,      // une nouvelle version de l'appli est prête (voir app.js)
  multi: { weekKey: '', weekPoints: 0, total: 0, played: 0, wins: 0 }, // points de ligue du joueur
  social: { friends: [], pending: {} }, // amis (démo) ; 'pending' = demandes en attente, non sauvegardées
  friendQuery: '',      // texte de la recherche d'amis
  createRubriqueId: null, // rubrique choisie dans l'onglet « Créer »
  multiMode: 'medley',  // format des duels : 'medley', 'qcm', 'vf' ou 'match'
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

export function decksOf(rid) {
  return state.decks.filter(d => d.rubriqueId === rid);
}
export function cardsOf(did) {
  return state.cards.filter(c => c.deckId === did);
}
export function dueCards(did) {
  const t = todayStr();
  return state.cards.filter(c => c.deckId === did && c.nextReview <= t);
}
export function dueInRubrique(rid) {
  return decksOf(rid).reduce((n, d) => n + dueCards(d.id).length, 0);
}
export function allDueCards() {
  const t = todayStr();
  return state.cards.filter(c => c.nextReview <= t);
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
