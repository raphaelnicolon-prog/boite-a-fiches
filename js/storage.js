// Sauvegarde des données dans le navigateur (localStorage), pour qu'elles
// restent là après avoir fermé l'appli — même hors-ligne.
//
// Note pour toi : localStorage est propre à CHAQUE navigateur/appareil.
// Tant qu'on n'a pas ajouté de compte + synchronisation en ligne, tes fiches
// créées sur ton téléphone ne se voient pas automatiquement sur ton ordinateur.

import { state, seedData, todayStr, CALM_COLORS, INTERVALS, SPEAK_LANGS, TRASH_DAYS, GOAL_CHOICES } from './state.js';

const STORAGE_KEY = 'boite-fiches-data-v1';

// Remet en forme des statistiques lues dans le stockage ou dans un fichier
// importé : objectif parmi les valeurs autorisées, jours au format AAAA-MM-JJ
// avec un nombre entier positif, et on ne garde que les ~400 derniers jours.
export function sanitizeStats(raw) {
  const stats = { goal: 10, days: {} };
  if (!raw || typeof raw !== 'object') return stats;
  if (GOAL_CHOICES.includes(raw.goal)) stats.goal = raw.goal;
  if (raw.days && typeof raw.days === 'object') {
    Object.keys(raw.days).sort().slice(-400).forEach(function (k) {
      const n = raw.days[k];
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isInteger(n) && n > 0 && n < 100000) stats.days[k] = n;
    });
  }
  return stats;
}

export function sanitizeMeta(raw) {
  const m = { premium: false, aiDays: {}, aiTotal: 0, welcomed: false, haptics: true, dailyDone: '', reminder: { on: false, time: '18:00' } };
  if (!raw || typeof raw !== 'object') return m;
  m.premium = raw.premium === true;
  m.welcomed = raw.welcomed === true;
  m.haptics = raw.haptics !== false;
  if (typeof raw.dailyDone === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dailyDone)) m.dailyDone = raw.dailyDone;
  if (raw.reminder && typeof raw.reminder === 'object') {
    m.reminder.on = raw.reminder.on === true;
    if (typeof raw.reminder.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.reminder.time)) m.reminder.time = raw.reminder.time;
  }
  if (Number.isInteger(raw.aiTotal) && raw.aiTotal >= 0) m.aiTotal = raw.aiTotal;
  if (raw.aiDays && typeof raw.aiDays === 'object') {
    Object.keys(raw.aiDays).sort().slice(-30).forEach(function (k) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isInteger(raw.aiDays[k]) && raw.aiDays[k] >= 0) m.aiDays[k] = raw.aiDays[k];
    });
  }
  return m;
}
export function sanitizeProfile(raw) {
  const p = { pseudo: 'Toi', avatar: '🙂' };
  if (!raw || typeof raw !== 'object') return p;
  if (typeof raw.pseudo === 'string' && raw.pseudo.trim().length >= 2 && raw.pseudo.trim().length <= 16) p.pseudo = raw.pseudo.trim();
  if (typeof raw.avatar === 'string' && raw.avatar.trim().length > 0 && raw.avatar.trim().length <= 8) p.avatar = raw.avatar.trim();
  return p;
}
export function sanitizeMulti(raw) {
  const m = { weekKey: '', weekPoints: 0, total: 0, played: 0, wins: 0 };
  if (!raw || typeof raw !== 'object') return m;
  ['weekPoints', 'total', 'played', 'wins'].forEach(k => { if (Number.isInteger(raw[k]) && raw[k] >= 0) m[k] = raw[k]; });
  if (typeof raw.weekKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.weekKey)) m.weekKey = raw.weekKey;
  return m;
}
export function sanitizeSocial(raw) {
  const s = { friends: [], pending: {} };
  if (raw && Array.isArray(raw.friends)) s.friends = raw.friends.filter(n => typeof n === 'string' && n.length > 0 && n.length <= 30).slice(0, 50);
  return s;
}

