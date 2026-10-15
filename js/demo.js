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
    label: '💼 Conseil en anglais', keywords: ['conseil', 'consulting', 'business', 'affaires', 'anglais pro'],
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
  },
  {
    label: '📣 Marketing', keywords: ['marketing', 'marque', 'client', 'vente', 'communication'],
    prompt: 'Les notions clés du marketing', title: 'Marketing (notions clés)', speakLang: '',
    cards: [
      ['Persona', 'Profil fictif qui représente un client cible', 'Un ____ est un profil fictif qui représente un client cible.', 'persona'],
      ['Segmentation', 'Découpage du marché en groupes de clients homogènes', 'La ____ découpe le marché en groupes de clients aux besoins similaires.', 'segmentation'],
      ['Positionnement', 'Place occupée par une marque dans l\'esprit du client', 'Le ____ définit la place d\'une marque dans l\'esprit du client.', 'positionnement'],
      ['Mix marketing', 'Les 4 P : produit, prix, place, promotion', 'Le ____ combine produit, prix, place et promotion.', 'mix marketing'],
      ['Taux de conversion', 'Part des visiteurs qui réalisent l\'action attendue', 'Le ____ mesure la part de visiteurs qui achètent ou s\'inscrivent.', 'taux de conversion'],
      ['Fidélisation', 'Ensemble des actions pour garder les clients existants', 'La ____ vise à garder les clients existants sur la durée.', 'fidélisation'],
      ['Proposition de valeur', 'Promesse de bénéfice faite au client', 'La ____ explique pourquoi un client choisit une offre.', 'proposition de valeur'],
      ['Cible', 'Groupe de clients visé par une offre', 'Bien définir sa ____ évite de s\'adresser à tout le monde.', 'cible'],
      ['Parcours client', 'Étapes vécues par un client avant et après l\'achat', 'Le ____ décrit chaque étape, de la découverte à l\'après-vente.', 'parcours client'],
      ['Notoriété', 'Part du public qui connaît une marque', 'La ____ mesure la part du public qui connaît la marque.', 'notoriété']
    ]
  },
  {
    label: '💶 Finance d\'entreprise', keywords: ['finance', 'compta', 'bilan', 'tresorerie', 'invest'],
    prompt: 'Les bases de la finance d\'entreprise', title: 'Finance (bases)', speakLang: '',
    cards: [
      ['Chiffre d\'affaires', 'Total des ventes réalisées sur une période', 'Le ____ correspond au total des ventes sur une période.', 'chiffre d\'affaires'],
      ['Marge brute', 'Chiffre d\'affaires moins le coût d\'achat des marchandises vendues', 'La ____ est le chiffre d\'affaires moins le coût d\'achat des marchandises.', 'marge brute'],
      ['Trésorerie', 'Argent immédiatement disponible', 'Une entreprise rentable peut manquer de ____ si ses clients paient tard.', 'trésorerie'],
      ['Bilan', 'Photographie du patrimoine : actif et passif', 'Le ____ présente l\'actif et le passif de l\'entreprise à une date donnée.', 'bilan'],
      ['Amortissement', 'Étalement du coût d\'un investissement sur sa durée d\'usage', 'L\'____ étale le coût d\'une machine sur plusieurs années.', 'amortissement'],
      ['Point mort', 'Niveau d\'activité où le résultat est nul', 'Au ____, les ventes couvrent exactement les coûts.', 'point mort'],
      ['EBITDA', 'Résultat avant intérêts, impôts, dépréciations et amortissements', 'L\'____ mesure la performance opérationnelle avant amortissements.', 'EBITDA'],
      ['ROI', 'Retour sur investissement : gain rapporté à la somme investie', 'Le ____ compare le gain obtenu à la somme investie.', 'ROI'],
      ['Dividende', 'Part du bénéfice versée aux actionnaires', 'Le ____ est la part du bénéfice reversée aux actionnaires.', 'dividende'],
      ['Fonds de roulement', 'Ressources stables qui financent le cycle d\'exploitation', 'Le ____ finance les besoins courants de l\'activité.', 'fonds de roulement']
    ]
  },
  {
    label: '🇬🇧 Anglais du quotidien', keywords: ['quotidien', 'courant', 'general', 'vocabulaire anglais', 'daily'],
    prompt: 'Anglais du quotidien et du travail', title: 'Anglais du quotidien', speakLang: 'en-GB',
    cards: [
      ['to book', 'réserver', 'I need to ____ a table for tonight.', 'book'],
      ['deadline', 'date limite', 'The ____ for the report is Friday.', 'deadline'],
      ['to improve', 'améliorer', 'I want to ____ my English this year.', 'improve'],
      ['to borrow', 'emprunter', 'Can I ____ your pen for a minute?', 'borrow'],
      ['although', 'bien que', '____ it was raining, we went for a walk.', 'Although'],
      ['reliable', 'fiable', 'He is a very ____ colleague.', 'reliable'],
      ['to cope with', 'faire face à', 'It is hard to ____ so much work.', 'cope with'],
      ['bill', 'facture, addition', 'Could we have the ____, please?', 'bill'],
      ['overtime', 'heures supplémentaires', 'She did two hours of ____ yesterday.', 'overtime'],
      ['to run out of', 'ne plus avoir de', 'We have run ____ milk.', 'out of']
    ]
  },
  {
    label: '🇩🇪 Allemand de base', keywords: ['allemand', 'deutsch', 'berlin'],
    prompt: 'Allemand de base pour voyager', title: 'Allemand (bases)', speakLang: 'de-DE',
    cards: [
      ['der Bahnhof', 'la gare', 'Wo ist der ____?', 'Bahnhof'],
      ['das Wasser', 'l\'eau', 'Ein Glas ____, bitte.', 'Wasser'],
      ['Danke', 'merci', '____ für Ihre Hilfe!', 'Danke'],
      ['Bitte', 's\'il vous plaît / de rien', 'Einen Kaffee, ____.', 'bitte'],
      ['die Rechnung', 'l\'addition', 'Die ____, bitte!', 'Rechnung'],
      ['Entschuldigung', 'excusez-moi', '____, wo ist die Toilette?', 'Entschuldigung'],
      ['das Brot', 'le pain', 'Ich esse ____ mit Butter.', 'Brot'],
      ['der Flughafen', 'l\'aéroport', 'Der ____ ist weit von hier.', 'Flughafen'],
      ['Guten Morgen', 'bonjour (le matin)', '____! Haben Sie gut geschlafen?', 'Guten Morgen'],
      ['Wie viel kostet das?', 'combien ça coûte ?', '____ dieses Buch?', 'Wie viel kostet']
    ]
  }
];

