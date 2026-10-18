// Point d'entrée + "contrôleur" de l'appli : chaque bouton du HTML généré par
// render.js appelle une méthode de l'objet App défini ici (ex: onclick="App.flip()").
// Une méthode App typique fait 3 choses dans l'ordre : 1) modifier state,
// 2) sauvegarder si besoin (persist), 3) redessiner l'écran (refresh).

import { state, shuffle, normalize, pickRandom, todayStr, cardsOf, treeCards, rootDeckId, childDecks, allDecksOf, nextDeckOrder, descendantIds, treeNodes, scopedCards, scopedDue, dueCards, allDueCards, scheduleCard, parseBulk, splitBatches, seedData, GOAL_CHOICES, INTERESTS, STUDY_LEVELS, STUDY_FIELDS, courseChoices, aiLeft, ensureWeek, APP_VERSION, totalReviews as totalReviewsCount, longestStreak as longestStreakCount } from './state.js';
import { generateDeck, generateFromText, demoDataset, AI_TOPICS, DEMO_PEOPLE, DAILY_OPPONENT, makeCloze, MOOC_TOPICS } from './demo.js';
import { eligibleDecks, startDuel, stopDuel, answer as duelAnswerFn, pickMatch, setRefresh } from './duel.js';
import { loadData, persist, buildBackupJson, parseBackup, EMAIL_RE } from './storage.js';
import { render, friendResultsHtml, searchResultsHtml } from './render.js';
import { enableReorder } from './dragdrop.js';

function refresh() {
  render();
  const list = document.getElementById('rubrique-list');
  if (list) enableReorder(list, applyReorder);
  const decks = document.getElementById('deck-list');
  if (decks) enableReorder(decks, applyDeckReorder);
}

