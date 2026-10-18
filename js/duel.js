// Duels en « direct » : PROTOTYPE avec adversaire simulé.
// Le déroulé est celui d'une vraie partie (recherche d'un adversaire, questions
// chronométrées, points selon la rapidité, résultat, points de ligue), mais
// l'adversaire est un programme qui répond après un délai aléatoire. Une version
// réelle remplacerait ce « bot » par un autre joueur via un service temps réel.
//
// Trois formats de partie :
//   - qcm    : 5 questions à 4 choix
//   - vf     : 6 affirmations « vrai ou faux » (réponse en 6 s)
//   - match  : course d'appariement, 3 manches de 4 paires à relier
//   - medley : enchaîne QCM, vrai/faux, phrase à trous et appariement

import { state, shuffle, ensureWeek, todayStr, treeCards } from './state.js';
import { persist } from './storage.js';
import { DEMO_PEOPLE } from './demo.js';
import { LEVELS, parseLeague, leagueLabel, leagueItems, ensureSeason, standings, addDailyPlay } from './leagues.js';

export const POINTS = { win: 50, draw: 25, loss: 15 };

export const DUEL_MODES = [
  { id: 'medley', emoji: '🎲', label: 'Medley', desc: 'QCM et vrai/faux enchaînés' },
  { id: 'qcm', emoji: '🧠', label: 'QCM', desc: '5 questions à 4 choix' },
  { id: 'vf', emoji: '✅', label: 'Vrai/Faux', desc: '6 affirmations en rafale' }
];

const QTIME = { qcm: 10, cloze: 12, vf: 6, match: 25 };

let tickTimer = null;
let botTimer = null;
let nextTimer = null;
let stepTimers = [];
let roomTimers = [];
let refreshFn = function () {};

export function setRefresh(fn) { refreshFn = fn; }

// Nombre de questions : un des nombres cochés dans « Format du duel », tiré au hasard.
function pickLength() {
  const l = state.multiLengths && state.multiLengths.length ? state.multiLengths : [5];
  return l[Math.floor(Math.random() * l.length)];
}

function clearAll() {
  clearInterval(tickTimer);
  clearTimeout(botTimer);
  clearTimeout(nextTimer);
  stepTimers.forEach(clearTimeout);
  tickTimer = botTimer = nextTimer = null;
  stepTimers = [];
  roomTimers.forEach(clearTimeout);
  roomTimers = [];
}

// Appelée dès qu'on quitte l'écran de duel : coupe tous les chronomètres.
export function stopDuel() {
  clearAll();
  state.duel = null;
}

// Un paquet peut servir de thème s'il a au moins 4 cartes, sous-paquets compris.
export function eligibleDecks() {
  return state.decks.filter(d => treeCards(d.id).length >= 4);
}

// Lance la mise en relation, puis la partie.
// opts.league : identifiant de ligue ('marketing:moyen') -> questions communes à tous les joueurs ;
//   sans ligue, le duel est un entraînement sur tes propres cartes (opts.deckId ou paquet au hasard).
// opts.ranked : les points comptent pour la ligue (sinon combat amical : aucun point).
// opts.opponent : un ami à défier ; sinon adversaire tiré au hasard parmi les joueurs « en ligne ».
export function startDuel(opts) {
  clearAll();
  opts = opts || {};
  let deck = null;
  if (!opts.league) {
    const decks = eligibleDecks();
    if (decks.length === 0) {
      state.duel = { phase: 'nodeck' };
      refreshFn();
      return;
    }
    deck = (opts.deckId && decks.find(d => d.id === opts.deckId)) || decks[Math.floor(Math.random() * decks.length)];
  }
  // Format : celui demandé, sinon un des formats cochés dans l'écran Arène, tiré au hasard.
  const modes = state.multiModes && state.multiModes.length ? state.multiModes : ['medley'];
  const mode = opts.mode || modes[Math.floor(Math.random() * modes.length)];
  const count = opts.count || pickLength();
  let opponent = opts.opponent;
  const kind = opponent ? (opts.skipSearch ? 'rematch' : 'friend') : 'quick';
  if (!opponent) {
    const online = DEMO_PEOPLE.filter(p => p.online);
    opponent = online[Math.floor(Math.random() * online.length)];
  }
  state.duel = { phase: kind === 'rematch' ? 'found' : 'search', kind, mode, count, opponent, ranked: !!opts.ranked,
    leagueId: opts.league || '', deckId: deck ? deck.id : '', deckName: opts.league ? leagueLabel(opts.league) : deck.name, daily: !!opts.daily };
  refreshFn();
  const wait = kind === 'rematch' ? 0 : (kind === 'friend' ? 1400 : 2400);
  stepTimers.push(setTimeout(function () {
    if (!state.duel) return;
    state.duel.phase = 'found';
    refreshFn();
    stepTimers.push(setTimeout(startMatch, 1700));
  }, wait));
}

