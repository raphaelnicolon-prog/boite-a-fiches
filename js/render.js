// Ce fichier ne fait qu'une chose : à partir de l'état actuel (state), produire
// le HTML à afficher. Aucune de ces fonctions ne modifie les données — c'est
// app.js qui s'en charge, puis qui rappelle render() pour rafraîchir l'écran.

import {
  state, MODES, SPEAK_LANGS, TRASH_DAYS, esc, colorVar, decksOf, cardsOf, dueCards, dueInRubrique,
  allDueCards, seedData, GOAL_CHOICES, reviewedToday, currentStreak, last7Days,
  aiLeft, FREE_AI_PER_DAY, badgeList, playerLevel, ensureWeek, daysLeftInWeek,
  weekSummary, masteryBreakdown, reminderDue, totalReviews, longestStreak, APP_VERSION
} from './state.js';
import { AI_TOPICS, PARTNERS, FACTS, DEMO_PEOPLE, ARTICLES } from './demo.js';
import { todayStr } from './state.js';
import { leagueTable, POINTS, DUEL_MODES } from './duel.js';

export function render() {
  const app = document.getElementById('app');
  if (state.view === 'home') app.innerHTML = renderHome();
  else if (state.view === 'rubrique') app.innerHTML = renderRubrique();
  else if (state.view === 'modes') app.innerHTML = renderModes();
  else if (state.view === 'cards') app.innerHTML = renderCards();
  else if (state.view === 'trash') app.innerHTML = renderTrash();
  else if (state.view === 'settings') app.innerHTML = renderSettings();
  else if (state.view === 'ai') app.innerHTML = renderAi();
  else if (state.view === 'pitch') app.innerHTML = renderPitch();
  else if (state.view === 'stats') app.innerHTML = renderStats();
  else if (state.view === 'search') app.innerHTML = renderSearch();
  else if (state.view === 'discover') app.innerHTML = renderDiscover();
  else if (state.view === 'multi') app.innerHTML = renderMulti();
  else if (state.view === 'duel') app.innerHTML = renderDuel();
  else if (state.view === 'league') app.innerHTML = renderLeague();
  else if (state.view === 'friends') app.innerHTML = renderFriends();
  else if (state.view === 'session') app.innerHTML = renderSession();
  if (state.showAddRubrique) app.insertAdjacentHTML('beforeend', renderRubriqueModal(null));
  if (state.showEditRubrique) app.insertAdjacentHTML('beforeend', renderRubriqueModal(state.editingRubriqueId));
  if (state.showAddDeck) app.insertAdjacentHTML('beforeend', renderDeckModal(null));
  if (state.showEditDeck) app.insertAdjacentHTML('beforeend', renderDeckModal(state.editingDeckId));
  if (state.showAddCard) app.insertAdjacentHTML('beforeend', renderCardModal(null));
  if (state.showEditCard) app.insertAdjacentHTML('beforeend', renderCardModal(state.editingCardId));
  if (state.showBulk) app.insertAdjacentHTML('beforeend', renderBulkModal());
  if (state.showPaywall) app.insertAdjacentHTML('beforeend', renderPaywall());
  if (state.showProfile) app.insertAdjacentHTML('beforeend', renderProfileModal());
  if (state.showFeedback) app.insertAdjacentHTML('beforeend', renderFeedbackModal());
  if (!state.meta.welcomed && state.view === 'home') app.insertAdjacentHTML('beforeend', renderWelcome());
  if (state.updateReady) app.insertAdjacentHTML('beforeend', '<div class="update-bar" onclick="location.reload()">✨ Nouvelle version disponible · toucher pour recharger</div>');
  // Toujours en dernier : la confirmation doit passer au-dessus de toute autre fenêtre.
  if (state.confirmDialog) app.insertAdjacentHTML('beforeend', renderConfirmDialog());
}

// Bouton « Écouter » : seulement si le paquet de la carte a une langue de lecture
// et que le navigateur sait parler (speechSynthesis).
function speakButton(card) {
  const d = state.decks.find(x => x.id === card.deckId);
  if (!d || !d.speakLang || !('speechSynthesis' in window)) return '';
  return '<button class="speak-btn" onclick="App.speak()">🔊 Écouter</button>';
}

// Emoji affiché sur le badge d'une rubrique : celui choisi, sinon (rubriques
// créées avant cette fonctionnalité, ou laissées vides) la 1re lettre du nom.
function rubriqueBadge(r) {
  return esc(r.emoji || r.name.charAt(0).toUpperCase());
}

// Les deux rubriques de départ ont un intitulé dédié pour l'écran des
// paquets ; toute rubrique créée par l'utilisateur garde un intitulé neutre.
function deckPickerTitle(r) {
  if (r.id === 'r-revisions') return 'Choisis ta matière !';
  if (r.id === 'r-langues') return 'Choisis ta langue !';
  return 'Choisis un paquet';
}

// Roue crantée (icône « settings » de la bibliothèque Feather, licence MIT).
const GEAR_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

const SEARCH_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

// ---------- RÉGLAGES ----------
function settingsRow(icon, title, desc, onclick) {
  return '<button class="settings-row" onclick="' + onclick + '"><span class="settings-ic">' + icon + '</span>'
    + '<span class="settings-txt"><span class="mode-title">' + title + '</span><span class="mode-desc">' + desc + '</span></span>'
    + '<span class="chev">›</span></button>';
}
function renderSettings() {
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Accueil</button>';
  html += '<div class="eyebrow">Boîte à Fiches</div><h1 class="title">Réglages</h1>';
  html += '<div class="subtitle">Tes fiches ne sont stockées que sur cet appareil : pense à les exporter de temps en temps.</div>';
  html += '<div class="eyebrow" style="margin:0 0 8px;">Objectif quotidien</div><div class="card"><div class="rub-meta" style="margin:0 0 12px;">Nombre de cartes visé chaque jour : c\'est la barre de progression de l\'accueil.</div><div class="row">'
    + GOAL_CHOICES.map(function (n) { return '<button class="chip' + (state.stats.goal === n ? ' sel' : '') + '" onclick="App.setGoal(' + n + ')">' + n + '</button>'; }).join('')
    + '</div></div>';
  const rem = state.meta.reminder;
  html += '<div class="eyebrow" style="margin:0 0 8px;">Profil et rappel</div><div class="settings-group">'
    + settingsRow(esc(state.profile.avatar), 'Mon profil', 'Pseudo : ' + esc(state.profile.pseudo) + ' · avatar', 'App.openProfile()')
    + '</div><div class="card"><div class="row between"><div><div class="mode-title">⏰ Rappel quotidien</div><div class="mode-desc">Une bannière sur l\'accueil à l\'heure choisie, tant que ton objectif n\'est pas atteint.</div></div>'
    + '<button class="chip' + (rem.on ? ' sel' : '') + '" onclick="App.toggleReminder()">' + (rem.on ? 'Activé' : 'Désactivé') + '</button></div>'
    + '<div class="row" style="margin-top:12px;"><span class="rub-meta" style="margin:0;">Heure</span><input type="time" class="time-input" id="reminder-time" value="' + esc(rem.time) + '" onchange="App.setReminderTime(this.value)"/></div>'
    + '<div class="rub-meta" style="margin-top:10px;">Les notifications sur téléphone fermé arriveront avec les comptes (phase 2).</div></div>';
  html += '<div class="eyebrow" style="margin:0 0 8px;">Abonnement</div><div class="settings-group">'
    + settingsRow('💎', 'Premium', state.meta.premium ? 'Actif (démo) · générations IA illimitées' : FREE_AI_PER_DAY + ' générations IA gratuites par jour · en savoir plus', 'App.openPaywall()')
    + '</div>';
  html += '<div class="eyebrow" style="margin:0 0 8px;">Mes données</div><div class="settings-group">'
    + settingsRow('💾', 'Exporter mes fiches', 'Crée un fichier de sauvegarde', 'App.exportData()')
    + settingsRow('📥', 'Importer une sauvegarde', 'Remplace tes données par celles d\'un fichier', 'document.getElementById(\'import-file\').click()')
    + settingsRow('🗑️', 'Supprimé récemment', state.trash.length ? state.trash.length + ' élément(s) récupérable(s) pendant ' + TRASH_DAYS + ' jours' : 'Rien pour l\'instant', 'App.openTrash()')
    + '</div><input type="file" id="import-file" accept=".json,application/json" style="display:none;" onchange="App.importFile(this)"/>';
  html += '<div class="eyebrow" style="margin:0 0 8px;">Partager et améliorer</div><div class="settings-group">'
    + settingsRow('📨', 'Inviter un camarade', 'Envoie le lien de l\'appli', 'App.shareApp()')
    + settingsRow('💬', 'Donner mon avis', 'Note et commentaire, pour améliorer l\'appli', 'App.openFeedback()')
    + '</div>';
  html += '<div class="eyebrow" style="margin:0 0 8px;">Projet</div><div class="settings-group">'
    + settingsRow('📊', 'Présentation du projet', 'Modèle économique, rétention et feuille de route', 'App.openPitch()')
    + '</div>';
  html += '<div class="eyebrow" style="margin:0 0 8px;">Démonstration</div><div class="settings-group">'
    + settingsRow('🎬', 'Charger les données de démo', 'Remplace tes fiches par un jeu d\'exemple complet', 'App.loadDemo()')
    + '</div>';
  html += '<div class="rub-meta" style="margin-top:6px;text-align:center;">Boîte à Fiches · version ' + APP_VERSION + ' (prototype)</div>';
  return html;
}

