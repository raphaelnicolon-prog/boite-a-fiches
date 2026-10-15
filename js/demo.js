// Contenus du PROTOTYPE : tout ce qui est simulé pour la démonstration vit ici.
//   - generateDeck()  : « IA » simulée, qui connaît quelques thèmes préparés à l'avance.
//                       Une vraie IA passerait par un serveur qui garde la clé secrète.
//   - DEMO_PEOPLE     : annuaire fictif pour la recherche d'amis et les adversaires.
//   - LEAGUE_BOTS     : joueurs fictifs de la ligue hebdomadaire.
//   - demoDataset()   : jeu de fiches d'exemple, chargé depuis les Réglages.

import { localDateStr, todayStr, weekKey } from './state.js';

// ---------- Personnes fictives ----------
export const DEMO_PEOPLE = [
  { name: 'Martin', level: 4, online: true },
  { name: 'Léa', level: 5, online: true },
  { name: 'Camille', level: 3, online: false },
  { name: 'Hugo', level: 6, online: true },
  { name: 'Inès', level: 2, online: false },
  { name: 'Noah', level: 4, online: true },
  { name: 'Jade', level: 3, online: true },
  { name: 'Lucas', level: 5, online: false },
  { name: 'Emma', level: 2, online: true },
  { name: 'Tom', level: 3, online: false },
  { name: 'Sarah', level: 4, online: true },
  { name: 'Yanis', level: 1, online: false }
];

// Points de la semaine des joueurs fictifs (le joueur réel commence à 0).
export const LEAGUE_BOTS = [
  { name: 'Léa', points: 120 }, { name: 'Hugo', points: 105 }, { name: 'Sarah', points: 95 },
  { name: 'Martin', points: 85 }, { name: 'Noah', points: 75 }, { name: 'Camille', points: 65 },
  { name: 'Lucas', points: 55 }, { name: 'Jade', points: 45 }, { name: 'Emma', points: 35 },
  { name: 'Tom', points: 25 }, { name: 'Inès', points: 15 }
];