// Combat de salon : plusieurs amis (simulés) répondent aux mêmes questions en même temps. Aucun point.
export function startRoom(opts) {
  clearAll();
  const modes = state.multiModes && state.multiModes.length ? state.multiModes : ['medley'];
  const mode = opts.mode || modes[Math.floor(Math.random() * modes.length)];
  const count = opts.count || pickLength();
  state.duel = { phase: 'found', kind: 'room', room: true, mode, count, ranked: false, leagueId: opts.league, deckId: '', deckName: leagueLabel(opts.league),
    others: opts.players.map(p => ({ name: p.name, level: p.level, score: 0 })), opponent: null };
  refreshFn();
  stepTimers.push(setTimeout(startMatch, 2000));
}

// ---------- Fabrication des questions ----------

function otherBacks(card, deckCards) {
  let pool = deckCards.filter(c => c.id !== card.id && c.back !== card.back);
  if (pool.length < 3) pool = pool.concat(state.cards.filter(c => c.deckId !== card.deckId && c.back !== card.back));
  return Array.from(new Set(pool.map(c => c.back)));
}

function qcmQuestion(card, deckCards) {
  const options = shuffle([card.back].concat(shuffle(otherBacks(card, deckCards)).slice(0, 3)));
  return { type: 'qcm', label: 'QCM', front: card.front, sub: '', options, correct: options.indexOf(card.back), time: QTIME.qcm };
}

function vfQuestion(card, deckCards) {
  const isTrue = Math.random() < 0.5;
  const wrong = shuffle(otherBacks(card, deckCards))[0];
  const shown = isTrue || !wrong ? card.back : wrong;
  const trulyTrue = shown === card.back;
  return { type: 'vf', label: 'Vrai ou faux ?', front: card.front, sub: '→ ' + shown, options: ['Vrai', 'Faux'], correct: trulyTrue ? 0 : 1, time: QTIME.vf };
}

// Phrase à trous : possible si la carte en a une et si le paquet a assez de mots à proposer.
function clozeQuestion(card, deckCards) {
  const answers = Array.from(new Set(deckCards.filter(c => c.cloze && c.cloze.answer !== card.cloze.answer).map(c => c.cloze.answer)));
  if (answers.length < 3) return null;
  const options = shuffle([card.cloze.answer].concat(shuffle(answers).slice(0, 3)));
  return { type: 'cloze', label: 'Complète la phrase', front: card.cloze.text, sub: 'Indice : ' + card.back, options, correct: options.indexOf(card.cloze.answer), time: QTIME.cloze };
}

// Manche d'appariement : 4 paires à relier (cartes tirées au sort dans le paquet).
function matchQuestion(picked) {
  return { type: 'match', label: 'Relie les paires', front: '', sub: '', options: [], correct: -1,
    pairs: picked.map(c => ({ front: c.front, back: c.back })), time: QTIME.match };
}

