// Ligues par thème : le cœur du multijoueur « équitable ».
//
// Pourquoi ? Un duel basé sur les cartes personnelles avantage celui dont les cartes sont
// jouées. Ici, tous les joueurs d'une même ligue répondent aux MÊMES questions, tirées d'une
// banque commune sur un thème répandu (marketing, anglais…) : le résultat ne dépend que des
// connaissances de chacun.
//
// PROTOTYPE : la banque ci-dessous est écrite à la main (exemples). Dans la version réelle, elle
// serait générée par une IA puis relue par l'équipe (voir « Le projet »), et les ligues, le nombre
// de joueurs et les classements viendraient d'un serveur. Ici, tout est simulé et déterministe.

import { state, todayStr } from './state.js';
import { LEAGUE_BOTS, PROMO_BOTS } from './demo.js';

// Niveaux de difficulté. Chaque niveau est une ligue À PART, avec son propre classement : on affronte des joueurs
// de même niveau. minPlayers = nombre de joueurs à partir duquel un lot est distribué (plus bas pour les ligues
// difficiles, qui sont plus petites) ; la valeur du lot grimpe avec la difficulté.
export const LEVELS = [
  { id: 'facile', label: 'Facile', mult: 1, minPlayers: 500, prize: 'Un mois de Premium offert', value: '≈ 5 €', skill: 1 },
  { id: 'moyen', label: 'Moyen', mult: 1.5, minPlayers: 300, prize: 'Un cours certifiant en ligne', value: '≈ 50 €', skill: 0.92 },
  { id: 'difficile', label: 'Difficile', mult: 2, minPlayers: 150, prize: 'Une carte cadeau', value: '≈ 100 €', skill: 0.85 },
  { id: 'expert', label: 'Expert', mult: 3, minPlayers: 50, prize: 'Une formation ou un voyage d\'études', value: '≈ 250 €', skill: 0.78 }
];