// ---------- « IA » simulée : thèmes préparés ----------
// Chaque carte : [recto, verso, phrase à trous avec ____, mot à retrouver]
export const AI_TOPICS = [
  {
    label: '⚽ Football en anglais', keywords: ['foot', 'sport', 'ballon', 'match'],
    prompt: 'Vocabulaire du football en anglais', title: 'Football (anglais)', speakLang: 'en-GB',
    cards: [
      ['goalkeeper', 'gardien de but', 'The ____ made an incredible save in the last minute.', 'goalkeeper'],
      ['striker', 'attaquant', 'The ____ scored twice before half-time.', 'striker'],
      ['referee', 'arbitre', 'The ____ blew the whistle and showed a yellow card.', 'referee'],
      ['penalty', 'penalty (tir au but)', 'He missed the ____ and the crowd went silent.', 'penalty'],
      ['offside', 'hors-jeu', 'The goal was cancelled because he was ____.', 'offside'],
      ['corner', 'corner', 'The winger takes the ____ from the right side.', 'corner'],
      ['to dribble', 'dribbler', 'He tried to ____ past two defenders.', 'dribble'],
      ['header', 'tête (but de la tête)', 'She scored with a powerful ____ from the cross.', 'header'],
      ['own goal', 'but contre son camp', 'A terrible ____ gave the opponents the lead.', 'own goal'],
      ['yellow card', 'carton jaune', 'He received a ____ for a late tackle.', 'yellow card'],
      ['pitch', 'terrain', 'The fans invaded the ____ after the final whistle.', 'pitch'],
      ['supporter', 'supporter', 'Every ____ sang the anthem before kick-off.', 'supporter']
    ]
  },
  {
    label: '🍝 Cuisine en italien', keywords: ['cuisine', 'italien', 'pasta', 'restaurant', 'manger', 'repas'],
    prompt: 'Vocabulaire de la cuisine et du restaurant en italien', title: 'Cuisine (italien)', speakLang: 'it-IT',
    cards: [
      ['la pasta', 'les pâtes', 'Per cena preparo la ____ al pomodoro.', 'pasta'],
      ['il formaggio', 'le fromage', 'Vorrei un po\' di ____ grattugiato sulla pasta.', 'formaggio'],
      ['il pomodoro', 'la tomate', 'Mi piace l\'insalata con il ____ e la mozzarella.', 'pomodoro'],
      ['l\'olio', 'l\'huile', 'Condisco l\'insalata con sale e ____ d\'oliva.', 'olio'],
      ['il pane', 'le pain', 'A colazione mangio il ____ con la marmellata.', 'pane'],
      ['il vino', 'le vin', 'Un bicchiere di ____ rosso, per favore.', 'vino'],
      ['la colazione', 'le petit-déjeuner', 'Al bar prendo un cappuccino per ____.', 'colazione'],
      ['il conto', 'l\'addition', 'Cameriere, il ____, per favore!', 'conto'],
      ['il cameriere', 'le serveur', 'Il ____ porta i piatti al tavolo.', 'cameriere'],
      ['delizioso', 'délicieux', 'Questo tiramisù è davvero ____!', 'delizioso'],
      ['l\'acqua', 'l\'eau', 'Una bottiglia di ____ naturale, grazie.', 'acqua'],
      ['il dolce', 'le dessert', 'Come ____ prendo una fetta di torta.', 'dolce']
    ]
  },
  {
    label: '✈️ Voyage en espagnol', keywords: ['voyage', 'espagnol', 'vacances', 'aeroport', 'hotel', 'tourisme'],
    prompt: 'Vocabulaire du voyage en espagnol', title: 'Voyage (espagnol)', speakLang: 'es-ES',
    cards: [
      ['el aeropuerto', 'l\'aéroport', 'Llegamos al ____ dos horas antes del vuelo.', 'aeropuerto'],
      ['la maleta', 'la valise', 'Mi ____ pesa demasiado.', 'maleta'],
      ['el billete', 'le billet', 'Compré el ____ de tren por internet.', 'billete'],
      ['el hotel', 'l\'hôtel', 'Reservé una habitación en un ____ cerca del mar.', 'hotel'],
      ['la playa', 'la plage', 'Por la tarde vamos a la ____.', 'playa'],
      ['el pasaporte', 'le passeport', 'No olvides el ____ en casa.', 'pasaporte'],
      ['reservar', 'réserver', 'Quiero ____ una mesa para dos personas.', 'reservar'],
      ['la estación', 'la gare', 'El tren sale de la ____ a las nueve.', 'estación'],
      ['el mapa', 'la carte', 'Necesito un ____ para no perderme.', 'mapa'],
      ['la habitación', 'la chambre', 'La ____ tiene vistas a la montaña.', 'habitación'],
      ['el equipaje', 'les bagages', 'El ____ de mano es gratuito.', 'equipaje'],
      ['el viaje', 'le voyage', 'Fue un ____ inolvidable.', 'viaje']
    ]
  },
  {
    label: '💼 Conseil en anglais', keywords: ['conseil', 'consulting', 'business', 'entreprise', 'management', 'pro'],
    prompt: 'Vocabulaire du conseil et du business en anglais', title: 'Conseil (anglais)', speakLang: 'en-GB',
    cards: [
      ['stakeholder', 'partie prenante', 'We need to identify every ____ before the kick-off.', 'stakeholder'],
      ['deliverable', 'livrable', 'The final ____ is a 30-page report.', 'deliverable'],
      ['scope', 'périmètre', 'Let\'s agree on the project ____ with the client.', 'scope'],
      ['benchmark', 'point de comparaison', 'We used the industry average as a ____.', 'benchmark'],
      ['roadmap', 'feuille de route', 'The product ____ covers the next twelve months.', 'roadmap'],
      ['workshop', 'atelier', 'We will run a ____ with the leadership team.', 'workshop'],
      ['milestone', 'jalon', 'The first ____ is due at the end of March.', 'milestone'],
      ['bottleneck', 'goulot d\'étranglement', 'Approvals are the main ____ in the process.', 'bottleneck'],
      ['buy-in', 'adhésion', 'Without management ____, the change will fail.', 'buy-in'],
      ['pain point', 'point de friction', 'Slow onboarding is a major ____ for customers.', 'pain point'],
      ['KPI', 'indicateur clé de performance', 'Customer churn is our key ____.', 'KPI'],
      ['kick-off meeting', 'réunion de lancement', 'The ____ is scheduled for Monday morning.', 'kick-off meeting']
    ]
  }
];

