// Duels en « direct » : PROTOTYPE avec adversaire simulé.
// Le déroulé est celui d'une vraie partie (recherche d'un adversaire, questions
// chronométrées, points selon la rapidité, résultat, points de ligue), mais
// l'adversaire est un programme qui répond après un délai aléatoire. Une version
// réelle remplacerait ce « bot » par un autre joueur via un service temps réel.
//
// Trois formats de partie :
//   - qcm    : 5 questions à 4 choix
//   - vf     : 6 affirmations « vrai ou faux » (réponse en 6 s)
//   - medley : enchaîne QCM, vrai/faux et phrase à trous

import { state, shuffle, ensureWeek } from './state.js';
import { persist } from './storage.js';
import { DEMO_PEOPLE, LEAGUE_BOTS } from './demo.js';

export const POINTS = { win: 50, draw: 25, loss: 15 };

export const DUEL_MODES = [
  { id: 'medley', emoji: '🎲', label: 'Medley', desc: 'QCM, vrai/faux et phrases à trous enchaînés' },
  { id: 'qcm', emoji: '🧠', label: 'QCM', desc: '5 questions à 4 choix' },
  { id: 'vf', emoji: '✅', label: 'Vrai/Faux', desc: '6 affirmations en rafale' }
];

const QTIME = { qcm: 10, cloze: 12, vf: 6 };

let tickTimer = null;
let botTimer = null;
let nextTimer = null;
let stepTimers = [];
let refreshFn = function () {};

export function setRefresh(fn) { refreshFn = fn; }

function clearAll() {
  clearInterval(tickTimer);
  clearTimeout(botTimer);
  clearTimeout(nextTimer);
  stepTimers.forEach(clearTimeout);
  tickTimer = botTimer = nextTimer = null;
  stepTimers = [];
}

// Appelée dès qu'on quitte l'écran de duel : coupe tous les chronomètres.
export function stopDuel() {
  clearAll();
  state.duel = null;
}

export function eligibleDecks() {
  return state.decks.filter(d => state.cards.filter(c => c.deckId === d.id).length >= 4);
}

// Lance la mise en relation, puis la partie. 'opponent' = null pour une partie rapide
// (adversaire tiré au hasard parmi les joueurs « en ligne »), ou un ami à défier.
export function startDuel(opts) {
  clearAll();
  const decks = eligibleDecks();
  if (decks.length === 0) {
    state.duel = { phase: 'nodeck' };
    refreshFn();
    return;
  }
  const deck = (opts && opts.deckId && decks.find(d => d.id === opts.deckId)) || decks[Math.floor(Math.random() * decks.length)];
  const mode = (opts && opts.mode) || state.multiMode || 'medley';
  let opponent = opts && opts.opponent;
  const kind = opponent ? (opts.skipSearch ? 'rematch' : 'friend') : 'quick';
  if (!opponent) {
    const online = DEMO_PEOPLE.filter(p => p.online);
    opponent = online[Math.floor(Math.random() * online.length)];
  }
  state.duel = { phase: kind === 'rematch' ? 'found' : 'search', kind, mode, opponent, deckId: deck.id, deckName: deck.name };
  refreshFn();
  const wait = kind === 'rematch' ? 0 : (kind === 'friend' ? 1400 : 2400);
  stepTimers.push(setTimeout(function () {
    if (!state.duel) return;
    state.duel.phase = 'found';
    refreshFn();
    stepTimers.push(setTimeout(startMatch, 1700));
  }, wait));
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

function buildQuestions(deckId, mode) {
  const deckCards = state.cards.filter(c => c.deckId === deckId);
  const cards = shuffle(deckCards);
  if (mode === 'vf') return cards.slice(0, 6).map(c => vfQuestion(c, deckCards));
  if (mode === 'qcm') return cards.slice(0, 5).map(c => qcmQuestion(c, deckCards));
  // Medley : on alterne les formats, avec une phrase à trous quand c'est possible.
  const plan = ['qcm', 'vf', 'cloze', 'vf', 'qcm'];
  const withCloze = cards.filter(c => c.cloze);
  const used = new Set();
  return plan.map(function (type) {
    let q = null;
    if (type === 'cloze') {
      const c = withCloze.find(x => !used.has(x.id));
      if (c) { used.add(c.id); q = clozeQuestion(c, deckCards); }
    }
    const c = cards.find(x => !used.has(x.id)) || cards[0];
    if (!q) { used.add(c.id); q = type === 'vf' ? vfQuestion(c, deckCards) : qcmQuestion(c, deckCards); }
    return q;
  });
}

// ---------- Déroulé d'une partie ----------

function startMatch() {
  const d = state.duel;
  if (!d) return;
  d.questions = buildQuestions(d.deckId, d.mode);
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
  refreshFn();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 100);
  // Le « bot » répond en 1,5 s à 70 % du temps imparti ; il est juste avec une
  // probabilité qui dépend de son niveau (un peu moins en vrai/faux : 50 % au hasard).
  let skill = Math.min(0.88, 0.5 + 0.06 * d.opponent.level);
  if (qu.type === 'vf') skill = 0.5 + (skill - 0.5) * 0.8;
  clearTimeout(botTimer);
  botTimer = setTimeout(function () { botAnswer(Math.random() < skill); }, 1500 + Math.random() * (qu.time * 700 - 1500));
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

function botAnswer(correct) {
  const d = state.duel;
  if (!d || d.phase !== 'question') return;
  d.q.oppAnswered = true;
  d.q.oppCorrect = correct;
  if (correct) d.opp.score += bonus(d.q);
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
  if (d.q.oppAnswered) reveal();
  else refreshFn(); // affiche ta réponse choisie, en attendant l'adversaire
}

function reveal() {
  const d = state.duel;
  if (!d) return;
  clearInterval(tickTimer);
  clearTimeout(botTimer);
  d.phase = 'reveal';
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
  const outcome = d.me.score > d.opp.score ? 'win' : d.me.score < d.opp.score ? 'loss' : 'draw';
  const gained = POINTS[outcome];
  state.multi.weekPoints += gained;
  state.multi.total += gained;
  state.multi.played++;
  if (outcome === 'win') state.multi.wins++;
  persist();
  d.phase = 'end';
  d.result = { outcome, gained, rank: leagueTable().findIndex(r => r.me) + 1 };
  refreshFn();
}

// Classement de la semaine : joueurs fictifs + toi (à égalité, tu passes devant).
export function leagueTable() {
  ensureWeek();
  const rows = LEAGUE_BOTS.map(b => ({ name: b.name, points: b.points, me: false }));
  rows.push({ name: 'Toi', points: state.multi.weekPoints, me: true });
  rows.sort((a, b) => b.points - a.points || (a.me ? -1 : b.me ? 1 : 0));
  return rows;
}
