// Données de l'application + petites fonctions utilitaires qui ne touchent pas au DOM.
// Rien ici n'affiche quoi que ce soit à l'écran : c'est juste "la mémoire" du programme.

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
  confirmDialog: null,  // { title, body, label, danger, onConfirm } : boîte de confirmation à l'écran
  pendingRubColor: 'sage', // couleur en cours de sélection dans la modale rubrique (ajout ou modif)
  session: null
};

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
  card.nextReview = d.toISOString().slice(0, 10);
}