// Les « sections » d'un paquet (version 39) sont devenues de vrais sous-paquets : on convertit
// d'anciennes données (ou sauvegardes) une fois, sans rien perdre. Retourne true si on a converti.
export function migrateSections(p) {
  let changed = false;
  const extra = [];
  p.decks.forEach(function (d) {
    if (!d || !Array.isArray(d.folders)) return;
    d.folders.forEach(function (f, i) {
      if (!f || typeof f.id !== 'string') return;
      extra.push({ id: f.id, name: f.name, rubriqueId: d.rubriqueId, parentId: d.id, order: i, speakLang: d.speakLang });
      p.cards.forEach(function (c) { if (c && c.deckId === d.id && c.folderId === f.id) { c.deckId = f.id; } });
    });
    delete d.folders;
    changed = true;
  });
  p.cards.forEach(function (c) { if (c && 'folderId' in c) { delete c.folderId; changed = true; } });
  extra.forEach(e => p.decks.push(e));
  return changed;
}

export function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.rubriques && p.decks && p.cards) {
        const migrated = migrateSections(p);
        state.rubriques = p.rubriques;
        state.decks = p.decks;
        state.cards = p.cards;
        // Données enregistrées avant l'arrivée de la lecture audio : le paquet
        // d'italien de départ est réglé sur la voix italienne.
        state.decks.forEach(d => { if (d.id === 'd-it' && d.speakLang === undefined) d.speakLang = 'it-IT'; });
        // Corbeille : on efface pour de bon ce qui a plus de TRASH_DAYS jours.
        const limit = Date.now() - TRASH_DAYS * 24 * 3600 * 1000;
        state.trash = Array.isArray(p.trash) ? p.trash.filter(t => t && Date.parse(t.deletedAt) > limit) : [];
        state.stats = sanitizeStats(p.stats);
        state.meta = sanitizeMeta(p.meta);
        state.multi = sanitizeMulti(p.multi);
        state.social = sanitizeSocial(p.social);
        state.profile = sanitizeProfile(p.profile);
        if (migrated) persist();
        return;
      }
    }
  } catch (e) {
    console.error('Lecture des données impossible, on repart des données de départ.', e);
  }
  const s = seedData();
  state.rubriques = s.rubriques;
  state.decks = s.decks;
  state.cards = s.cards;
  state.trash = [];
  state.stats = sanitizeStats(null);
  state.meta = sanitizeMeta(null);
  state.multi = sanitizeMulti(null);
  state.social = sanitizeSocial(null);
  state.profile = sanitizeProfile(null);
  persist();
}

export function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rubriques: state.rubriques,
      decks: state.decks,
      cards: state.cards,
      trash: state.trash,
      stats: state.stats,
      meta: state.meta,
      multi: state.multi,
      profile: state.profile,
      social: { friends: state.social.friends }
    }));
  } catch (e) {
    console.error('Erreur de sauvegarde (stockage plein ou navigateur en mode privé ?)', e);
  }
}

// ---------- Sauvegarde / restauration (fichier .json) ----------

export function buildBackupJson() {
  return JSON.stringify({
    app: 'boite-a-fiches',
    version: 1,
    exportedAt: new Date().toISOString(),
    rubriques: state.rubriques,
    decks: state.decks,
    cards: state.cards,
    stats: state.stats
  }, null, 2);
}

// Les identifiants sont collés tels quels dans des onclick="..." générés par
// render.js : un fichier importé pourrait y glisser du code. On n'accepte donc
// que des identifiants "sages" (lettres, chiffres, - et _), et on reconstruit
// chaque objet champ par champ au lieu de recopier ce que contient le fichier.
const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const isStr = v => typeof v === 'string';
const isId = v => isStr(v) && SAFE_ID.test(v);