// Questions d'une ligue : les mêmes pour tous les joueurs (tirées de la banque commune du thème).
// n questions ; si la banque d'exemple est plus courte, elle est reparcourue dans un autre ordre.
// Chaque question garde sa bonne réponse (ans) : elle sert à « ajouter les questions ratées à mes cartes ».
function bankQuestions(leagueId, mode, n) {
  const bank = leagueItems(leagueId);
  let items = [];
  while (items.length < n) items = items.concat(shuffle(bank));
  items = items.slice(0, n);
  const qcm = function (it) {
    const options = shuffle(it.slice(1));
    return { type: 'qcm', label: 'QCM', front: it[0], sub: '', options, correct: options.indexOf(it[1]), time: QTIME.qcm, ans: it[1] };
  };
  const vf = function (it) {
    const isTrue = Math.random() < 0.5;
    const shown = isTrue ? it[1] : shuffle(it.slice(2))[0];
    return { type: 'vf', label: 'Vrai ou faux ?', front: it[0], sub: '→ ' + shown, options: ['Vrai', 'Faux'], correct: isTrue ? 0 : 1, time: QTIME.vf, ans: it[1] };
  };
  if (mode === 'vf') return items.map(vf);
  if (mode === 'qcm') return items.map(qcm);
  return items.map((it, i) => (i % 2 === 1 ? vf(it) : qcm(it)));
}

function buildQuestions(deckId, mode) {
  const deckCards = treeCards(deckId);
  const cards = shuffle(deckCards);
  if (mode === 'vf') return cards.slice(0, 6).map(c => vfQuestion(c, deckCards));
  if (mode === 'qcm') return cards.slice(0, 5).map(c => qcmQuestion(c, deckCards));
  if (mode === 'match') {
    // 3 manches ; si le paquet est petit, les cartes sont mélangées à nouveau pour chaque manche.
    return [0, 1, 2].map(() => matchQuestion(shuffle(deckCards).slice(0, 4)));
  }
  // Medley : on alterne les formats, avec une phrase à trous quand c'est possible.
  const plan = ['qcm', 'vf', 'cloze', 'vf', 'match'];
  const withCloze = cards.filter(c => c.cloze);
  const used = new Set();
  return plan.map(function (type) {
    let q = null;
    if (type === 'cloze') {
      const c = withCloze.find(x => !used.has(x.id));
      if (c) { used.add(c.id); q = clozeQuestion(c, deckCards); }
    }
    if (type === 'match') return matchQuestion(shuffle(deckCards).slice(0, 4));
    const c = cards.find(x => !used.has(x.id)) || cards[0];
    if (!q) { used.add(c.id); q = type === 'vf' ? vfQuestion(c, deckCards) : qcmQuestion(c, deckCards); }
    return q;
  });
}

// ---------- Déroulé d'une partie ----------

function startMatch() {
  const d = state.duel;
  if (!d) return;
  d.questions = d.leagueId ? bankQuestions(d.leagueId, d.mode, d.count || 5) : buildQuestions(d.deckId, d.mode);
  d.missed = [];
  d.index = 0;
  d.me = { score: 0 };
  d.opp = { score: 0 };
  startQuestion();
}

function startQuestion() {
  const d = state.duel;
  if (!d) return;
  const qu = d.questions[d.index];
  d.phase = 'question';
  d.q = { time: qu.time, timeLeft: qu.time, meAnswered: false, meIdx: null, meCorrect: false, oppAnswered: false, oppCorrect: false };
  if (d.room) d.q.others = d.others.map(() => ({ answered: false, correct: false }));
  if (qu.type === 'match') {
    const idx = qu.pairs.map((_, i) => i);
    d.q.match = { left: shuffle(idx), right: shuffle(idx), done: idx.map(() => false), selL: null, selR: null, wrong: null, count: 0 };
  }
  refreshFn();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 100);
  const lvl = d.leagueId ? parseLeague(d.leagueId) : null;
  const levelSkill = lvl ? lvl.level.skill : 1;
  if (d.room) {
    // Chaque ami simulé répond à son rythme, avec une chance d'avoir juste selon son niveau.
    d.others.forEach(function (o, i) {
      let sk = Math.min(0.88, 0.5 + 0.06 * o.level) * levelSkill;
      if (qu.type === 'vf') sk = 0.5 + (sk - 0.5) * 0.8;
      roomTimers[i] = setTimeout(function () { roomAnswer(i, Math.random() < sk); }, 1500 + Math.random() * (qu.time * 700 - 1500));
    });
    return;
  }
  // Le « bot » répond en 1,5 s à 70 % du temps imparti ; il est juste avec une
  // probabilité qui dépend de son niveau (un peu moins en vrai/faux : 50 % au hasard).
  let skill = Math.min(0.88, 0.5 + 0.06 * d.opponent.level) * levelSkill;
  if (qu.type === 'vf') skill = 0.5 + (skill - 0.5) * 0.8;
  clearTimeout(botTimer);
  if (qu.type === 'match') {
    // Plus le bot est fort, plus il termine tôt (entre 20 % et 75 % du temps).
    botTimer = setTimeout(function () { botAnswer(true); }, qu.time * 1000 * (0.9 - skill * 0.5 + Math.random() * 0.25));
    return;
  }
  botTimer = setTimeout(function () { botAnswer(Math.random() < skill); }, 1500 + Math.random() * (qu.time * 700 - 1500));
}

