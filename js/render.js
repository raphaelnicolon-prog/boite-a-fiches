// Ce fichier ne fait qu'une chose : à partir de l'état actuel (state), produire
// le HTML à afficher. Aucune de ces fonctions ne modifie les données — c'est
// app.js qui s'en charge, puis qui rappelle render() pour rafraîchir l'écran.

import {
  state, MODES, SPEAK_LANGS, TRASH_DAYS, esc, colorVar, decksOf, cardsOf, dueCards, dueInRubrique,
  allDueCards, seedData, GOAL_CHOICES, reviewedToday, currentStreak, last7Days
} from './state.js';

export function render() {
  const app = document.getElementById('app');
  if (state.view === 'home') app.innerHTML = renderHome();
  else if (state.view === 'rubrique') app.innerHTML = renderRubrique();
  else if (state.view === 'modes') app.innerHTML = renderModes();
  else if (state.view === 'cards') app.innerHTML = renderCards();
  else if (state.view === 'trash') app.innerHTML = renderTrash();
  else if (state.view === 'settings') app.innerHTML = renderSettings();
  else if (state.view === 'session') app.innerHTML = renderSession();
  if (state.showAddRubrique) app.insertAdjacentHTML('beforeend', renderRubriqueModal(null));
  if (state.showEditRubrique) app.insertAdjacentHTML('beforeend', renderRubriqueModal(state.editingRubriqueId));
  if (state.showAddDeck) app.insertAdjacentHTML('beforeend', renderDeckModal(null));
  if (state.showEditDeck) app.insertAdjacentHTML('beforeend', renderDeckModal(state.editingDeckId));
  if (state.showAddCard) app.insertAdjacentHTML('beforeend', renderCardModal(null));
  if (state.showEditCard) app.insertAdjacentHTML('beforeend', renderCardModal(state.editingCardId));
  if (state.showBulk) app.insertAdjacentHTML('beforeend', renderBulkModal());
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
  html += '<div class="eyebrow" style="margin:0 0 8px;">Mes données</div><div class="settings-group">'
    + settingsRow('💾', 'Exporter mes fiches', 'Crée un fichier de sauvegarde', 'App.exportData()')
    + settingsRow('📥', 'Importer une sauvegarde', 'Remplace tes données par celles d\'un fichier', 'document.getElementById(\'import-file\').click()')
    + settingsRow('🗑️', 'Supprimé récemment', state.trash.length ? state.trash.length + ' élément(s) récupérable(s) pendant ' + TRASH_DAYS + ' jours' : 'Rien pour l\'instant', 'App.openTrash()')
    + '</div><input type="file" id="import-file" accept=".json,application/json" style="display:none;" onchange="App.importFile(this)"/>';
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
  return '<div class="stat-card"><div class="row between"><div><div class="mode-title">' + title + '</div><div class="mode-desc">' + msg + '</div></div>'
    + '<div class="week-dots">' + dots + '</div></div>'
    + '<div class="goal-bar"><div class="goal-fill' + (done >= goal ? ' full' : '') + '" style="width:' + pct + '%;"></div></div></div>';
}

// ---------- ACCUEIL ----------
function renderHome() {
  const totalDue = allDueCards().length;
  const visibleRubs = state.rubriques.filter(r => !r.hidden).sort((a, b) => a.order - b.order);
  const hiddenRubs = state.rubriques.filter(r => r.hidden);

  let html = '<div class="row between" style="align-items:flex-start;"><div><div class="eyebrow">Boîte à Fiches</div><h1 class="title">Ton espace de révision</h1></div>'
    + '<button class="icon-btn" onclick="App.openSettings()" aria-label="Réglages">' + GEAR_ICON + '</button></div>';
  html += '<div class="subtitle">' + (totalDue > 0 ? totalDue + ' carte(s) à revoir aujourd\'hui, tous paquets confondus.' : 'Rien à revoir aujourd\'hui.') + '</div>';
  html += renderStreakCard();

  if (totalDue > 0) {
    html += '<button class="card" style="width:100%;text-align:left;border:none;cursor:pointer;" onclick="App.startFlash(null,null,\'all-due\')">'
      + '<div class="row between"><div><div class="mode-title" style="color:var(--primary);">▶ Reprendre</div><div class="mode-desc">' + totalDue + ' carte(s) prêtes, toutes rubriques</div></div><span class="chev" style="color:var(--primary);">›</span></div></button>';
  }

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
  if (decks.length === 0) { html += '<div class="subtitle">Aucun paquet ici pour l\'instant — crée le premier.</div>'; }
  decks.forEach(function (d) {
    const due = dueCards(d.id).length;
    const total = cardsOf(d.id).length;
    html += '<div class="deck-card" onclick="App.openDeck(\'' + d.id + '\')" style="cursor:pointer;">'
      + '<div class="deck-top" style="background:' + colorVar(r.color) + ';"></div>'
      + '<div class="row between"><div><div class="rub-name">' + esc(d.name) + '</div>'
      + '<div class="rub-meta">' + (total === 0 ? 'vide' : (due + ' / ' + total + ' à revoir')) + '</div></div>'
      + '<div class="row">'
      + '<button class="hidebtn" onclick="event.stopPropagation();App.openEditDeck(\'' + d.id + '\')">modifier</button>'
      + '<button class="hidebtn" onclick="event.stopPropagation();App.deleteDeck(\'' + d.id + '\')">supprimer</button>'
      + '<span class="chev">›</span>'
      + '</div></div></div>';
  });
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
    + '</div><button class="backbtn" onclick="App.openDeck(\'' + deckId + '\')" style="margin-top:16px;">‹ Annuler</button></div>';
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
    + '<div class="qtext">' + esc(card.front) + '</div>'
    + speakButton(card)
    + (!s.texteRevealed
      ? '<input class="answer-input" id="texte-input" placeholder="Ta réponse" value="' + esc(s.texteInput || '') + '" oninput="App.setTexteInput(this.value)" autocomplete="off" autocapitalize="off" spellcheck="false"/>'
        + '<button class="btn" style="margin-top:14px;" onclick="App.checkTexte()">Vérifier</button>'
      : '<div class="result-banner ' + (s.texteCorrect ? 'ok' : 'ko') + '">' + (s.texteCorrect ? 'Correct !' : 'Réponse attendue : ' + esc(card.back)) + '</div>'
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
    + '<button class="btn" onclick="App.backHome()">Retour à l\'accueil</button></div>';
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
