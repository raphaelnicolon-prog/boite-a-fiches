# Boîte à Fiches

Application de révision par petites sessions, pensée pour le téléphone : fiches de cours (école de commerce) et apprentissage des langues dans un même moteur de révision.

Projet personnel, construit pour répondre à un besoin réel (mes propres révisions) et testé avec des camarades de promotion. **C'est un prototype** : certaines fonctions (IA, multijoueur, Premium, partenaires) sont des maquettes fonctionnelles qui illustrent la version finale.

Application en ligne : https://raphaelnicolon-prog.github.io/boite-a-fiches/ (installable sur l'écran d'accueil du téléphone, utilisable hors-ligne).

## Ce qui fonctionne pour de vrai

- **Rubriques → paquets → cartes**, réorganisables par glisser-déposer, avec modification, suppression et « Supprimé récemment » (30 jours).
- **5 modes de révision** : flashcard, QCM, texte à trous (y compris phrases à trous en contexte), appariement par lots, et **Quizz Medley** qui les mélange.
- **Répétition espacée (Leitner)** : une mauvaise réponse remet la carte à zéro, une bonne espace les rappels (0, 1, 3, 7, 16, 30 jours). Un seul score de maîtrise par carte.
- **Nudges de rétention** : série de jours, objectif quotidien, histogramme de la semaine, rappel quotidien, badges et niveaux, « le saviez-vous ? » et articles « Découvrir ».
- **Création de contenu** : ajout en masse (`recto ; verso`), création d'un paquet **à partir d'un texte de cours** (analyse locale des définitions), lecture audio des mots (voix du téléphone).
- **Données** : stockées sur l'appareil, sauvegarde/restauration en fichier, profil (pseudo, avatar).

## Maquettes (simulées pour la démonstration)

- **Création de paquet par IA** : l'IA est simulée sur quelques thèmes préparés (`js/demo.js`), avec écran de relecture avant ajout.
- **Freemium** : quota de 3 générations IA par jour puis écran Premium, sans paiement réel.
- **Multijoueur** : duels (QCM, vrai/faux, phrase à trous, course d'appariement, Medley) contre un adversaire simulé, ligue hebdomadaire avec zone de lots, amis dans un annuaire fictif (`js/duel.js`).
- **Partenaires** : liens vers des cours en ligne.

L'écran **Réglages → Présentation du projet** résume le besoin, le modèle économique (freemium, affiliation, lots sponsorisés), la rétention, les risques et la feuille de route.

## Choix techniques

HTML, CSS et JavaScript sans framework ni outil de build : le code reste lisible de bout en bout. Les données sont stockées dans le navigateur (`localStorage`), sans serveur ni compte.

```
index.html          page unique
css/styles.css      thème sombre
js/state.js         données, statistiques et fonctions utilitaires
js/storage.js       sauvegarde navigateur + import/export contrôlé
js/render.js        affichage des écrans
js/app.js           actions des boutons
js/duel.js          duels multijoueur (adversaire simulé)
js/demo.js          contenus simulés et jeu de données de démonstration
js/dragdrop.js      glisser-déposer
service-worker.js   mode hors-ligne
manifest.json       installation sur l'écran d'accueil
```

## Lancer en local

Les service workers exigent un serveur (pas un double-clic sur le fichier) :

```bash
python3 -m http.server 8765
```

puis ouvrir http://localhost:8765

## Suite prévue

Vrais comptes et amis, vraie IA via un serveur sécurisé (clé secrète), duels en temps réel, import de cours (PDF, photos de notes manuscrites), notifications de rappel, paiements.