// ---------- SÉRIE DE JOURS ET OBJECTIF ----------
// Un « nudge » (coup de pouce) positif : on montre la progression et la série en
// cours, sans jamais culpabiliser quand elle est à zéro.
function renderStreakCard() {
  const streak = currentStreak();
  const done = reviewedToday();
  const goal = state.stats.goal;
  const pct = Math.min(100, Math.round(done / goal * 100));
  const title = streak > 0 ? '🔥 ' + streak + ' jour' + (streak > 1 ? 's' : '') + ' d\'affilée' : 'Lance ta série';
  const msg = done >= goal ? 'Objectif atteint, bravo 🎉'
    : done > 0 ? done + ' / ' + goal + ' cartes aujourd\'hui'
    : streak > 0 ? 'Révise une carte aujourd\'hui pour garder ta série'
    : 'Révise une carte aujourd\'hui pour la démarrer';
  const dots = last7Days().map(function (d) {
    return '<div class="week-day"><div class="dot' + (d.count > 0 ? ' on' : '') + (d.isToday ? ' today' : '') + '"></div><span>' + d.letter + '</span></div>';
  }).join('');
  return '<div class="stat-card tap" onclick="App.openStats()"><div class="row between"><div><div class="mode-title">' + title + '</div><div class="mode-desc">' + msg + '</div></div>'
    + '<div class="week-dots">' + dots + '</div></div>'
    + '<div class="goal-bar"><div class="goal-fill' + (done >= goal ? ' full' : '') + '" style="width:' + pct + '%;"></div></div>'
    + '<div class="stat-more">Mes statistiques ›</div></div>';
}

// ---------- ACCUEIL ----------
function renderHome() {
  const totalDue = allDueCards().length;
  const visibleRubs = state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order);
  const hiddenRubs = state.rubriques.filter(r => r.hidden);

  let html = '<div class="row between" style="align-items:flex-start;"><div><div class="eyebrow">Boîte à Fiches</div><h1 class="title home-title">Ton espace de révision</h1></div>'
    + '<div class="row" style="gap:6px;"><button class="icon-btn" onclick="App.openSearch()" aria-label="Rechercher">' + SEARCH_ICON + '</button>'
    + '<button class="icon-btn" onclick="App.openSettings()" aria-label="Réglages">' + GEAR_ICON + '</button></div></div>';
  html += '<div class="subtitle">' + (totalDue > 0 ? totalDue + ' carte(s) à revoir aujourd\'hui, tous paquets confondus.' : 'Rien à revoir aujourd\'hui.') + '</div>';
  html += renderStreakCard();
  html += renderReminderBanner();

  if (totalDue > 0) {
    html += '<button class="card" style="width:100%;text-align:left;border:none;cursor:pointer;" onclick="App.startFlash(null,null,\'all-due\')">'
      + '<div class="row between"><div><div class="mode-title" style="color:var(--primary);">▶ Reprendre</div><div class="mode-desc">' + totalDue + ' carte(s) prêtes, toutes rubriques</div></div><span class="chev" style="color:var(--primary);">›</span></div></button>';
  }

  html += '<button class="mode-card medley" style="width:100%;border:none;text-align:left;cursor:pointer;" onclick="App.openMulti()">'
    + '<div><div class="mode-title">⚔️ Multijoueur</div><div class="mode-desc">Défie tes amis, grimpe dans la ligue</div></div><span class="chev">›</span></button>';

  const dailyDone = state.meta.dailyDone === todayStr();
  html += '<div class="mode-card" style="cursor:pointer;" onclick="App.dailyChallenge()"><div><div class="mode-title">🎯 Défi du jour' + (dailyDone ? ' ✓' : '') + '</div>'
    + '<div class="mode-desc">' + (dailyDone ? 'Relevé aujourd\'hui · reviens demain pour un nouveau bonus' : 'Un Medley contre les joueurs du jour · +20 points bonus') + '</div></div><span class="chev">›</span></div>';

  html += '<div class="row between" style="margin:18px 0 8px;"><div class="eyebrow">Mes rubriques</div>'
    + '<button class="toggle-reorder" onclick="App.toggleReorder()">' + (state.reorderMode ? 'Terminé' : 'Réorganiser') + '</button></div>';

  html += '<div id="rubrique-list">';
  visibleRubs.forEach(function (r) {
    const due = dueInRubrique(r.id);
    const total = decksOf(r.id).length;
    html += '<div class="card rub-item" data-id="' + r.id + '" onclick="' + (state.reorderMode ? '' : 'App.openRubrique(\'' + r.id + '\')') + '" style="cursor:pointer;">'
      + '<div class="row between"><div class="row">'
      + '<div class="badge" style="background:' + colorVar(r.color) + ';">' + rubriqueBadge(r) + '</div>'
      + '<div><div class="rub-name">' + esc(r.name) + '</div><div class="rub-meta">' + total + ' paquet(s)' + (due > 0 ? ' · ' + due + ' à revoir' : '') + '</div></div>'
      + '</div>';
    if (state.reorderMode) {
      html += '<div class="row">'
        + '<button class="hidebtn" onclick="event.stopPropagation();App.openEditRubrique(\'' + r.id + '\')">modifier</button>'
        + '<button class="hidebtn" onclick="event.stopPropagation();App.hideRubrique(\'' + r.id + '\')">masquer</button>'
        + '<div class="drag-handle" onclick="event.stopPropagation();" title="Glisser pour réordonner">⠿</div>'
        + '</div>';
    } else {
      html += '<span class="chev">›</span>';
    }
    html += '</div></div>';
  });
  html += '</div>';

  if (hiddenRubs.length > 0 && state.reorderMode) {
    html += '<div class="eyebrow" style="margin-top:14px;">Masquées</div>';
    hiddenRubs.forEach(function (r) {
      html += '<div class="card row between"><div class="rub-name" style="color:var(--ink-soft);">' + esc(r.name) + '</div>'
        + '<button class="hidebtn" onclick="App.showRubrique(\'' + r.id + '\')">afficher</button></div>';
    });
  }

  html += '<div class="fact-card tap" onclick="App.openDiscover()"><div class="eyebrow">💡 Le saviez-vous ?</div><div class="rub-meta" style="margin-top:6px;font-size:13px;line-height:1.45;">'
    + esc(FACTS[Math.floor(Date.now() / 86400000) % FACTS.length]) + '</div><div class="stat-more">Lire les articles ›</div></div>';
  html += '<div class="fab" onclick="App.openAddRubrique()">+</div>';
  return html;
}

// ---------- RUBRIQUE (paquets) ----------
function renderRubrique() {
  const r = state.rubriques.find(x => x.id === state.currentRubriqueId);
  if (!r) return renderHome();
  const decks = decksOf(r.id);
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Rubriques</button>';
  html += '<div class="eyebrow" style="color:' + colorVar(r.color) + ';">' + esc(r.name) + '</div><h1 class="title">' + deckPickerTitle(r) + '</h1>';
  html += aiButton(r);
  const rubCards = decks.reduce((n, d) => n + cardsOf(d.id).length, 0);
  if (rubCards >= 2) html += '<div class="mode-card medley" style="cursor:pointer;margin-bottom:16px;" onclick="App.openMedleyScope(\'R:' + r.id + '\')">'
    + '<div><div class="mode-title">✨ Quizz Medley de la rubrique</div><div class="mode-desc">Mélange tous les paquets · ' + rubCards + ' cartes</div></div><span class="chev">›</span></div>';
  if (decks.length === 0) { html += '<div class="subtitle">Aucun paquet ici pour l\'instant — crée le premier.</div>'; }
  decks.forEach(function (d) {
    const due = dueCards(d.id).length;
    const total = cardsOf(d.id).length;
    html += '<div class="deck-card" onclick="App.openDeck(\'' + d.id + '\')" style="cursor:pointer;">'
      + '<div class="deck-top" style="background:' + colorVar(r.color) + ';"></div>'
      + '<div class="row between"><div><div class="rub-name">' + esc(d.name) + '</div>'
      + '<div class="rub-meta">' + (total === 0 ? 'vide' : (due + ' / ' + total + ' à revoir · maîtrise ' + deckMastery(d.id) + ' %')) + '</div></div>'
      + '<div class="row">'
      + '<button class="hidebtn" onclick="event.stopPropagation();App.openEditDeck(\'' + d.id + '\')">modifier</button>'
      + '<button class="hidebtn" onclick="event.stopPropagation();App.deleteDeck(\'' + d.id + '\')">supprimer</button>'
      + '<span class="chev">›</span>'
      + '</div></div></div>';
  });
  html += partnerCard(r);
  html += '<div class="fab" style="background:' + colorVar(r.color) + ';" onclick="App.openAddDeck()">+</div>';
  return html;
}

// ---------- MODES ----------
function renderModes() {
  const d = state.decks.find(x => x.id === state.currentDeckId);
  if (!d) return renderHome();
  const r = state.rubriques.find(x => x.id === d.rubriqueId);
  const total = cardsOf(d.id).length;
  const due = dueCards(d.id).length;
  let html = '<button class="backbtn" onclick="App.openRubrique(\'' + r.id + '\')">‹ ' + esc(r.name) + '</button>';
  html += '<div class="eyebrow">' + esc(d.name) + '</div><h1 class="title">Modes de révision</h1>';
  html += '<div class="subtitle">' + (total === 0 ? 'Ajoute des cartes pour commencer.' : (due + ' / ' + total + ' cartes à revoir aujourd\'hui')) + '</div>';
  MODES.forEach(function (m) {
    const enough = total >= m.min;
    html += '<div class="mode-card" style="opacity:' + (enough ? 1 : .45) + ';" onclick="' + (enough ? ('App.startMode(\'' + m.id + '\',\'' + d.id + '\')') : '') + '">'
      + '<div><div class="mode-title">' + m.name + '</div><div class="mode-desc">' + m.desc + (enough ? '' : ' — besoin de ' + m.min + ' carte(s) min.') + '</div></div>'
      + '<span class="chev">›</span></div>';
  });
  const enoughMedley = total >= 2;
  html += '<div class="mode-card medley" style="opacity:' + (enoughMedley ? 1 : .45) + ';" onclick="' + (enoughMedley ? ('App.openMedleyScope(\'' + d.id + '\')') : '') + '">'
    + '<div><div class="mode-title">✨ Quizz Medley</div><div class="mode-desc">Mélange de tous les modes disponibles</div></div><span class="chev">›</span></div>';
  html += '<button class="manage-link" onclick="App.openCards(\'' + d.id + '\')">Voir et modifier les cartes (' + total + ')</button>';
  html += '<div class="fab" onclick="App.openAddCard()">+</div>';
  return html;
}

