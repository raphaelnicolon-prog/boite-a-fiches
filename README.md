# Boîte à Fiches

Application de révision par petites sessions, pensée pour le téléphone : fiches de cours (école de commerce) et apprentissage de l'italien dans un même moteur de révision.

Projet personnel, construit pour répondre à un besoin réel (mes propres révisions) et testé avec des camarades de promotion.

## Fonctionnalités

- **Rubriques** (Révisions, Langues, ou les tiennes) → **paquets** → **cartes**, réorganisables par glisser-déposer.
- **Modes de révision** : Flashcard, QCM, Texte à trous, Appariement (par lots de 6 maximum) et **Quizz Medley** (mélange de tous les modes).
- **Planification façon Leitner** : une mauvaise réponse remet la carte à zéro, une bonne réponse espace les rappels (0, 1, 3, 7, 16, 30 jours). Un seul score de maîtrise par carte, quel que soit le mode.
- **Lecture audio** des mots (voix du téléphone) pour les paquets de langue.
- **Ajout en masse** de cartes (`recto ; verso`), **sauvegarde / restauration** en fichier, **« Supprimé récemment »** (30 jours).
- **Installable** sur l'écran d'accueil (PWA) et utilisable hors-ligne.

## Choix techniques

HTML, CSS et JavaScript sans framework ni outil de build : le code reste lisible de bout en bout. Les données sont stockées dans le navigateur (`localStorage`), sans serveur ni compte.

```
index.html          page unique
css/styles.css      thème sombre
js/state.js         données et fonctions utilitaires
js/storage.js       sauvegarde navigateur + import/export
js/render.js        affichage des écrans
js/app.js           actions des boutons
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

## Pistes pour la suite

Import de cours par IA (PDF, photos de notes manuscrites) et mode multijoueur en direct : ils demandent un petit back-end.
