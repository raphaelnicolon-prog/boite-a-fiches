// Duel de QCM en « direct » : PROTOTYPE avec adversaire simulé.
// Le déroulé est celui d'une vraie partie (recherche d'un adversaire, 5 questions
// chronométrées, points selon la rapidité, résultat, points de ligue), mais
// l'adversaire est un programme qui répond après un délai aléatoire. Une version
// réelle remplacerait ce « bot » par un autre joueur via un service temps réel.

import { state, shuffle, ensureWeek } from './state.js';
import { persist } from './storage.js';
import { DEMO_PEOPLE, LEAGUE_BOTS } from './demo.js';

export const QUESTIONS = 5;
export const TIME = 10;                  // secondes par question
export const POINTS = { win: 50, draw: 25, loss: 15 };

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
  let opponent = opts && opts.opponent;
  const kind = opponent ? (opts.skipSearch ? 'rematch' : 'friend') : 'quick';
  if (!opponent) {
    const online = DEMO_PEOPLE.filter(p => p.online);
    opponent = online[Math.floor(Math.random() * online.length)];
  }
  state.duel = { phase: kind === 'rematch' ? 'found' : 'search', kind, opponent, deckId: deck.id, deckName: deck.name };
  refreshFn();
  const wait = kind === 'rematch' ? 0 : (kind === 'friend' ? 1400 : 2400);
  stepTimers.push(setTimeout(function () {
    if (!state.duel) return;
    state.duel.phase = 'found';
    refreshFn();
    stepTimers.push(setTimeout(startMatch, 1700));
  }, wait));
}

function buildQuestions(deckId) {
  const deckCards = state.cards.filter(c => c.deckId === deckId);
  return shuffle(deckCards).slice(0, QUESTIONS).map(function (card) {
    let pool = deckCards.filter(c => c.id !== card.id && c.back !== card.back);
    if (pool.length < 3) pool = pool.concat(state.cards.filter(c => c.deckId !== deckId && c.back !== card.back));
    const wrong = shuffle(Array.from(new Set(pool.map(c => c.back)))).slice(0, 3);
    const options = shuffle([card.back].concat(wrong));
    return { front: card.front, options, correct: options.indexOf(card.back) };
  });
}

function startMatch() {
  const d = state.duel;
  if (!d) return;
  d.questions = buildQuestions(d.deckId);
  d.index = 0;
  d.me = { score: 0 };
  d.opp = { score: 0 };
  startQuestion();
}

function startQuestion() {
  const d = state.duel;
  if (!d) return;
  d.phase = 'question';
  d.q = { timeLeft: TIME, meAnswered: false, meIdx: null, meCorrect: false, oppAnswered: false, oppCorrect: false };
  refreshFn();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, 100);
  // Le « bot » répond au bout de 1,5 à 7 s, juste avec une probabilité qui dépend de son niveau.
  const skill = Math.min(0.88, 0.5 + 0.06 * d.opponent.level);
  clearTimeout(botTimer);
  botTimer = setTimeout(function () { botAnswer(Math.random() < skill); }, 1500 + Math.random() * 5500);
}

function bonus(q) {
  return 100 + Math.round(Math.max(q.timeLeft, 0) * 10);
}

function paint() {
  const d = state.duel;
  if (!d || !d.q) return;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('duel-timer-fill', el => { el.style.width = Math.max(0, d.q.timeLeft / TIME * 100) + '%'; });
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