// ---------- CARTES D'UN PAQUET (liste, modification, suppression) ----------
function renderCards() {
  const d = state.decks.find(x => x.id === state.currentDeckId);
  if (!d) return renderHome();
  const cards = cardsOf(d.id);
  let html = '<button class="backbtn" onclick="App.openDeck(\'' + d.id + '\')">‹ ' + esc(d.name) + '</button>';
  html += '<div class="eyebrow">' + esc(d.name) + '</div><h1 class="title">Tes cartes</h1>';
  html += '<div class="row between" style="margin-bottom:18px;"><div class="subtitle" style="margin:0;">' + cards.length + ' carte(s)</div>'
    + '<button class="toggle-reorder" onclick="App.openBulk()">Ajouter plusieurs cartes</button></div>';
  if (cards.length === 0) html += '<div class="subtitle">Aucune carte pour l\'instant — ajoute-en avec le bouton + ou colle-en plusieurs d\'un coup.</div>';
  cards.forEach(function (c) {
    html += '<div class="list-item"><div class="row between" style="align-items:flex-start;">'
      + '<div style="min-width:0;"><div class="rub-name">' + esc(c.front) + '</div><div class="rub-meta">' + esc(c.back) + '</div></div>'
      + '<div class="row card-actions">'
      + '<button class="hidebtn" onclick="App.openEditCard(\'' + c.id + '\')">modifier</button>'
      + '<button class="hidebtn" onclick="App.deleteCard(\'' + c.id + '\')">supprimer</button>'
      + '</div></div></div>';
  });
  html += '<div class="fab" onclick="App.openAddCard()">+</div>';
  return html;
}

function renderMedleyScope(deckId) {
  return '<div class="center" style="padding-top:30px;">'
    + '<div class="eyebrow">Quizz Medley</div><h1 class="title">Quelles cartes ?</h1>'
    + '<div class="scope-row">'
    + '<button class="scope-opt" onclick="App.startMedley(\'' + deckId + '\',\'due\')">Seulement celles dues aujourd\'hui</button>'
    + '<button class="scope-opt" onclick="App.startMedley(\'' + deckId + '\',\'wide\')">Mélange plus large, même déjà sues</button>'
    + '</div><button class="backbtn" onclick="' + (deckId.indexOf('R:') === 0 ? 'App.openRubrique(\'' + deckId.slice(2) + '\')' : 'App.openDeck(\'' + deckId + '\')') + '" style="margin-top:16px;">‹ Annuler</button></div>';
}

// ---------- SESSION ----------
function renderSession() {
  const s = state.session;
  if (!s) return renderHome();
  if (s.scopeChoicePending) return renderMedleyScope(s.deckId);
  if (s.done) return renderSessionDone();
  if (s.mode === 'appariement' || (s.mode === 'medley' && s.phase === 'matching')) return renderMatching();
  if (s.queue.length === 0 || s.index >= s.queue.length) return renderSessionDone();
  const cardMode = s.mode === 'medley' ? s.cardModes[s.index] : s.mode;
  if (cardMode === 'flash') return renderFlash();
  if (cardMode === 'qcm') return renderQcm();
  if (cardMode === 'texte') return renderTexte();
  return renderFlash();
}

function sessionHeader() {
  const s = state.session;
  return '<div class="progress">' + (s.index + 1) + ' / ' + s.queue.length + (s.deckName ? (' — ' + esc(s.deckName)) : '') + '</div>';
}

function renderFlash() {
  const s = state.session;
  const card = s.queue[s.index];
  return '<div class="center">' + sessionHeader()
    + '<div class="flashcard ' + (s.flipped ? 'flipped' : '') + '" onclick="App.flip()">'
    + '<div class="flashcard-inner">'
    + '<div class="face front"><div class="face-tag">Recto</div>' + esc(card.front) + '</div>'
    + '<div class="face back"><div class="face-tag">Verso</div>' + esc(card.back) + '</div>'
    + '</div></div>'
    + speakButton(card)
    + (s.flipped
      ? '<div class="rate-row"><button class="pill rate-again" onclick="App.advance(false)">À revoir</button><button class="pill rate-easy" onclick="App.advance(true)">Je savais</button></div>'
      : '<div class="hint">Touche la carte pour retourner</div>')
    + quitLink() + '</div>';
}

function renderQcm() {
  const s = state.session;
  const card = s.queue[s.index];
  let opts = '';
  s.qcmOptions.forEach(function (opt, i) {
    let cls = 'opt';
    if (s.qcmAnswered) {
      if (opt === card.back) cls += ' correct';
      else if (i === s.qcmSelectedIndex) cls += ' wrong';
      else cls += ' dim';
    }
    // On passe l'index (i), jamais le texte de la réponse : un texte contenant
    // une apostrophe (ex. "S'il te plaît") casserait le onclick="..." généré.
    opts += '<button class="' + cls + '" ' + (s.qcmAnswered ? '' : 'onclick="App.answerQcm(' + i + ')"') + '>' + esc(opt) + '</button>';
  });
  return '<div class="center">' + sessionHeader()
    + '<div class="qtext">' + esc(card.front) + '</div>'
    + speakButton(card)
    + '<div class="opt-grid">' + opts + '</div>'
    + (s.qcmAnswered ? '<div class="result-banner ' + (s.qcmOptions[s.qcmSelectedIndex] === card.back ? 'ok' : 'ko') + '">' + (s.qcmOptions[s.qcmSelectedIndex] === card.back ? 'Bonne réponse !' : 'La bonne réponse était : ' + esc(card.back)) + '</div><button class="btn" style="margin-top:16px;" onclick="App.continueAfterReveal()">Continuer</button>' : '')
    + quitLink() + '</div>';
}

function renderTexte() {
  const s = state.session;
  const card = s.queue[s.index];
  return '<div class="center">' + sessionHeader()
    + '<div class="qtext">' + esc(card.cloze ? card.cloze.text : card.front) + '</div>'
    + (card.cloze ? '<div class="hint" style="margin:-8px 0 4px;">' + (card.cloze.hint ? 'Question : ' : 'Indice : ') + esc(card.cloze.hint || card.back) + '</div>' : '')
    + speakButton(card)
    + (!s.texteRevealed
      ? '<input class="answer-input" id="texte-input" placeholder="Ta réponse" value="' + esc(s.texteInput || '') + '" oninput="App.setTexteInput(this.value)" autocomplete="off" autocapitalize="off" spellcheck="false"/>'
        + '<button class="btn" style="margin-top:14px;" onclick="App.checkTexte()">Vérifier</button>'
      : '<div class="result-banner ' + (s.texteCorrect ? 'ok' : 'ko') + '">' + (s.texteCorrect ? 'Correct !' : 'Réponse attendue : ' + esc(card.cloze ? card.cloze.answer : card.back)) + '</div>'
        + '<div class="rate-row"><button class="pill rate-again" onclick="App.advance(false)">À revoir</button><button class="pill rate-easy" onclick="App.advance(true)">Je savais</button></div>')
    + quitLink() + '</div>';
}

function renderMatching() {
  const s = state.session;
  const frontsHtml = s.matchFronts.map(function (f) {
    let cls = 'match-item';
    if (s.matchedIds.includes(f.cardId)) cls += ' matched';
    else if (s.selFront === f.cardId) cls += ' sel';
    if (s.flashWrong && s.selFront === f.cardId) cls += ' wrongflash';
    return '<div class="' + cls + '" onclick="' + (s.matchedIds.includes(f.cardId) ? '' : 'App.selectMatch(\'front\',\'' + f.cardId + '\')') + '">' + esc(f.text) + '</div>';
  }).join('');
  const backsHtml = s.matchBacks.map(function (b) {
    let cls = 'match-item';
    if (s.matchedIds.includes(b.cardId)) cls += ' matched';
    else if (s.selBack === b.cardId) cls += ' sel';
    if (s.flashWrong && s.selBack === b.cardId) cls += ' wrongflash';
    return '<div class="' + cls + '" onclick="' + (s.matchedIds.includes(b.cardId) ? '' : 'App.selectMatch(\'back\',\'' + b.cardId + '\')') + '">' + esc(b.text) + '</div>';
  }).join('');
  const done = s.matchedIds.length === s.matchBatch.length;
  const multi = s.batches && s.batches.length > 1;
  const lastBatch = !multi || s.batchIndex >= s.batches.length - 1;
  return '<div class="center"><div class="progress">Appariement — ' + s.matchedIds.length + ' / ' + s.matchBatch.length + (multi ? ' · lot ' + (s.batchIndex + 1) + ' sur ' + s.batches.length : '') + '</div>'
    + '<div class="match-wrap"><div class="match-col">' + frontsHtml + '</div><div class="match-col">' + backsHtml + '</div></div>'
    + (done ? '<button class="btn" style="margin-top:18px;" onclick="App.finishMatching()">' + (lastBatch ? 'Continuer' : 'Lot suivant') + '</button>' : '<div class="hint">Touche un élément de chaque colonne pour les relier</div>')
    + quitLink() + '</div>';
}