function plain(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Cherche un thème préparé qui correspond à la demande ; null si aucun.
export function generateDeck(prompt) {
  const p = plain(prompt);
  const topic = AI_TOPICS.find(t => t.keywords.some(k => p.includes(k)) || p.includes(plain(t.title.split(' ')[0])));
  if (!topic) return null;
  return {
    title: topic.title,
    speakLang: topic.speakLang,
    cards: topic.cards.map(c => ({ front: c[0], back: c[1], cloze: { text: c[2], answer: c[3] } }))
  };
}

// ---------- Contenu de « Le saviez-vous ? » (nudge quotidien) ----------
export const FACTS = [
  'Sans révision, on oublie vite une grande partie de ce qu\'on vient d\'apprendre (courbe de l\'oubli d\'Ebbinghaus, 1885). C\'est pour ça que la répétition espacée fonctionne.',
  'Se tester soi-même fixe mieux les connaissances que relire son cours : c\'est l\'« effet de test ».',
  'Des séances courtes et régulières sont plus efficaces qu\'une longue séance la veille de l\'examen.',
  'Le sommeil aide à consolider la mémoire : réviser le soir, puis dormir, est un bon réflexe.',
  'Expliquer une notion à voix haute à quelqu\'un (méthode Feynman) révèle ce qu\'on n\'a pas vraiment compris.',
  'Alterner des thèmes différents pendant une séance (l\'entrelacement) améliore l\'apprentissage à long terme.',
  'Prononcer un mot à voix haute aide à le mémoriser : l\'« effet de production ».',
  'Un « nudge » (Thaler et Sunstein) oriente un comportement par un petit coup de pouce, sans rien interdire. Ta série de jours en est un.'
];

// ---------- Liens partenaires (démonstration) ----------
export const PARTNERS = {
  'r-revisions': { title: 'Gestion de projet', desc: 'Cours en ligne pour approfondir', url: 'https://www.coursera.org/search?query=project%20management' },
  'r-langues': { title: 'Apprendre l\'italien', desc: 'Cours en ligne pour progresser', url: 'https://www.coursera.org/search?query=italian' },
  _default: { title: 'Cours en ligne', desc: 'Découvrir des cours pour aller plus loin', url: 'https://www.coursera.org/' }
};

// ---------- Jeu de fiches de démonstration ----------
const REV = {
  'd-pm': [
    ['Que signifie la « contrainte triple » (triangle de fer) en gestion de projet ?', 'Périmètre, délais et coûts : modifier l\'un impacte les deux autres.'],
    ['Qu\'est-ce qu\'un diagramme de Gantt ?', 'Un planning en barres qui visualise les tâches, leur durée et leurs dépendances dans le temps.'],
    ['À quoi sert la méthode du chemin critique ?', 'À identifier la suite de tâches qui détermine la durée minimale du projet.'],
    ['Que signifie WBS ?', 'Work Breakdown Structure : découpage hiérarchique du projet en livrables et en tâches.'],
    ['Que veut dire MoSCoW ?', 'Méthode de priorisation : Must, Should, Could, Won\'t have.'],
    ['Quelle différence entre méthode agile et cycle en V ?', 'Agile : itérations courtes et adaptation continue. Cycle en V : phases séquentielles planifiées à l\'avance.'],
    ['Qu\'est-ce qu\'un sprint en Scrum ?', 'Une itération courte (1 à 4 semaines) qui produit un incrément de produit livrable.'],
    ['Que signifie RACI ?', 'Matrice des rôles : Responsible, Accountable, Consulted, Informed.']
  ],
  'd-km': [
    ['Que décrit le modèle SECI ?', 'Les 4 modes de création de connaissance (Nonaka et Takeuchi) : Socialisation, Externalisation, Combinaison, Internalisation.'],
    ['Connaissance tacite vs explicite ?', 'Tacite : savoir-faire personnel difficile à formaliser. Explicite : codifiée et transmissible par des documents.'],
    ['Qu\'est-ce qu\'une communauté de pratique ?', 'Un groupe de personnes qui partagent un domaine et échangent pour apprendre ensemble (Wenger).'],
    ['Pourquoi faire du Knowledge Management ?', 'Pour capitaliser sur le savoir de l\'organisation, éviter la perte d\'expertise et accélérer l\'innovation.'],
    ['Qu\'est-ce qu\'un retour d\'expérience (REX) ?', 'L\'analyse d\'un projet terminé pour en tirer des leçons réutilisables.'],
    ['Qu\'est-ce qu\'un silo de connaissances ?', 'Un savoir cantonné à un service ou à une personne, non partagé dans l\'organisation.']
  ],
  'd-pfm': [
    ['Qu\'est-ce qu\'un KPI ?', 'Un indicateur clé de performance : une mesure chiffrée suivie pour piloter un objectif.'],
    ['Que contient le Balanced Scorecard (Kaplan et Norton) ?', '4 axes : finance, clients, processus internes, apprentissage et croissance.'],
    ['Que signifie SMART pour un objectif ?', 'Spécifique, Mesurable, Atteignable, Réaliste, Temporellement défini.'],
    ['Qu\'est-ce qu\'un OKR ?', 'Un objectif ambitieux associé à 3 à 5 résultats clés mesurables.'],
    ['Qu\'est-ce qu\'un feedback à 360° ?', 'L\'évaluation d\'un collaborateur par son entourage : manager, pairs, équipe, clients.'],
    ['Efficacité ou efficience ?', 'Efficacité : atteindre l\'objectif. Efficience : l\'atteindre avec le moins de ressources.']
  ],
  'd-bc': [
    ['Qu\'est-ce que la matrice sociodynamique ?', 'Cartographie des acteurs d\'un projet selon leur pouvoir et leur volonté de changement (synergie, inertie, opposition...).'],
    ['Que signifie PSF ?', 'Professional Service Firm : une structure qui vend du conseil ou de l\'expertise plutôt qu\'un produit.'],
    ['Qu\'est-ce que la matrice SWOT ?', 'L\'analyse des Forces et Faiblesses (internes), des Opportunités et Menaces (externes).'],
    ['Que décrit le modèle des 5 forces de Porter ?', 'L\'intensité concurrentielle d\'un secteur : rivalité, nouveaux entrants, substituts, pouvoir des clients et des fournisseurs.'],
    ['Que signifie le principe MECE ?', 'Mutuellement Exclusif, Collectivement Exhaustif : structurer sans chevauchement ni oubli.'],
    ['Que classe la matrice BCG ?', 'Les activités selon leur part de marché et leur croissance : vedettes, vaches à lait, dilemmes, poids morts.'],
    ['Qu\'est-ce que la pyramide de Minto ?', 'Une façon de communiquer : la conclusion d\'abord, puis les arguments, puis les données.'],
    ['Qu\'est-ce qu\'un livrable en conseil ?', 'Un résultat concret remis au client : rapport, recommandation, outil ou plan d\'action.']
  ],
  'd-icm': [
    ['Quelle est la règle d\'or d\'un brainstorming ?', 'La quantité d\'abord, et aucune critique pendant la production d\'idées.'],
    ['Quelles sont les phases du design thinking ?', 'Empathie, définition, idéation, prototypage, test.'],
    ['Innovation de rupture ou incrémentale ?', 'Rupture : nouveau marché ou nouvel usage (Christensen). Incrémentale : amélioration de l\'existant.'],
    ['Qu\'est-ce qu\'un MVP ?', 'Minimum Viable Product : la version minimale qui permet de tester une hypothèse avec de vrais utilisateurs.'],
    ['Que signifie SCAMPER ?', 'Une liste de pistes : Substituer, Combiner, Adapter, Modifier, Proposer un autre usage, Éliminer, Réorganiser.'],
    ['Pensée divergente ou convergente ?', 'Divergente : générer beaucoup d\'idées. Convergente : sélectionner et affiner les meilleures.']
  ]
};

const ITA = [
  ['Buongiorno', 'Bonjour', '____! Vorrei un caffè, per favore.', 'Buongiorno'],
  ['Grazie mille', 'Merci beaucoup', '____ per il tuo aiuto!', 'Grazie mille'],
  ['Arrivederci', 'Au revoir', 'Ci vediamo domani, ____!', 'Arrivederci'],
  ['Per favore', 'S\'il te plaît', 'Un caffè, ____.', 'Per favore'],
  ['Prego', 'De rien', '— Grazie! — ____.', 'Prego'],
  ['Scusi', 'Excusez-moi', '____, dov\'è la stazione?', 'Scusi'],
  ['Dov\'è...?', 'Où est... ?', '____ il bagno?', 'Dov\'è'],
  ['Quanto costa?', 'Combien ça coûte ?', '____ questo libro?', 'Quanto costa'],
  ['Mi chiamo', 'Je m\'appelle', '____ Raphaël.', 'Mi chiamo'],
  ['Piacere', 'Enchanté', 'Mi chiamo Marco, ____!', 'Piacere'],
  ['A domani', 'À demain', 'Buonanotte, ____!', 'A domani'],
  ['Ho fame', 'J\'ai faim', 'Non ho mangiato oggi: ____!', 'Ho fame']
];

// Fiches d'exemple + statistiques « vivantes » calculées par rapport à aujourd'hui,
// pour que l'accueil montre une série en cours le jour de la démonstration.
export function demoDataset() {
  const t = todayStr();
  const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDateStr(d); };
  const inDays = n => day(-n);

  const rubriques = [
    { id: 'r-revisions', name: 'Spécial Révisions', color: 'revisions', emoji: '📚', order: 0, hidden: false, isDefault: true },
    { id: 'r-langues', name: 'Spécial Langues', color: 'langues', emoji: '🗣️', order: 1, hidden: false, isDefault: true }
  ];
  const decks = [
    { id: 'd-pm', name: 'Project Management', rubriqueId: 'r-revisions', speakLang: '' },
    { id: 'd-km', name: 'Knowledge Management', rubriqueId: 'r-revisions', speakLang: '' },
    { id: 'd-pfm', name: 'Performance Management', rubriqueId: 'r-revisions', speakLang: '' },
    { id: 'd-bc', name: 'Business Consulting', rubriqueId: 'r-revisions', speakLang: '' },
    { id: 'd-icm', name: 'Innovation & Creativity Mgmt', rubriqueId: 'r-revisions', speakLang: '' },
    { id: 'd-it', name: 'Italien', rubriqueId: 'r-langues', speakLang: 'it-IT' }
  ];
  const cards = [];
  let n = 0;
  const push = (deckId, front, back, cloze) => {
    n++;
    // Un peu de variété : environ 1 carte sur 4 est déjà bien connue et reportée.
    const known = n % 4 === 0;
    cards.push(Object.assign({
      id: 'dc-' + n, deckId, front, back,
      box: known ? 2 : (n % 3 === 0 ? 1 : 0),
      nextReview: known ? inDays(3) : t
    }, cloze ? { cloze: { text: cloze[0], answer: cloze[1] } } : {}));
  };
  Object.keys(REV).forEach(deckId => REV[deckId].forEach(c => push(deckId, c[0], c[1])));
  ITA.forEach(c => push('d-it', c[0], c[1], [c[2], c[3]]));

  return {
    rubriques, decks, cards,
    stats: { goal: 10, days: { [t]: 3, [day(1)]: 12, [day(2)]: 8, [day(3)]: 15, [day(4)]: 10, [day(6)]: 7 } },
    multi: { weekKey: weekKey(), weekPoints: 20, total: 180, played: 7, wins: 4 },
    social: { friends: ['Léa'], pending: {} }
  };
}