function plain(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Cherche un thème préparé qui correspond à la demande ; null si aucun.
export function generateDeck(prompt) {
  const p = plain(prompt);
  let topic = AI_TOPICS.find(t => t.keywords.some(k => p.includes(k)) || p.includes(plain(t.title.split(' ')[0])));
  // Une langue seule (« anglais », « italien »...) mène au thème le plus général de cette langue.
  if (!topic) {
    const byLang = { anglais: 'Anglais du quotidien', italien: 'Cuisine (italien)', espagnol: 'Voyage (espagnol)' };
    const lang = Object.keys(byLang).find(l => p.includes(l));
    if (lang) topic = AI_TOPICS.find(t => t.title === byLang[lang]);
  }
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

// ---------- « Découvrir » : articles courts sur l'apprentissage (contenu d'exemple) ----------
export const ARTICLES = [
  { emoji: '⏳', title: 'La répétition espacée', time: '2 min',
    summary: 'Revoir une information juste avant de l\'oublier la grave plus durablement.',
    body: 'Dès 1885, Hermann Ebbinghaus a décrit la « courbe de l\'oubli » : sans révision, on perd vite une grande partie de ce qu\'on vient d\'apprendre. La répétition espacée consiste à revoir une information à des intervalles de plus en plus longs. C\'est le principe de la boîte de Leitner utilisée dans cette appli : une bonne réponse repousse le prochain rappel (1, 3, 7, 16 puis 30 jours), une mauvaise le ramène à zéro. Résultat : tu révises moins souvent ce que tu sais déjà, et davantage ce qui t\'échappe.' },
  { emoji: '🧠', title: 'Se tester plutôt que relire', time: '2 min',
    summary: 'Aller chercher une réponse en mémoire la renforce plus que la relecture.',
    body: 'Relire son cours donne une impression de familiarité, pas la certitude de savoir. Des travaux comme ceux de Roediger et Karpicke (2006) montrent que se tester activement améliore la rétention à long terme : c\'est l\'« effet de test ». Les flashcards, le QCM et le texte à trous reposent tous sur ce mécanisme. Astuce : essaie de répondre avant de retourner la carte, même si tu hésites.' },
  { emoji: '🌙', title: 'Le sommeil, allié de la mémoire', time: '2 min',
    summary: 'Le cerveau consolide ce qu\'il a appris pendant la nuit.',
    body: 'De nombreuses études suggèrent que le sommeil aide à consolider les souvenirs récents. Réviser en fin de journée, puis dormir, est donc un bon réflexe. À l\'inverse, enchaîner une nuit blanche avant un examen est rarement payant : la fatigue dégrade l\'attention et la récupération des informations.' },
  { emoji: '🎲', title: 'Mélanger pour mieux retenir', time: '2 min',
    summary: 'Alterner les thèmes et les types d\'exercices rend l\'apprentissage plus durable.',
    body: 'L\'« entrelacement » consiste à mélanger des sujets ou des formats au lieu de tout travailler par blocs. La séance semble plus difficile, mais la mémoire à long terme est souvent meilleure. C\'est la logique du Quizz Medley : QCM, vrai/faux, phrases à trous et appariement s\'enchaînent pour solliciter ta mémoire de plusieurs façons.' },
  { emoji: '🗣️', title: 'La méthode Feynman', time: '2 min',
    summary: 'Expliquer simplement une notion révèle ce qu\'on n\'a pas compris.',
    body: 'Le principe attribué au physicien Richard Feynman : explique une notion comme à quelqu\'un qui n\'y connaît rien. Là où tu butes, il y a un trou dans ta compréhension. Retourne au cours, comble-le, puis recommence. Les phrases à trous et la lecture audio des mots peuvent t\'aider à passer de la reconnaissance à la production.' },
  { emoji: '👉', title: 'Les nudges : de petits coups de pouce', time: '2 min',
    summary: 'Orienter un comportement sans rien interdire, c\'est la théorie du « nudge ».',
    body: 'Popularisé par Thaler et Sunstein (Nudge, 2008), le nudge oriente un choix par un petit changement de contexte, sans contrainte : option par défaut, rappel, preuve sociale, progression visible. Ici : la série de jours, l\'objectif quotidien, le rappel à l\'heure choisie ou la ligue entre amis sont des nudges. Bien conçus, ils aident à tenir une habitude ; mal utilisés, ils peuvent devenir manipulateurs, d\'où l\'importance de rester transparent et de ne jamais culpabiliser.' }
];

// ---------- Analyse d'un texte de cours (locale, sans IA) ----------
// Repère des définitions (« Terme : définition », « X est / désigne / signifie... ») et en tire des
// cartes, avec une phrase à trous quand c'est possible. C'est une analyse simple, pas de l'IA :
// une vraie IA comprendrait le sens, résumerait et irait bien plus loin.
const STOP = new Set(['alors', 'aussi', 'autres', 'avant', 'avec', 'cette', 'comme', 'dans', 'donc', 'elles', 'entre', 'leurs', 'mais', 'même', 'notre', 'plus', 'pour', 'sans', 'selon', 'sont', 'toute', 'toutes', 'tous', 'votre', 'quand', 'ainsi', 'chaque', 'depuis', 'permet', 'consiste']);
const GRAM_ARTICLES = ['le', 'la', 'les', 'un', 'une', 'des', 'du', 'l\''];

function lowerFirst(txt) {
  const first = txt.split(/[\s']/)[0].toLowerCase();
  return GRAM_ARTICLES.includes(first) || GRAM_ARTICLES.includes(first + '\'') ? txt.charAt(0).toLowerCase() + txt.slice(1) : txt;
}

export function makeCloze(sentence) {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  if (clean.length > 220) return null;
  const words = clean.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{5,}/g) || [];
  const best = words.filter(w => !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0];
  if (!best) return null;
  const re = new RegExp('(^|[^A-Za-zÀ-ÿ])' + best.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-zÀ-ÿ])', 'i');
  if (!re.test(clean)) return null;
  return { text: clean.replace(re, (m, pre) => pre + '____'), answer: best };
}

export function generateFromText(text, title) {
  const cards = [];
  const seen = new Set();
  const add = (front, back) => {
    const key = front.toLowerCase();
    if (seen.has(key) || cards.length >= 15) return;
    seen.add(key);
    const cz = makeCloze(back);
    cards.push({ front, back, cloze: cz });
  };
  const defRe = /^\s*(?:[-•*]+\s*|\d+[.)]\s*)?([^:—–-]{2,60}?)\s*(?::|—|–|\s-\s)\s*(.{12,})$/;
  const sentRe = /^(.{3,70}?)\s+(est|sont|désigne|désignent|signifie|correspond à)\s+(.{12,})$/i;
  String(text || '').split(/\r?\n/).forEach(function (line) {
    const l = line.trim();
    if (l.length < 15) return;
    const m = l.match(defRe);
    if (m && m[1].split(' ').length <= 8) { add('Que signifie « ' + m[1].trim() + ' » ?', m[2].trim().replace(/^./, c => c.toUpperCase())); return; }
    (l.match(/[^.!?]+[.!?]?/g) || []).forEach(function (sentence) {
      const s2 = sentence.trim();
      const sm = s2.match(sentRe);
      if (sm && sm[1].split(' ').length <= 8) add('Définis : ' + lowerFirst(sm[1].trim()), s2.replace(/\s+/g, ' '));
    });
  });
  if (cards.length === 0) return null;
  return { title: (title || '').trim() || 'Mon cours (analyse)', speakLang: '', cards };
}

// Classement fictif d'une promo d'école (cercle « Promo ») pour la démonstration.
export const PROMO_BOTS = [
  { name: 'Chloé B.', points: 140 }, { name: 'Maxime D.', points: 118 }, { name: 'Salomé R.', points: 104 },
  { name: 'Antoine L.', points: 92 }, { name: 'Manon T.', points: 81 }, { name: 'Julien P.', points: 66 },
  { name: 'Clara V.', points: 52 }, { name: 'Hugo F.', points: 41 }, { name: 'Lina K.', points: 30 }, { name: 'Paul G.', points: 18 }
];

// Adversaire du défi du jour : représente le niveau moyen des joueurs.
export const DAILY_OPPONENT = { name: 'Joueurs du jour', level: 3, online: true };