function renderSessionDone() {
  const s = state.session;
  return '<div class="center" style="padding-top:30px;">'
    + '<div class="eyebrow">Session</div><h1 class="title">Bien joué !</h1>'
    + '<div class="subtitle">' + (s.reviewedCount || 0) + ' carte(s) revue(s).</div>'
    + sessionRecap()
    + '<button class="btn" style="margin-top:18px;" onclick="App.backHome()">Retour à l\'accueil</button></div>';
}

function quitLink() {
  return '<div class="footer-row"><button class="link" onclick="App.backHome()">Quitter la session</button></div>';
}

// ---------- MODALES ----------
// editId à null = mode création ; sinon on pré-remplit avec la rubrique/le
// paquet existant et le bouton devient "Enregistrer" au lieu de "Créer".
function renderRubriqueModal(editId) {
  const editing = editId ? state.rubriques.find(x => x.id === editId) : null;
  const colors = ['revisions', 'langues', 'sage', 'gold', 'slate', 'lavender'];
  const swatches = colors.map(function (c) {
    return '<div class="swatch' + (c === state.pendingRubColor ? ' sel' : '') + '" style="background:' + colorVar(c) + ';" onclick="App.pickRubColor(\'' + c + '\')" id="sw-' + c + '"></div>';
  }).join('');
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">' + (editing ? 'Modifier la rubrique' : 'Nouvelle rubrique') + '</div>'
    + '<label>Nom</label><input id="rub-name" placeholder="ex: Spécial Musique" value="' + (editing ? esc(editing.name) : '') + '"/>'
    + '<label>Emoji (facultatif)</label><input id="rub-emoji" placeholder="ex: 📚" value="' + (editing ? esc(editing.emoji || '') : '') + '"/>'
    + '<label>Couleur</label><div class="swatch-row">' + swatches + '</div>'
    + '<div class="modal-actions">'
    + (editing ? '<button class="btn danger" onclick="App.deleteRubrique()">Supprimer</button>' : '')
    + '<button class="btn ghost" onclick="App.closeModals()">Annuler</button><button class="btn" onclick="App.saveRubrique()">' + (editing ? 'Enregistrer' : 'Créer') + '</button></div>'
    + '</div></div>';
}
function renderDeckModal(editId) {
  const editing = editId ? state.decks.find(x => x.id === editId) : null;
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">' + (editing ? 'Modifier le paquet' : 'Nouveau paquet') + '</div>'
    + '<label>Nom</label><input id="deck-name" placeholder="ex: Espagnol, ou Marketing" value="' + (editing ? esc(editing.name) : '') + '"/>'
    + '<label>Lecture audio du recto</label><select id="deck-lang">'
    + SPEAK_LANGS.map(function (l) { return '<option value="' + l.code + '"' + (editing && editing.speakLang === l.code ? ' selected' : '') + '>' + l.label + '</option>'; }).join('')
    + '</select>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeModals()">Annuler</button><button class="btn" onclick="App.saveDeck()">' + (editing ? 'Enregistrer' : 'Créer') + '</button></div>'
    + '</div></div>';
}
function renderCardModal(editId) {
  const editing = editId ? state.cards.find(x => x.id === editId) : null;
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">' + (editing ? 'Modifier la carte' : 'Nouvelle carte') + '</div>'
    + '<label>Recto (question / mot)</label><textarea id="card-front" placeholder="ex: Qu\'est-ce que le SECI model ?">' + (editing ? esc(editing.front) : '') + '</textarea>'
    + '<label>Verso (réponse / traduction)</label><textarea id="card-back" placeholder="Réponse...">' + (editing ? esc(editing.back) : '') + '</textarea>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeModals()">Annuler</button><button class="btn" onclick="App.saveCard()">Enregistrer</button></div>'
    + '</div></div>';
}
function renderBulkModal() {
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">Ajouter plusieurs cartes</div>'
    + '<div class="rub-meta" style="margin-top:8px;">Une carte par ligne, sous la forme <b>recto ; verso</b>. Tu peux aussi coller directement deux colonnes copiées depuis Excel ou Google Sheets.</div>'
    + '<label>Tes cartes</label><textarea id="bulk-text" style="min-height:150px;" placeholder="Buongiorno ; Bonjour&#10;Grazie mille ; Merci beaucoup&#10;Arrivederci ; Au revoir" oninput="App.previewBulk(this.value)"></textarea>'
    + '<div class="rub-meta" id="bulk-preview" style="margin-top:8px;">Rien à ajouter pour l\'instant.</div>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeModals()">Annuler</button><button class="btn" onclick="App.saveBulk()">Ajouter</button></div>'
    + '</div></div>';
}

// ---------- CONFIRMATION (remplace les fenêtres natives confirm()) ----------
// Sans bouton de confirmation (label vide) elle sert de simple message avec « OK ».
function renderConfirmDialog() {
  const c = state.confirmDialog;
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.cancelConfirm()"><div class="modal">'
    + '<div class="eyebrow">' + esc(c.title) + '</div>'
    + '<div class="confirm-body">' + esc(c.body) + '</div>'
    + '<div class="modal-actions">'
    + (c.label
      ? '<button class="btn ghost" onclick="App.cancelConfirm()">Annuler</button>'
        + '<button class="btn' + (c.danger ? ' danger-solid' : '') + '" onclick="App.acceptConfirm()">' + esc(c.label) + '</button>'
      : '<button class="btn" onclick="App.cancelConfirm()">OK</button>')
    + '</div></div></div>';
}

// ---------- SUPPRIMÉ RÉCEMMENT ----------
function trashMeta(t) {
  const p = t.payload;
  if (t.type === 'rubrique') return 'Rubrique · ' + p.decks.length + ' paquet(s), ' + p.cards.length + ' carte(s)';
  if (t.type === 'deck') return 'Paquet · ' + p.cards.length + ' carte(s)';
  return 'Carte · ' + p.card.back;
}
function agoLabel(iso) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / (24 * 3600 * 1000));
  const left = Math.max(TRASH_DAYS - days, 0);
  return (days <= 0 ? 'supprimé aujourd\'hui' : days === 1 ? 'supprimé hier' : 'supprimé il y a ' + days + ' j') + ' · effacé pour de bon dans ' + left + ' j';
}
function renderTrash() {
  const missing = seedData().rubriques.filter(sr =>
    !state.rubriques.some(r => r.id === sr.id) && !state.trash.some(t => t.type === 'rubrique' && t.payload.rubrique.id === sr.id));
  let html = '<button class="backbtn" onclick="App.openSettings()">‹ Réglages</button>';
  html += '<div class="eyebrow">Corbeille</div><h1 class="title">Supprimé récemment</h1>';
  html += '<div class="subtitle">Les éléments supprimés restent récupérables pendant ' + TRASH_DAYS + ' jours, puis sont effacés pour de bon.</div>';
  if (state.trash.length === 0) html += '<div class="subtitle">Rien à récupérer pour l\'instant.</div>';
  state.trash.slice().sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt)).forEach(function (t) {
    html += '<div class="list-item"><div class="rub-name">' + esc(t.name) + '</div>'
      + '<div class="rub-meta">' + esc(trashMeta(t)) + '</div><div class="rub-meta">' + agoLabel(t.deletedAt) + '</div>'
      + '<div class="row" style="margin-top:10px;"><button class="btn" onclick="App.restoreFromTrash(\'' + t.id + '\')">Restaurer</button>'
      + '<button class="btn danger" style="margin-right:0;" onclick="App.purgeFromTrash(\'' + t.id + '\')">Effacer</button></div></div>';
  });
  if (missing.length) {
    html += '<div class="eyebrow" style="margin:26px 0 8px;">Rubriques de départ manquantes</div>'
      + '<div class="card"><div class="rub-meta" style="margin:0 0 12px;">' + missing.map(r => esc(r.name)).join(', ')
      + ' n\'existe plus. Tu peux la recréer avec son contenu d\'origine (tes propres cartes supprimées ne reviennent pas).</div>'
      + '<button class="btn ghost" onclick="App.restoreDefaults()">Rétablir</button></div>';
  }
  return html;
}

// ---------- ASSISTANT IA (simulé) ----------
function aiQuotaText() {
  if (state.meta.premium) return '💎 Premium : générations illimitées';
  const n = aiLeft();
  return n > 0 ? n + ' génération' + (n > 1 ? 's' : '') + ' gratuite' + (n > 1 ? 's' : '') + ' restante' + (n > 1 ? 's' : '') + ' aujourd\'hui' : 'Plus de génération gratuite aujourd\'hui';
}

function aiButton(r) {
  return '<button class="ai-btn" onclick="App.openAi(\'' + r.id + '\')"><span class="ai-spark">✨</span><span class="ai-txt"><span class="mode-title">Créer un paquet avec l\'IA</span>'
    + '<span class="mode-desc">' + aiQuotaText() + '</span></span><span class="chev" style="color:#fff;">›</span></button>';
}

function partnerCard(r) {
  const p = PARTNERS[r.id] || PARTNERS._default;
  return '<div class="eyebrow" style="margin:22px 0 8px;">Pour aller plus loin</div>'
    + '<a class="partner-card" href="' + esc(p.url) + '" target="_blank" rel="noopener sponsored">'
    + '<span class="settings-ic">🎓</span><span class="settings-txt"><span class="mode-title">' + esc(p.title) + '</span>'
    + '<span class="mode-desc">' + esc(p.desc) + ' · lien partenaire (démo)</span></span><span class="chev">›</span></a>';
}

