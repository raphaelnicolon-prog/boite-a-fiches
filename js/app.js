// Point d'entrée + "contrôleur" de l'appli : chaque bouton du HTML généré par
// render.js appelle une méthode de l'objet App défini ici (ex: onclick="App.flip()").
// Une méthode App typique fait 3 choses dans l'ordre : 1) modifier state,
// 2) sauvegarder si besoin (persist), 3) redessiner l'écran (refresh).

import { state, shuffle, normalize, pickRandom, todayStr, cardsOf, dueCards, allDueCards, scheduleCard, parseBulk, splitBatches, seedData, GOAL_CHOICES, aiLeft, ensureWeek } from './state.js';
import { generateDeck, generateFromText, demoDataset, AI_TOPICS, DEMO_PEOPLE, DAILY_OPPONENT } from './demo.js';
import { startDuel, stopDuel, answer as duelAnswerFn, pickMatch, setRefresh } from './duel.js';
import { loadData, persist, buildBackupJson, parseBackup } from './storage.js';
import { render, friendResultsHtml } from './render.js';
import { enableReorder } from './dragdrop.js';

function refresh() {
  render();
  const list = document.getElementById('rubrique-list');
  if (list) enableReorder(list, applyReorder);
}

function applyReorder(idsInOrder) {
  idsInOrder.forEach((id, i) => {
    const r = state.rubriques.find(x => x.id === id);
    if (r) r.order = i;
  });
  persist();
  refresh();
}

// Construit les 4 options d'un QCM : la bonne réponse + 3 mauvaises piochées
// dans le même paquet, ou dans la même rubrique si le paquet est trop petit.
function buildQcmOptions(card) {
  const deck = state.decks.find(d => d.id === card.deckId);
  let pool = state.cards.filter(c => c.deckId === card.deckId && c.id !== card.id);
  if (pool.length < 3 && deck) {
    pool = state.cards.filter(c => {
      const cardDeck = state.decks.find(x => x.id === c.deckId);
      return c.id !== card.id && cardDeck && cardDeck.rubriqueId === deck.rubriqueId;
    });
  }
  if (pool.length < 3) pool = state.cards.filter(c => c.id !== card.id);
  const distractors = shuffle(pool).slice(0, 3).map(c => c.back);
  return shuffle([card.back].concat(distractors));
}

// Prépare un round d'appariement : mélange indépendamment la colonne des
// rectos et celle des versos, pour qu'ils ne soient pas alignés par hasard.
function prepareMatching(s) {
  s.matchFronts = shuffle(s.matchBatch.map(c => ({ cardId: c.id, text: c.front })));
  s.matchBacks = shuffle(s.matchBatch.map(c => ({ cardId: c.id, text: c.back })));
  s.matchedIds = []; s.selFront = null; s.selBack = null; s.flashWrong = false; s.matchAttempts = {};
}

// Remet à zéro les réponses temporaires (flip, saisie...) et prépare la carte
// courante d'une session — notamment ses options si c'est une question QCM.
function prepareCurrentCard(s) {
  s.flipped = false;
  s.texteRevealed = false;
  s.texteInput = '';
  s.qcmAnswered = false;
  s.qcmSelectedIndex = null;
  s.qcmOptions = null;
  const card = s.queue && s.queue[s.index];
  if (!card) return;
  const cardMode = s.mode === 'medley' ? s.cardModes[s.index] : s.mode;
  if (cardMode === 'qcm') s.qcmOptions = buildQcmOptions(card);
}

const AI_TOPICS_LIST = AI_TOPICS;

// Boîte de confirmation à l'écran (remplace confirm() du navigateur, trop
// discret et parfois absent sur téléphone). Sans 'label' : simple message + OK.
function askConfirm(opts) {
  state.confirmDialog = opts;
  refresh();
}

// Envoie un élément supprimé dans la corbeille ("Supprimé récemment").
function sendToTrash(type, name, payload) {
  state.trash.push({
    id: 't-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
    type, name, deletedAt: new Date().toISOString(), payload
  });
}