// pop = popularité du thème (sert à simuler le nombre de joueurs) ; kw = mots qui rattachent une matière à ce thème.
export const THEMES = [
  { id: 'marketing', label: 'Marketing', desc: 'Concepts, outils et stratégies', pop: 2400, kw: /market/,
    q: {
      facile: [
        ['Que désigne le « marketing mix » classique (les 4 P) ?', 'Produit, Prix, Place, Promotion', 'Prix, Publicité, Personnel, Packaging', 'Produit, Public, Presse, Prix', 'Plan, Prix, Promotion, Profit'],
        ['Que signifie « B2C » ?', 'Business to Consumer : vente aux particuliers', 'Business to Company', 'Brand to Customer', 'Buy to Cash'],
        ['Qu\'est-ce qu\'une cible marketing ?', 'Le groupe de clients que l\'on cherche à atteindre', 'Le budget publicitaire', 'L\'objectif de vente', 'Le lieu de vente'],
        ['À quoi sert principalement un logo ?', 'Identifier visuellement une marque', 'Fixer le prix', 'Mesurer la satisfaction', 'Contrôler la qualité'],
        ['Que signifie « SEO » ?', 'Search Engine Optimization : référencement naturel', 'Sales Efficiency Optimization', 'Social Engagement Overview', 'Search Email Outreach'],
        ['Qu\'est-ce qu\'un slogan ?', 'Une phrase courte et mémorable associée à une marque', 'Un contrat de vente', 'Un sondage client', 'Un type d\'emballage']
      ],
      moyen: [
        ['Que mesure le « taux de conversion » ?', 'La part de visiteurs qui réalisent l\'action attendue', 'Le nombre total de visiteurs', 'Le prix moyen du panier', 'Le taux de remise'],
        ['Que désigne le « positionnement » d\'une marque ?', 'La place distinctive qu\'elle occupe dans l\'esprit du public', 'Son emplacement géographique', 'Son classement boursier', 'Sa place dans le catalogue'],
        ['Qu\'est-ce que la segmentation ?', 'Découper un marché en groupes de clients aux besoins proches', 'Découper un produit en pièces', 'Séparer les services d\'une entreprise', 'Classer les concurrents'],
        ['Que signifie « CAC » ?', 'Coût d\'acquisition client', 'Chiffre d\'affaires cumulé', 'Canal d\'achat courant', 'Contrat d\'achat client'],
        ['Qu\'est-ce que le « storytelling » ?', 'Raconter une histoire pour donner du sens à une marque', 'Un outil de comptabilité', 'Une étude de marché', 'Un type de remise'],
        ['Quelle est la différence entre stratégie « push » et « pull » ?', 'Push : pousser le message vers le client ; pull : attirer le client vers la marque', 'Push : gratuit ; pull : payant', 'Push : en ligne ; pull : en magasin', 'Il n\'y en a aucune']
      ],
      difficile: [
        ['Dans la matrice BCG, que représente un « dilemme » ?', 'Forte croissance du marché mais faible part de marché relative', 'Faible croissance et forte part', 'Faible croissance et faible part', 'Forte croissance et forte part'],
        ['Que décrit le modèle AIDA ?', 'Attention, Intérêt, Désir, Action', 'Analyse, Idée, Décision, Application', 'Audience, Image, Distribution, Achat', 'Accroche, Information, Démonstration, Avantage'],
        ['Que mesure la « LTV » (customer lifetime value) ?', 'La valeur totale qu\'un client rapporte sur toute sa relation avec l\'entreprise', 'Le coût d\'un lancement', 'Le taux de fidélité en magasin', 'La visibilité en ligne'],
        ['Qu\'est-ce que l\'élasticité-prix de la demande ?', 'La sensibilité de la quantité demandée à une variation du prix', 'La flexibilité des prix fournisseurs', 'La vitesse de baisse des prix', 'Le rapport marge sur prix'],
        ['Que signifie « Blue Ocean Strategy » ?', 'Créer un espace de marché nouveau plutôt qu\'affronter la concurrence', 'Se développer en bord de mer', 'Baisser les prix pour éliminer les rivaux', 'Copier le leader du marché'],
        ['Que mesure le NPS (Net Promoter Score) ?', 'La propension des clients à recommander l\'entreprise', 'Le nombre de promotions', 'Le prix net des produits', 'Le potentiel de croissance']
      ],
      expert: [
        ['En quoi consiste la stratégie de prix d\'« écrémage » (skimming) ?', 'Lancer à prix élevé pour viser d\'abord les acheteurs prêts à payer plus', 'Lancer à bas prix pour conquérir vite', 'Aligner les prix sur la concurrence', 'Vendre uniquement en promotion'],
        ['Que décrit la courbe d\'adoption de Rogers ?', 'La diffusion d\'une innovation : innovateurs, adopteurs précoces, majorités, retardataires', 'Le cycle de vie des prix', 'L\'évolution d\'un budget publicitaire', 'La courbe d\'apprentissage'],
        ['Que signifie « Jobs to be Done » ?', 'Les clients « embauchent » un produit pour accomplir une tâche précise', 'Un processus de recrutement', 'Une liste de tâches logistiques', 'Un plan de production'],
        ['Qu\'est-ce que l\'attribution multi-touch ?', 'Répartir le crédit d\'une conversion entre plusieurs points de contact', 'Compter uniquement le dernier clic', 'Lancer plusieurs tests A/B', 'Vendre en plusieurs fois'],
        ['Que mesure le ROAS ?', 'Le chiffre d\'affaires généré par euro dépensé en publicité', 'Le retour sur actifs', 'Le taux d\'abandon', 'Le ratio d\'audience'],
        ['Que dit la loi de Pareto appliquée aux clients ?', 'Environ 20 % des clients génèrent environ 80 % du chiffre d\'affaires', '80 % des clients sont fidèles', '20 % de remise suffisent', '80 % du budget publicitaire est inutile']
      ]
    } },
  { id: 'anglais', label: 'Anglais', desc: 'Vocabulaire, grammaire et expressions', pop: 3100, kw: /anglais|english/,
    q: {
      facile: [
        ['Que signifie « breakfast » ?', 'Petit-déjeuner', 'Déjeuner', 'Dîner', 'Goûter'],
        ['Comment dit-on « Je suis fatigué » ?', 'I am tired', 'I have tired', 'I am tire', 'Me tired'],
        ['Quel est le pluriel de « child » ?', 'Children', 'Childs', 'Childrens', 'Childes'],
        ['Que signifie « to borrow » ?', 'Emprunter', 'Prêter', 'Acheter', 'Rendre'],
        ['« She ___ to school every day. »', 'goes', 'go', 'going', 'gone'],
        ['Que signifie « Thank you very much » ?', 'Merci beaucoup', 'Excusez-moi', 'Je vous en prie', 'À bientôt']
      ],
      moyen: [
        ['Que signifie « actually » ?', 'En fait, en réalité', 'Actuellement', 'Activement', 'Aujourd\'hui'],
        ['« If I ___ you, I would accept. »', 'were', 'am', 'was being', 'will be'],
        ['Que signifie « to look forward to » ?', 'Attendre avec impatience', 'Regarder devant soi', 'Chercher en avant', 'Prévoir'],
        ['Quel est le prétérit de « to buy » ?', 'Bought', 'Buyed', 'Boughten', 'Bout'],
        ['« I have lived here ___ 2019. »', 'since', 'for', 'during', 'from'],
        ['Que signifie « eventually » ?', 'Finalement, à la longue', 'Éventuellement', 'Évidemment', 'Éternellement']
      ],
      difficile: [
        ['Que signifie « to run out of » ?', 'Être à court de', 'Courir dehors', 'S\'enfuir de', 'Gérer'],
        ['« Had I known, I ___ come. »', 'would have', 'will have', 'had', 'would'],
        ['« Despite » est suivi de…', 'Un nom ou une forme en -ing', 'Un verbe conjugué', 'Un infinitif avec to', 'Une proposition avec that'],
        ['Que signifie « to put up with » ?', 'Supporter, tolérer', 'Installer', 'Mettre en haut', 'Proposer'],
        ['Quelle est la différence entre « affect » et « effect » ?', 'Affect est surtout un verbe (influencer), effect un nom (effet)', 'C\'est l\'inverse', 'Aucune différence', 'Affect est un adjectif'],
        ['Que signifie « reluctant » ?', 'Réticent', 'Fiable', 'Impatient', 'Reconnaissant']
      ],
      expert: [
        ['Que signifie « to bite the bullet » ?', 'Affronter une situation désagréable avec courage', 'Mordre une balle', 'Se taire', 'Tirer profit'],
        ['« The more you practise, ___ you become. »', 'the better', 'better', 'the best', 'more good'],
        ['Que signifie « ubiquitous » ?', 'Présent partout', 'Ambigu', 'Unique', 'Ancien'],
        ['Que signifie « to be on the fence » ?', 'Hésiter, ne pas avoir tranché', 'Être en sécurité', 'Clôturer', 'Être en retard'],
        ['Quelle est la différence entre « lay » et « lie » ?', 'Lay prend un complément (poser) ; lie = être allongé', 'Aucune', 'Lay = mentir ; lie = poser', 'Lie prend toujours un complément'],
        ['Que signifie « notwithstanding » ?', 'Malgré, en dépit de', 'À cause de', 'Grâce à', 'En plus de']
      ]
    } },
  { id: 'projet', label: 'Gestion de projet', desc: 'Méthodes, planification et pilotage', pop: 900, kw: /projet|project/,
    q: {
      facile: [
        ['Que représente le « triangle de fer » ?', 'Périmètre, délais et coûts', 'Qualité, risque et humain', 'Prix, marge et vente', 'Équipe, outil et lieu'],
        ['Qu\'est-ce qu\'un livrable ?', 'Un résultat concret produit par le projet', 'Un retard', 'Un budget', 'Un risque'],
        ['Quel est le rôle du chef de projet ?', 'Coordonner l\'équipe pour atteindre les objectifs dans les délais et le budget', 'Concevoir seul tous les livrables', 'Contrôler uniquement les comptes', 'Vendre le produit'],
        ['Qu\'est-ce qu\'un jalon ?', 'Un point de contrôle clé dans le planning', 'Un type de budget', 'Un membre d\'équipe', 'Un document juridique'],
        ['Qu\'est-ce qu\'un sprint en Scrum ?', 'Une itération courte qui produit un incrément livrable', 'Une réunion de crise', 'Un budget', 'Un outil de suivi'],
        ['Que signifie « planifier » un projet ?', 'Organiser les tâches, ressources et délais', 'Recruter l\'équipe', 'Vendre le projet', 'Contrôler la qualité finale']
      ],
      moyen: [
        ['Qu\'est-ce qu\'un diagramme de Gantt ?', 'Un planning en barres montrant tâches, durées et dépendances', 'Un schéma de répartition du budget', 'Un organigramme', 'Une matrice de risques'],
        ['Que désigne le « chemin critique » ?', 'La suite de tâches qui détermine la durée minimale du projet', 'Les tâches les plus chères', 'Les tâches les plus urgentes', 'Le trajet vers le client'],
        ['Que signifie WBS ?', 'Work Breakdown Structure : découpage du projet en livrables et tâches', 'Un plan de budget', 'Une matrice de risques', 'Un planning de congés'],
        ['Que veut dire MoSCoW ?', 'Méthode de priorisation : Must, Should, Could, Won\'t', 'Méthode de budgétisation', 'Modèle de leadership', 'Norme qualité'],
        ['Que signifie RACI ?', 'Matrice des rôles : Responsible, Accountable, Consulted, Informed', 'Registre des risques', 'Calendrier des réunions', 'Plan qualité'],
        ['Quel est le rôle du Product Owner en Scrum ?', 'Défendre la vision produit et prioriser le backlog', 'Animer uniquement les rituels', 'Coder les fonctionnalités', 'Gérer les congés']
      ],
      difficile: [
        ['Quelle différence entre méthode agile et cycle en V ?', 'Agile : itérations courtes et adaptation ; cycle en V : phases séquentielles planifiées', 'Agile se pratique sans équipe', 'Le cycle en V est toujours moins cher', 'Aucune'],
        ['À quoi sert la gestion de la valeur acquise (EVM) ?', 'Comparer l\'avancement réel au planning et au budget', 'Calculer les salaires', 'Estimer la satisfaction', 'Choisir un fournisseur'],
        ['Que désigne la « marge » (float) d\'une tâche ?', 'Le retard possible sans décaler la fin du projet', 'Le budget de réserve', 'La marge du client', 'Le temps de réunion'],
        ['Qu\'est-ce qu\'un risque projet ?', 'Un événement incertain pouvant affecter les objectifs', 'Un retard certain', 'Une dépense prévue', 'Un problème déjà survenu'],
        ['Quel est le rôle du Scrum Master ?', 'Veiller à l\'application de Scrum et lever les obstacles', 'Prioriser le backlog', 'Superviser le budget', 'Remplacer le chef de projet'],
        ['À quoi sert une rétrospective ?', 'Identifier des améliorations pour le prochain cycle', 'Présenter le produit au client', 'Planifier le budget annuel', 'Évaluer chaque personne']
      ],
      expert: [
        ['Quelle est la formule d\'estimation PERT à trois points ?', '(optimiste + 4 × probable + pessimiste) / 6', 'Moyenne simple des trois valeurs', 'Optimiste × pessimiste', 'Probable + 2 × pessimiste'],
        ['Que fait la gestion des parties prenantes ?', 'Identifier et engager les personnes qui affectent ou sont affectées par le projet', 'Gérer les stocks', 'Piloter la trésorerie', 'Planifier les tests'],
        ['Qu\'est-ce que le « scope creep » ?', 'Une extension non maîtrisée du périmètre du projet', 'Une réduction du budget', 'Un retard de livraison', 'Le départ d\'un membre d\'équipe'],
        ['Un SPI (Schedule Performance Index) inférieur à 1 signifie…', 'Le projet est en retard sur son planning', 'Le projet est en avance', 'Le budget est dépassé', 'Le projet est terminé'],
        ['Que signifie le « fast-tracking » ?', 'Réaliser en parallèle des tâches prévues en séquence', 'Ajouter des ressources', 'Réduire le périmètre', 'Allonger les délais'],
        ['Que dit la loi de Brooks ?', 'Ajouter du monde à un projet en retard le retarde souvent davantage', 'Plus d\'équipe égale toujours plus vite', 'Réduire l\'équipe accélère toujours', 'Le budget n\'a aucun effet']
      ]
    } },
  { id: 'finance', label: 'Finance', desc: 'Marchés, comptabilité et gestion', pop: 1300, kw: /financ|compta/,
    q: {
      facile: [
        ['Qu\'est-ce qu\'un taux d\'intérêt ?', 'Le prix de l\'argent emprunté, en pourcentage', 'Une taxe', 'Un salaire', 'Un dividende'],
        ['Qu\'est-ce qu\'une action ?', 'Une part du capital d\'une entreprise', 'Un prêt à une entreprise', 'Un impôt', 'Un compte épargne'],
        ['Que désigne l\'inflation ?', 'Une hausse générale et durable des prix', 'Une baisse des prix', 'Une hausse des seuls salaires', 'Une hausse des taux'],
        ['Qu\'est-ce qu\'un budget ?', 'Une prévision de recettes et de dépenses', 'Un compte bancaire', 'Un prêt', 'Un impôt'],
        ['Qu\'est-ce qu\'un dividende ?', 'Une part des bénéfices versée aux actionnaires', 'Les intérêts d\'un prêt', 'Des frais bancaires', 'Une taxe'],
        ['Que signifie « épargner » ?', 'Mettre de l\'argent de côté', 'Dépenser davantage', 'Emprunter', 'Acheter à crédit']
      ],
      moyen: [
        ['Que mesure le « bénéfice net » ?', 'Le résultat après toutes les charges et impôts', 'Le chiffre d\'affaires', 'La trésorerie', 'La marge brute'],
        ['À quoi sert la diversification ?', 'Répartir ses placements pour réduire le risque', 'Concentrer l\'argent sur une action', 'Investir à court terme', 'Emprunter davantage'],
        ['Que signifie BFR ?', 'Besoin en fonds de roulement', 'Bilan financier réel', 'Bénéfice fiscal rapporté', 'Budget fixe recommandé'],
        ['Qu\'est-ce que l\'amortissement comptable ?', 'Répartir le coût d\'un bien durable sur sa durée d\'utilisation', 'Rembourser un prêt', 'Baisser un salaire', 'Vendre des actifs'],
        ['Quelle est la différence entre bilan et compte de résultat ?', 'Le bilan est une photo du patrimoine à une date ; le compte de résultat décrit les flux d\'une période', 'Le bilan décrit les impôts', 'C\'est la même chose', 'Le compte de résultat est facultatif'],
        ['Que décrit l\'effet de levier de l\'endettement ?', 'Il augmente la rentabilité des fonds propres si la rentabilité dépasse le coût de la dette', 'Il réduit les impôts', 'Il annule la dette', 'Il baisse toujours le risque']
      ],
      difficile: [
        ['Que signifie VAN ?', 'Valeur actuelle nette : flux futurs actualisés moins l\'investissement', 'Valeur annuelle nominale', 'Valeur ajoutée nette', 'Variation annuelle normale'],
        ['Que mesure le PER d\'une action ?', 'Le rapport du cours au bénéfice par action', 'Le taux de dividende', 'Le rendement d\'une obligation', 'Le rapport capital sur dettes'],
        ['Quand les taux d\'intérêt montent, le prix d\'une obligation déjà émise…', 'Baisse', 'Monte', 'Reste stable', 'Double'],
        ['Quelle est la valeur future avec intérêts composés ?', 'VP × (1 + t)^n', 'VP × t × n', 'VP / (1 + t)^n', 'VP + t'],
        ['Que signifie WACC ?', 'Le coût moyen pondéré du capital', 'Le coût marginal', 'Un taux de liquidité', 'Un ratio d\'actifs'],
        ['Comment calcule-t-on la liquidité générale ?', 'Actifs courants / dettes à court terme', 'Chiffre d\'affaires / résultat', 'Dette / capitaux propres', 'Résultat / actifs']
      ],
      expert: [
        ['Que dit le MEDAF ?', 'Rendement attendu = taux sans risque + bêta × prime de risque du marché', 'Rendement = taux sans risque × bêta', 'Rendement = PER × bêta', 'Rendement = dividende + inflation'],
        ['Que dit le théorème de Modigliani-Miller (sans impôts ni frictions) ?', 'La structure financière n\'affecte pas la valeur de l\'entreprise', 'La dette augmente toujours la valeur', 'Les dividendes détruisent la valeur', 'Les actions valent plus que la dette'],
        ['Que mesure la duration d\'une obligation ?', 'La sensibilité de son prix aux variations de taux', 'La durée du contrat', 'Le délai avant remboursement', 'La durée d\'un coupon'],
        ['Comment calcule-t-on le ratio de Sharpe ?', '(Rendement − taux sans risque) / écart-type', 'Rendement / bêta', 'Bénéfice / capitaux', 'Dividende / cours'],
        ['Qu\'est-ce qu\'un « call » ?', 'Une option donnant le droit d\'acheter un actif à un prix fixé', 'Une option de vente', 'Une obligation', 'Un contrat à terme obligatoire'],
        ['Que signifie EBITDA ?', 'Résultat avant intérêts, impôts, dépréciations et amortissements', 'Résultat net', 'Flux de trésorerie libre', 'Bénéfice après impôts']
      ]
    } },
  { id: 'culture', label: 'Culture générale', desc: 'Histoire, sciences, arts et monde', pop: 4200, kw: null,
    q: {
      facile: [
        ['Quelle est la capitale de l\'Australie ?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'],
        ['Quelle est la plus grande planète du système solaire ?', 'Jupiter', 'Saturne', 'La Terre', 'Mars'],
        ['Qui a peint la Joconde ?', 'Léonard de Vinci', 'Michel-Ange', 'Raphaël', 'Botticelli'],
        ['Combien de joueurs une équipe de football a-t-elle sur le terrain ?', '11', '10', '12', '9'],
        ['En quelle année la Révolution française a-t-elle commencé ?', '1789', '1799', '1769', '1815'],
        ['Quel est l\'océan le plus étendu ?', 'Le Pacifique', 'L\'Atlantique', 'L\'océan Indien', 'L\'Arctique']
      ],
      moyen: [
        ['Qui a écrit « Les Misérables » ?', 'Victor Hugo', 'Émile Zola', 'Honoré de Balzac', 'Gustave Flaubert'],
        ['Quel est le plus long fleuve de France ?', 'La Loire', 'La Seine', 'La Garonne', 'Le Rhône'],
        ['Quel est le symbole chimique de l\'or ?', 'Au', 'Ag', 'Or', 'Go'],
        ['Qui a découvert la pénicilline ?', 'Alexander Fleming', 'Louis Pasteur', 'Marie Curie', 'Robert Koch'],
        ['Quelle organisation internationale s\'occupe de la santé mondiale ?', 'L\'OMS', 'L\'OTAN', 'Le FMI', 'L\'OMC'],
        ['En quelle année l\'homme a-t-il marché sur la Lune ?', '1969', '1965', '1972', '1959']
      ],
      difficile: [
        ['Qui a formulé la théorie de la relativité générale ?', 'Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Stephen Hawking'],
        ['Quel traité de 1957 a fondé la Communauté économique européenne ?', 'Le traité de Rome', 'Le traité de Maastricht', 'Le traité de Lisbonne', 'Le traité de Versailles'],
        ['Quel est le plus grand désert chaud du monde ?', 'Le Sahara', 'Le Gobi', 'Le Kalahari', 'L\'Atacama'],
        ['Qui est l\'auteur du « Capital » ?', 'Karl Marx', 'Adam Smith', 'John Maynard Keynes', 'David Ricardo'],
        ['Quelle est la capitale du Canada ?', 'Ottawa', 'Toronto', 'Montréal', 'Vancouver'],
        ['Que mesure l\'échelle de Richter ?', 'La magnitude d\'un séisme', 'La vitesse du vent', 'La température', 'La pression atmosphérique']
      ],
      expert: [
        ['Quel philosophe a écrit la « Critique de la raison pure » ?', 'Emmanuel Kant', 'Hegel', 'Descartes', 'Nietzsche'],
        ['En quelle année le mur de Berlin est-il tombé ?', '1989', '1991', '1987', '1985'],
        ['Quel économiste a écrit « La Richesse des nations » ?', 'Adam Smith', 'John Maynard Keynes', 'Karl Marx', 'Milton Friedman'],
        ['Quel est l\'élément le plus abondant de l\'univers ?', 'L\'hydrogène', 'L\'oxygène', 'Le carbone', 'L\'hélium'],
        ['Quel exemple classique de théorie des jeux illustre la difficulté de coopérer ?', 'Le dilemme du prisonnier', 'Le paradoxe du menteur', 'Le problème du voyageur de commerce', 'Le théorème de Pythagore'],
        ['Quelle est la plus haute montagne du monde au-dessus du niveau de la mer ?', 'L\'Everest', 'Le K2', 'Le mont Blanc', 'Le Kilimandjaro']
      ]
    } }
];