function renderAi() {
  const a = state.ai;
  const r = state.rubriques.find(x => x.id === a.rubriqueId);
  let html = '<button class="backbtn" onclick="App.leaveAi()">‹ ' + esc(r ? r.name : 'Retour') + '</button>';
  html += '<div class="eyebrow">Assistant IA</div>';

  if (a.phase === 'loading') {
    return html + '<h1 class="title">Un instant…</h1><div class="center" style="padding-top:40px;"><div class="spinner"></div>'
      + '<div class="subtitle" style="margin-top:20px;">L\'IA rédige tes cartes, tes phrases à trous et tes QCM…</div></div>';
  }

  if (a.phase === 'review') {
    const res = a.result;
    const nb = a.selected.length;
    html += '<h1 class="title">' + esc(res.title) + '</h1><div class="subtitle">' + res.cards.length + ' cartes proposées. Décoche celles que tu ne veux pas, puis ajoute-les.</div>';
    res.cards.forEach(function (c, i) {
      const on = a.selected.includes(i);
      html += '<div class="ai-item' + (on ? ' on' : '') + '" onclick="App.toggleAi(' + i + ')"><span class="ai-check">' + (on ? '✓' : '') + '</span><div style="min-width:0;">'
        + '<div class="rub-name">' + esc(c.front) + ' <span style="color:var(--ink-soft);font-weight:500;">→ ' + esc(c.back) + '</span></div>'
        + (c.cloze ? '<div class="rub-meta" style="font-style:italic;">' + esc(c.cloze.text) + '</div>' : '') + '</div></div>';
    });
    html += '<div class="row" style="margin-top:16px;"><button class="btn" onclick="App.addAi()"' + (nb ? '' : ' disabled style="opacity:.4;"') + '>Ajouter ' + nb + ' carte(s) en nouveau paquet</button></div>';
    return html;
  }

  const src = a.source || 'prompt';
  html += '<h1 class="title">Crée un paquet en un instant</h1>';
  html += '<div class="chip-row" style="margin:6px 0 14px;">'
    + '<button class="chip wide' + (src === 'prompt' ? ' sel' : '') + '" onclick="App.setAiSource(\'prompt\')">✨ Par consigne</button>'
    + '<button class="chip wide' + (src === 'text' ? ' sel' : '') + '" onclick="App.setAiSource(\'text\')">📝 À partir d\'un texte</button></div>';

  if (src === 'text') {
    html += '<div class="subtitle">Colle un extrait de cours : les définitions deviennent des cartes, avec une phrase à trous quand c\'est possible.</div>';
    html += '<textarea class="answer-input" style="max-width:none;text-align:left;min-height:170px;font-size:14px;" id="ai-text" placeholder="Matrice SWOT : analyse des forces, faiblesses, opportunités et menaces.&#10;Un livrable désigne un résultat concret remis au client.&#10;MECE - principe consistant à structurer sans chevauchement ni oubli.">' + esc(a.text || '') + '</textarea>';
    html += '<input class="answer-input" style="max-width:none;text-align:left;margin-top:10px;" id="ai-title" placeholder="Nom du paquet (facultatif)" value="' + esc(a.title || '') + '" autocomplete="off"/>';
    if (a.error) html += '<div class="result-banner ko" style="font-weight:600;">' + esc(a.error) + '</div>';
    html += '<div class="row" style="margin-top:14px;"><button class="btn" onclick="App.generateFromText()">Analyser le texte</button>'
      + '<label class="btn ghost file-btn">Importer un fichier .txt<input type="file" accept=".txt,.md,text/plain" style="display:none;" onchange="App.loadTextFile(this)"/></label></div>';
    html += '<div class="eyebrow" style="margin:20px 0 8px;">Bientôt</div><div class="settings-group">'
      + '<div class="settings-row" style="opacity:.55;"><span class="settings-ic">📄</span><span class="settings-txt"><span class="mode-title">Importer un PDF ou des slides</span><span class="mode-desc">Extraction du texte, puis génération (phase 2)</span></span></div>'
      + '<div class="settings-row" style="opacity:.55;"><span class="settings-ic">📷</span><span class="settings-txt"><span class="mode-title">Photo de notes manuscrites</span><span class="mode-desc">Lecture de l\'écriture par une IA vision (phase 2, Premium)</span></span></div></div>';
    html += '<div class="rub-meta" style="margin-top:14px;">Analyse simple, locale et gratuite : elle repère les définitions. Une vraie IA comprendrait le sens, résumerait et générerait aussi des QCM plus fins.</div>';
    return html;
  }

  html += '<div class="subtitle">L\'IA crée un paquet complet : cartes, QCM et phrases à trous en contexte.</div>';
  html += '<input class="answer-input" style="max-width:none;text-align:left;" id="ai-prompt" placeholder="ex : Vocabulaire du football en anglais" value="' + esc(a.prompt) + '" autocomplete="off"/>';
  if (a.error) html += '<div class="result-banner ko" style="font-weight:600;">' + esc(a.error) + '</div>';
  html += '<div class="eyebrow" style="margin:18px 0 8px;">Idées</div><div class="chip-row">'
    + AI_TOPICS.map(function (t, i) { return '<button class="chip wide" onclick="App.pickAiTopic(' + i + ')">' + t.label + '</button>'; }).join('') + '</div>';
  html += '<div class="rub-meta" style="margin-top:18px;">' + aiQuotaText() + (state.meta.premium ? '' : ' · <a href="#" onclick="App.openPaywall();return false;" style="color:var(--primary);">Passer Premium</a>') + '</div>';
  html += '<div class="row" style="margin-top:14px;"><button class="btn" onclick="App.generateAi()">✨ Générer</button></div>';
  html += '<div class="rub-meta" style="margin-top:16px;">Prototype : l\'IA est simulée sur quelques thèmes. La version finale appellerait un vrai modèle depuis un serveur sécurisé.</div>';
  return html;
}

function renderPaywall() {
  const prem = state.meta.premium;
  const row = (label, free, pro) => '<tr><td>' + label + '</td><td>' + free + '</td><td class="pro">' + pro + '</td></tr>';
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closePaywall()"><div class="modal">'
    + '<div class="eyebrow">💎 Boîte à Fiches Premium</div>'
    + '<div class="confirm-body">' + (prem ? 'Premium est actif sur cet appareil (démo).' : 'Avec Premium, plus aucune limite de générations IA. Gratuit : ' + FREE_AI_PER_DAY + ' par jour.') + '</div>'
    + '<table class="plan-table"><tr><th></th><th>Gratuit</th><th class="pro">Premium</th></tr>'
    + row('Cartes et révisions', 'illimitées', 'illimitées')
    + row('Générations IA', FREE_AI_PER_DAY + ' / jour', 'illimitées')
    + row('Duels et ligue', '✓', '✓')
    + row('Import de cours (PDF, photos)', '—', 'bientôt')
    + '</table>'
    + '<div class="rub-meta" style="margin-top:10px;">Exemple de tarif : 4,99 € / mois. Aucun paiement réel dans cette démo.</div>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closePaywall()">Fermer</button>'
    + '<button class="btn" onclick="App.' + (prem ? 'downgradePremium' : 'upgradePremium') + '()">' + (prem ? 'Revenir au gratuit' : 'Essayer Premium') + '</button></div>'
    + '</div></div>';
}

// ---------- MULTIJOUEUR (prototype : adversaires simulés) ----------
function avatar(name, big) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const size = big ? 'width:64px;height:64px;font-size:26px;border-radius:18px;' : '';
  return '<div class="badge" style="' + size + 'background:hsl(' + h + ',48%,42%);">' + esc(name.charAt(0).toUpperCase()) + '</div>';
}

function renderMulti() {
  ensureWeek();
  const lv = playerLevel();
  const m = state.multi;
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Accueil</button>';
  html += '<div class="eyebrow">Multijoueur</div><h1 class="title">Affronte tes amis</h1>';
  html += '<div class="subtitle">Duels de QCM en direct, points et ligue de la semaine.</div>';
  html += '<div class="stat-card tap" onclick="App.openProfile()"><div class="row">' + meAvatar()
    + '<div><div class="mode-title">' + esc(state.profile.pseudo) + ' · niveau ' + lv.level + '</div><div class="mode-desc">' + m.weekPoints + ' pts cette semaine · ' + m.wins + ' victoire(s) sur ' + m.played + ' duel(s)</div></div></div>'
    + '<div class="badge-row">' + badgeList().map(function (b) {
      return '<div class="badge-chip' + (b.earned ? ' on' : '') + '"><span>' + b.emoji + '</span><small>' + esc(b.label) + '</small></div>';
    }).join('') + '</div></div>';
  const curMode = DUEL_MODES.find(x => x.id === state.multiMode) || DUEL_MODES[0];
  html += '<div class="eyebrow" style="margin:6px 0 8px;">Format de partie</div><div class="chip-row" style="margin-bottom:12px;">'
    + DUEL_MODES.map(function (x) { return '<button class="chip wide' + (x.id === curMode.id ? ' sel' : '') + '" onclick="App.setMultiMode(\'' + x.id + '\')">' + x.emoji + ' ' + x.label + '</button>'; }).join('') + '</div>';
  html += '<button class="mode-card medley" style="width:100%;border:none;text-align:left;cursor:pointer;" onclick="App.quickMatch()">'
    + '<div><div class="mode-title">⚡ Partie rapide</div><div class="mode-desc">Adversaire au hasard · ' + esc(curMode.desc) + '</div></div><span class="chev">›</span></button>';
  html += '<div class="mode-card" style="cursor:pointer;" onclick="App.openFriends()"><div><div class="mode-title">👥 Mes amis</div><div class="mode-desc">'
    + (state.social.friends.length ? state.social.friends.length + ' ami(s) · cherche un pseudo pour en ajouter' : 'Cherche un pseudo pour ajouter un ami') + '</div></div><span class="chev">›</span></div>';
  html += '<div class="mode-card" style="cursor:pointer;" onclick="App.openLeague()"><div><div class="mode-title">🏆 Classement</div><div class="mode-desc">Ligue de la semaine · se termine dans ' + daysLeftInWeek() + ' j</div></div><span class="chev">›</span></div>';
  html += '<div class="rub-meta" style="margin-top:14px;">Prototype : les adversaires et le classement sont simulés. La version finale utiliserait de vrais comptes et un service temps réel.</div>';
  return html;
}

