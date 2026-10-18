// Ce fichier ne fait qu'une chose : à partir de l'état actuel (state), produire
// le HTML à afficher. Aucune de ces fonctions ne modifie les données — c'est
// app.js qui s'en charge, puis qui rappelle render() pour rafraîchir l'écran.

import {
  state, MODES, SPEAK_LANGS, TRASH_DAYS, esc, colorVar, decksOf, cardsOf, dueCards, dueInRubrique,
  scopedCards, scopedDue, selectedIds, childDecks, treeNodes, treeCards, dueTree, allDecksOf, deckPath, descendantIds, rootDeckId, allDueCards, seedData, GOAL_CHOICES, INTERESTS, STUDY_LEVELS, STUDY_FIELDS, courseChoices, studySummary, hasStudyProfile, examDaysLeft, reviewedToday, currentStreak, normalize,
  aiLeft, FREE_AI_PER_DAY, badgeList, playerLevel, ensureWeek, daysLeftInWeek,
  weekSummary, masteryBreakdown, reminderDue, totalReviews, longestStreak, APP_VERSION
} from './state.js';
import { AI_TOPICS, FACTS, DEMO_PEOPLE, ARTICLES, MOOC_PROVIDERS, MOOC_TOPICS, MOOC_LANGS, MOOC_LANG_NAMES } from './demo.js';
import { todayStr } from './state.js';
import { leagueTable, POINTS, DUEL_MODES, eligibleDecks } from './duel.js';

// Accord simple : pl(2, 'carte') donne « 2 cartes », pl(1, 'carte') donne « 1 carte ».
function pl(n, one, many) {
  return n + ' ' + (n > 1 ? (many || one + 's') : one);
}

// Écrans « immersifs » : pas de barre d'onglets pendant une session de révision ou un duel.
const IMMERSIVE_VIEWS = ['session', 'duel'];
// Onglet actif selon l'écran affiché (la navigation à l'intérieur d'un onglet ne change pas d'onglet).
const TAB_OF_VIEW = {
  home: 'learn', rubrique: 'learn', modes: 'learn', cards: 'learn', search: 'learn',
  multi: 'play', league: 'play', friends: 'play',
  create: 'create', ai: 'create',
  stats: 'progress',
  settings: 'profile', trash: 'profile', pitch: 'profile'
};

export function render() {
  const app = document.getElementById('app');
  if (state.onboard) {
    app.innerHTML = renderOnboarding();
    if (state.confirmDialog) app.insertAdjacentHTML('beforeend', renderConfirmDialog());
    return;
  }
  const screens = {
    home: renderHome, rubrique: renderRubrique, modes: renderModes, cards: renderCards, search: renderSearch,
    multi: renderMulti, league: renderLeague, friends: renderFriends, duel: renderDuel,
    create: renderCreate, ai: renderAi, stats: renderStats,
    settings: renderSettings, trash: renderTrash, pitch: renderPitch, session: renderSession
  };
  app.innerHTML = (screens[state.view] || renderHome)();
  if (!IMMERSIVE_VIEWS.includes(state.view)) app.insertAdjacentHTML('beforeend', renderTabBar());
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
  if (state.updateReady) app.insertAdjacentHTML('beforeend', '<div class="update-bar" onclick="location.reload()">✨ Nouvelle version disponible · toucher pour recharger</div>');
  // Toujours en dernier : la confirmation doit passer au-dessus de toute autre fenêtre.
  if (state.confirmDialog) app.insertAdjacentHTML('beforeend', renderConfirmDialog());
}