// Manche d'appariement terminée en entier : 200 points + bonus de rapidité (jusqu'à 100).
function matchFull(q) {
  return 200 + Math.round(Math.max(q.timeLeft, 0) / q.time * 100);
}

// Relier une paire : on touche un élément à gauche puis son équivalent à droite.
export function pickMatch(side, idx) {
  const d = state.duel;
  if (!d || d.phase !== 'question' || d.q.meAnswered) return;
  const qu = d.questions[d.index];
  if (qu.type !== 'match') return;
  const m = d.q.match;
  const pairIdx = side === 'L' ? m.left[idx] : m.right[idx];
  if (m.done[pairIdx]) return;
  if (side === 'L') m.selL = m.selL === idx ? null : idx; else m.selR = m.selR === idx ? null : idx;
  if (m.selL !== null && m.selR !== null) {
    if (m.left[m.selL] === m.right[m.selR]) {
      m.done[m.left[m.selL]] = true;
      m.count++;
      m.selL = m.selR = null;
      m.wrong = null;
      if (m.count === qu.pairs.length) {
        d.q.meAnswered = true;
        d.q.meCorrect = true;
        d.me.score += matchFull(d.q);
        if (d.q.oppAnswered) { reveal(); return; }
      }
    } else {
      m.wrong = { l: m.selL, r: m.selR };
      m.selL = m.selR = null;
      refreshFn();
      setTimeout(function () { if (state.duel === d && d.q && d.q.match === m) { m.wrong = null; refreshFn(); } }, 450);
      return;
    }
  }
  refreshFn();
}

function bonus(q) {
  return 100 + Math.round(Math.max(q.timeLeft, 0) / q.time * 100);
}

function paint() {
  const d = state.duel;
  if (!d || !d.q) return;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('duel-timer-fill', el => { el.style.width = Math.max(0, d.q.timeLeft / d.q.time * 100) + '%'; });
  set('duel-timer-num', el => { el.textContent = Math.ceil(Math.max(0, d.q.timeLeft)); });
  set('duel-score-me', el => { el.textContent = d.me.score; });
  if (d.room) {
    d.others.forEach((o, i) => set('room-score-' + i, el => { el.textContent = o.score; }));
    set('duel-opp-status', el => { const n = d.q.others.filter(x => x.answered).length; el.textContent = n + ' / ' + d.others.length + ' ont répondu'; });
    return;
  }
  set('duel-score-opp', el => { el.textContent = d.opp.score; });
  set('duel-opp-status', el => { el.textContent = d.q.oppAnswered ? d.opponent.name + ' a répondu ✓' : d.opponent.name + ' réfléchit…'; });
}

function tick() {
  const d = state.duel;
  if (!d || state.view !== 'duel' || d.phase !== 'question') { clearInterval(tickTimer); return; }
  d.q.timeLeft -= 0.1;
  paint();
  if (d.q.timeLeft <= 0) reveal();
}

// Un ami simulé du salon répond.
function roomAnswer(i, correct) {
  const d = state.duel;
  if (!d || !d.room || d.phase !== 'question' || d.q.others[i].answered) return;
  d.q.others[i].answered = true;
  d.q.others[i].correct = correct;
  if (correct) d.others[i].score += bonus(d.q);
  paint();
  if (d.q.meAnswered && d.q.others.every(x => x.answered)) reveal();
}