// ---- Outils sur les identifiants de ligue ('theme:niveau', ex. 'marketing:moyen') ----
export function parseLeague(id) {
  const [t, l] = String(id || '').split(':');
  const theme = THEMES.find(x => x.id === t);
  const level = LEVELS.find(x => x.id === l);
  return theme && level ? { id, theme, level } : null;
}
export function leagueLabel(id) {
  const p = parseLeague(id);
  return p ? p.theme.label + ' · ' + p.level.label : '';
}
export function allLeagueIds() {
  const ids = [];
  THEMES.forEach(t => LEVELS.forEach(l => ids.push(t.id + ':' + l.id)));
  return ids;
}
// Ligues proposées d'après les matières et langues du profil (niveau moyen par défaut).
export function suggestedLeagues(texts) {
  const ids = [];
  THEMES.forEach(function (t) {
    if (t.kw && texts.some(x => t.kw.test(x))) ids.push(t.id + ':moyen');
  });
  return ids;
}

// Petite fonction de hachage : donne des nombres « aléatoires » mais stables (même ligue = mêmes chiffres).
function hash(str) {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
  return h;
}

// Nombre de joueurs simulé : thème populaire = plus de joueurs ; niveau plus dur = moins de joueurs.
const LEVEL_SHARE = { facile: 1, moyen: 0.7, difficile: 0.3, expert: 0.05 };
export function leaguePlayers(id) {
  const p = parseLeague(id);
  if (!p) return 0;
  const base = p.theme.pop * LEVEL_SHARE[p.level.id];
  return Math.round(base * (0.9 + (hash(id) % 20) / 100));
}
// Lot de la saison : débloqué à partir de minPlayers ; renforcé à partir de 3 fois le seuil.
export function leaguePrize(id) {
  const p = parseLeague(id);
  const n = leaguePlayers(id);
  const min = p.level.minPlayers;
  return { players: n, min, unlocked: n >= min, boosted: n >= min * 3, missing: Math.max(0, min - n), prize: p.level.prize, value: p.level.value };
}