// ---------- BARRE D'ONGLETS (en bas, comme sur Instagram ou TikTok) ----------
// Icônes tracées au trait (style de la bibliothèque Feather, licence MIT).
function tabIcon(inner) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
}
const TAB_ICONS = {
  learn: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  play: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  create: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  progress: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  profile: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
};
function renderTabBar() {
  const cur = TAB_OF_VIEW[state.view] || 'learn';
  const labels = { learn: 'Réviser', play: 'Jouer', create: 'Créer', progress: 'Progrès', profile: 'Profil' };
  return '<nav class="tabbar" aria-label="Navigation principale">' + ['learn', 'play', 'create', 'progress', 'profile'].map(function (t) {
    const on = cur === t;
    if (t === 'create') {
      return '<button class="tab tab-create' + (on ? ' on' : '') + '" onclick="App.goTab(\'create\')" aria-label="Créer"><span class="create-pill">' + tabIcon(TAB_ICONS.create) + '</span></button>';
    }
    return '<button class="tab' + (on ? ' on' : '') + '" onclick="App.goTab(\'' + t + '\')"' + (on ? ' aria-current="page"' : '') + '>' + tabIcon(TAB_ICONS[t]) + '<span>' + labels[t] + '</span></button>';
  }).join('') + '</nav>';
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

const SEARCH_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

// ---------- RÉGLAGES ----------
function settingsRow(icon, title, desc, onclick) {
  return '<button class="settings-row" onclick="' + onclick + '"><span class="settings-ic">' + icon + '</span>'
    + '<span class="settings-txt"><span class="mode-title">' + title + '</span><span class="mode-desc">' + desc + '</span></span>'
    + '<span class="chev">›</span></button>';
}
// Liste déroulante à cocher : un en-tête (titre + résumé) qui s'ouvre sur des lignes avec case.
// items = [{ id, label, count, depth, state: 'on' | 'part' | 'off' }] ; call(item) = code JS exécuté au clic.
function dropdown(key, title, summary, items, call, allCall) {
  const open = state.dropOpen === key;
  let h = '<div class="dd' + (open ? ' open' : '') + '"><button class="dd-head" onclick="App.toggleDrop(\'' + key + '\')">'
    + '<span class="dd-text"><span class="dd-title">' + title + '</span><span class="dd-val">' + summary + '</span></span>'
    + '<span class="dd-chev">' + (open ? '⌃' : '⌄') + '</span></button>';
  if (open) {
    h += '<div class="dd-panel">';
    if (allCall) h += '<button class="dd-row dd-all" onclick="' + allCall + '"><span class="dd-box on">✓</span><span class="dd-label">Tout cocher</span></button>';
    h += items.map(function (it) {
      return '<button class="dd-row" style="padding-left:' + (14 + (it.depth || 0) * 18) + 'px;" onclick="' + call(it) + '">'
        + '<span class="dd-box ' + it.state + '">' + (it.state === 'on' ? '✓' : it.state === 'part' ? '–' : '') + '</span>'
        + '<span class="dd-label">' + esc(it.label) + '</span>' + (it.count !== undefined ? '<span class="dd-count">' + it.count + '</span>' : '') + '</button>';
    }).join('');
    h += '</div>';
  }
  return h + '</div>';
}

// Une seule suggestion à la fois, la plus utile pour le parcours de la personne.
function nextStepHtml() {
  const days = examDaysLeft();
  const due = allDueCards().length;
  let n = null;
  if (days !== null && days <= 30) {
    n = { t: 'Examen ' + (days === 0 ? 'aujourd\'hui' : 'dans ' + pl(days, 'jour')),
      d: due > 0 ? pl(due, 'carte') + ' à revoir : une session par jour suffit pour arriver prêt.' : 'Rien à revoir pour l\'instant. Ajoute des cartes pour t\'entraîner avant le jour J.',
      go: due > 0 ? 'App.startFlash(null,null,\'all-due\')' : 'App.goTab(\'create\')', l: due > 0 ? 'Réviser' : 'Créer' };
  }
  if (!n) {
    const empty = (state.profile.courses || []).map(function (c) {
      return state.decks.find(d => !d.parentId && normalize(d.name) === normalize(c) && treeCards(d.id).length === 0);
    }).filter(Boolean)[0];
    if (empty) n = { t: '« ' + empty.name + ' » est encore vide', d: 'Colle ton cours ou ajoute quelques cartes pour commencer à réviser.', go: 'App.openDeck(\'' + empty.id + '\')', l: 'Remplir' };
  }
  if (!n && !hasStudyProfile()) n = { t: 'Complète ton parcours', d: 'Niveau, matières, examens : pour des recommandations adaptées à tes études.', go: 'App.editStudy()', l: 'Compléter' };
  if (!n) return '';
  return '<div class="slim-card tap next-step" onclick="' + n.go + '"><div style="flex:1;min-width:0;"><div class="next-kicker">Prochaine étape</div><div class="mode-title">' + esc(n.t) + '</div>'
    + '<div class="mode-desc">' + esc(n.d) + '</div></div><span class="next-go">' + n.l + ' ›</span></div>';
}

function studyCardHtml() {
  const days = examDaysLeft();
  if (!hasStudyProfile()) {
    return '<div class="card tap" onclick="App.editStudy()"><div class="row between"><div><div class="mode-title">Renseigne tes études</div>'
      + '<div class="mode-desc">Niveau, diplôme, matières : pour des recommandations adaptées.</div></div><span class="stat-more" style="margin:0;">Compléter ›</span></div></div>';
  }
  const courses = state.profile.courses || [];
  return '<div class="card tap" onclick="App.editStudy()"><div class="row between" style="align-items:flex-start;"><div style="min-width:0;">'
    + '<div class="mode-title">' + esc(studySummary() || 'Mon parcours') + '</div>'
    + (days !== null ? '<div class="mode-desc">Examen ' + (days === 0 ? 'aujourd\'hui' : 'dans ' + pl(days, 'jour')) + '</div>' : '')
    + (courses.length ? '<div class="tag-row">' + courses.slice(0, 8).map(c => '<span class="mini-tag">' + esc(c) + '</span>').join('') + (courses.length > 8 ? '<span class="mini-tag">+' + (courses.length - 8) + '</span>' : '') + '</div>' : '')
    + '</div><span class="stat-more" style="margin:0;">Modifier ›</span></div></div>';
}

function renderSettings() {
  const lv = playerLevel();
  const rem = state.meta.reminder;
  let html = '<div class="eyebrow">Mon compte</div><h1 class="title">Profil</h1>';
  html += '<div class="profile-head tap" onclick="App.openProfile()">' + meAvatar(true)
    + '<div style="flex:1;min-width:0;"><div class="profile-name">' + esc(state.profile.pseudo) + '</div><div class="rub-meta">' + (state.profile.email ? esc(state.profile.email) + ' · ' : '') + 'Niveau ' + lv.level + ' · ' + totalReviews() + ' cartes révisées</div></div>'
    + '<span class="stat-more" style="margin:0;">Modifier ›</span></div>';

  html += '<div class="section-label">Mon parcours</div>' + studyCardHtml();
  html += '<div class="section-label">Objectif et rappel</div>'
    + '<div class="card"><div class="mode-title">Objectif quotidien</div><div class="mode-desc" style="margin-bottom:10px;">Nombre de cartes à réviser chaque jour</div><div class="row">'
    + GOAL_CHOICES.map(function (n) { return '<button class="chip' + (state.stats.goal === n ? ' sel' : '') + '" onclick="App.setGoal(' + n + ')">' + n + '</button>'; }).join('')
    + '</div></div>'
    + '<div class="card"><div class="row between"><div><div class="mode-title">Rappel quotidien</div><div class="mode-desc">Une bannière à l\'heure choisie</div></div>'
    + '<button class="chip' + (rem.on ? ' sel' : '') + '" onclick="App.toggleReminder()">' + (rem.on ? 'Activé' : 'Désactivé') + '</button></div>'
    + '<div class="row" style="margin-top:12px;"><span class="rub-meta" style="margin:0;">Heure</span><input type="time" class="time-input" id="reminder-time" value="' + esc(rem.time) + '" onchange="App.setReminderTime(this.value)"/></div></div>'
    + '<div class="settings-group">' + settingsRow('📳', 'Vibrations au toucher', (state.meta.haptics ? 'Activées' : 'Désactivées') + ' · Android', 'App.toggleHaptics()') + '</div>';

  html += '<div class="section-label">Abonnement</div><div class="settings-group">'
    + settingsRow('💎', 'Premium', state.meta.premium ? 'Actif (démo) · IA illimitée' : FREE_AI_PER_DAY + ' générations IA gratuites par jour', 'App.openPaywall()')
    + '</div>';

  html += '<div class="section-label">Mes données</div><div class="settings-group">'
    + settingsRow('💾', 'Exporter mes fiches', 'Un fichier de sauvegarde', 'App.exportData()')
    + settingsRow('📥', 'Importer une sauvegarde', 'Remplace tes données', 'document.getElementById(\'import-file\').click()')
    + settingsRow('🗑️', 'Supprimé récemment', state.trash.length ? pl(state.trash.length, 'élément') + ' récupérable' + (state.trash.length > 1 ? 's' : '') : 'Rien pour l\'instant', 'App.openTrash()')
    + '</div><input type="file" id="import-file" accept=".json,application/json" style="display:none;" onchange="App.importFile(this)"/>'
    + '<div class="rub-meta" style="margin:-4px 0 4px;">Tes fiches sont stockées sur cet appareil : exporte-les de temps en temps.</div>';

  html += '<div class="section-label">Communauté</div><div class="settings-group">'
    + settingsRow('📨', 'Inviter un camarade', 'Envoie le lien de l\'appli', 'App.shareApp()')
    + settingsRow('💬', 'Donner mon avis', 'Une note et un commentaire', 'App.openFeedback()')
    + '</div>';

  html += '<div class="section-label">À propos</div><div class="settings-group">'
    + settingsRow('📊', 'Présentation du projet', 'Modèle économique et feuille de route', 'App.openPitch()')
    + settingsRow('👋', 'Revoir la présentation', 'Refaire l\'accueil et ton profil', 'App.startOnboarding()')
    + settingsRow('🎬', 'Charger les données de démo', 'Un jeu d\'exemple complet', 'App.loadDemo()')
    + '</div>';
  html += '<div class="rub-meta" style="margin-top:6px;text-align:center;">Boîte à Fiches · version ' + APP_VERSION + ' (prototype)</div>';
  return html;
}

// ---------- SÉRIE DE JOURS ET OBJECTIF ----------
// Un « nudge » (coup de pouce) positif : on montre la progression et la série en
// cours, sans jamais culpabiliser quand elle est à zéro.
function renderStreakMini() {
  const streak = currentStreak();
  const done = reviewedToday();
  const goal = state.stats.goal;
  const pct = Math.min(100, Math.round(done / goal * 100));
  const msg = done >= goal ? 'Objectif atteint 🎉' : done + ' / ' + goal + ' cartes aujourd\'hui';
  return '<div class="streak-mini tap" onclick="App.goTab(\'progress\')"><div class="sm-left"><b>🔥 ' + streak + '</b><small>jour' + (streak > 1 ? 's' : '') + '</small></div>'
    + '<div class="sm-mid"><div class="goal-bar" style="margin:0 0 6px;"><div class="goal-fill' + (done >= goal ? ' full' : '') + '" style="width:' + pct + '%;"></div></div><small>' + msg + '</small></div>'
    + '<span class="chev">›</span></div>';
}

function renderTodayCard(totalDue) {
  if (totalDue > 0) {
    return '<button class="hero-cta" onclick="App.startFlash(null,null,\'all-due\')"><div><div class="hero-kicker">Aujourd\'hui</div>'
      + '<div class="hero-big">' + totalDue + ' carte' + (totalDue > 1 ? 's' : '') + ' à revoir</div><div class="hero-sub">Toutes rubriques confondues</div></div><span class="hero-play">▶</span></button>';
  }
  return '<div class="hero-cta calm tap" onclick="App.goTab(\'create\')"><div><div class="hero-kicker">Aujourd\'hui</div>'
    + '<div class="hero-big">Tout est à jour 🎉</div><div class="hero-sub">Ajoute des cartes ou lance un duel</div></div><span class="hero-play">+</span></div>';
}

// ---------- ACCUEIL ----------
function renderHome() {
  const totalDue = allDueCards().length;
  const visibleRubs = state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order);
  const hiddenRubs = state.rubriques.filter(r => r.hidden);
  const name = state.profile.pseudo !== 'Toi' ? ' ' + esc(state.profile.pseudo) : '';

  let html = '<div class="row between" style="align-items:flex-start;"><div><div class="eyebrow">Salut' + name + ' 👋</div><h1 class="title">Réviser</h1></div>'
    + '<button class="icon-btn" onclick="App.openSearch()" aria-label="Rechercher une carte">' + SEARCH_ICON + '</button></div>';
  html += renderTodayCard(totalDue);
  html += renderStreakMini();
  html += renderReminderBanner();
  html += nextStepHtml();
  if (state.meta.dailyDone !== todayStr()) {
    html += '<div class="slim-card tap" onclick="App.dailyChallenge()"><span class="settings-ic">🎯</span><div style="flex:1;min-width:0;"><div class="mode-title">Défi du jour</div>'
      + '<div class="mode-desc">Un Medley express · +20 points bonus</div></div><span class="chev">›</span></div>';
  }

  html += '<div class="row between" style="margin:22px 0 10px;"><div class="section-label" style="margin:0;">Mes rubriques</div>'
    + '<button class="toggle-reorder" onclick="App.toggleReorder()">' + (state.reorderMode ? 'Terminé' : 'Réorganiser') + '</button></div>';

  html += '<div id="rubrique-list">';
  visibleRubs.forEach(function (r) {
    const due = dueInRubrique(r.id);
    const total = decksOf(r.id).length;
    html += '<div class="card rub-item" data-id="' + r.id + '" onclick="' + (state.reorderMode ? '' : 'App.openRubrique(\'' + r.id + '\')') + '" style="cursor:pointer;">'
      + '<div class="row between"><div class="row">'
      + '<div class="badge" style="background:' + colorVar(r.color) + ';">' + rubriqueBadge(r) + '</div>'
      + '<div><div class="rub-name">' + esc(r.name) + '</div><div class="rub-meta">' + total + ' paquet' + (total > 1 ? 's' : '') + (due > 0 ? ' · ' + due + ' à revoir' : '') + '</div></div>'
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
  html += '<button class="add-row" onclick="App.openAddRubrique()">+ Nouvelle rubrique</button>';

  if (!state.reorderMode) {
    html += moocSection(recommendations(3), 'Recommandé pour toi');
    html += '<div class="slim-card tap" style="margin-top:14px;" onclick="App.goTab(\'progress\')"><div style="flex:1;min-width:0;"><div class="mode-title">Newsletter</div>'
      + '<div class="mode-desc">Édition du ' + editionDate() + ' · ' + pl(articleFeed().length, 'article') + ' sélectionné' + (articleFeed().length > 1 ? 's' : '') + ' pour toi</div></div><span class="chev">›</span></div>';
  }

  if (hiddenRubs.length > 0 && state.reorderMode) {
    html += '<div class="section-label" style="margin-top:14px;">Masquées</div>';
    hiddenRubs.forEach(function (r) {
      html += '<div class="card row between"><div class="rub-name" style="color:var(--ink-soft);">' + esc(r.name) + '</div>'
        + '<button class="hidebtn" onclick="App.showRubrique(\'' + r.id + '\')">afficher</button></div>';
    });
  }
  return html;
}

// ---------- RUBRIQUE (paquets) ----------
function renderRubrique() {
  const r = state.rubriques.find(x => x.id === state.currentRubriqueId);
  if (!r) return renderHome();
  const decks = decksOf(r.id);
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Réviser</button>';
  html += '<div class="eyebrow" style="color:' + colorVar(r.color) + ';">' + esc(r.name) + '</div><h1 class="title">' + deckPickerTitle(r) + '</h1>';
  html += aiButton(r);
  const rubCards = allDecksOf(r.id).reduce((n, d) => n + cardsOf(d.id).length, 0);
  if (rubCards >= 2) html += '<div class="mode-card medley" style="cursor:pointer;margin-bottom:16px;" onclick="App.openMedleyScope(\'R:' + r.id + '\')">'
    + '<div><div class="mode-title">✨ Quizz Medley de la rubrique</div><div class="mode-desc">Mélange tous les paquets · ' + rubCards + ' cartes</div></div><span class="chev">›</span></div>';
  if (decks.length === 0) { html += '<div class="subtitle">Aucun paquet ici pour l\'instant.</div>'; }
  if (decks.length > 1) html += '<div class="row between" style="margin:0 0 8px;"><span></span><button class="toggle-reorder" onclick="App.toggleReorder()">' + (state.reorderMode ? 'Terminé' : 'Réorganiser') + '</button></div>';
  html += '<div id="deck-list">';
  decks.forEach(function (d) { html += deckRowHtml(d, r); });
  html += '</div>';
  html += '<button class="add-row" onclick="App.openAddDeck()">+ Nouveau paquet</button>';
  html += partnerCard(r);
  return html;
}

// ---------- MODES ----------
// Toutes les façons d'ajouter des cartes, regroupées (écran du paquet + liste des cartes).
function addCardsBlock(d) {
  return '<div class="section-label">Ajouter des cartes</div><div class="settings-group">'
    + settingsRow('✏️', 'Une carte', 'Recto et verso, à la main', 'App.openAddCard()')
    + settingsRow('📋', 'Plusieurs cartes', 'Colle une liste ou importe un fichier .csv / .txt', 'App.openBulk()')
    + settingsRow('✨', 'Générer avec l\'IA', aiQuotaText() + ' · cartes ajoutées à ce paquet', 'App.openAi(\'' + d.rubriqueId + '\',\'prompt\',\'deck\',\'' + d.id + '\')')
    + settingsRow('📝', 'Coller un cours', 'Les définitions deviennent des cartes', 'App.openAi(\'' + d.rubriqueId + '\',\'text\',\'deck\',\'' + d.id + '\')')
    + '</div>';
}

// Ligne d'un paquet (dans une rubrique ou dans un autre paquet), réordonnable par glisser-déposer.
function deckRowHtml(d, r) {
  const total = treeCards(d.id).length;
  const due = dueTree(d.id).length;
  const kids = childDecks(d.id).length;
  const go = state.reorderMode ? '' : 'App.openDeck(\'' + d.id + '\')';
  return '<div class="deck-card rub-item" data-id="' + d.id + '" onclick="' + go + '" style="cursor:pointer;">'
    + '<div class="deck-top" style="background:' + colorVar(r.color) + ';"></div>'
    + '<div class="row between"><div style="min-width:0;"><div class="rub-name">' + esc(d.name) + '</div>'
    + '<div class="rub-meta">' + (total === 0 && !kids ? 'vide' : (kids ? pl(kids, 'sous-paquet') + ' · ' : '') + due + ' / ' + total + ' à revoir · maîtrise ' + deckMastery(d.id) + ' %') + '</div></div>'
    + '<div class="row">'
    + (state.reorderMode
      ? '<button class="hidebtn" onclick="event.stopPropagation();App.openEditDeck(\'' + d.id + '\')">modifier</button><div class="drag-handle" onclick="event.stopPropagation();" title="Glisser pour réordonner">⠿</div>'
      : '<button class="hidebtn" onclick="event.stopPropagation();App.openEditDeck(\'' + d.id + '\')">modifier</button>'
        + '<button class="hidebtn" onclick="event.stopPropagation();App.deleteDeck(\'' + d.id + '\')">supprimer</button><span class="chev">›</span>')
    + '</div></div></div>';
}

// Liste déroulante « Contenu à réviser » : un paquet et ses sous-paquets, à cocher / décocher.
function contentDropdown(d) {
  if (!childDecks(d.id).length) return '';
  const nodes = treeNodes(d.id);
  const sel = new Set(selectedIds(d.id));
  const stateOf = function (id) {
    const ids = descendantIds(id);
    const n = ids.filter(x => sel.has(x)).length;
    return n === ids.length ? 'on' : n === 0 ? 'off' : 'part';
  };
  const items = nodes.map(function (n) {
    const node = state.decks.find(x => x.id === n.id);
    const hasKids = childDecks(n.id).length > 0;
    // Pour le paquet lui-même, on précise qu'il s'agit de ses cartes directes.
    return { id: n.id, depth: n.depth, label: n.depth === 0 ? 'Cartes de « ' + node.name + ' »' : node.name,
      count: n.depth === 0 ? cardsOf(n.id).length : treeCards(n.id).length,
      state: n.depth === 0 ? (sel.has(n.id) ? 'on' : 'off') : stateOf(n.id), hasKids };
  }).filter(it => !(it.depth === 0 && it.count === 0));
  const total = nodes.length;
  const all = sel.size === total;
  const summary = all ? 'Tout le paquet' : sel.size + ' sur ' + total + ' sections';
  return dropdown('content', 'Contenu à réviser', summary + ' · ' + pl(scopedCards(d.id).length, 'carte'), items,
    it => 'App.toggleSel(\'' + d.id + '\',\'' + it.id + '\')', all ? '' : 'App.selAll(\'' + d.id + '\')');
}

function renderModes() {
  const d = state.decks.find(x => x.id === state.currentDeckId);
  if (!d) return renderHome();
  const r = state.rubriques.find(x => x.id === d.rubriqueId);
  const parent = d.parentId ? state.decks.find(x => x.id === d.parentId) : null;
  const total = scopedCards(d.id).length;
  const due = scopedDue(d.id).length;
  const kids = childDecks(d.id);
  let html = '<button class="backbtn" onclick="App.backFromDeck()">‹ ' + esc(parent ? parent.name : r.name) + '</button>';
  html += '<div class="eyebrow">' + esc(parent ? deckPath(d.id) : r.name) + '</div><h1 class="title">' + esc(d.name) + '</h1>';
  html += '<div class="subtitle">' + (total === 0 ? 'Aucune carte ici : ajoutes-en pour commencer.' : (due > 0 ? due + ' à revoir aujourd\'hui · ' : 'Rien à revoir aujourd\'hui · ') + pl(total, 'carte')) + '</div>';
  html += contentDropdown(d);
  html += '<div class="section-label">Réviser</div>';
  MODES.forEach(function (m) {
    const enough = total >= m.min;
    html += '<div class="mode-card" style="opacity:' + (enough ? 1 : .45) + ';" onclick="' + (enough ? ('App.startMode(\'' + m.id + '\',\'' + d.id + '\')') : '') + '">'
      + '<div><div class="mode-title">' + m.name + '</div><div class="mode-desc">' + m.desc + (enough ? '' : ' — besoin de ' + m.min + ' carte(s) min.') + '</div></div>'
      + '<span class="chev">›</span></div>';
  });
  const enoughMedley = total >= 2;
  html += '<div class="mode-card medley" style="opacity:' + (enoughMedley ? 1 : .45) + ';" onclick="' + (enoughMedley ? ('App.openMedleyScope(\'' + d.id + '\')') : '') + '">'
    + '<div><div class="mode-title">✨ Quizz Medley</div><div class="mode-desc">Mélange des modes que tu choisis</div></div><span class="chev">›</span></div>';

  // Contenu du paquet : sous-paquets (comme des dossiers) puis cartes.
  html += '<div class="row between" style="margin:26px 0 10px;"><div class="section-label" style="margin:0;">Sous-paquets</div>'
    + (kids.length > 1 ? '<button class="toggle-reorder" onclick="App.toggleReorder()">' + (state.reorderMode ? 'Terminé' : 'Réorganiser') + '</button>' : '') + '</div>';
  html += '<div id="deck-list">' + kids.map(k => deckRowHtml(k, r)).join('') + '</div>';
  html += '<button class="add-row" style="margin-top:' + (kids.length ? 4 : 0) + 'px;" onclick="App.openAddSubDeck()">+ Nouveau sous-paquet</button>';
  if (!kids.length) html += '<div class="rub-meta" style="margin-top:8px;">Pour ranger ce paquet par thèmes ou par séances, comme des dossiers.</div>';
  html += addCardsBlock(d);
  html += '<button class="manage-link" onclick="App.openCards(\'' + d.id + '\')">Voir et modifier les cartes (' + treeCards(d.id).length + ')</button>';
  return html;
}

// ---------- CARTES D'UN PAQUET (liste, modification, suppression) ----------
function renderCards() {
  const d = state.decks.find(x => x.id === state.currentDeckId);
  if (!d) return renderHome();
  const nodes = treeNodes(d.id);
  const total = treeCards(d.id).length;
  const cardRow = function (c) {
    return '<div class="list-item"><div class="row between" style="align-items:flex-start;">'
      + '<div style="min-width:0;"><div class="rub-name">' + esc(c.front) + '</div><div class="rub-meta">' + esc(c.back) + '</div></div>'
      + '<div class="row card-actions">'
      + '<button class="hidebtn" onclick="App.openEditCard(\'' + c.id + '\')">modifier</button>'
      + '<button class="hidebtn" onclick="App.deleteCard(\'' + c.id + '\')">supprimer</button>'
      + '</div></div></div>';
  };
  let html = '<button class="backbtn" onclick="App.openDeck(\'' + d.id + '\')">‹ ' + esc(d.name) + '</button>';
  html += '<div class="eyebrow">' + esc(d.name) + '</div><h1 class="title">Tes cartes</h1>';
  html += '<div class="subtitle">' + pl(total, 'carte') + (nodes.length > 1 ? ' · ' + pl(nodes.length - 1, 'sous-paquet') : '') + '</div>';
  html += addCardsBlock(d);
  if (total) html += '<div style="margin:4px 0 16px;"><button class="link" onclick="App.shareDeck()">Partager ce paquet avec un camarade</button></div>';
  const multi = nodes.length > 1;
  nodes.forEach(function (n) {
    const list = cardsOf(n.id);
    if (!list.length) return;
    if (multi) html += '<div class="section-label">' + esc(n.depth === 0 ? 'Cartes de ce paquet' : deckPath(n.id).split(' › ').slice(deckPath(d.id).split(' › ').length).join(' › ')) + ' · ' + list.length + '</div>';
    else html += '<div class="section-label">Les cartes du paquet</div>';
    list.forEach(c => { html += cardRow(c); });
  });
  return html;
}

function renderMedleyScope(deckId) {
  const labels = { flash: 'Flashcard', qcm: 'QCM', texte: 'Texte à trous', appariement: 'Appariement' };
  const ms = state.medleyModes;
  const items = ['flash', 'qcm', 'texte', 'appariement'].map(m => ({ id: m, label: labels[m], state: ms.includes(m) ? 'on' : 'off' }));
  const summary = ms.length === 4 ? 'Tous les modes' : ms.map(m => labels[m]).join(', ');
  return '<div class="center" style="padding-top:30px;">'
    + '<div class="eyebrow">Quizz Medley</div><h1 class="title">Ton mélange</h1>'
    + '<div style="width:100%;text-align:left;">' + dropdown('medley', 'Modes inclus', esc(summary), items, it => 'App.toggleMedleyMode(\'' + it.id + '\')', '') + '</div>'
    + '<div class="section-label" style="align-self:flex-start;margin-top:8px;">Quelles cartes ?</div>'
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
  return '<div class="progress">' + (s.index + 1) + ' / ' + s.queue.length + (s.deckName ? (' · ' + esc(s.deckName)) : '') + '</div>'
    + '<div class="progress-bar"><i style="width:' + Math.round(s.index / s.queue.length * 100) + '%"></i></div>';
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
    + '<div class="subtitle">' + pl(s.reviewedCount || 0, 'carte') + ' révisée' + ((s.reviewedCount || 0) > 1 ? 's' : '') + '.</div>'
    + sessionRecap()
    + '<div style="width:100%;text-align:left;">' + moocSection(recommendations(1, d => d.id === s.deckId), 'Pour aller plus loin') + '</div>'
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
// Menu « Emplacement » pour déplacer un paquet : racine d'une rubrique ou dans un autre paquet.
function locationSelect(deck) {
  let h = '<label>Emplacement</label><select id="deck-loc"><option value="">Ne pas déplacer</option>';
  state.rubriques.forEach(function (r) {
    h += '<option value="R:' + r.id + '">Rubrique : ' + esc(r.name) + '</option>';
    const walk = function (id, depth) {
      if (id === deck.id) return; // on ne se range pas dans soi-même
      const x = state.decks.find(y => y.id === id);
      h += '<option value="D:' + id + '">' + '  '.repeat(depth) + '↳ ' + esc(x.name) + '</option>';
      childDecks(id).forEach(c => walk(c.id, depth + 1));
    };
    decksOfRoot(r.id).forEach(d0 => walk(d0.id, 1));
  });
  return h + '</select>';
}
function decksOfRoot(rid) { return decksOf(rid); }
function renderDeckModal(editId) {
  const editing = editId ? state.decks.find(x => x.id === editId) : null;
  const parent = !editing && state.newDeckParentId ? state.decks.find(x => x.id === state.newDeckParentId) : null;
  const lang = editing ? editing.speakLang : (parent ? parent.speakLang : '');
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">' + (editing ? 'Modifier le paquet' : (parent ? 'Nouveau sous-paquet' : 'Nouveau paquet')) + '</div>'
    + (parent ? '<div class="rub-meta" style="margin-top:6px;">Dans « ' + esc(deckPath(parent.id)) + ' »</div>' : '')
    + '<label>Nom</label><input id="deck-name" placeholder="' + (parent ? 'ex: Vocabulaire du voyage, ou Séance 3' : 'ex: Espagnol, ou Marketing') + '" value="' + (editing ? esc(editing.name) : '') + '"/>'
    + '<label>Lecture audio du recto</label><select id="deck-lang">'
    + SPEAK_LANGS.map(function (l) { return '<option value="' + l.code + '"' + (lang === l.code ? ' selected' : '') + '>' + l.label + '</option>'; }).join('')
    + '</select>'
    + (editing ? locationSelect(editing) : '')
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeModals()">Annuler</button><button class="btn" onclick="App.saveDeck()">' + (editing ? 'Enregistrer' : 'Créer') + '</button></div>'
    + '</div></div>';
}
// Menu « Paquet » d'une carte : tous les paquets de la même rubrique, avec leur arborescence.
function deckSelect(id, current) {
  const base = state.decks.find(x => x.id === state.currentDeckId);
  if (!base) return '';
  const root = rootDeckId(base.id);
  const nodes = treeNodes(root);
  if (nodes.length < 2) return '';
  return '<label>Paquet</label><select id="' + id + '">'
    + nodes.map(function (n) {
      const x = state.decks.find(y => y.id === n.id);
      return '<option value="' + n.id + '"' + (n.id === current ? ' selected' : '') + '>' + '  '.repeat(n.depth) + (n.depth ? '↳ ' : '') + esc(x.name) + '</option>';
    }).join('') + '</select>';
}
function renderCardModal(editId) {
  const editing = editId ? state.cards.find(x => x.id === editId) : null;
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">' + (editing ? 'Modifier la carte' : 'Nouvelle carte') + '</div>'
    + '<label>Recto (question / mot)</label><textarea id="card-front" placeholder="ex: Qu\'est-ce que le SECI model ?">' + (editing ? esc(editing.front) : '') + '</textarea>'
    + '<label>Verso (réponse / traduction)</label><textarea id="card-back" placeholder="Réponse...">' + (editing ? esc(editing.back) : '') + '</textarea>'
    + deckSelect('card-deck', editing ? editing.deckId : state.currentDeckId)
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeModals()">Annuler</button><button class="btn" onclick="App.saveCard()">Enregistrer</button></div>'
    + '</div></div>';
}
function renderBulkModal() {
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()"><div class="modal">'
    + '<div class="eyebrow">Ajouter plusieurs cartes</div>'
    + '<div class="rub-meta" style="margin-top:8px;">Une carte par ligne, sous la forme <b>recto ; verso</b>. Tu peux aussi coller directement deux colonnes copiées depuis Excel ou Google Sheets.</div>'
    + '<label>Tes cartes</label><label class="link file-link">Importer un fichier .csv ou .txt<input type="file" accept=".csv,.tsv,.txt,text/plain,text/csv" style="display:none;" onchange="App.loadBulkFile(this)"/></label><textarea id="bulk-text" style="min-height:150px;" placeholder="Buongiorno ; Bonjour&#10;Grazie mille ; Merci beaucoup&#10;Arrivederci ; Au revoir" oninput="App.previewBulk(this.value)"></textarea>'
    + '<div class="rub-meta" id="bulk-preview" style="margin-top:8px;">Rien à ajouter pour l\'instant.</div>'
    + deckSelect('bulk-deck', state.currentDeckId)
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
  if (t.type === 'rubrique') return 'Rubrique · ' + pl(p.decks.length, 'paquet') + ', ' + pl(p.cards.length, 'carte');
  if (t.type === 'deck') return 'Paquet · ' + pl(p.cards.length, 'carte');
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
  let html = '<button class="backbtn" onclick="App.openSettings()">‹ Profil</button>';
  html += '<div class="eyebrow">Corbeille</div><h1 class="title">Supprimé récemment</h1>';
  html += '<div class="subtitle">Récupérables pendant ' + TRASH_DAYS + ' jours, puis effacés pour de bon.</div>';
  if (state.trash.length === 0) html += '<div class="subtitle">Rien à récupérer.</div>';
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

// ---------- CRÉER (nouvel onglet) ----------
function renderCreate() {
  const rubs = state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order);
  const cur = rubs.find(r => r.id === state.createRubriqueId) || rubs[0];
  let html = '<div class="eyebrow">Nouveau contenu</div><h1 class="title">Créer</h1>';
  if (!cur) {
    return html + '<div class="subtitle">Crée d\'abord une rubrique pour y ranger tes paquets.</div>'
      + '<button class="add-row" onclick="App.goTab(\'learn\');App.openAddRubrique()">+ Nouvelle rubrique</button>';
  }
  html += '<div class="section-label">Dans quelle rubrique ?</div><div class="chip-row" style="margin-bottom:6px;">'
    + rubs.map(function (r) { return '<button class="chip wide' + (r.id === cur.id ? ' sel' : '') + '" onclick="App.setCreateRubrique(\'' + r.id + '\')">' + rubriqueBadge(r) + ' ' + esc(r.name) + '</button>'; }).join('') + '</div>';

  html += '<div class="section-label">Avec l\'IA</div><div class="settings-group">'
    + settingsRow('✨', 'Décrire un thème', aiQuotaText(), 'App.createAi(\'prompt\')')
    + settingsRow('📝', 'Coller un cours', 'Les définitions deviennent des cartes', 'App.createAi(\'text\')')
    + '</div>';

  const decks = decksOf(cur.id);
  html += '<div class="section-label">À la main</div><div class="settings-group">'
    + settingsRow('📦', 'Nouveau paquet', 'Dans « ' + esc(cur.name) + ' »', 'App.createDeck()')
    + '</div>';
  if (decks.length) {
    html += '<div class="section-label">Ajouter des cartes à…</div><div class="settings-group">'
      + decks.map(function (d) { return settingsRow('🃏', esc(d.name), pl(treeCards(d.id).length, 'carte'), 'App.openDeckCards(\'' + d.id + '\')'); }).join('')
      + '</div>';
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
    + '<span class="mode-desc">' + aiQuotaText() + '</span></span><span class="chev">›</span></button>';
}

// ---------- RECOMMANDATIONS DE COURS (MOOC) ----------
// Choisit des cours en ligne d'après ce que la personne révise vraiment : les paquets qui
// ont des cartes, les plus « à revoir » d'abord. keep = filtre facultatif sur les paquets.
function recommendations(limit, keep) {
  const levelLabel = (STUDY_LEVELS.find(l => l.id === (state.profile.study || {}).level) || {}).label;
  const langTopic = lang => ({ title: lang.title, desc: 'Cours de langue en ligne, du débutant au niveau avancé', query: lang.query, providers: ['coursera', 'futurelearn'] });
  const cand = (t, why) => ({ t, why });
  // 1) Matières en cours (parcours d'études), 2) centres d'intérêt, 3) paquets réellement révisés.
  const byCourses = [], byInterests = [], byDecks = [];
  if (!keep) {
    (state.profile.courses || []).forEach(function (c) {
      const t = MOOC_TOPICS.find(x => x.test.test(normalize(c))) || { title: c, desc: 'Cours en ligne en lien avec ta matière', query: c, providers: ['coursera', 'edx'] };
      byCourses.push(cand(t, 'Parce que tu suis « ' + c + ' »' + (levelLabel ? ' · ' + levelLabel : '')));
    });
    (state.meta.interests || []).forEach(function (id) {
      const it = INTERESTS.find(x => x.id === id);
      if (!it) return;
      const t = MOOC_LANGS[id] ? langTopic(MOOC_LANGS[id]) : MOOC_TOPICS.find(x => x.test.test(it.id));
      if (t) byInterests.push(cand(t, 'Parce que tu t\'intéresses à « ' + it.label + ' »'));
    });
  }
  const decks = state.decks.filter(d => !d.parentId && treeCards(d.id).length > 0 && (!keep || keep(d)));
  decks.sort((a, b) => dueTree(b.id).length - dueTree(a.id).length || treeCards(b.id).length - treeCards(a.id).length);
  decks.forEach(function (d) {
    const n = normalize(d.name);
    const langHit = MOOC_LANG_NAMES.find(l => l[0].test(n));
    const lang = MOOC_LANGS[d.speakLang] || (langHit && MOOC_LANGS[langHit[1]]);
    const t = lang ? langTopic(lang) : (MOOC_TOPICS.find(x => x.test.test(n)) || { title: d.name, desc: 'Cours en ligne sur ce thème', query: d.name, providers: ['coursera', 'edx'] });
    const due = dueTree(d.id).length;
    byDecks.push(cand(t, 'Parce que tu révises « ' + d.name + ' »' + (due ? ' · ' + pl(due, 'carte') + ' à revoir' : '')));
  });
  // On alterne entre les trois sources pour varier les suggestions.
  const lists = [byCourses, byInterests, byDecks];
  const seen = new Set();
  const out = [];
  let progress = true;
  while (out.length < limit && progress) {
    progress = false;
    lists.forEach(function (l) {
      while (l.length && seen.has(l[0].t.title)) l.shift();
      if (!l.length || out.length >= limit) return;
      const c = l.shift();
      seen.add(c.t.title);
      const prov = MOOC_PROVIDERS[c.t.providers[out.length % c.t.providers.length]];
      out.push({ provider: prov.name, title: c.t.title, desc: c.t.desc, url: prov.url(c.t.query), why: c.why });
      progress = true;
    });
  }
  return out;
}

function moocCard(r) {
  return '<a class="mooc" href="' + esc(r.url) + '" target="_blank" rel="noopener sponsored"><div style="min-width:0;">'
    + '<div class="mooc-prov">' + esc(r.provider) + '</div><div class="mooc-title">' + esc(r.title) + '</div>'
    + '<div class="mooc-why">' + esc(r.why) + '</div></div><span class="chev">›</span></a>';
}

function moocSection(list, label) {
  if (!list.length) return '';
  return '<div class="section-label" style="margin-top:26px;">' + label + '</div><div class="mooc-list">' + list.map(moocCard).join('') + '</div>'
    + '<div class="mooc-note">Liens partenaires</div>';
}

// Dans une rubrique : cours liés aux paquets de cette rubrique.
function partnerCard(r) {
  return moocSection(recommendations(2, d => d.rubriqueId === r.id), 'Pour aller plus loin');
}

function renderAi() {
  const a = state.ai;
  const r = state.rubriques.find(x => x.id === a.rubriqueId);
  const backDeck = a.from === 'deck' ? state.decks.find(x => x.id === a.targetDeckId) : null;
  let html = '<button class="backbtn" onclick="App.leaveAi()">‹ ' + (a.from === 'create' ? 'Créer' : (backDeck ? esc(backDeck.name) : esc(r ? r.name : 'Retour'))) + '</button>';
  html += '<div class="eyebrow">Assistant IA</div>';

  if (a.phase === 'loading') {
    return html + '<h1 class="title">L\'IA au travail</h1><div class="center" style="padding-top:40px;"><div class="spinner"></div>'
      + '<div class="subtitle" style="margin-top:20px;">L\'IA rédige tes cartes, tes phrases à trous et tes QCM…</div></div>';
  }

  if (a.phase === 'review') {
    const res = a.result;
    const nb = a.selected.length;
    html += '<h1 class="title">' + esc(res.title) + '</h1><div class="subtitle">' + pl(res.cards.length, 'carte') + ' proposées · décoche celles que tu ne veux pas</div>';
    res.cards.forEach(function (c, i) {
      const on = a.selected.includes(i);
      html += '<div class="ai-item' + (on ? ' on' : '') + '" onclick="App.toggleAi(' + i + ')"><span class="ai-check">' + (on ? '✓' : '') + '</span><div style="min-width:0;">'
        + '<div class="rub-name">' + esc(c.front) + ' <span style="color:var(--ink-soft);font-weight:500;">→ ' + esc(c.back) + '</span></div>'
        + (c.cloze ? '<div class="rub-meta" style="font-style:italic;">' + esc(c.cloze.text) + '</div>' : '') + '</div></div>';
    });
    const target = a.targetDeckId !== 'new' ? decksOf(a.rubriqueId).find(x => x.id === a.targetDeckId) : null;
    // Venu d'un paquet : la destination est évidente, pas de choix à proposer.
    if (a.from !== 'deck') html += '<div class="section-label">Ranger dans…</div><div class="chip-row">'
      + decksOf(a.rubriqueId).map(function (d) { return '<button class="chip wide' + (target && target.id === d.id ? ' sel' : '') + '" onclick="App.setAiTarget(\'' + d.id + '\')">' + esc(d.name) + '</button>'; }).join('')
      + '<button class="chip wide' + (target ? '' : ' sel') + '" onclick="App.setAiTarget(\'new\')">+ Nouveau paquet</button></div>';
    html += '<div class="row" style="margin-top:16px;"><button class="btn" onclick="App.addAi()"' + (nb ? '' : ' disabled style="opacity:.4;"') + '>Ajouter ' + pl(nb, 'carte') + (target ? ' à « ' + esc(target.name) + ' »' : ' en nouveau paquet') + '</button></div>';
    return html;
  }

  const src = a.source || 'prompt';
  html += '<h1 class="title">Créer avec l\'IA</h1>';
  html += '<div class="chip-row" style="margin:6px 0 14px;">'
    + '<button class="chip wide' + (src === 'prompt' ? ' sel' : '') + '" onclick="App.setAiSource(\'prompt\')">✨ Par consigne</button>'
    + '<button class="chip wide' + (src === 'text' ? ' sel' : '') + '" onclick="App.setAiSource(\'text\')">📝 À partir d\'un texte</button></div>';

  if (src === 'text') {
    html += '<div class="subtitle">Colle un extrait : les définitions deviennent des cartes.</div>';
    html += '<textarea class="answer-input" style="max-width:none;text-align:left;min-height:170px;font-size:14px;" id="ai-text" placeholder="Matrice SWOT : analyse des forces, faiblesses, opportunités et menaces.&#10;Un livrable désigne un résultat concret remis au client.&#10;MECE - principe consistant à structurer sans chevauchement ni oubli.">' + esc(a.text || '') + '</textarea>';
    html += '<input class="answer-input" style="max-width:none;text-align:left;margin-top:10px;" id="ai-title" placeholder="Nom du paquet (facultatif)" value="' + esc(a.title || '') + '" autocomplete="off"/>';
    if (a.error) html += '<div class="result-banner ko" style="font-weight:600;">' + esc(a.error) + '</div>';
    html += '<div class="row" style="margin-top:14px;"><button class="btn" onclick="App.generateFromText()">Analyser le texte</button>'
      + '<label class="btn ghost file-btn">Importer un fichier .txt<input type="file" accept=".txt,.md,text/plain" style="display:none;" onchange="App.loadTextFile(this)"/></label></div>';
    html += '<div class="eyebrow" style="margin:20px 0 8px;">Bientôt</div><div class="settings-group">'
      + '<div class="settings-row" style="opacity:.55;"><span class="settings-ic">📄</span><span class="settings-txt"><span class="mode-title">Importer un PDF ou des slides</span><span class="mode-desc">Extraction du texte, puis génération (phase 2)</span></span></div>'
      + '<div class="settings-row" style="opacity:.55;"><span class="settings-ic">📷</span><span class="settings-txt"><span class="mode-title">Photo de notes manuscrites</span><span class="mode-desc">Lecture de l\'écriture par une IA vision (phase 2, Premium)</span></span></div></div>';
    html += '<div class="rub-meta" style="margin-top:14px;">Analyse simple, locale et gratuite (sans IA) : elle repère les définitions.</div>';
    return html;
  }

  html += '<div class="subtitle">Cartes, QCM et phrases à trous, générés à partir d\'une phrase.</div>';
  html += '<input class="answer-input" style="max-width:none;text-align:left;" id="ai-prompt" placeholder="ex : Vocabulaire du football en anglais" value="' + esc(a.prompt) + '" autocomplete="off"/>';
  if (a.error) html += '<div class="result-banner ko" style="font-weight:600;">' + esc(a.error) + '</div>';
  html += '<div class="eyebrow" style="margin:18px 0 8px;">Idées</div><div class="chip-row">'
    + AI_TOPICS.map(function (t, i) { return '<button class="chip wide" onclick="App.pickAiTopic(' + i + ')">' + t.label + '</button>'; }).join('') + '</div>';
  html += '<div class="rub-meta" style="margin-top:18px;">' + aiQuotaText() + (state.meta.premium ? '' : ' · <a href="#" onclick="App.openPaywall();return false;" style="color:var(--primary);">Passer Premium</a>') + '</div>';
  html += '<div class="row" style="margin-top:14px;"><button class="btn" onclick="App.generateAi()">✨ Générer</button></div>';
  html += '<div class="rub-meta" style="margin-top:16px;">Prototype : l\'IA est simulée sur des thèmes préparés.</div>';
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

// En-tête commun aux trois écrans de l'onglet « Jouer » : un sélecteur remplace trois écrans séparés.
function playHeader(active) {
  const tabs = [['multi', 'Duels'], ['league', 'Classement'], ['friends', 'Amis']];
  return '<div class="eyebrow">Multijoueur</div><h1 class="title">Jouer</h1>'
    + '<div class="seg-tabs">' + tabs.map(function (t) {
      return '<button class="seg-tab' + (t[0] === active ? ' on' : '') + '" onclick="App.goPlay(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('') + '</div>';
}

function renderMulti() {
  ensureWeek();
  const lv = playerLevel();
  const m = state.multi;
  const dailyDone = state.meta.dailyDone === todayStr();
  let html = playHeader('multi');
  html += '<div class="slim-card tap" onclick="App.openProfile()">' + meAvatar()
    + '<div style="flex:1;min-width:0;"><div class="mode-title">' + esc(state.profile.pseudo) + ' · niveau ' + lv.level + '</div>'
    + '<div class="mode-desc">' + m.weekPoints + ' pts cette semaine · ' + pl(m.wins, 'victoire') + ' sur ' + pl(m.played, 'duel') + '</div></div></div>';

  const fm = state.multiModes;
  const formatItems = DUEL_MODES.map(x => ({ id: x.id, label: x.label, state: fm.includes(x.id) ? 'on' : 'off' }));
  const formatSummary = fm.length === DUEL_MODES.length ? 'Tous les formats' : DUEL_MODES.filter(x => fm.includes(x.id)).map(x => x.label).join(', ');
  html += dropdown('formats', 'Format de partie', esc(formatSummary), formatItems, it => 'App.toggleMultiMode(\'' + it.id + '\')', '');

  const ok = new Set(eligibleDecks().map(d => d.id));
  const checked = state.multiThemes ? new Set(state.multiThemes.filter(id => ok.has(id))) : ok;
  const themeItems = [];
  state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order).forEach(function (r) {
    decksOf(r.id).forEach(function (d0) {
      treeNodes(d0.id).forEach(function (n) {
        if (!ok.has(n.id)) return;
        const ids = descendantIds(n.id).filter(x => ok.has(x));
        const k = ids.filter(x => checked.has(x)).length;
        themeItems.push({ id: n.id, depth: n.depth, label: state.decks.find(x => x.id === n.id).name, count: treeCards(n.id).length, state: k === ids.length ? 'on' : k === 0 ? 'off' : 'part' });
      });
    });
  });
  const themeSummary = checked.size === ok.size ? 'Tous les paquets (au hasard)' : (checked.size === 1 ? esc(state.decks.find(x => x.id === [...checked][0]).name) : checked.size + ' paquets');
  html += dropdown('themes', 'Thèmes', themeSummary, themeItems, it => 'App.toggleMultiTheme(\'' + it.id + '\')', checked.size === ok.size ? '' : 'App.allMultiThemes()');
  html += '<button class="mode-card medley" style="width:100%;border:none;text-align:left;cursor:pointer;margin-top:14px;" onclick="App.quickMatch()">'
    + '<div><div class="mode-title">⚡ Partie rapide</div><div class="mode-desc">Adversaire au hasard · ' + esc(formatSummary) + ' · ' + esc(themeSummary) + '</div></div><span class="chev">›</span></button>';
  html += '<div class="mode-card" style="cursor:pointer;" onclick="App.dailyChallenge()"><div><div class="mode-title">🎯 Défi du jour' + (dailyDone ? ' ✓' : '') + '</div>'
    + '<div class="mode-desc">' + (dailyDone ? 'Relevé aujourd\'hui · reviens demain' : 'Un Medley express · +20 points bonus') + '</div></div><span class="chev">›</span></div>';
  html += '<div class="rub-meta" style="margin-top:14px;">Prototype : adversaires et classement simulés.</div>';
  return html;
}

function renderDuel() {
  const d = state.duel;
  if (!d) return renderMulti();
  const back = '<button class="backbtn" onclick="App.openMulti()">‹ Quitter</button>';

  if (d.phase === 'nodeck') {
    return back + '<h1 class="title">Pas assez de cartes</h1><div class="subtitle">Il faut un paquet d\'au moins 4 cartes pour lancer un duel.</div>';
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
  let html = playHeader('league');
  html += '<div class="chip-row" style="margin-bottom:12px;">' + [['general', '🌍 Général'], ['promo', '🎓 Promo'], ['amis', '👥 Amis']].map(function (x) {
    return '<button class="chip wide' + (scope === x[0] ? ' sel' : '') + '" onclick="App.setLeagueScope(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>';
  html += '<div class="rub-meta" style="margin:0 0 10px;">Fin de la ligue dans ' + daysLeftInWeek() + ' jour' + (daysLeftInWeek() > 1 ? 's' : '') + ' · victoire +' + POINTS.win + ' pts, égalité +' + POINTS.draw + ', défaite +' + POINTS.loss + '</div>';
  if (scope !== 'amis') html += '<div class="prize-card"><span class="settings-ic">🎁</span><div><div class="mode-title">Lot du mois · partenaire</div>'
    + '<div class="mode-desc">Les 5 premiers participent au tirage au sort : 2 places de concert (exemple).</div></div></div>';
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
  const q = normalize(query || '');
  if (q) {
    const found = DEMO_PEOPLE.filter(p => normalize(p.name).includes(q));
    return found.length ? found.map(friendRow).join('') : '<div class="rub-meta">Aucun joueur trouvé pour « ' + esc(query) + ' ».</div>';
  }
  const friends = DEMO_PEOPLE.filter(p => state.social.friends.includes(p.name));
  const others = DEMO_PEOPLE.filter(p => !state.social.friends.includes(p.name)).slice(0, 4);
  return '<div class="section-label">Mes amis (' + friends.length + ')</div>'
    + (friends.length ? friends.map(friendRow).join('') : '<div class="rub-meta" style="margin-bottom:10px;">Pas encore d\'ami : cherche un pseudo ci-dessus.</div>')
    + '<div class="section-label" style="margin-top:18px;">Suggestions</div>' + others.map(friendRow).join('');
}

function renderFriends() {
  let html = playHeader('friends');
  html += '<input class="answer-input" style="max-width:none;text-align:left;margin-bottom:12px;" id="friend-search" placeholder="Rechercher un pseudo (ex : Martin)" oninput="App.searchFriends(this.value)" autocomplete="off" autocapitalize="off" value="' + esc(state.friendQuery || '') + '"/>';
  html += '<div id="friend-results">' + friendResultsHtml(state.friendQuery) + '</div>';
  html += '<div class="row" style="margin-top:16px;"><button class="btn ghost" onclick="App.shareApp()">📨 Inviter un camarade</button></div>';
  html += '<div class="rub-meta" style="margin-top:14px;">Prototype : annuaire fictif, demandes acceptées automatiquement.</div>';
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
  let html = '<button class="backbtn" onclick="App.openSettings()">‹ Profil</button>';
  html += '<div class="eyebrow">Boîte à Fiches</div><h1 class="title">Le projet</h1>';
  html += '<div class="subtitle">Réviser par petites sessions, sur téléphone. Un prototype testé avec de vrais utilisateurs.</div>';

  html += pitchSection('1', 'Le besoin', pitchList([
    'Réviser <b>régulièrement</b> est difficile : fiches papier, applis de langues, cours dispersés.',
    'Un besoin réel, vécu : réviser mes cours de dernière année et apprendre l\'italien.',
    'Les temps morts (bus, train) sont inutilisés : sessions de quelques minutes.'
  ]));

  html += pitchSection('2', 'La solution', pitchList([
    'Un <b>moteur de révision unique</b> pour deux usages : cours et langues.',
    '5 modes (flashcard, QCM, texte à trous, appariement, Medley) et un seul score de maîtrise par carte.',
    'Rappels espacés (méthode Leitner) : l\'appli te dit quoi réviser aujourd\'hui.',
    '<b>Contenu créé en une phrase par l\'IA</b>, ou à partir d\'un texte de cours, relu par l\'utilisateur avant ajout.',
    'Partage d\'un paquet avec un camarade en un geste : levier de croissance par le bouche-à-oreille.'
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
    '<b>Preuve sociale</b> : amis, duels, ligue hebdomadaire avec classements général, promo et amis.',
    '<b>Défi du jour</b> : un rendez-vous quotidien, avec points bonus une fois par jour.',
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
    + '<div class="rub-meta" style="margin-top:8px;">Visibles dans les duels et le classement.</div>'
    + '<label>Pseudo (2 à 16 caractères)</label><input id="profile-pseudo" maxlength="16" value="' + esc(state.profile.pseudo) + '" autocomplete="off"/>'
    + '<label>Avatar (un emoji)</label><input id="profile-avatar" maxlength="8" value="' + esc(state.profile.avatar) + '" placeholder="🙂"/>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeProfile()">Annuler</button><button class="btn" onclick="App.saveProfile()">Enregistrer</button></div>'
    + '</div></div>';
}

function renderReminderBanner() {
  if (!reminderDue()) return '';
  const left = Math.max(state.stats.goal - reviewedToday(), 0);
  return '<div class="reminder-banner"><span class="reminder-ic">⏰</span><div style="flex:1;"><div class="mode-title">C\'est l\'heure de ta révision</div>'
    + '<div class="mode-desc">Il te reste ' + pl(left, 'carte') + ' pour atteindre ton objectif du jour.</div></div>'
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
  // Progression vers le niveau suivant : le niveau N commence à 20 × (N−1)² points d'expérience.
  const from = 20 * Math.pow(lv.level - 1, 2);
  const to = 20 * Math.pow(lv.level, 2);
  const lvPct = Math.max(0, Math.min(100, Math.round((lv.xp - from) / (to - from) * 100)));

  let html = '<div class="eyebrow">Niveau ' + lv.level + '</div><h1 class="title">Progrès</h1>';
  html += '<div class="stat-card"><div class="row between"><div class="mode-title">Niveau ' + lv.level + '</div><div class="rub-meta" style="margin:0;">' + lv.xp + ' / ' + to + ' XP</div></div>'
    + '<div class="goal-bar"><div class="goal-fill" style="width:' + lvPct + '%;"></div></div>'
    + '<div class="rub-meta" style="margin-top:8px;">' + totalReviews() + ' cartes révisées au total</div></div>';

  html += '<div class="section-label">Cette semaine</div><div class="stat-card"><div class="mode-desc">' + w.total + ' cartes · ' + w.activeDays + ' jour' + (w.activeDays > 1 ? 's' : '') + ' actif' + (w.activeDays > 1 ? 's' : '') + ' sur 7 · moyenne ' + w.average + ' par jour</div>'
    + '<div class="bar-chart">' + w.days.map(function (d) {
      const h = Math.round(d.count / maxBar * 100);
      return '<div class="bar-col"><span class="bar-val">' + (d.count || '') + '</span><div class="bar-track"><div class="bar' + (d.count >= goal ? ' hit' : '') + '" style="height:' + h + '%;"></div></div><span class="bar-lbl' + (d.isToday ? ' today' : '') + '">' + d.letter + '</span></div>';
    }).join('') + '</div><div class="rub-meta" style="margin-top:8px;">Barre verte : objectif de ' + goal + ' cartes atteint.</div></div>';

  html += '<div class="section-label">Séries</div><div class="stat-card"><div class="stats-grid">'
    + '<div><div class="stat-num">' + currentStreak() + '</div><div class="rub-meta">en cours</div></div>'
    + '<div><div class="stat-num">' + longestStreak() + '</div><div class="rub-meta">record</div></div>'
    + '<div><div class="stat-num">' + (w.best.count || 0) + '</div><div class="rub-meta">meilleur jour</div></div></div></div>';

  const seg = (n, cls, label) => '<div class="seg-row"><span class="seg-lbl">' + label + '</span><div class="seg-track"><div class="seg ' + cls + '" style="width:' + Math.round(n / totalCards * 100) + '%;"></div></div><span class="seg-n">' + n + '</span></div>';
  html += '<div class="section-label">Maîtrise · ' + state.cards.length + ' cartes</div><div class="stat-card">'
    + seg(m.fresh, 'fresh', 'À apprendre') + seg(m.learning, 'learning', 'En progrès') + seg(m.known, 'known', 'Maîtrisées') + '</div>';

  const badges = badgeList();
  html += '<div class="section-label">Badges · ' + badges.filter(b => b.earned).length + ' / ' + badges.length + '</div><div class="stat-card"><div class="badge-row" style="margin-top:0;">'
    + badges.map(function (b) { return '<div class="badge-chip' + (b.earned ? ' on' : '') + '"><span>' + b.emoji + '</span><small>' + esc(b.label) + '</small></div>'; }).join('') + '</div></div>';

  const mp = state.multi;
  html += '<div class="section-label">Multijoueur</div><div class="stat-card"><div class="stats-grid">'
    + '<div><div class="stat-num">' + mp.played + '</div><div class="rub-meta">duels</div></div>'
    + '<div><div class="stat-num">' + mp.wins + '</div><div class="rub-meta">victoires</div></div>'
    + '<div><div class="stat-num">' + (mp.played ? Math.round(mp.wins / mp.played * 100) + ' %' : '—') + '</div><div class="rub-meta">réussite</div></div></div></div>';

  html += '<div class="section-label">Le saviez-vous ?</div><div class="fact-card" style="margin-top:0;"><div class="rub-meta" style="font-size:13px;line-height:1.5;margin:0;">'
    + esc(FACTS[Math.floor(Date.now() / 86400000) % FACTS.length]) + '</div></div>';
  html += articlesHtml();
  return html;
}

// ---------- NEWSLETTER ----------
function editionDate() {
  return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// Classe les articles d'après ce que la personne révise : les articles de langues remontent
// si elle a des paquets de langue. À score égal, l'ordre tourne chaque jour (édition qui « vit »).
function articleFeed() {
  const likesLang = (state.meta.interests || []).some(id => MOOC_LANGS[id]);
  const hasLang = likesLang || state.decks.some(function (d) {
    if (!cardsOf(d.id).length) return false;
    const n = normalize(d.name);
    return !!d.speakLang || d.rubriqueId === 'r-langues' || MOOC_LANG_NAMES.some(l => l[0].test(n));
  });
  const study = hasStudyProfile();
  const days = examDaysLeft();
  const examSoon = days !== null && days <= 30;
  const day = Math.floor(Date.now() / 86400000);
  return ARTICLES.map(function (a, i) {
    let score = a.tags.includes('langues') ? (hasLang ? 3 : -1) : 1;
    if (study && a.tags.includes('etudes')) score += 2;
    if (examSoon && a.tags.includes('partiels')) score += 4;
    return { a, i, score: score + ((i + day) % ARTICLES.length) / 100 };
  }).sort((x, y) => y.score - x.score).slice(0, 4);
}

function articlesHtml() {
  const feed = articleFeed();
  const hasLang = feed.some(f => f.a.tags.includes('langues'));
  let html = '<div class="news"><div class="news-mast"><div class="news-kicker">Newsletter · ' + editionDate() + '</div>'
    + '<div class="news-title">Apprendre efficacement</div>'
    + '<div class="news-edition">' + (hasStudyProfile() ? 'Sélection d\'après ton parcours et tes révisions' : hasLang ? 'Sélection d\'après tes révisions de langues' : 'Sélection d\'après tes révisions') + '</div></div>';
  html += feed.map(function (f) {
    const a = f.a;
    const open = state.openArticle === f.i;
    return '<article class="news-item' + (open ? ' open' : '') + '" onclick="App.toggleArticle(' + f.i + ')"><div class="news-main">'
      + '<div class="news-meta"><span class="news-tag">' + esc(a.tag) + '</span><span class="news-time">' + a.time + ' de lecture</span></div>'
      + '<div class="news-headline">' + esc(a.title) + '</div>'
      + (open
        ? '<div class="news-body">' + esc(a.body) + '</div><div class="news-source">Source : ' + esc(a.source) + '</div>'
        : '<div class="news-sum">' + esc(a.summary) + '</div>')
      + '</div><span class="news-chev">' + (open ? '⌃' : '⌄') + '</span></article>';
  }).join('');
  html += '</div><div class="rub-meta" style="margin-top:10px;">Sélection de démonstration : dans la version complète, les articles viendront de sources externes.</div>';
  return html;
}

// ---------- DÉCOUVRIR (articles) ----------

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

// ---------- ACCUEIL ET CRÉATION DU PROFIL (première ouverture) ----------
const AVATARS = ['🙂', '😎', '🦊', '🐼', '🚀', '🎧', '⚽', '📚'];
const GOAL_TEXT = { 5: 'Une pause de 2 minutes', 10: 'Une révision tranquille', 20: 'Un bon rythme', 30: 'Le mode intensif' };

function renderOnboarding() {
  const o = state.onboard;
  const step = o.flow[o.i];
  const last = o.i === o.flow.length - 1;
  const mid = o.flow.filter(x => x !== 'welcome' && x !== 'recap');
  const eyebrow = 'Étape ' + (mid.indexOf(step) + 1) + ' sur ' + mid.length;
  const chips = (list, isSel, call) => '<div class="chip-row">' + list.map((x, i) => '<button class="chip wide' + (isSel(x) ? ' sel' : '') + '" onclick="' + call(x, i) + '">' + esc(x.label !== undefined ? x.label : x) + '</button>').join('') + '</div>';
  let body = '';
  if (step === 'welcome') {
    const feat = (icon, t, d) => '<div class="onb-feat"><span class="onb-ic">' + tabIcon(icon) + '</span><div><div class="mode-title">' + t + '</div><div class="mode-desc">' + d + '</div></div></div>';
    body = '<div class="onb-hero"><div class="eyebrow">Bienvenue</div><h1 class="title onb-brand">La Boîte à Fiches</h1>'
      + '<div class="subtitle">Révise mieux, par petites sessions.</div></div>'
      + feat(TAB_ICONS.learn, 'Révise à ton rythme', 'Flashcards, QCM, textes à trous et appariement, avec des rappels espacés.')
      + feat(TAB_ICONS.play, 'Défie tes amis', 'Duels, classement de la semaine et défi du jour.')
      + feat(TAB_ICONS.progress, 'Vois tes progrès', 'Série de jours, niveau, badges et statistiques.');
  } else if (step === 'account') {
    body = '<div class="eyebrow">' + eyebrow + '</div><h1 class="title">Crée ton compte</h1>'
      + '<div class="subtitle">Ton profil apparaît dans les duels et le classement.</div>'
      + '<div class="onb-label">Choisis un avatar</div>'
      + '<div class="onb-avatars">' + AVATARS.map(a => '<button class="onb-av' + (o.avatar === a ? ' sel' : '') + '" onclick="App.onbAvatar(\'' + a + '\')">' + a + '</button>').join('') + '</div>'
      + '<label class="onb-label" for="onb-pseudo">Pseudo</label><input id="onb-pseudo" class="onb-input" maxlength="16" placeholder="ex : Raph" value="' + esc(o.pseudo) + '" autocomplete="off"/>'
      + '<label class="onb-label" for="onb-email">E-mail <span class="onb-opt">facultatif</span></label><input id="onb-email" class="onb-input" type="email" inputmode="email" maxlength="80" placeholder="prenom@exemple.fr" value="' + esc(o.email) + '" autocomplete="off" autocapitalize="off"/>'
      + (o.error ? '<div class="onb-error">' + esc(o.error) + '</div>' : '')
      + '<div class="onb-note">Pas de mot de passe : dans la version en ligne, tu te connecteras avec un lien envoyé par e-mail. Pour l\'instant, ton profil est enregistré uniquement sur cet appareil.</div>';
  } else if (step === 'study') {
    const lvl = STUDY_LEVELS.find(l => l.id === o.level);
    const fld = STUDY_FIELDS.find(f => f.id === o.field);
    body = '<div class="eyebrow">' + (o.studyOnly ? 'Mon parcours' : eyebrow) + '</div><h1 class="title">Tes études</h1>'
      + '<div class="subtitle">Pour te proposer des cours, des articles et des rappels adaptés à ton parcours.</div>'
      + '<div class="onb-label">Niveau</div>' + chips(STUDY_LEVELS, l => l.id === o.level, l => 'App.onbLevel(\'' + l.id + '\')')
      + (lvl && lvl.years.length ? '<div class="onb-label">Année</div>' + chips(lvl.years, y => y === o.year, (y, i) => 'App.onbYear(' + i + ')') : '')
      + '<div class="onb-label">Domaine</div>' + chips(STUDY_FIELDS, f => f.id === o.field, f => 'App.onbField(\'' + f.id + '\')')
      + '<label class="onb-label" for="onb-degree">Diplôme préparé <span class="onb-opt">facultatif</span></label><input id="onb-degree" class="onb-input" maxlength="60" placeholder="' + esc(fld ? fld.ph : 'ex : Bachelor, Master, BTS…') + '" value="' + esc(o.degree) + '" autocomplete="off"/>'
      + '<label class="onb-label" for="onb-exam">Prochain examen ou partiel <span class="onb-opt">facultatif</span></label><input id="onb-exam" class="onb-input" type="date" min="' + todayStr() + '" value="' + esc(o.exam) + '"/>'
      + '<div class="onb-note">Avec une date d\'examen, l\'appli te rappelle le compte à rebours et met en avant des conseils de préparation.</div>';
  } else if (step === 'courses') {
    const choices = courseChoices(o.field, o.courses);
    body = '<div class="eyebrow">' + (o.studyOnly ? 'Mon parcours' : eyebrow) + '</div><h1 class="title">Tes matières</h1>'
      + '<div class="subtitle">Ce que tu étudies en ce moment. Chaque matière devient un paquet prêt à remplir.</div>'
      + '<div class="chip-row" style="margin-top:14px;">' + choices.map((c, i) => '<button class="chip wide' + (o.courses.includes(c) ? ' sel' : '') + '" onclick="App.onbCourse(' + i + ')">' + esc(c) + '</button>').join('') + '</div>'
      + '<div class="onb-add"><input id="onb-course" class="onb-input" maxlength="40" placeholder="Une autre matière…" autocomplete="off" onkeydown="if(event.key===\'Enter\'){App.onbAddCourse();}"/>'
      + '<button class="btn" onclick="App.onbAddCourse()">Ajouter</button></div>'
      + '<div class="onb-label">Langues que tu apprends</div>'
      + chips(INTERESTS.filter(i => i.group === 'Langues'), i => o.interests.includes(i.id), i => 'App.onbInterest(\'' + i.id + '\')')
      + '<div class="onb-note">On s\'en sert pour te recommander des cours et des articles.</div>';
  } else if (step === 'goal') {
    body = '<div class="eyebrow">' + eyebrow + '</div><h1 class="title">Ton objectif</h1>'
      + '<div class="subtitle">Combien de cartes veux-tu réviser par jour ?</div>'
      + GOAL_CHOICES.map(n => '<button class="onb-goal' + (o.goal === n ? ' sel' : '') + '" onclick="App.onbGoal(' + n + ')"><span class="onb-goal-n">' + n + '</span><span><span class="mode-title">' + pl(n, 'carte') + ' par jour</span><span class="mode-desc">' + GOAL_TEXT[n] + '</span></span></button>').join('')
      + '<div class="card" style="margin-top:14px;"><div class="row between"><div><div class="mode-title">Rappel quotidien</div><div class="mode-desc">Une bannière à l\'heure choisie</div></div>'
      + '<button class="chip' + (o.remind ? ' sel' : '') + '" onclick="App.onbRemind()">' + (o.remind ? 'Activé' : 'Désactivé') + '</button></div>'
      + (o.remind ? '<div class="row" style="margin-top:12px;"><span class="rub-meta" style="margin:0;">Heure</span><input type="time" class="time-input" value="' + esc(o.time) + '" onchange="App.onbTime(this.value)"/></div>' : '') + '</div>';
  } else {
    const lvl = STUDY_LEVELS.find(l => l.id === o.level);
    const fld = STUDY_FIELDS.find(f => f.id === o.field);
    const parcours = [o.degree, lvl && (lvl.label + (o.year ? ' · ' + o.year : '')), fld && fld.label].filter(Boolean).join(' · ');
    const langs = INTERESTS.filter(i => o.interests.includes(i.id)).map(i => esc(i.label));
    let days = null;
    if (o.exam) { const n = Math.round((Date.parse(o.exam + 'T00:00:00') - Date.parse(todayStr() + 'T00:00:00')) / 86400000); if (n >= 0) days = n; }
    const row = (k, v) => '<div class="onb-sum"><span>' + k + '</span><b>' + v + '</b></div>';
    body = '<div class="onb-hero"><div class="eyebrow">' + (o.studyOnly ? 'Mon parcours' : 'Terminé') + '</div><h1 class="title">' + (o.studyOnly ? 'Vérifie et enregistre' : 'C\'est prêt, ' + esc(o.pseudo) + ' !') + '</h1></div>'
      + '<div class="stat-card"><div class="row"><div class="badge" style="width:56px;height:56px;font-size:28px;border-radius:16px;background:var(--card);">' + esc(o.avatar) + '</div>'
      + '<div style="min-width:0;"><div class="profile-name">' + esc(o.pseudo) + '</div><div class="rub-meta">' + (o.email ? esc(o.email) : 'Compte sur cet appareil') + '</div></div></div>'
      + row('Parcours', parcours ? esc(parcours) : 'non renseigné')
      + row('Matières', o.courses.length ? o.courses.map(esc).join(', ') : 'aucune')
      + (days !== null ? row('Examen', days === 0 ? 'aujourd\'hui' : 'dans ' + pl(days, 'jour')) : '')
      + (langs.length ? row('Langues', langs.join(', ')) : '')
      + row('Objectif', pl(o.goal, 'carte') + ' par jour')
      + row('Rappel', o.remind ? 'à ' + esc(o.time) : 'désactivé') + '</div>'
      + '<div class="onb-note">Tu pourras tout modifier dans l\'onglet Profil.</div>';
  }
  const dots = o.flow.map((_, i) => '<i class="' + (i === o.i ? 'on' : i < o.i ? 'done' : '') + '"></i>').join('');
  const primary = step === 'welcome' ? 'Commencer' : last ? (o.studyOnly ? 'Enregistrer' : 'Commencer à réviser') : 'Continuer';
  const act = last ? 'App.onbFinish(\'' + (o.studyOnly ? 'home' : 'review') + '\')' : 'App.onbNext()';
  return '<div class="onb"><div class="onb-top">'
    + (o.i > 0 || o.studyOnly ? '<button class="onb-back" onclick="App.onbBack()">‹ ' + (o.i === 0 ? 'Annuler' : 'Retour') + '</button>' : '<span></span>')
    + '<div class="onb-dots">' + dots + '</div>'
    + (o.i > 0 && !last && !o.studyOnly ? '<button class="onb-back" onclick="App.skipWelcome()">Passer</button>' : '<span></span>') + '</div>'
    + '<div class="onb-body">' + body + '</div>'
    + '<div class="onb-foot"><button class="btn onb-cta" onclick="' + act + '">' + primary + '</button>'
    + (step === 'welcome' ? '<button class="link" onclick="App.onbLogin()">J\'ai déjà un compte</button>' : '')
    + (last && !o.studyOnly ? '<button class="link" onclick="App.onbFinish(\'home\')">Explorer l\'appli d\'abord</button>' : '')
    + (step === 'welcome' ? '<div class="onb-proto">Version prototype</div>' : '') + '</div></div>';
}

// ---------- AVIS ----------
function renderFeedbackModal() {
  const faces = ['😞', '😐', '🙂', '😍'];
  return '<div class="modal-backdrop" onclick="if(event.target===this) App.closeFeedback()"><div class="modal">'
    + '<div class="eyebrow">Donner mon avis</div>'
    + '<div class="rub-meta" style="margin-top:8px;">Ton avis sera préparé dans ton menu de partage : tu choisis où l\'envoyer.</div>'
    + '<label>Ton ressenti</label><div class="row">'
    + faces.map(function (f, i) { return '<button class="chip' + (state.feedbackRating === i + 1 ? ' sel' : '') + '" id="fb-' + (i + 1) + '" onclick="App.pickFeedback(' + (i + 1) + ')" style="font-size:20px;">' + f + '</button>'; }).join('')
    + '</div><label>Un commentaire (facultatif)</label><textarea id="fb-text" placeholder="Ce que j\'aime, ce qui manque, ce qui bug…"></textarea>'
    + '<div class="modal-actions"><button class="btn ghost" onclick="App.closeFeedback()">Annuler</button><button class="btn" onclick="App.sendFeedback()">Envoyer</button></div>'
    + '</div></div>';
}

// Maîtrise d'un paquet en % : moyenne des cases de Leitner (0 à 5) de ses cartes.
function deckMastery(deckId) {
  const cards = treeCards(deckId);
  if (cards.length === 0) return 0;
  return Math.round(cards.reduce((a, c) => a + Math.min(c.box, 5), 0) / (cards.length * 5) * 100);
}

// ---------- RECHERCHE DE CARTES ----------
// Liste des cartes dont le recto ou le verso contient le texte cherché (exportée : app.js la met à jour en direct).
export function searchResultsHtml(query) {
  const plain = s => normalize(String(s));
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
  let html = '<button class="backbtn" onclick="App.backHome()">‹ Réviser</button>';
  html += '<div class="eyebrow">Recherche</div><h1 class="title">Rechercher</h1>';
  html += '<input class="answer-input" style="max-width:none;text-align:left;margin:8px 0 14px;" id="search-q" placeholder="Un mot du recto ou du verso…" oninput="App.runSearch(this.value)" autocomplete="off" autocapitalize="off"/>';
  html += '<div id="search-results">' + searchResultsHtml('') + '</div>';
  return html;
}