function renderDuel() {
  const d = state.duel;
  if (!d) return renderMulti();
  const back = '<button class="backbtn" onclick="App.openMulti()">‹ Quitter</button>';

  if (d.phase === 'nodeck') {
    return back + '<h1 class="title">Il manque des cartes</h1><div class="subtitle">Il faut un paquet d\'au moins 4 cartes pour lancer un duel.</div>';
  }
  const opp = d.opponent;
  if (d.phase === 'search') {
    return '<div class="center" style="padding-top:50px;"><div class="eyebrow">' + (d.kind === 'friend' ? 'Défi' : 'Partie rapide') + '</div>'
      + '<h1 class="title">' + (d.kind === 'friend' ? 'Invitation envoyée à ' + esc(opp.name) + '…' : 'Recherche d\'un adversaire…') + '</h1>'
      + '<div class="spinner" style="margin-top:26px;"></div><div class="subtitle" style="margin-top:20px;">Thème : ' + esc(d.deckName) + '</div>'
      + '<button class="link" onclick="App.openMulti()">Annuler</button></div>';
  }
  if (d.phase === 'found') {
    return '<div class="center" style="padding-top:50px;"><div class="eyebrow">' + (d.daily ? 'Défi du jour' : d.kind === 'friend' ? opp.name + ' a accepté' : 'Adversaire trouvé') + '</div>'
      + avatar(opp.name, true) + '<h1 class="title" style="margin-top:14px;">' + esc(opp.name) + '</h1>'
      + '<div class="subtitle">Niveau ' + opp.level + ' · en ligne · ' + esc((DUEL_MODES.find(x => x.id === d.mode) || DUEL_MODES[0]).label) + ' · thème : ' + esc(d.deckName) + '</div><div class="spinner"></div>'
      + '<div class="hint">Le duel commence…</div></div>';
  }
  if (d.phase === 'end') {
    const r = d.result;
    const title = r.outcome === 'win' ? 'Victoire 🎉' : r.outcome === 'loss' ? 'Défaite…' : 'Égalité';
    return '<div class="center" style="padding-top:30px;"><div class="eyebrow">Résultat</div><h1 class="title">' + title + '</h1>'
      + '<div class="duel-final"><div><div class="duel-name">' + esc(state.profile.pseudo) + '</div><div class="duel-score">' + d.me.score + '</div></div>'
      + '<div class="duel-vs">vs</div><div><div class="duel-name">' + esc(opp.name) + '</div><div class="duel-score">' + d.opp.score + '</div></div></div>'
      + '<div class="stat-card" style="width:100%;margin-top:18px;"><div class="mode-title" style="color:var(--primary);">+' + r.gained + ' points de ligue' + (r.dailyBonus ? ' (dont ' + r.dailyBonus + ' de bonus du défi 🎯)' : '') + '</div>'
      + '<div class="mode-desc">Tu es ' + r.rank + (r.rank === 1 ? 'er' : 'e') + ' du classement cette semaine' + (r.rank <= 5 ? ' · dans la zone des lots 🎁' : '') + '</div></div>'
      + '<div class="row" style="margin-top:18px;"><button class="btn" onclick="App.duelRematch()">Revanche</button>'
      + '<button class="btn ghost" onclick="App.openLeague()">Classement</button></div>'
      + '<button class="link" style="margin-top:18px;" onclick="App.openMulti()">Retour au multijoueur</button></div>';
  }

  // question / reveal
  const q = d.q;
  const qu = d.questions[d.index];
  const revealed = d.phase === 'reveal';
  const isMatch = qu.type === 'match';
  const opts = isMatch ? '' : qu.options.map(function (o, i) {
    let cls = 'opt';
    if (revealed) cls += i === qu.correct ? ' correct' : (i === q.meIdx ? ' wrong' : ' dim');
    else if (q.meIdx === i) cls += ' picked';
    return '<button class="' + cls + '" ' + (q.meAnswered || revealed ? '' : 'onclick="App.duelAnswer(' + i + ')"') + '>' + esc(o) + '</button>';
  }).join('');
  const status = revealed
    ? (q.meAnswered ? (q.meCorrect ? 'Bonne réponse ✓' : 'Raté ✗') : 'Temps écoulé') + ' · ' + opp.name + (q.oppAnswered ? (q.oppCorrect ? ' a eu juste' : ' s\'est trompé') : ' n\'a pas répondu')
    : (q.meAnswered ? 'En attente de ' + opp.name + '…' : (q.oppAnswered ? opp.name + ' a répondu ✓' : opp.name + ' réfléchit…'));
  return '<div class="duel-head"><div class="duel-side"><span class="duel-name">' + esc(state.profile.pseudo) + '</span><span class="duel-score" id="duel-score-me">' + d.me.score + '</span></div>'
    + '<div class="duel-mid">' + (d.index + 1) + ' / ' + d.questions.length + '<div class="duel-num" id="duel-timer-num">' + Math.ceil(Math.max(q.timeLeft, 0)) + '</div></div>'
    + '<div class="duel-side"><span class="duel-name">' + esc(opp.name) + '</span><span class="duel-score" id="duel-score-opp">' + d.opp.score + '</span></div></div>'
    + '<div class="goal-bar"><div class="goal-fill" id="duel-timer-fill" style="transition:none;width:' + Math.max(0, q.timeLeft / q.time * 100) + '%;"></div></div>'
    + '<div class="center"><div class="eyebrow" style="margin-top:20px;">' + esc(qu.label) + '</div>'
    + (qu.front ? '<div class="qtext" style="margin-top:8px;">' + esc(qu.front) + '</div>' : '')
    + (qu.sub ? '<div class="duel-sub">' + esc(qu.sub) + '</div>' : '')
    + (isMatch ? duelMatchHtml(d, qu, revealed) : '<div class="opt-grid">' + opts + '</div>')
    + '<div class="hint" id="duel-opp-status" style="margin-top:16px;">' + esc(status) + '</div></div>';
}