// ---- Saison (un mois) ----
export function seasonKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
export function daysLeftInSeason() {
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - d) / 86400000));
}
// ---- Plafond quotidien : 10 duels classés par ligue et par jour (limite le « farming » de points) ----
export const DAILY_CAP = 10;
export function ensureDay() {
  const p = state.multi.plays;
  if (p.date !== todayStr()) { p.date = todayStr(); p.counts = {}; }
}
export function dailyPlayed(id) {
  ensureDay();
  return state.multi.plays.counts[id] || 0;
}
export function dailyLeft(id) { return Math.max(0, DAILY_CAP - dailyPlayed(id)); }
export function addDailyPlay(id) {
  ensureDay();
  state.multi.plays.counts[id] = dailyPlayed(id) + 1;
}

// ---- Montée et descente (classement) ----
// Fin de saison : les 3 premiers de la ligue montent d'un niveau, les 3 derniers descendent (sauf aux extrémités).
// Il faut avoir joué au moins MIN_PLAYED duels classés dans la saison pour être concerné.
export const ZONE = 3;
export const MIN_PLAYED = 3;
export function levelStep(id, delta) {
  const p = parseLeague(id);
  if (!p) return null;
  const i = LEVELS.findIndex(l => l.id === p.level.id) + delta;
  return i >= 0 && i < LEVELS.length ? p.theme.id + ':' + LEVELS[i].id : null;
}
// Situation actuelle dans une ligue : 'up' (zone de montée), 'down' (zone de descente) ou 'stay'.
export function zoneOf(id) {
  const rows = standings(id, 'general');
  const rank = rows.findIndex(r => r.me) + 1;
  if (rank <= ZONE && levelStep(id, 1)) return { zone: 'up', rank, to: levelStep(id, 1) };
  if (rank > rows.length - ZONE && levelStep(id, -1)) return { zone: 'down', rank, to: levelStep(id, -1) };
  return { zone: 'stay', rank, to: null };
}
// Applique la montée ou la descente d'une ligue : on quitte l'ancienne, on rejoint la nouvelle. Renvoie le mouvement.
export function settleSeason(id) {
  const st = myLeagueStats(id);
  if (st.played < MIN_PLAYED) return { kind: 'idle', from: id, to: id, need: MIN_PLAYED - st.played };
  const z = zoneOf(id);
  const m = state.multi;
  const move = { kind: z.zone === 'up' ? 'up' : z.zone === 'down' ? 'down' : 'stay', from: id, to: z.to || id, rank: z.rank };
  if (z.to) {
    m.joined = m.joined.filter(x => x !== id);
    if (!m.joined.includes(z.to)) m.joined.push(z.to);
  }
  m.leagues[id] = { points: 0, played: 0, wins: 0 };
  m.moves = [move].concat(m.moves).slice(0, 5);
  return move;
}
export function ensureSeason() {
  const m = state.multi;
  if (m.seasonKey !== seasonKey()) {
    // Nouvelle saison : on règle d'abord la saison écoulée (montées et descentes), puis on remet les points à zéro.
    const old = m.seasonKey;
    m.seasonKey = seasonKey(); // posé avant, pour que les calculs ci-dessous ne relancent pas ensureSeason
    if (old) m.joined.slice().forEach(function (id) { if ((m.leagues[id] || {}).played >= MIN_PLAYED) settleSeason(id); });
    m.leagues = {};
  }
}
export function myLeagueStats(id) {
  ensureSeason();
  return state.multi.leagues[id] || { points: 0, played: 0, wins: 0 };
}