// Après un glisser-déposer de paquets : on numérote les paquets de cette liste dans le nouvel ordre.
function applyDeckReorder(idsInOrder) {
  idsInOrder.forEach((id, i) => {
    const d = state.decks.find(x => x.id === id);
    if (d) d.order = i;
  });
  persist();
  refresh();
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
  let pool = treeCards(rootDeckId(card.deckId)).filter(c => c.id !== card.id);
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

// Une « cible » de Medley est soit un paquet (son id), soit toute une rubrique ('R:' + id).
function targetCards(target) {
  if (target.indexOf('R:') === 0) {
    const ids = state.decks.filter(d => d.rubriqueId === target.slice(2)).map(d => d.id);
    return state.cards.filter(c => ids.includes(c.deckId));
  }
  return scopedCards(target);
}
function targetDue(target) {
  const t = todayStr();
  return targetCards(target).filter(c => c.nextReview <= t);
}
function targetName(target) {
  if (target.indexOf('R:') === 0) { const r = state.rubriques.find(x => x.id === target.slice(2)); return r ? r.name : 'Rubrique'; }
  const d = state.decks.find(x => x.id === target);
  return d ? d.name : 'Paquet';
}

// Texte à trous sur une fiche de cours : retaper une définition entière à l'identique est
// irréaliste. Pour les cartes dont le verso est une phrase assez longue et qui n'ont pas
// encore de phrase à trous, on en fabrique une (mot clé masqué ; l'indice est la question).
function ensureAutoCloze(cards) {
  let changed = false;
  cards.forEach(function (c) {
    if (c.cloze || c.back.length < 25 || c.back.split(/\s+/).length < 5) return;
    const cz = makeCloze(c.back);
    if (cz) { c.cloze = { text: cz.text, answer: cz.answer, hint: c.front, auto: true }; changed = true; }
  });
  if (changed) persist();
}

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

// État de départ du parcours d'accueil (rejoué = on part du profil actuel).
// studyOnly : seulement les écrans « parcours » et « matières », puis le récapitulatif (depuis l'onglet Profil).
function makeOnboard(replay, studyOnly) {
  const st = state.profile.study || {};
  return { flow: studyOnly ? ['study', 'courses', 'recap'] : ['welcome', 'account', 'study', 'courses', 'goal', 'recap'], i: 0, replay, studyOnly: !!studyOnly, error: '',
    pseudo: state.profile.pseudo !== 'Toi' ? state.profile.pseudo : '', avatar: state.profile.avatar, email: state.profile.email || '',
    level: st.level || '', year: st.year || '', field: st.field || '', degree: st.degree || '', exam: st.exam || '',
    courses: (state.profile.courses || []).slice(), goal: state.stats.goal, interests: (state.meta.interests || []).slice(),
    remind: state.meta.reminder.on, time: state.meta.reminder.time };
}
function onbStep() { const o = state.onboard; return o ? o.flow[o.i] : ''; }
// Recopie dans l'état ce qui a été tapé dans les champs (on ne rafraîchit pas à chaque lettre).
function syncOnbInputs() {
  const o = state.onboard;
  if (!o) return;
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
  const p = g('onb-pseudo'); if (p !== null) o.pseudo = p;
  const e = g('onb-email'); if (e !== null) o.email = e;
  const d = g('onb-degree'); if (d !== null) o.degree = d.slice(0, 60);
  const x = g('onb-exam'); if (x !== null) o.exam = /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : '';
}

// Modes à une carte à la fois cochés pour le Medley (l'appariement est géré à part).
function medleySingles() {
  return state.medleyModes.filter(m => m !== 'appariement');
}

// Déplace un paquet : 'R:idRubrique' = à la racine de cette rubrique, 'D:idPaquet' = dans ce paquet.
// Un paquet ne peut pas aller dans lui-même ni dans un de ses sous-paquets.
function moveDeck(d, value) {
  let rid, parentId = null;
  if (value.indexOf('R:') === 0) rid = value.slice(2);
  else if (value.indexOf('D:') === 0) {
    const target = state.decks.find(x => x.id === value.slice(2));
    if (!target || descendantIds(d.id).includes(target.id)) return;
    rid = target.rubriqueId; parentId = target.id;
  } else return;
  if (!state.rubriques.some(r => r.id === rid)) return;
  if ((d.parentId || null) === parentId && d.rubriqueId === rid) return;
  descendantIds(d.id).forEach(id => { const x = state.decks.find(y => y.id === id); if (x) x.rubriqueId = rid; });
  if (parentId) d.parentId = parentId; else delete d.parentId;
  d.order = nextDeckOrder(rid, parentId);
}

// Écarte les cartes dont le recto existe déjà dans le paquet courant : on peut
// ré-importer une liste mise à jour chaque semaine sans doublons.
function newBulkCards(cards) {
  const have = new Set(treeCards(state.currentDeckId).map(c => normalize(c.front)));
  return cards.filter(c => { const k = normalize(c.front); if (have.has(k)) return false; have.add(k); return true; });
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
  openAi(rubriqueId, source, from, deckId) {
    // deckId : si on vient de l'écran d'un paquet, les cartes iront dans CE paquet (sinon « nouveau paquet »).
    state.ai = { rubriqueId, source: source || 'prompt', from: from || 'rubrique', targetDeckId: deckId || 'new', prompt: '', phase: 'form', error: '', result: null, selected: [] };
    state.view = 'ai'; refresh();
  },
  leaveAi() {
    const from = state.ai && state.ai.from;
    state.view = from === 'create' ? 'create' : (from === 'deck' ? 'modes' : 'rubrique');
    state.ai = null; refresh();
  },
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
      a.error = 'Dans cette démo, l\'IA connaît seulement des thèmes préparés à l\'avance. Choisis une des idées ci-dessous.';
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
  setAiTarget(id) { if (state.ai) { state.ai.targetDeckId = id; refresh(); } },
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
    // Soit un paquet existant choisi par l'utilisateur, soit un nouveau paquet.
    const existing = a.targetDeckId !== 'new' ? state.decks.find(d => d.id === a.targetDeckId && d.rubriqueId === a.rubriqueId) : null;
    const deckId = existing ? existing.id : 'd-' + stamp;
    if (existing) { if (!existing.speakLang && res.speakLang) existing.speakLang = res.speakLang; }
    else state.decks.push({ id: deckId, name: res.title, rubriqueId: a.rubriqueId, speakLang: res.speakLang, order: nextDeckOrder(a.rubriqueId, null) });
    a.selected.slice().sort((x, y) => x - y).forEach((i, k) => {
      const c = res.cards[i];
      const nc = Object.assign({ id: 'c-' + stamp + '-' + k, deckId, front: c.front, back: c.back, box: 0, nextReview: todayStr() },
        c.cloze ? { cloze: { text: c.cloze.text, answer: c.cloze.answer } } : {});
      state.cards.push(nc);
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
        state.meta = { premium: false, aiDays: {}, aiTotal: 0, welcomed: true, interests: state.meta.interests || [], haptics: state.meta.haptics, reminder: state.meta.reminder };
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
  openRubrique(id) { state.currentRubriqueId = id; state.view = 'rubrique'; state.reorderMode = false; state.dropOpen = null; refresh(); window.scrollTo(0, 0); },
  openDeck(id) {
    const d = state.decks.find(x => x.id === id);
    if (d) state.currentRubriqueId = d.rubriqueId;
    state.currentDeckId = id; state.view = 'modes'; state.reorderMode = false; state.dropOpen = null; refresh(); window.scrollTo(0, 0);
  },
  // Retour : vers le paquet parent s'il y en a un, sinon vers la rubrique.
  backFromDeck() {
    const d = state.decks.find(x => x.id === state.currentDeckId);
    if (d && d.parentId) this.openDeck(d.parentId); else this.openRubrique(d ? d.rubriqueId : state.currentRubriqueId);
  },
  backHome() { stopDuel(); state.dropOpen = null; state.view = 'home'; state.session = null; refresh(); },

  // ---- Barre d'onglets ----
  goTab(tab) {
    state.dropOpen = null;
    stopDuel();
    state.session = null;
    const roots = { learn: 'home', play: 'multi', create: 'create', progress: 'stats', profile: 'settings' };
    state.view = roots[tab] || 'home';
    if (tab === 'play') state.friendQuery = '';
    refresh();
    window.scrollTo(0, 0);
  },
  // Sélecteur de l'onglet « Jouer » : Duels, Classement ou Amis.
  goPlay(view) {
    if (view === 'league') this.openLeague();
    else if (view === 'friends') this.openFriends();
    else this.openMulti();
  },

  // ---- Onglet « Créer » ----
  setCreateRubrique(id) { state.createRubriqueId = id; refresh(); },
  createAi(source) {
    const rubs = state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order);
    const cur = rubs.find(r => r.id === state.createRubriqueId) || rubs[0];
    if (cur) this.openAi(cur.id, source, 'create');
  },
  createDeck() {
    const rubs = state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order);
    const cur = rubs.find(r => r.id === state.createRubriqueId) || rubs[0];
    if (!cur) return;
    state.currentRubriqueId = cur.id; // le paquet créé sera rangé dans cette rubrique
    this.openAddDeck();
  },

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

  // ---- Paquets (création, modification, déplacement, suppression) ----
  openAddDeck() { state.editingDeckId = null; state.newDeckParentId = null; state.showAddDeck = true; refresh(); },
  // Nouveau paquet DANS le paquet affiché (comme créer un dossier dans un dossier).
  openAddSubDeck() { state.editingDeckId = null; state.newDeckParentId = state.currentDeckId; state.showAddDeck = true; refresh(); },
  openEditDeck(id) {
    if (!state.decks.find(x => x.id === id)) return;
    state.editingDeckId = id;
    state.showEditDeck = true;
    refresh();
  },
  saveDeck() {
    const name = document.getElementById('deck-name').value.trim();
    if (!name) return;
    const lang = document.getElementById('deck-lang').value;
    if (state.editingDeckId) {
      const d = state.decks.find(x => x.id === state.editingDeckId);
      if (d) {
        d.name = name; d.speakLang = lang;
        // « Emplacement » : valeur 'R:idRubrique' (racine d'une rubrique) ou 'D:idPaquet' (dans ce paquet).
        const loc = document.getElementById('deck-loc');
        if (loc && loc.value) moveDeck(d, loc.value);
      }
    } else {
      const parent = state.newDeckParentId ? state.decks.find(x => x.id === state.newDeckParentId) : null;
      const rid = parent ? parent.rubriqueId : state.currentRubriqueId;
      const nd = Object.assign({ id: 'd-' + Date.now(), name, rubriqueId: rid, speakLang: lang, order: nextDeckOrder(rid, parent ? parent.id : null) },
        parent ? { parentId: parent.id } : {});
      state.decks.push(nd);
      // Si une sélection personnalisée est active et que le parent est coché, le nouveau sous-paquet l'est aussi.
      Object.keys(state.deckSel).forEach(k => { if (parent && state.deckSel[k].includes(parent.id)) state.deckSel[k].push(nd.id); });
    }
    state.showAddDeck = false; state.showEditDeck = false; state.editingDeckId = null; state.newDeckParentId = null;
    persist(); refresh();
  },
  deleteDeck(id) {
    const d = state.decks.find(x => x.id === id);
    if (!d) return;
    const ids = new Set(descendantIds(id));
    const decks = state.decks.filter(x => ids.has(x.id));
    const cards = state.cards.filter(c => ids.has(c.deckId));
    const parent = d.parentId ? state.decks.find(x => x.id === d.parentId) : state.rubriques.find(r => r.id === d.rubriqueId);
    askConfirm({
      title: 'Supprimer le paquet ?',
      body: '« ' + d.name + ' »' + (decks.length > 1 ? ', ses ' + (decks.length - 1) + ' sous-paquet(s)' : '') + ' et ' + cards.length + ' carte(s) iront dans « Supprimé récemment ». Tu pourras les récupérer pendant 30 jours.',
      label: 'Supprimer', danger: true,
      onConfirm() {
        sendToTrash('deck', d.name, { deck: d, decks: decks.filter(x => x.id !== id), cards, parentName: parent ? parent.name : '' });
        state.decks = state.decks.filter(x => !ids.has(x.id));
        state.cards = state.cards.filter(c => !ids.has(c.deckId));
        if (ids.has(state.currentDeckId)) state.view = d.parentId ? 'modes' : 'rubrique', state.currentDeckId = d.parentId || null;
        persist(); refresh();
      }
    });
  },

  // ---- Listes déroulantes à cocher ----
  toggleDrop(key) { state.dropOpen = state.dropOpen === key ? null : key; refresh(); },
  // Contenu à réviser dans un paquet : cocher un paquet qui a des sous-paquets coche/décoche tout son contenu.
  toggleSel(deckId, nodeId) {
    const all = descendantIds(deckId);
    const cur = new Set(state.deckSel[deckId] || all);
    const branch = descendantIds(nodeId);
    const full = branch.every(id => cur.has(id));
    branch.forEach(id => { if (full) cur.delete(id); else cur.add(id); });
    if (cur.size === 0) return; // on garde toujours au moins une case cochée
    state.deckSel[deckId] = cur.size === all.length ? undefined : all.filter(id => cur.has(id));
    if (state.deckSel[deckId] === undefined) delete state.deckSel[deckId];
    refresh();
  },
  selAll(deckId) { delete state.deckSel[deckId]; refresh(); },
  toggleMedleyMode(m) {
    const cur = new Set(state.medleyModes);
    if (cur.has(m)) { if (cur.size === 1) return; cur.delete(m); } else cur.add(m);
    state.medleyModes = ['flash', 'qcm', 'texte', 'appariement'].filter(x => cur.has(x));
    refresh();
  },
  toggleMultiMode(m) {
    const cur = new Set(state.multiModes);
    if (cur.has(m)) { if (cur.size === 1) return; cur.delete(m); } else cur.add(m);
    state.multiModes = ['medley', 'qcm', 'vf', 'match'].filter(x => cur.has(x));
    refresh();
  },
  toggleMultiTheme(id) {
    const ok = eligibleDecks().map(d => d.id);
    const cur = new Set(state.multiThemes || ok);
    const branch = descendantIds(id).filter(x => ok.includes(x));
    const full = branch.every(x => cur.has(x));
    branch.forEach(x => { if (full) cur.delete(x); else cur.add(x); });
    if (cur.size === 0) return;
    state.multiThemes = cur.size === ok.length ? null : ok.filter(x => cur.has(x));
    refresh();
  },
  allMultiThemes() { state.multiThemes = null; refresh(); },

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
    const deckEl = document.getElementById('card-deck');
    const deckSel = deckEl && state.decks.some(d => d.id === deckEl.value) ? deckEl.value : null;
    if (!front || !back) return;
    if (state.editingCardId) {
      // On ne touche qu'au texte : le niveau de maîtrise (box) et la date de rappel restent.
      const c = state.cards.find(x => x.id === state.editingCardId);
      if (c) { c.front = front; c.back = back; if (c.cloze && c.cloze.auto) delete c.cloze; if (deckSel) c.deckId = deckSel; }
    } else {
      state.cards.push({ id: 'c-' + Date.now(), deckId: deckSel || state.currentDeckId, front, back, box: 0, nextReview: todayStr() });
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
  openSearch() { state.view = 'search'; refresh(); },
  // Pas de refresh() complet : il ferait perdre le focus de la barre de recherche.
  runSearch(q) {
    const el = document.getElementById('search-results');
    if (el) el.innerHTML = searchResultsHtml(q);
  },
  openDeckCards(deckId) {
    const d = state.decks.find(x => x.id === deckId);
    if (!d) return;
    state.currentRubriqueId = d.rubriqueId; state.currentDeckId = deckId; state.view = 'cards'; refresh();
  },
  toggleArticle(i) { state.openArticle = state.openArticle === i ? null : i; refresh(); },

  // ---- Accueil de la première ouverture ----
  // Parcours d'accueil : présentation, compte, parcours d'études, matières, objectif, récapitulatif.
  // Le « compte » est un profil enregistré sur l'appareil (aucun serveur dans cette version).
  startOnboarding() { state.onboard = makeOnboard(true, false); state.view = 'home'; refresh(); window.scrollTo(0, 0); },
  // Depuis l'onglet Profil : on ne repasse que par le parcours d'études et les matières.
  editStudy() { state.onboard = makeOnboard(true, true); refresh(); window.scrollTo(0, 0); },
  onbNext() {
    const o = state.onboard;
    if (!o) return;
    syncOnbInputs();
    if (onbStep() === 'account') {
      if (o.pseudo.length < 2 || o.pseudo.length > 16) { o.error = 'Ton pseudo doit faire entre 2 et 16 caractères.'; refresh(); return; }
      if (o.email && !EMAIL_RE.test(o.email)) { o.error = 'Cette adresse e-mail ne semble pas valide (ou laisse le champ vide).'; refresh(); return; }
    }
    o.error = '';
    o.i = Math.min(o.i + 1, o.flow.length - 1);
    refresh(); window.scrollTo(0, 0);
  },
  onbBack() {
    const o = state.onboard;
    if (!o) return;
    if (o.i === 0) { if (o.studyOnly) { state.onboard = null; refresh(); } return; }
    syncOnbInputs(); o.error = ''; o.i--; refresh(); window.scrollTo(0, 0);
  },
  onbAvatar(e) { syncOnbInputs(); state.onboard.avatar = e; refresh(); },
  onbInterest(id) {
    syncOnbInputs();
    const o = state.onboard;
    o.interests = o.interests.includes(id) ? o.interests.filter(x => x !== id) : o.interests.concat(id);
    refresh();
  },
  onbLevel(id) {
    syncOnbInputs();
    const o = state.onboard, lvl = STUDY_LEVELS.find(l => l.id === id);
    if (!lvl) return;
    o.level = o.level === id ? '' : id;
    if (!lvl.years.includes(o.year) || !o.level) o.year = '';
    refresh();
  },
  onbYear(i) {
    syncOnbInputs();
    const o = state.onboard, lvl = STUDY_LEVELS.find(l => l.id === o.level);
    if (lvl && lvl.years[i]) { o.year = o.year === lvl.years[i] ? '' : lvl.years[i]; refresh(); }
  },
  onbField(id) {
    syncOnbInputs();
    const o = state.onboard;
    if (STUDY_FIELDS.some(f => f.id === id)) { o.field = o.field === id ? '' : id; refresh(); }
  },
  // Matières : on passe l'index dans la liste affichée, jamais le texte (une apostrophe casserait le onclick).
  onbCourse(i) {
    syncOnbInputs();
    const o = state.onboard, name = courseChoices(o.field, o.courses)[i];
    if (name === undefined) return;
    if (o.courses.includes(name)) o.courses = o.courses.filter(c => c !== name);
    else if (o.courses.length < 14) o.courses = o.courses.concat(name);
    refresh();
  },
  onbAddCourse() {
    syncOnbInputs();
    const o = state.onboard, el = document.getElementById('onb-course');
    const name = el ? el.value.trim().slice(0, 40) : '';
    if (name && !o.courses.some(c => normalize(c) === normalize(name)) && o.courses.length < 14) o.courses = o.courses.concat(name);
    refresh();
    const again = document.getElementById('onb-course'); if (again) again.focus();
  },
  onbGoal(n) { if (GOAL_CHOICES.includes(n)) { state.onboard.goal = n; refresh(); } },
  onbRemind() { state.onboard.remind = !state.onboard.remind; refresh(); },
  onbTime(v) { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) state.onboard.time = v; },
  onbLogin() {
    askConfirm({ title: 'Connexion en ligne', body: 'Prototype : il n\'y a pas encore de serveur. Les comptes en ligne (connexion, synchronisation entre appareils) font partie de la phase 2. Crée ton profil : il reste sur cet appareil.', label: '' });
  },
  // Applique les choix de l'accueil. go = 'review' pour enchaîner sur une première révision.
  onbFinish(go) {
    const o = state.onboard;
    if (!o) return;
    syncOnbInputs();
    state.profile.pseudo = o.pseudo || state.profile.pseudo;
    state.profile.avatar = o.avatar || state.profile.avatar;
    state.profile.email = o.email || '';
    if (!state.profile.createdAt) state.profile.createdAt = todayStr();
    state.profile.study = { level: o.level, year: o.year, field: o.field, degree: o.degree.slice(0, 60), exam: o.exam };
    state.profile.courses = o.courses.slice(0, 14);
    state.stats.goal = o.goal;
    state.meta.reminder.on = o.remind; state.meta.reminder.time = o.time;
    state.meta.interests = INTERESTS.map(i => i.id).filter(id => o.interests.includes(id));
    // Une langue choisie qui n'a pas encore de paquet : on en prépare un (vide) dans « Spécial Langues ».
    const lr = state.rubriques.find(r => r.id === 'r-langues');
    if (lr) INTERESTS.filter(i => i.group === 'Langues' && o.interests.includes(i.id)).forEach(function (i) {
      const have = state.decks.some(d => d.rubriqueId === lr.id && (d.speakLang === i.id || normalize(d.name) === normalize(i.label)));
      if (!have) state.decks.push({ id: 'd-' + Date.now() + '-' + i.id.slice(0, 2), name: i.label, rubriqueId: lr.id, speakLang: i.id, order: nextDeckOrder(lr.id, null) });
    });
    // Chaque matière en cours devient un paquet (vide) dans « Spécial Révisions », prêt à remplir.
    const rr = state.rubriques.find(r => r.id === 'r-revisions');
    if (rr) o.courses.forEach(function (c, k) {
      // Déjà un paquet du même sujet (ex. « Gestion de projet » et « Project Management ») : on n'en crée pas un second.
      const topic = MOOC_TOPICS.find(x => x.test.test(normalize(c)));
      const have = state.decks.some(d => d.rubriqueId === rr.id && (normalize(d.name) === normalize(c) || (topic && topic === MOOC_TOPICS.find(x => x.test.test(normalize(d.name))))));
      if (!have) state.decks.push({ id: 'd-' + Date.now() + '-c' + k, name: c, rubriqueId: rr.id, speakLang: '', order: nextDeckOrder(rr.id, null) });
    });
    const studyOnly = o.studyOnly;
    state.meta.welcomed = true; state.onboard = null;
    persist();
    if (studyOnly) { state.view = 'settings'; refresh(); window.scrollTo(0, 0); }
    else if (go === 'review' && allDueCards().length > 0) this.startFlash(null, null, 'all-due');
    else { state.view = 'home'; refresh(); window.scrollTo(0, 0); }
  },
  skipWelcome() { state.meta.welcomed = true; state.onboard = null; persist(); refresh(); },

  // ---- Partage et avis ----
  async shareApp() {
    const url = location.origin + location.pathname.replace(/index\.html$/, '');
    const data = { title: 'Boîte à Fiches', text: 'Je révise avec Boîte à Fiches : cartes, QCM, duels et ligue. Essaie-la !', url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      askConfirm({ title: 'Lien copié', body: url, label: '' });
    } catch (e) {
      askConfirm({ title: 'Voici le lien à partager', body: url, label: '' });
    }
  },
  openFeedback() { state.feedbackRating = 0; state.showFeedback = true; refresh(); },
  closeFeedback() { state.showFeedback = false; refresh(); },
  // Pas de refresh() : il effacerait le commentaire en cours de saisie.
  pickFeedback(n) {
    state.feedbackRating = n;
    [1, 2, 3, 4].forEach(i => { const el = document.getElementById('fb-' + i); if (el) el.classList.toggle('sel', i === n); });
  },
  async sendFeedback() {
    const t = document.getElementById('fb-text');
    const comment = t ? t.value.trim() : '';
    if (!state.feedbackRating && !comment) { askConfirm({ title: 'Rien à envoyer', body: 'Choisis une humeur ou écris un commentaire.', label: '' }); return; }
    const usage = totalReviewsCount() + ' cartes révisées, record de série ' + longestStreakCount() + ' j, ' + state.multi.played + ' duel(s)';
    const text = 'Avis Boîte à Fiches (v' + APP_VERSION + ')\nRessenti : ' + (state.feedbackRating ? state.feedbackRating + '/4' : 'non précisé') + '\nUsage : ' + usage + '\n' + (comment || '(pas de commentaire)');
    state.showFeedback = false;
    try {
      if (navigator.share) { await navigator.share({ title: 'Avis Boîte à Fiches', text }); refresh(); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') { refresh(); return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      askConfirm({ title: 'Avis copié', body: 'Colle-le dans un message pour l\'envoyer.', label: '' });
    } catch (e) {
      askConfirm({ title: 'Ton avis', body: text, label: '' });
    }
  },

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

  toggleHaptics() { state.meta.haptics = !state.meta.haptics; if (state.meta.haptics && navigator.vibrate) navigator.vibrate(12); persist(); refresh(); },

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
      if (p.deck.parentId && !state.decks.some(x => x.id === p.deck.parentId)) delete p.deck.parentId; // le dossier parent n'existe plus : retour à la racine
      if (!state.decks.some(x => x.id === p.deck.id)) state.decks.push(p.deck);
      (p.decks || []).forEach(d => { if (!state.decks.some(x => x.id === d.id)) state.decks.push(d); });
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

  // ---- Partage d'un paquet ----
  // Texte « recto ; verso » collable dans « Ajouter plusieurs cartes » chez un camarade.
  async shareDeck() {
    const d = state.decks.find(x => x.id === state.currentDeckId);
    if (!d) return;
    const lines = cardsOf(d.id).map(c => c.front.replace(/[\r\n;]+/g, ' ') + ' ; ' + c.back.replace(/[\r\n]+/g, ' '));
    const text = 'Paquet « ' + d.name + ' » — Boîte à Fiches\n(à coller dans « Ajouter plusieurs cartes »)\n\n' + lines.join('\n');
    try {
      if (navigator.share) { await navigator.share({ title: 'Paquet ' + d.name, text }); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      askConfirm({ title: 'Paquet copié', body: lines.length + ' carte(s) copiées. Colle-les dans un message à ton camarade.', label: '' });
    } catch (e) {
      askConfirm({ title: 'Copie impossible', body: 'Ton navigateur n\'autorise pas la copie automatique.', label: '' });
    }
  },

  // ---- Ajout de plusieurs cartes d'un coup ----
  loadBulkFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 300000) { askConfirm({ title: 'Fichier trop volumineux', body: 'Choisis un fichier de moins de 300 Ko.', label: '' }); return; }
    file.text().then(txt => {
      input.value = '';
      const ta = document.getElementById('bulk-text');
      if (ta) { ta.value = txt; this.previewBulk(txt); }
    });
  },
  openBulk() { state.showBulk = true; refresh(); },
  // Pas de refresh() ici : il effacerait le texte en cours de saisie.
  previewBulk(text) {
    const { cards, skipped } = parseBulk(text);
    const fresh = newBulkCards(cards);
    const dup = cards.length - fresh.length;
    const el = document.getElementById('bulk-preview');
    if (!el) return;
    el.textContent = cards.length === 0 && skipped === 0
      ? 'Rien à ajouter pour l’instant.'
      : fresh.length + ' carte(s) à ajouter'
        + (dup ? ' — ' + dup + ' déjà dans le paquet (ignorée(s))' : '')
        + (skipped ? ' — ' + skipped + ' ligne(s) ignorée(s) (il manque le « ; » ou un des deux côtés)' : '') + '.';
  },
  saveBulk() {
    const cards = newBulkCards(parseBulk(document.getElementById('bulk-text').value).cards);
    const deckEl = document.getElementById('bulk-deck');
    const target = deckEl && state.decks.some(d => d.id === deckEl.value) ? deckEl.value : state.currentDeckId;
    if (cards.length === 0) return;
    const stamp = Date.now();
    cards.forEach((c, i) => {
      state.cards.push({ id: 'c-' + stamp + '-' + i, deckId: target, front: c.front, back: c.back, box: 0, nextReview: todayStr() });
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
    state.showBulk = false; state.newDeckParentId = null;
    refresh();
  },

  // ---- Démarrage d'une session ----
  startFlash(deckId, rubriqueId, scope) {
    const pool = scope === 'all-due' ? allDueCards() : scopedDue(deckId);
    const s = { mode: 'flash', deckId, deckName: deckId ? (state.decks.find(d => d.id === deckId) || {}).name : 'Session mixte', queue: shuffle(pool), index: 0, reviewedCount: 0 };
    prepareCurrentCard(s);
    state.session = s; state.view = 'session'; refresh();
  },
  startMode(mode, deckId) {
    const deck = state.decks.find(d => d.id === deckId);
    const pool = shuffle(scopedDue(deckId).length ? scopedDue(deckId) : scopedCards(deckId));
    if (mode === 'texte') ensureAutoCloze(pool);
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
    state.dropOpen = null;
    state.session = { mode: 'medley', deckId, deckName: targetName(deckId), scopeChoicePending: true, queue: [], index: 0, reviewedCount: 0 };
    state.view = 'session'; refresh();
  },
  startMedley(deckId, scope) {
    const pool = shuffle(scope === 'due' ? (targetDue(deckId).length ? targetDue(deckId) : targetCards(deckId)) : targetCards(deckId));
    ensureAutoCloze(pool);
    const wantMatch = state.medleyModes.includes('appariement');
    const singles = medleySingles();
    let s;
    if (wantMatch && singles.length === 0) {
      // Seul l'appariement est coché : on enchaîne des lots de 6 paires.
      const batches = splitBatches(pool, 6);
      s = { mode: 'appariement', deckId, deckName: targetName(deckId), batches, batchIndex: 0, matchBatch: batches[0], queue: batches[0], index: 0, reviewedCount: 0 };
      prepareMatching(s);
    } else {
      s = { mode: 'medley', deckId, deckName: targetName(deckId), reviewedCount: 0, index: 0, scope };
      if (wantMatch && pool.length >= 4) {
        const batch = pool.slice(0, Math.min(6, pool.length));
        s.phase = 'matching'; s.matchBatch = batch; s.pendingQueue = pool.slice(batch.length);
        prepareMatching(s);
      } else {
        s.phase = 'single'; s.queue = pool; s.cardModes = pool.map(() => pickRandom(singles.length ? singles : ['flash']));
        prepareCurrentCard(s);
      }
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
      s.cardModes = s.queue.map(() => pickRandom(medleySingles()));
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

// Petite vibration au toucher (Android ; Safari sur iPhone ne l'autorise pas). Désactivable dans
// les Réglages, et ignorée si l'utilisateur a demandé de réduire les animations.
document.addEventListener('pointerdown', function (e) {
  if (!state.meta.haptics || !navigator.vibrate) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (e.target.closest && e.target.closest('button, .card, .mode-card, .deck-card, .opt, .match-item, .fab, .settings-row, .chip, .ai-btn, .article, .list-item.tap')) navigator.vibrate(8);
}, { passive: true });

// Indicateur « hors-ligne » : ajouté/retiré sans redessiner l'écran (pour ne rien interrompre).
function syncOfflinePill() {
  const existing = document.getElementById('offline-pill');
  if (!navigator.onLine && !existing) document.body.insertAdjacentHTML('beforeend', '<div class="offline-pill" id="offline-pill">Hors-ligne · tout fonctionne</div>');
  if (navigator.onLine && existing) existing.remove();
}
window.addEventListener('online', syncOfflinePill);
window.addEventListener('offline', syncOfflinePill);

// ---- Démarrage de l'appli ----
loadData();
if (!state.meta.welcomed) state.onboard = makeOnboard(false);
// Demande au navigateur de ne pas effacer nos données quand il manque de place
// (pas garanti partout, mais ça réduit le risque).
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* pas grave */ }
ensureWeek();
setRefresh(refresh);
refresh();
syncOfflinePill();

// Raccourcis de l'icône (voir manifest.json) : ./?action=daily, resume ou multi.
(function handleShortcut() {
  const action = new URLSearchParams(location.search).get('action');
  if (!action) return;
  history.replaceState(null, '', location.pathname);
  if (!state.meta.welcomed) return;
  if (action === 'daily') window.App.dailyChallenge();
  else if (action === 'multi') window.App.openMulti();
  else if (action === 'resume' && allDueCards().length > 0) window.App.startFlash(null, null, 'all-due');
})();

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