window.App = {
  // ---- Objectif quotidien ----
  setGoal(n) {
    if (!GOAL_CHOICES.includes(n)) return;
    state.stats.goal = n;
    persist(); refresh();
  },

  // ---- Multijoueur (prototype : adversaires simulés, voir duel.js) ----
  openMulti() { stopDuel(); state.view = 'multi'; refresh(); },
  setMultiMode(m) { state.multiMode = m; refresh(); },
  quickMatch() { state.view = 'duel'; startDuel(null); },
  duelAnswer(i) { duelAnswerFn(i); },
  duelPickMatch(side, i) { pickMatch(side, i); },
  setLeagueScope(s) { state.leagueScope = s; refresh(); },
  // Défi du jour : un Medley contre « les joueurs du jour » ; le bonus n'est accordé qu'une fois par jour.
  dailyChallenge() {
    state.view = 'duel';
    startDuel({ opponent: DAILY_OPPONENT, mode: 'medley', skipSearch: true, daily: true });
  },
  duelRematch() {
    const d = state.duel;
    if (!d) return;
    startDuel({ opponent: d.opponent, deckId: d.deckId, mode: d.mode, skipSearch: true });
  },
  openLeague() { stopDuel(); state.view = 'league'; refresh(); },
  openFriends() { stopDuel(); state.view = 'friends'; state.friendQuery = ''; refresh(); },
  // Pas de refresh() complet : il ferait perdre le focus de la barre de recherche.
  searchFriends(q) {
    state.friendQuery = q;
    const el = document.getElementById('friend-results');
    if (el) el.innerHTML = friendResultsHtml(q);
  },
  addFriend(name) {
    if (state.social.friends.includes(name) || state.social.pending[name]) return;
    state.social.pending[name] = true;
    this.searchFriends(state.friendQuery);
    // Démo : la demande est « acceptée » au bout de 2 secondes.
    setTimeout(() => {
      delete state.social.pending[name];
      if (!state.social.friends.includes(name)) state.social.friends.push(name);
      persist();
      if (state.view === 'friends') this.searchFriends(state.friendQuery);
    }, 1800);
  },
  challengeFriend(name) {
    const p = DEMO_PEOPLE.find(x => x.name === name);
    if (!p) return;
    state.view = 'duel';
    startDuel({ opponent: p });
  },

  // ---- Assistant IA (simulé : voir demo.js) ----
  openAi(rubriqueId) {
    state.ai = { rubriqueId, prompt: '', phase: 'form', error: '', result: null, selected: [] };
    state.view = 'ai'; refresh();
  },
  leaveAi() { state.view = 'rubrique'; state.ai = null; refresh(); },
  setAiSource(src) {
    if (!state.ai) return;
    // On garde ce qui a été saisi avant de changer d'onglet.
    const t = document.getElementById('ai-text'); if (t) state.ai.text = t.value;
    const ti = document.getElementById('ai-title'); if (ti) state.ai.title = ti.value;
    state.ai.source = src; state.ai.error = '';
    refresh();
  },
  generateFromText() {
    const a = state.ai;
    if (!a) return;
    const t = document.getElementById('ai-text'); a.text = t ? t.value : a.text;
    const ti = document.getElementById('ai-title'); a.title = ti ? ti.value : a.title;
    if (!a.text || a.text.trim().length < 20) { a.error = 'Colle d\'abord un extrait de cours (quelques lignes).'; refresh(); return; }
    const result = generateFromText(a.text, a.title);
    if (!result) { a.error = 'Je n\'ai trouvé aucune définition. Écris des lignes du type « Terme : définition » ou « X est … ».'; refresh(); return; }
    a.error = ''; a.phase = 'loading'; refresh();
    setTimeout(() => {
      if (state.ai !== a) return;
      a.result = result; a.selected = result.cards.map((_, i) => i); a.phase = 'review';
      refresh(); // analyse locale : elle ne consomme pas de génération gratuite
    }, 900);
  },
  loadTextFile(input) {
    const file = input.files && input.files[0];
    if (!file || !state.ai) return;
    if (file.size > 300000) { askConfirm({ title: 'Fichier trop volumineux', body: 'Choisis un fichier texte de moins de 300 Ko.', label: '' }); return; }
    file.text().then(txt => {
      input.value = '';
      if (!state.ai) return;
      state.ai.text = txt; state.ai.source = 'text';
      if (!state.ai.title) state.ai.title = file.name.replace(/\.[^.]+$/, '');
      refresh();
    });
  },
  pickAiTopic(i) {
    const t = AI_TOPICS_LIST[i];
    if (!t || !state.ai) return;
    state.ai.prompt = t.prompt;
    const input = document.getElementById('ai-prompt'); // pas de refresh : on garde le focus
    if (input) input.value = t.prompt;
  },
  generateAi() {
    const a = state.ai;
    if (!a) return;
    const input = document.getElementById('ai-prompt');
    if (input) a.prompt = input.value.trim();
    if (!a.prompt) { a.error = 'Écris d\'abord ce que tu veux réviser.'; refresh(); return; }
    if (aiLeft() <= 0) { state.showPaywall = true; refresh(); return; }
    const result = generateDeck(a.prompt);
    if (!result) {
      a.error = 'Dans cette démo, l\'IA connaît quelques thèmes (football, cuisine italienne, voyage, conseil). Choisis une idée ci-dessous.';
      refresh(); return;
    }
    a.error = ''; a.phase = 'loading'; refresh();
    setTimeout(() => {
      if (state.ai !== a) return; // l'utilisateur est parti entre-temps
      a.result = result; a.selected = result.cards.map((_, i) => i); a.phase = 'review';
      const t = todayStr();
      state.meta.aiDays[t] = (state.meta.aiDays[t] || 0) + 1;
      state.meta.aiTotal++;
      persist(); refresh();
    }, 1900);
  },
  toggleAi(i) {
    const a = state.ai;
    if (!a || a.phase !== 'review') return;
    a.selected = a.selected.includes(i) ? a.selected.filter(x => x !== i) : a.selected.concat(i);
    refresh();
  },
  addAi() {
    const a = state.ai;
    if (!a || a.phase !== 'review' || a.selected.length === 0) return;
    const res = a.result;
    const stamp = Date.now();
    const deckId = 'd-' + stamp;
    state.decks.push({ id: deckId, name: res.title, rubriqueId: a.rubriqueId, speakLang: res.speakLang });
    a.selected.slice().sort((x, y) => x - y).forEach((i, k) => {
      const c = res.cards[i];
      state.cards.push(Object.assign({ id: 'c-' + stamp + '-' + k, deckId, front: c.front, back: c.back, box: 0, nextReview: todayStr() },
        c.cloze ? { cloze: { text: c.cloze.text, answer: c.cloze.answer } } : {}));
    });
    state.currentRubriqueId = a.rubriqueId;
    state.ai = null;
    persist();
    this.openDeck(deckId);
  },

  // ---- Premium (démo : aucun paiement) ----
  openPaywall() { state.showPaywall = true; refresh(); },
  closePaywall() { state.showPaywall = false; refresh(); },
  upgradePremium() { state.meta.premium = true; state.showPaywall = false; persist(); refresh(); },
  downgradePremium() { state.meta.premium = false; state.showPaywall = false; persist(); refresh(); },

  // ---- Données de démonstration ----
  loadDemo() {
    askConfirm({
      title: 'Charger les données de démo ?',
      body: 'Tes rubriques, paquets et cartes actuels seront remplacés par un jeu d\'exemple complet (révisions et italien), avec une série de jours déjà en cours. Exporte tes fiches avant si tu veux les garder.',
      label: 'Charger', danger: true,
      onConfirm() {
        const d = demoDataset();
        state.rubriques = d.rubriques; state.decks = d.decks; state.cards = d.cards;
        state.stats = d.stats; state.multi = d.multi; state.social = d.social;
        state.meta = { premium: false, aiDays: {}, aiTotal: 0, welcomed: true, reminder: state.meta.reminder };
        state.trash = []; state.view = 'home'; state.session = null; state.reorderMode = false;
        persist(); refresh();
      }
    });
  },

  // ---- Confirmation ----
  cancelConfirm() { state.confirmDialog = null; refresh(); },
  acceptConfirm() {
    const c = state.confirmDialog;
    state.confirmDialog = null;
    if (c && c.onConfirm) c.onConfirm(); else refresh();
  },

  // ---- Navigation ----
  toggleReorder() { state.reorderMode = !state.reorderMode; refresh(); },
  hideRubrique(id) { const r = state.rubriques.find(x => x.id === id); if (r) { r.hidden = true; persist(); refresh(); } },
  showRubrique(id) { const r = state.rubriques.find(x => x.id === id); if (r) { r.hidden = false; persist(); refresh(); } },
  openRubrique(id) { state.currentRubriqueId = id; state.view = 'rubrique'; refresh(); },
  openDeck(id) { state.currentDeckId = id; state.view = 'modes'; refresh(); },
  backHome() { stopDuel(); state.view = 'home'; state.session = null; refresh(); },

  // ---- Rubriques (création + modification) ----
  openAddRubrique() {
    state.editingRubriqueId = null;
    state.pendingRubColor = 'sage';
    state.showAddRubrique = true;
    refresh();
  },
  openEditRubrique(id) {
    const r = state.rubriques.find(x => x.id === id);
    if (!r) return;
    state.editingRubriqueId = id;
    state.pendingRubColor = r.color;
    state.showEditRubrique = true;
    refresh();
  },
  pickRubColor(c) {
    // Modification directe du DOM (pas de refresh()) : un refresh() complet
    // régénérerait la modale et effacerait ce que l'utilisateur a déjà tapé
    // dans les champs nom/emoji.
    state.pendingRubColor = c;
    ['revisions', 'langues', 'sage', 'gold', 'slate', 'lavender'].forEach(k => {
      const el = document.getElementById('sw-' + k);
      if (el) el.classList.toggle('sel', k === c);
    });
  },
  saveRubrique() {
    const name = document.getElementById('rub-name').value.trim();
    if (!name) return;
    const emoji = document.getElementById('rub-emoji').value.trim();
    if (state.editingRubriqueId) {
      const r = state.rubriques.find(x => x.id === state.editingRubriqueId);
      if (r) { r.name = name; r.emoji = emoji; r.color = state.pendingRubColor; }
    } else {
      const maxOrder = Math.max(-1, ...state.rubriques.map(r => r.order));
      state.rubriques.push({ id: 'r-' + Date.now(), name, emoji, color: state.pendingRubColor, order: maxOrder + 1, hidden: false, isDefault: false });
    }
    state.showAddRubrique = false; state.showEditRubrique = false; state.editingRubriqueId = null;
    persist(); refresh();
  },
  // Supprime la rubrique en cours de modification, avec ses paquets et leurs cartes.
  deleteRubrique() {
    const r = state.rubriques.find(x => x.id === state.editingRubriqueId);
    if (!r) return;
    const decks = state.decks.filter(d => d.rubriqueId === r.id);
    const deckIds = decks.map(d => d.id);
    const cards = state.cards.filter(c => deckIds.includes(c.deckId));
    askConfirm({
      title: 'Supprimer la rubrique ?',
      body: '« ' + r.name + ' » ainsi que ses ' + decks.length + ' paquet(s) et ses ' + cards.length + ' carte(s) iront dans « Supprimé récemment ». Tu pourras les récupérer pendant 30 jours.',
      label: 'Supprimer', danger: true,
      onConfirm() {
        sendToTrash('rubrique', r.name, { rubrique: r, decks, cards });
        state.cards = state.cards.filter(c => !deckIds.includes(c.deckId));
        state.decks = state.decks.filter(d => d.rubriqueId !== r.id);
        state.rubriques = state.rubriques.filter(x => x.id !== r.id);
        state.showEditRubrique = false; state.editingRubriqueId = null;
        persist(); refresh();
      }
    });
  },

  // ---- Paquets (création, modification, suppression) ----
  openAddDeck() { state.editingDeckId = null; state.showAddDeck = true; refresh(); },
  openEditDeck(id) {
    if (!state.decks.find(x => x.id === id)) return;
    state.editingDeckId = id;
    state.showEditDeck = true;
    refresh();
  },
  saveDeck() {
    const name = document.getElementById('deck-name').value.trim();
    if (!name) return;
    if (state.editingDeckId) {
      const d = state.decks.find(x => x.id === state.editingDeckId);
      if (d) { d.name = name; d.speakLang = document.getElementById('deck-lang').value; }
    } else {
      state.decks.push({ id: 'd-' + Date.now(), name, rubriqueId: state.currentRubriqueId, speakLang: document.getElementById('deck-lang').value });
    }
    state.showAddDeck = false; state.showEditDeck = false; state.editingDeckId = null;
    persist(); refresh();
  },
  deleteDeck(id) {
    const d = state.decks.find(x => x.id === id);
    if (!d) return;
    const cards = state.cards.filter(c => c.deckId === id);
    const parent = state.rubriques.find(r => r.id === d.rubriqueId);
    askConfirm({
      title: 'Supprimer le paquet ?',
      body: '« ' + d.name + ' » et ses ' + cards.length + ' carte(s) iront dans « Supprimé récemment ». Tu pourras les récupérer pendant 30 jours.',
      label: 'Supprimer', danger: true,
      onConfirm() {
        sendToTrash('deck', d.name, { deck: d, cards, parentName: parent ? parent.name : '' });
        state.decks = state.decks.filter(x => x.id !== id);
        state.cards = state.cards.filter(c => c.deckId !== id);
        persist(); refresh();
      }
    });
  },

  // ---- Cartes ----
  openCards() { state.view = 'cards'; refresh(); },
  openAddCard() { state.editingCardId = null; state.showAddCard = true; refresh(); },
  openEditCard(id) {
    if (!state.cards.find(x => x.id === id)) return;
    state.editingCardId = id;
    state.showEditCard = true;
    refresh();
  },
  saveCard() {
    const front = document.getElementById('card-front').value.trim();
    const back = document.getElementById('card-back').value.trim();
    if (!front || !back) return;
    if (state.editingCardId) {
      // On ne touche qu'au texte : le niveau de maîtrise (box) et la date de rappel restent.
      const c = state.cards.find(x => x.id === state.editingCardId);
      if (c) { c.front = front; c.back = back; }
    } else {
      state.cards.push({ id: 'c-' + Date.now(), deckId: state.currentDeckId, front, back, box: 0, nextReview: todayStr() });
    }
    state.showAddCard = false; state.showEditCard = false; state.editingCardId = null;
    persist(); refresh();
  },
  deleteCard(id) {
    const c = state.cards.find(x => x.id === id);
    if (!c) return;
    const parent = state.decks.find(d => d.id === c.deckId);
    askConfirm({
      title: 'Supprimer la carte ?',
      body: '« ' + c.front + ' » ira dans « Supprimé récemment ». Tu pourras la récupérer pendant 30 jours.',
      label: 'Supprimer', danger: true,
      onConfirm() {
        sendToTrash('card', c.front, { card: c, parentName: parent ? parent.name : '' });
        state.cards = state.cards.filter(x => x.id !== id);
        persist(); refresh();
      }
    });
  },

  // ---- Supprimé récemment ----
  openSettings() { state.view = 'settings'; refresh(); },
  openTrash() { state.view = 'trash'; refresh(); },
  openPitch() { state.view = 'pitch'; refresh(); },
  openStats() { state.view = 'stats'; refresh(); },
  openDiscover() { state.view = 'discover'; state.openArticle = null; refresh(); },
  toggleArticle(i) { state.openArticle = state.openArticle === i ? null : i; refresh(); },

  // ---- Accueil de la première ouverture ----
  // Pas de refresh() sur le choix de l'objectif : il effacerait le pseudo déjà tapé.
  pickWelcomeGoal(n) {
    if (!GOAL_CHOICES.includes(n)) return;
    state.stats.goal = n;
    GOAL_CHOICES.forEach(g => { const el = document.getElementById('wg-' + g); if (el) el.classList.toggle('sel', g === n); });
  },
  finishWelcome() {
    const input = document.getElementById('welcome-pseudo');
    const pseudo = input ? input.value.trim() : '';
    if (pseudo.length >= 2 && pseudo.length <= 16) state.profile.pseudo = pseudo;
    state.meta.welcomed = true;
    persist(); refresh();
  },
  skipWelcome() { state.meta.welcomed = true; persist(); refresh(); },

  // ---- Profil ----
  openProfile() { state.showProfile = true; refresh(); },
  saveProfile() {
    const pseudo = document.getElementById('profile-pseudo').value.trim();
    const avatar = document.getElementById('profile-avatar').value.trim();
    if (pseudo.length < 2 || pseudo.length > 16) { askConfirm({ title: 'Pseudo trop court ou trop long', body: 'Choisis un pseudo de 2 à 16 caractères.', label: '' }); return; }
    state.profile = { pseudo, avatar: avatar && avatar.length <= 8 ? avatar : '🙂' };
    state.showProfile = false;
    persist(); refresh();
  },
  closeProfile() { state.showProfile = false; refresh(); },

  // ---- Rappel quotidien (bannière sur l'accueil, pas de notification push sans serveur) ----
  toggleReminder() {
    state.meta.reminder.on = !state.meta.reminder.on;
    persist(); refresh();
  },
  setReminderTime(v) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { state.meta.reminder.time = v; persist(); }
  },
  restoreFromTrash(id) {
    const t = state.trash.find(x => x.id === id);
    if (!t) return;
    const p = t.payload;
    const missingParent = (kind, name) => askConfirm({
      title: 'Restauration impossible',
      body: 'Le ' + kind + ' « ' + name + ' » qui contenait cet élément n\'existe plus. Restaure-le d\'abord (s\'il est dans « Supprimé récemment »), puis recommence.',
      label: ''
    });
    if (t.type === 'rubrique') {
      if (!state.rubriques.some(r => r.id === p.rubrique.id)) state.rubriques.push(p.rubrique);
      p.decks.forEach(d => { if (!state.decks.some(x => x.id === d.id)) state.decks.push(d); });
      p.cards.forEach(c => { if (!state.cards.some(x => x.id === c.id)) state.cards.push(c); });
    } else if (t.type === 'deck') {
      if (!state.rubriques.some(r => r.id === p.deck.rubriqueId)) { missingParent('rubrique', p.parentName); return; }
      if (!state.decks.some(x => x.id === p.deck.id)) state.decks.push(p.deck);
      p.cards.forEach(c => { if (!state.cards.some(x => x.id === c.id)) state.cards.push(c); });
    } else {
      if (!state.decks.some(d => d.id === p.card.deckId)) { missingParent('paquet', p.parentName); return; }
      if (!state.cards.some(x => x.id === p.card.id)) state.cards.push(p.card);
    }
    state.trash = state.trash.filter(x => x.id !== id);
    persist(); refresh();
  },
  purgeFromTrash(id) {
    const t = state.trash.find(x => x.id === id);
    if (!t) return;
    askConfirm({
      title: 'Effacer pour de bon ?',
      body: '« ' + t.name + ' » sera définitivement perdu, impossible de le récupérer ensuite.',
      label: 'Effacer', danger: true,
      onConfirm() { state.trash = state.trash.filter(x => x.id !== id); persist(); refresh(); }
    });
  },
  // Recrée une rubrique de départ qui a disparu (avec son contenu d'origine).
  restoreDefaults() {
    const seed = seedData();
    seed.rubriques.forEach(sr => {
      const inTrash = state.trash.some(t => t.type === 'rubrique' && t.payload.rubrique.id === sr.id);
      if (state.rubriques.some(r => r.id === sr.id) || inTrash) return;
      const maxOrder = Math.max(-1, ...state.rubriques.map(r => r.order));
      state.rubriques.push(Object.assign({}, sr, { order: maxOrder + 1 }));
      seed.decks.filter(d => d.rubriqueId === sr.id && !state.decks.some(x => x.id === d.id)).forEach(d => {
        state.decks.push(d);
        seed.cards.filter(c => c.deckId === d.id && !state.cards.some(x => x.id === c.id)).forEach(c => state.cards.push(c));
      });
    });
    persist(); refresh();
  },

  // ---- Lecture audio (voix du téléphone, via la Web Speech API) ----
  speak() {
    const s = state.session;
    const card = s && s.queue && s.queue[s.index];
    if (!card) return;
    const d = state.decks.find(x => x.id === card.deckId);
    if (!d || !d.speakLang || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(card.front);
    u.lang = d.speakLang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  },

  // ---- Ajout de plusieurs cartes d'un coup ----
  openBulk() { state.showBulk = true; refresh(); },
  // Pas de refresh() ici : il effacerait le texte en cours de saisie.
  previewBulk(text) {
    const { cards, skipped } = parseBulk(text);
    const el = document.getElementById('bulk-preview');
    if (!el) return;
    el.textContent = cards.length === 0 && skipped === 0
      ? 'Rien à ajouter pour l’instant.'
      : cards.length + ' carte(s) détectée(s)' + (skipped ? ' — ' + skipped + ' ligne(s) ignorée(s) (il manque le « ; » ou un des deux côtés)' : '') + '.';
  },
  saveBulk() {
    const { cards } = parseBulk(document.getElementById('bulk-text').value);
    if (cards.length === 0) return;
    const stamp = Date.now();
    cards.forEach((c, i) => {
      state.cards.push({ id: 'c-' + stamp + '-' + i, deckId: state.currentDeckId, front: c.front, back: c.back, box: 0, nextReview: todayStr() });
    });
    state.showBulk = false;
    persist(); refresh();
  },

  // ---- Sauvegarde / restauration ----
  async exportData() {
    const fileName = 'boite-a-fiches-' + todayStr() + '.json';
    const file = new File([buildBackupJson()], fileName, { type: 'application/json' });
    // Sur téléphone, on ouvre la feuille de partage (« Enregistrer dans Fichiers »...) ;
    // sinon (ordinateur) on déclenche un téléchargement classique.
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Sauvegarde Boîte à Fiches' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // l'utilisateur a fermé la feuille de partage
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  importFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    file.text().then(text => {
      input.value = ''; // permet de re-choisir le même fichier plus tard
      const res = parseBackup(text);
      if (!res.ok) { askConfirm({ title: 'Import impossible', body: res.error, label: '' }); return; }
      const d = res.data;
      askConfirm({
        title: 'Remplacer tes données ?',
        body: 'Cette sauvegarde contient ' + d.rubriques.length + ' rubrique(s), ' + d.decks.length + ' paquet(s) et ' + d.cards.length + ' carte(s).'
          + (res.dropped ? ' (' + res.dropped + ' élément(s) invalide(s) ignorés.)' : '')
          + ' Tes données actuelles, et « Supprimé récemment », seront remplacées.',
        label: 'Remplacer', danger: true,
        onConfirm() {
          state.rubriques = d.rubriques; state.decks = d.decks; state.cards = d.cards; state.trash = [];
          if (d.stats) state.stats = d.stats;
          state.view = 'home'; state.session = null; state.reorderMode = false;
          persist(); refresh();
        }
      });
    }).catch(() => { input.value = ''; askConfirm({ title: 'Import impossible', body: 'Impossible de lire ce fichier.', label: '' }); });
  },

  closeModals() {
    state.showAddRubrique = false; state.showEditRubrique = false; state.editingRubriqueId = null;
    state.showAddDeck = false; state.showEditDeck = false; state.editingDeckId = null;
    state.showAddCard = false; state.showEditCard = false; state.editingCardId = null;
    state.showBulk = false;
    refresh();
  },

  // ---- Démarrage d'une session ----
  startFlash(deckId, rubriqueId, scope) {
    const pool = scope === 'all-due' ? allDueCards() : dueCards(deckId);
    const s = { mode: 'flash', deckId, deckName: deckId ? (state.decks.find(d => d.id === deckId) || {}).name : 'Session mixte', queue: shuffle(pool), index: 0, reviewedCount: 0 };
    prepareCurrentCard(s);
    state.session = s; state.view = 'session'; refresh();
  },
  startMode(mode, deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    const pool = shuffle(dueCards(deckId).length ? dueCards(deckId) : cardsOf(deckId));
    let s;
    if (mode === 'appariement') {
      const batches = splitBatches(pool, 6);
      s = { mode: 'appariement', deckId, deckName: deck.name, batches, batchIndex: 0, matchBatch: batches[0], queue: batches[0], index: 0, reviewedCount: 0 };
      prepareMatching(s);
    } else {
      s = { mode, deckId, deckName: deck.name, queue: pool, index: 0, reviewedCount: 0 };
      prepareCurrentCard(s);
    }
    state.session = s; state.view = 'session'; refresh();
  },
  openMedleyScope(deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    state.session = { mode: 'medley', deckId, deckName: deck.name, scopeChoicePending: true, queue: [], index: 0, reviewedCount: 0 };
    state.view = 'session'; refresh();
  },
  startMedley(deckId, scope) {
    const deck = state.decks.find(d => d.id === deckId);
    const pool = shuffle(scope === 'due' ? (dueCards(deckId).length ? dueCards(deckId) : cardsOf(deckId)) : cardsOf(deckId));
    const s = { mode: 'medley', deckId, deckName: deck.name, reviewedCount: 0, index: 0, scope };
    if (pool.length >= 4) {
      const batch = pool.slice(0, Math.min(6, pool.length));
      s.phase = 'matching'; s.matchBatch = batch; s.pendingQueue = pool.slice(batch.length);
      prepareMatching(s);
    } else {
      s.phase = 'single'; s.queue = pool; s.cardModes = pool.map(() => pickRandom(['flash', 'qcm', 'texte']));
      prepareCurrentCard(s);
    }
    state.session = s; state.view = 'session'; refresh();
  },

  // ---- Appariement ----
  selectMatch(side, cardId) {
    const s = state.session;
    if (side === 'front') s.selFront = (s.selFront === cardId ? null : cardId);
    else s.selBack = (s.selBack === cardId ? null : cardId);

    if (s.selFront && s.selBack) {
      if (s.selFront === s.selBack) {
        s.matchAttempts[s.selFront] = (s.matchAttempts[s.selFront] || 0);
        s.matchedIds.push(s.selFront);
        const card = state.cards.find(c => c.id === s.selFront);
        if (card) scheduleCard(card, (s.matchAttempts[s.selFront] || 0) === 0);
        s.selFront = null; s.selBack = null; s.flashWrong = false;
        persist(); refresh();
      } else {
        s.matchAttempts[s.selFront] = (s.matchAttempts[s.selFront] || 0) + 1;
        s.flashWrong = true; refresh();
        setTimeout(() => { s.selFront = null; s.selBack = null; s.flashWrong = false; refresh(); }, 550);
      }
    } else {
      refresh();
    }
  },
  finishMatching() {
    const s = state.session;
    if (s.mode === 'medley') {
      s.phase = 'single';
      s.queue = s.pendingQueue || [];
      s.index = 0;
      s.reviewedCount += s.matchBatch.length;
      s.cardModes = s.queue.map(() => pickRandom(['flash', 'qcm', 'texte']));
      s.matchFronts = null;
      prepareCurrentCard(s);
      if (s.queue.length === 0) s.done = true;
    } else if (s.batches && s.batchIndex < s.batches.length - 1) {
      // Il reste des cartes : on enchaîne sur le lot suivant.
      s.reviewedCount += s.matchBatch.length;
      s.batchIndex++;
      s.matchBatch = s.batches[s.batchIndex];
      prepareMatching(s);
    } else {
      s.reviewedCount += s.matchBatch.length;
      s.queue = []; s.index = 0; s.matchFronts = null; s.done = true;
    }
    refresh();
  },

  // ---- Flashcard ----
  flip() { state.session.flipped = true; refresh(); },

  // ---- QCM ----
  answerQcm(index) { state.session.qcmSelectedIndex = index; state.session.qcmAnswered = true; refresh(); },
  continueAfterReveal() {
    const s = state.session;
    const card = s.queue[s.index];
    scheduleCard(card, s.qcmOptions[s.qcmSelectedIndex] === card.back);
    persist();
    s.reviewedCount++; s.index++;
    prepareCurrentCard(s);
    refresh();
  },

  // ---- Texte à trous ----
  setTexteInput(v) { state.session.texteInput = v; },
  checkTexte() {
    const s = state.session;
    const card = s.queue[s.index];
    // Phrase à trous (carte générée par l'IA) : on attend le mot manquant, pas le verso.
    const expected = card.cloze ? card.cloze.answer : card.back;
    s.texteCorrect = normalize(s.texteInput) === normalize(expected);
    s.texteRevealed = true;
    refresh();
  },

  // ---- Flashcard / Texte : passage à la carte suivante après auto-évaluation ----
  advance(success) {
    const s = state.session;
    const card = s.queue[s.index];
    scheduleCard(card, success);
    persist();
    s.reviewedCount++; s.index++;
    prepareCurrentCard(s);
    refresh();
  }
};

// Sans ça, Safari sur iPhone ignore l'état CSS ":active" (le retour visuel
// au clic) sur un simple tap — bizarrerie connue de longue date. Un écouteur
// tactile vide sur tout le document suffit à le convaincre de l'appliquer.
document.addEventListener('touchstart', function () {}, { passive: true });

// ---- Démarrage de l'appli ----
loadData();
ensureWeek();
setRefresh(refresh);
refresh();

if ('serviceWorker' in navigator) {
  // Quand une nouvelle version prend le relais, on propose de recharger au lieu de
  // couper l'utilisateur en pleine révision (ou en plein duel).
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) { state.updateReady = true; refresh(); }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => {
      console.warn('Service worker non installé (normal en développement local sans HTTPS/localhost).', err);
    });
  });
}