// Classement de la saison pour une ligue, dans un cercle : 'general' (tous les joueurs fictifs), 'amis' (tes amis)
// ou 'promo' (une promo fictive). Toi inclus ; à égalité, tu passes devant.
export function standings(id, scope) {
  let base;
  if (scope === 'amis') {
    base = state.social.friends.map(function (name) {
      const known = LEAGUE_BOTS.find(b => b.name === name);
      return known || { name, points: 30 };
    });
  } else base = scope === 'promo' ? PROMO_BOTS : LEAGUE_BOTS;
  const rows = base.map(function (b) {
    const k = 0.6 + (hash(id + b.name) % 90) / 100; // le même joueur a les mêmes points dans tous les cercles
    return { name: b.name, points: Math.round(b.points * k * 1.4), me: false };
  });
  const mine = myLeagueStats(id);
  rows.push({ name: state.profile.pseudo, points: mine.points, me: true });
  rows.sort((a, b) => b.points - a.points || (a.me ? -1 : b.me ? 1 : 0));
  return rows;
}

// ---- Questions de la ligue ----
// Chaque ligne de la banque : [énoncé, bonne réponse, 3 mauvaises réponses].
export function leagueItems(id) {
  const p = parseLeague(id);
  return p ? p.theme.q[p.level.id] : [];
}