export function parseBackup(text) {
  let p;
  try { p = JSON.parse(text); }
  catch (e) { return { ok: false, error: 'Ce fichier n’est pas lisible : ce n’est pas une sauvegarde de la Boîte à Fiches.' }; }
  if (!p || !Array.isArray(p.rubriques) || !Array.isArray(p.decks) || !Array.isArray(p.cards)) {
    return { ok: false, error: 'Ce fichier ne ressemble pas à une sauvegarde de la Boîte à Fiches.' };
  }

  migrateSections(p);
  const colorKeys = Object.keys(CALM_COLORS);
  const seen = new Set();
  const rubriques = [];
  p.rubriques.forEach(function (r, i) {
    if (!r || !isId(r.id) || !isStr(r.name) || !r.name.trim() || seen.has(r.id)) return;
    seen.add(r.id);
    rubriques.push({
      id: r.id,
      name: r.name.trim().slice(0, 80),
      emoji: isStr(r.emoji) ? r.emoji.trim().slice(0, 8) : '',
      color: colorKeys.includes(r.color) ? r.color : 'slate',
      order: Number.isFinite(r.order) ? r.order : i,
      hidden: !!r.hidden,
      isDefault: !!r.isDefault
    });
  });

  const rubIds = new Set(rubriques.map(r => r.id));
  const deckIds = new Set();
  const decks = [];
  p.decks.forEach(function (d) {
    if (!d || !isId(d.id) || !isStr(d.name) || !d.name.trim() || !rubIds.has(d.rubriqueId) || deckIds.has(d.id)) return;
    deckIds.add(d.id);
    decks.push(Object.assign({ id: d.id, name: d.name.trim().slice(0, 120), rubriqueId: d.rubriqueId, speakLang: SPEAK_LANGS.some(l => l.code === d.speakLang) ? d.speakLang : '' },
      Number.isFinite(d.order) ? { order: d.order } : {},
      isId(d.parentId) ? { parentId: d.parentId } : {}));
  });

  // parentId : doit désigner un autre paquet de la même rubrique, sans boucle ; sinon le paquet remonte à la racine.
  const byId = new Map(decks.map(d => [d.id, d]));
  decks.forEach(function (d) {
    if (!d.parentId) return;
    const par = byId.get(d.parentId);
    let ok = !!par && par.id !== d.id && par.rubriqueId === d.rubriqueId;
    for (let cur = par, n = 0; ok && cur && cur.parentId && n < 60; n++) { cur = byId.get(cur.parentId); if (cur && cur.id === d.id) ok = false; }
    if (!ok) delete d.parentId;
  });

  const cardIds = new Set();
  const cards = [];
  p.cards.forEach(function (c) {
    if (!c || !isId(c.id) || !deckIds.has(c.deckId) || !isStr(c.front) || !isStr(c.back) || !c.front.trim() || !c.back.trim() || cardIds.has(c.id)) return;
    cardIds.add(c.id);
    const cz = c.cloze && isStr(c.cloze.text) && isStr(c.cloze.answer) && c.cloze.text.includes('____')
      ? Object.assign({ text: c.cloze.text.slice(0, 300), answer: c.cloze.answer.slice(0, 100) },
        isStr(c.cloze.hint) ? { hint: c.cloze.hint.slice(0, 300) } : {}, c.cloze.auto === true ? { auto: true } : {})
      : null;
    cards.push({
      id: c.id,
      deckId: c.deckId,
      front: c.front.trim(),
      back: c.back.trim(),
      ...(cz ? { cloze: cz } : {}),
      box: Number.isInteger(c.box) ? Math.min(Math.max(c.box, 0), INTERVALS.length - 1) : 0,
      nextReview: isStr(c.nextReview) && /^\d{4}-\d{2}-\d{2}$/.test(c.nextReview) ? c.nextReview : todayStr()
    });
  });

  const dropped = (p.rubriques.length - rubriques.length) + (p.decks.length - decks.length) + (p.cards.length - cards.length);
  // Une ancienne sauvegarde (avant les statistiques) n'a pas de 'stats' : null = on garde les tiennes.
  const stats = p.stats ? sanitizeStats(p.stats) : null;
  return { ok: true, data: { rubriques, decks, cards, stats }, dropped };
}