function botAnswer(correct) {
  const d = state.duel;
  if (!d || d.phase !== 'question') return;
  d.q.oppAnswered = true;
  d.q.oppCorrect = correct;
  if (correct) d.opp.score += d.questions[d.index].type === 'match' ? matchFull(d.q) : bonus(d.q);
  paint();
  if (d.q.meAnswered) reveal();
}

export function answer(i) {
  const d = state.duel;
  if (!d || d.phase !== 'question' || d.q.meAnswered) return;
  const question = d.questions[d.index];
  d.q.meAnswered = true;
  d.q.meIdx = i;
  d.q.meCorrect = i === question.correct;
  if (d.q.meCorrect) d.me.score += bonus(d.q);
  if (d.room ? d.q.others.every(x => x.answered) : d.q.oppAnswered) reveal();
  else refreshFn(); // affiche ta réponse choisie, en attendant l'adversaire
}

function reveal() {
  const d = state.duel;
  if (!d) return;
  clearInterval(tickTimer);
  clearTimeout(botTimer);
  d.phase = 'reveal';
  const qq = d.questions[d.index];
  if (qq.ans && !d.q.meCorrect && !d.q.missedLogged) { d.q.missedLogged = true; d.missed.push({ front: qq.front, back: qq.ans }); }
  // Manche d'appariement non terminée à temps : points partiels, 40 par paire reliée.
  if (!d.room && d.questions[d.index].type === 'match') {
    if (!d.q.meAnswered) d.me.score += d.q.match.count * 40;
    if (!d.q.oppAnswered) d.opp.score += 80;
  }
  refreshFn();
  nextTimer = setTimeout(function () {
    if (!state.duel) return;
    if (d.index + 1 < d.questions.length) { d.index++; startQuestion(); }
    else endMatch();
  }, 1700);
}

function endMatch() {
  const d = state.duel;
  if (!d) return;
  ensureWeek();
  ensureSeason();
  if (d.room) {
    // Classement du salon : toi + les amis, du meilleur score au moins bon. Pas de points.
    const board = [{ name: state.profile.pseudo, score: d.me.score, me: true }].concat(d.others.map(o => ({ name: o.name, score: o.score, me: false })));
    board.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
    d.phase = 'end';
    d.result = { room: true, board, outcome: board[0].me ? 'win' : 'loss', rank: board.findIndex(r => r.me) + 1, gained: 0, dailyBonus: 0 };
    refreshFn();
    return;
  }
  const outcome = d.me.score > d.opp.score ? 'win' : d.me.score < d.opp.score ? 'loss' : 'draw';
  let gained = 0;
  let rank = 0;
  // Seul un duel classé dans une ligue rapporte des points (les mêmes dans toutes les ligues :
  // chaque niveau a déjà son propre classement, inutile de les pondérer).
  if (d.ranked && d.leagueId) {
    gained = POINTS[outcome];
    addDailyPlay(d.leagueId);
    const st = state.multi.leagues[d.leagueId] || { points: 0, played: 0, wins: 0 };
    st.points += gained; st.played++; if (outcome === 'win') st.wins++;
    state.multi.leagues[d.leagueId] = st;
    state.multi.weekPoints += gained;
    state.multi.total += gained;
    state.multi.played++;
    if (outcome === 'win') state.multi.wins++;
    rank = standings(d.leagueId).findIndex(r => r.me) + 1;
  }
  // Défi du jour : bonus de 20 points d'arène, une seule fois par jour.
  let dailyBonus = 0;
  if (d.daily && state.meta.dailyDone !== todayStr()) { dailyBonus = 20; state.meta.dailyDone = todayStr(); state.multi.weekPoints += dailyBonus; state.multi.total += dailyBonus; }
  persist();
  d.phase = 'end';
  d.result = { outcome, gained, dailyBonus, rank, ranked: d.ranked && !!d.leagueId };
  refreshFn();
}