function renderLeague() {
  const scope = state.leagueScope || 'general';
  const rows = leagueTable(scope);
  let html = '<button class="backbtn" onclick="App.openMulti()">‹ Multijoueur</button>';
  html += '<div class="eyebrow">Ligue de la semaine</div><h1 class="title">Classement</h1>';
  html += '<div class="subtitle">Se termine dans ' + daysLeftInWeek() + ' jour(s). Victoire : +' + POINTS.win + ' pts, égalité : +' + POINTS.draw + ', défaite : +' + POINTS.loss + '.</div>';
  html += '<div class="chip-row" style="margin-bottom:12px;">' + [['general', '🌍 Général'], ['promo', '🎓 Promo'], ['amis', '👥 Amis']].map(function (x) {
    return '<button class="chip wide' + (scope === x[0] ? ' sel' : '') + '" onclick="App.setLeagueScope(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>';
  if (scope !== 'amis') html += '<div class="prize-card"><span class="settings-ic">🎁</span><div><div class="mode-title">Lot du mois · partenaire</div>'
    + '<div class="mode-desc">Les 5 premiers participent au tirage au sort : 2 places de concert (exemple de lot).</div></div></div>';
  if (scope === 'amis' && state.social.friends.length === 0) html += '<div class="rub-meta" style="margin-bottom:10px;">Ajoute des amis pour comparer vos points chaque semaine.</div>';
  html += '<div class="settings-group">';
  rows.forEach(function (r, i) {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    html += '<div class="league-row' + (r.me ? ' me' : '') + (scope !== 'amis' && i === 5 ? ' cut' : '') + '"><span class="rank">' + medal + '</span>'
      + '<span class="league-name">' + esc(r.name) + (scope !== 'amis' && i < 5 ? ' <span title="Zone des lots">🎁</span>' : '') + '</span><span class="league-pts">' + r.points + ' pts</span></div>';
  });
  html += '</div><div class="rub-meta">Classement de démonstration : les autres joueurs sont fictifs.</div>';
  return html;
}

// ---------- AMIS (prototype : annuaire fictif) ----------
function friendRow(p) {
  const isFriend = state.social.friends.includes(p.name);
  const pending = !!state.social.pending[p.name];
  let action;
  if (isFriend) action = p.online ? '<button class="btn" onclick="App.challengeFriend(\'' + esc(p.name) + '\')">Défier</button>' : '<span class="rub-meta" style="margin:0;">Hors ligne</span>';
  else if (pending) action = '<span class="rub-meta" style="margin:0;">Demande envoyée…</span>';
  else action = '<button class="btn ghost" onclick="App.addFriend(\'' + esc(p.name) + '\')">Ajouter</button>';
  return '<div class="friend-row">' + avatar(p.name) + '<div style="flex:1;min-width:0;"><div class="rub-name">' + esc(p.name) + '</div>'
    + '<div class="rub-meta"><span class="online-dot' + (p.online ? ' on' : '') + '"></span>' + (p.online ? 'en ligne' : 'hors ligne') + ' · niveau ' + p.level + (isFriend ? ' · ami' : '') + '</div></div>' + action + '</div>';
}

// Liste affichée sous la barre de recherche (exportée : app.js la met à jour en direct).
export function friendResultsHtml(query) {
  const q = (query || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (q) {
    const found = DEMO_PEOPLE.filter(p => plain(p.name).includes(q));
    return found.length ? found.map(friendRow).join('') : '<div class="rub-meta">Aucun joueur trouvé pour « ' + esc(query) + ' ».</div>';
  }
  const friends = DEMO_PEOPLE.filter(p => state.social.friends.includes(p.name));
  const others = DEMO_PEOPLE.filter(p => !state.social.friends.includes(p.name)).slice(0, 4);
  return '<div class="eyebrow" style="margin:6px 0 8px;">Mes amis (' + friends.length + ')</div>'
    + (friends.length ? friends.map(friendRow).join('') : '<div class="rub-meta" style="margin-bottom:10px;">Pas encore d\'ami : cherche un pseudo ci-dessus.</div>')
    + '<div class="eyebrow" style="margin:18px 0 8px;">Suggestions</div>' + others.map(friendRow).join('');
}

function renderFriends() {
  let html = '<button class="backbtn" onclick="App.openMulti()">‹ Multijoueur</button>';
  html += '<div class="eyebrow">Multijoueur</div><h1 class="title">Mes amis</h1>';
  html += '<input class="answer-input" style="max-width:none;text-align:left;margin-bottom:12px;" id="friend-search" placeholder="Rechercher un pseudo (ex : Martin)" oninput="App.searchFriends(this.value)" autocomplete="off" autocapitalize="off" value="' + esc(state.friendQuery || '') + '"/>';
  html += '<div id="friend-results">' + friendResultsHtml(state.friendQuery) + '</div>';
  html += '<div class="row" style="margin-top:16px;"><button class="btn ghost" onclick="App.shareApp()">📨 Inviter un camarade</button></div>';
  html += '<div class="rub-meta" style="margin-top:14px;">Prototype : annuaire fictif, les demandes sont acceptées automatiquement.</div>';
  return html;
}

// ---------- PRÉSENTATION DU PROJET (modèle économique, rétention, feuille de route) ----------
function pitchSection(num, title, body) {
  return '<div class="pitch-sec"><div class="eyebrow">' + num + ' · ' + title + '</div>' + body + '</div>';
}
function pitchList(items) {
  return '<ul class="pitch-list">' + items.map(i => '<li>' + i + '</li>').join('') + '</ul>';
}

function renderPitch() {
  let html = '<button class="backbtn" onclick="App.openSettings()">‹ Réglages</button>';
  html += '<div class="eyebrow">Boîte à Fiches</div><h1 class="title">Présentation du projet</h1>';
  html += '<div class="subtitle">Une application de révision par petites sessions, pour le téléphone. Prototype, avec de vrais utilisateurs en test.</div>';

  html += pitchSection('1', 'Le besoin', pitchList([
    'Réviser <b>régulièrement</b> est difficile : fiches papier, applis de langues, cours dispersés.',
    'Un besoin réel, vécu : réviser mes cours de dernière année et apprendre l\'italien.',
    'Les temps morts (bus, train) sont inutilisés : sessions de quelques minutes.'
  ]));

  html += pitchSection('2', 'La solution', pitchList([
    'Un <b>moteur de révision unique</b> pour deux usages : cours et langues.',
    '5 modes (flashcard, QCM, texte à trous, appariement, Medley) et un seul score de maîtrise par carte.',
    'Rappels espacés (méthode Leitner) : l\'appli te dit quoi réviser aujourd\'hui.',
    '<b>Contenu créé en une phrase par l\'IA</b>, relu par l\'utilisateur avant ajout.'
  ]));

  html += pitchSection('3', 'Modèle économique : freemium',
    '<table class="plan-table"><tr><th></th><th>Gratuit</th><th class="pro">Premium</th></tr>'
    + '<tr><td>Cartes et révisions</td><td>illimitées</td><td class="pro">illimitées</td></tr>'
    + '<tr><td>Générations IA</td><td>' + FREE_AI_PER_DAY + ' / jour</td><td class="pro">illimitées</td></tr>'
    + '<tr><td>Duels et ligue</td><td>✓</td><td class="pro">✓</td></tr>'
    + '<tr><td>Import de cours (PDF, photos)</td><td>—</td><td class="pro">bientôt</td></tr></table>'
    + pitchList([
      'Le quota porte sur l\'<b>IA</b>, pas sur les cartes : chaque génération a un coût réel (de l\'ordre du centime, à vérifier), le prix suit le coût.',
      'Créer ses propres cartes reste illimité : c\'est le cœur de la valeur, il ne faut pas le frustrer.',
      'Tarif d\'exemple : 4,99 € / mois (à tester auprès des utilisateurs).'
    ]));

  html += pitchSection('4', 'Autres sources de revenus', pitchList([
    '<b>Affiliation</b> : liens vers des cours en ligne pertinents, selon la rubrique de l\'utilisateur.',
    '<b>Lots sponsorisés</b> : un partenaire finance des lots (places de concert, chèques cadeaux) pour la ligue hebdomadaire.',
    '<b>Offre établissements</b> (piste) : licence pour une promo ou une association, avec classement interne.'
  ]));

  html += pitchSection('5', 'Rétention : les « nudges »', pitchList([
    '<b>Série de jours</b> et objectif quotidien avec barre de progression.',
    '<b>Preuve sociale</b> : amis, duels et ligue hebdomadaire.',
    '<b>Récompenses</b> : points, niveaux, badges, « le saviez-vous ? » quotidien.',
    '<b>Par défaut utile</b> : la répétition espacée décide des cartes du jour à ta place.',
    'À venir : rappel à l\'heure habituelle de révision.',
    'Garde-fou : encourager sans culpabiliser, jamais de fausse urgence.'
  ]));

  html += pitchSection('6', 'Indicateurs à suivre (à valider en test)', pitchList([
    'Retour des utilisateurs à J1, J7 et J30.',
    'Utilisateurs actifs par semaine, cartes révisées par utilisateur.',
    'Conversion gratuit vers Premium.',
    'Coût IA par utilisateur actif, à comparer au revenu par utilisateur.'
  ]));

  html += pitchSection('7', 'Risques et limites', pitchList([
    '<b>Coût de l\'IA</b> : plafond mensuel, quota par utilisateur, limite de débit.',
    '<b>Démarrage à froid</b> du multijoueur : peu de joueurs connectés au début, donc duels différés et adversaire simulé.',
    '<b>Données personnelles (RGPD)</b> : comptes, e-mails, suppression à la demande.',
    '<b>Jeux-concours</b> : cadre légal français strict, sponsor et règlement nécessaires.',
    '<b>Qualité de l\'IA</b> : erreurs possibles, d\'où la relecture avant ajout.'
  ]));

  html += pitchSection('8', 'Feuille de route',
    '<div class="roadmap"><div class="road on"><b>Aujourd\'hui</b><span>Prototype : 5 modes de révision, séries, IA et multijoueur simulés, appli installable et hors-ligne</span></div>'
    + '<div class="road"><b>Phase 2</b><span>Vrais comptes et amis, vraie IA via un serveur sécurisé, duels en temps réel, synchronisation entre appareils</span></div>'
    + '<div class="road"><b>Phase 3</b><span>Import de cours (PDF, photos de notes), notifications de rappel, paiements, partenariats</span></div></div>');

  html += '<div class="rub-meta" style="margin-top:6px;">Les fonctions IA, multijoueur, Premium et partenaires sont des maquettes fonctionnelles pour illustrer le modèle.</div>';
  return html;
}

// ---------- AVATAR DU JOUEUR, PROFIL, RAPPEL ----------
function meAvatar(big) {
  const size = big ? 'width:64px;height:64px;font-size:30px;border-radius:18px;' : 'font-size:20px;';
  return '<div class="badge" style="' + size + 'background:var(--bg);">' + esc(state.profile.avatar) + '</div>';
}

function renderProfileModal() {
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeProfile()"><div class="modal">'
    + '<div class="eyebrow">Mon profil</div>'
    + '<div class="rub-meta" style="margin-top:8px;">Ton pseudo et ton avatar sont visibles dans les duels et le classement.</div>'
    + '<label>Pseudo (2 à 16 caractères)</label><input id="profile-pseudo" maxlength="16" value="' + esc(state.profile.pseudo) + '" autocomplete="off"/>'
    + '<label>Avatar (un emoji)</label><input id="profile-avatar" maxlength="8" value="' + esc(state.profile.avatar) + '" placeholder="🙂"/>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeProfile()">Annuler</button><button class="btn" onclick="App.saveProfile()">Enregistrer</button></div>'
    + '</div></div>';
}

function renderReminderBanner() {
  if (!reminderDue()) return '';
  const left = Math.max(state.stats.goal - reviewedToday(), 0);
  return '<div class="reminder-banner"><span class="reminder-ic">⏰</span><div style="flex:1;"><div class="mode-title">C\'est l\'heure de ta révision</div>'
    + '<div class="mode-desc">Il te reste ' + left + ' carte(s) pour atteindre ton objectif du jour.</div></div>'
    + '<button class="btn" onclick="App.startFlash(null,null,\'all-due\')">Réviser</button></div>';
}

// ---------- STATISTIQUES ----------
function renderStats() {
  const w = weekSummary();
  const m = masteryBreakdown();
  const lv = playerLevel();
  const goal = state.stats.goal;
  const maxBar = Math.max(goal, ...w.days.map(d => d.count), 1);
  const totalCards = state.cards.length || 1;
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Accueil</button>';
  html += '<div class="eyebrow">Progression</div><h1 class="title">Mes statistiques</h1>';
  html += '<div class="subtitle">Niveau ' + lv.level + ' · ' + totalReviews() + ' cartes révisées au total.</div>';

  html += '<div class="stat-card"><div class="mode-title">Cette semaine</div><div class="mode-desc">' + w.total + ' cartes · ' + w.activeDays + ' jour(s) actif(s) sur 7 · moyenne ' + w.average + ' par jour</div>'
    + '<div class="bar-chart">' + w.days.map(function (d) {
      const h = Math.round(d.count / maxBar * 100);
      return '<div class="bar-col"><span class="bar-val">' + (d.count || '') + '</span><div class="bar-track"><div class="bar' + (d.count >= goal ? ' hit' : '') + '" style="height:' + h + '%;"></div></div><span class="bar-lbl' + (d.isToday ? ' today' : '') + '">' + d.letter + '</span></div>';
    }).join('') + '</div><div class="rub-meta" style="margin-top:8px;">Barre verte : objectif de ' + goal + ' cartes atteint.</div></div>';

  html += '<div class="stat-card"><div class="mode-title">Séries</div><div class="stats-grid">'
    + '<div><div class="stat-num">' + currentStreak() + '</div><div class="rub-meta">en cours</div></div>'
    + '<div><div class="stat-num">' + longestStreak() + '</div><div class="rub-meta">record</div></div>'
    + '<div><div class="stat-num">' + (w.best.count || 0) + '</div><div class="rub-meta">meilleur jour</div></div></div></div>';

  const seg = (n, cls, label) => '<div class="seg-row"><span class="seg-lbl">' + label + '</span><div class="seg-track"><div class="seg ' + cls + '" style="width:' + Math.round(n / totalCards * 100) + '%;"></div></div><span class="seg-n">' + n + '</span></div>';
  html += '<div class="stat-card"><div class="mode-title">Maîtrise de tes ' + state.cards.length + ' cartes</div>'
    + seg(m.fresh, 'fresh', 'À apprendre') + seg(m.learning, 'learning', 'En progrès') + seg(m.known, 'known', 'Maîtrisées') + '</div>';

  const mp = state.multi;
  html += '<div class="stat-card"><div class="mode-title">Multijoueur</div><div class="stats-grid">'
    + '<div><div class="stat-num">' + mp.played + '</div><div class="rub-meta">duels</div></div>'
    + '<div><div class="stat-num">' + mp.wins + '</div><div class="rub-meta">victoires</div></div>'
    + '<div><div class="stat-num">' + (mp.played ? Math.round(mp.wins / mp.played * 100) + ' %' : '—') + '</div><div class="rub-meta">réussite</div></div></div></div>';
  return html;
}

// ---------- DÉCOUVRIR (articles) ----------
function renderDiscover() {
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Accueil</button>';
  html += '<div class="eyebrow">Découvrir</div><h1 class="title">Mieux apprendre</h1>';
  html += '<div class="subtitle">Quelques idées de la science de l\'apprentissage, derrière les fonctions de l\'appli. Contenu d\'exemple : à terme, une vraie lettre d\'information éditée.</div>';
  ARTICLES.forEach(function (a, i) {
    const open = state.openArticle === i;
    html += '<div class="article' + (open ? ' open' : '') + '" onclick="App.toggleArticle(' + i + ')"><div class="row between"><div class="row" style="min-width:0;"><span class="settings-ic">' + a.emoji + '</span>'
      + '<div style="min-width:0;"><div class="mode-title">' + esc(a.title) + '</div><div class="mode-desc">' + esc(a.summary) + '</div></div></div>'
      + '<span class="chev">' + (open ? '⌃' : '⌄') + '</span></div>'
      + (open ? '<div class="article-body">' + esc(a.body) + '<div class="rub-meta" style="margin-top:8px;">Lecture : ' + a.time + '</div></div>' : '') + '</div>';
  });
  return html;
}

// Colonnes de la manche d'appariement d'un duel.
function duelMatchHtml(d, qu, revealed) {
  const m = d.q.match;
  const col = function (side, order, key) {
    return '<div class="match-col">' + order.map(function (pairIdx, i) {
      let cls = 'match-item';
      if (m.done[pairIdx]) cls += ' matched';
      else if ((side === 'L' ? m.selL : m.selR) === i) cls += ' sel';
      if (m.wrong && (side === 'L' ? m.wrong.l : m.wrong.r) === i) cls += ' wrongflash';
      const locked = m.done[pairIdx] || revealed || d.q.meAnswered;
      return '<div class="' + cls + '" ' + (locked ? '' : 'onclick="App.duelPickMatch(\'' + side + '\',' + i + ')"') + '>' + esc(qu.pairs[pairIdx][key]) + '</div>';
    }).join('') + '</div>';
  };
  return '<div class="match-wrap" style="margin-top:6px;">' + col('L', m.left, 'front') + col('R', m.right, 'back') + '</div>'
    + '<div class="rub-meta" style="margin-top:10px;">' + m.count + ' / ' + qu.pairs.length + ' paires reliées</div>';
}

// Récap affiché à la fin d'une session : objectif du jour et série, pour encourager à continuer.
function sessionRecap() {
  const done = reviewedToday();
  const goal = state.stats.goal;
  const pct = Math.min(100, Math.round(done / goal * 100));
  const confetti = done >= goal ? '<div class="confetti">' + '<i></i>'.repeat(16) + '</div>' : '';
  return confetti + '<div class="stat-card" style="width:100%;text-align:left;"><div class="mode-title">'
    + (done >= goal ? '🎉 Objectif du jour atteint' : done + ' / ' + goal + ' cartes aujourd\'hui') + '</div>'
    + '<div class="mode-desc">🔥 ' + currentStreak() + ' jour(s) d\'affilée</div>'
    + '<div class="goal-bar"><div class="goal-fill' + (done >= goal ? ' full' : '') + '" style="width:' + pct + '%;"></div></div></div>';
}

// ---------- ACCUEIL DE LA PREMIÈRE OUVERTURE ----------
function renderWelcome() {
  const named = state.profile.pseudo !== 'Toi' ? state.profile.pseudo : '';
  return '<div class="modal-backdrop"><div class="modal">'
    + '<div class="eyebrow">Bienvenue 👋</div>'
    + '<div class="confirm-body">Boîte à Fiches t\'aide à réviser par petites sessions, avec des rappels espacés. Deux petits réglages pour commencer :</div>'
    + '<label>Ton pseudo</label><input id="welcome-pseudo" maxlength="16" placeholder="ex : Raph" value="' + esc(named) + '" autocomplete="off"/>'
    + '<label>Objectif quotidien (cartes par jour)</label><div class="row">'
    + GOAL_CHOICES.map(function (n) { return '<button class="chip' + (state.stats.goal === n ? ' sel' : '') + '" id="wg-' + n + '" onclick="App.pickWelcomeGoal(' + n + ')">' + n + '</button>'; }).join('')
    + '</div><div class="modal-actions"><button class="btn ghost" onclick="App.skipWelcome()">Plus tard</button><button class="btn" onclick="App.finishWelcome()">C\'est parti</button></div>'
    + '</div></div>';
}

// ---------- AVIS ----------
function renderFeedbackModal() {
  const faces = ['😞', '😐', '🙂', '😍'];
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeFeedback()"><div class="modal">'
    + '<div class="eyebrow">Donner mon avis</div>'
    + '<div class="rub-meta" style="margin-top:8px;">Ton retour aide à améliorer l\'appli. Il sera préparé dans ton menu de partage : tu choisis où l\'envoyer.</div>'
    + '<label>Ton ressenti</label><div class="row">'
    + faces.map(function (f, i) { return '<button class="chip' + (state.feedbackRating === i + 1 ? ' sel' : '') + '" id="fb-' + (i + 1) + '" onclick="App.pickFeedback(' + (i + 1) + ')" style="font-size:20px;">' + f + '</button>'; }).join('')
    + '</div><label>Un commentaire (facultatif)</label><textarea id="fb-text" placeholder="Ce que j\'aime, ce qui manque, ce qui bug…"></textarea>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeFeedback()">Annuler</button><button class="btn" onclick="App.sendFeedback()">Envoyer</button></div>'
    + '</div></div>';
}

// Maîtrise d'un paquet en % : moyenne des cases de Leitner (0 à 5) de ses cartes.
function deckMastery(deckId) {
  const cards = cardsOf(deckId);
  if (cards.length === 0) return 0;
  return Math.round(cards.reduce((a, c) => a + Math.min(c.box, 5), 0) / (cards.length * 5) * 100);
}

// ---------- RECHERCHE DE CARTES ----------
// Liste des cartes dont le recto ou le verso contient le texte cherché (exportée : app.js la met à jour en direct).
export function searchResultsHtml(query) {
  const plain = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = plain((query || '').trim());
  if (q.length < 2) return '<div class="rub-meta">Tape au moins 2 lettres. ' + state.cards.length + ' cartes dans l\'appli.</div>';
  const found = state.cards.filter(c => plain(c.front).includes(q) || plain(c.back).includes(q));
  if (found.length === 0) return '<div class="rub-meta">Aucune carte trouvée pour « ' + esc(query) + ' ».</div>';
  return '<div class="rub-meta" style="margin-bottom:8px;">' + found.length + ' résultat(s)' + (found.length > 30 ? ' (30 premiers affichés)' : '') + '</div>'
    + found.slice(0, 30).map(function (c) {
      const d = state.decks.find(x => x.id === c.deckId);
      return '<div class="list-item tap" onclick="App.openDeckCards(\'' + c.deckId + '\')"><div class="rub-name">' + esc(c.front) + '</div>'
        + '<div class="rub-meta">' + esc(c.back) + '</div><div class="rub-meta" style="color:var(--primary);">' + esc(d ? d.name : '') + '</div></div>';
    }).join('');
}

function renderSearch() {
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Accueil</button>';
  html += '<div class="eyebrow">Recherche</div><h1 class="title">Retrouver une carte</h1>';
  html += '<input class="answer-input" style="max-width:none;text-align:left;margin:8px 0 14px;" id="search-q" placeholder="Un mot du recto ou du verso…" oninput="App.runSearch(this.value)" autocomplete="off" autocapitalize="off"/>';
  html += '<div id="search-results">' + searchResultsHtml('') + '</div>';
  return html;
}
