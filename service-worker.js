// Permet à l'appli de continuer à fonctionner sans connexion internet, une
// fois qu'elle a été ouverte au moins une fois. Change CACHE_VERSION quand tu
// modifies les fichiers ci-dessous, pour forcer les téléphones à récupérer
// la nouvelle version au lieu de garder l'ancienne en cache indéfiniment.
const CACHE_VERSION = 'v31';
const CACHE_NAME = 'boite-a-fiches-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/state.js',
  './js/storage.js',
  './js/render.js',
  './js/dragdrop.js',
  './js/demo.js',
  './js/duel.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' = on va chercher les fichiers frais sur le serveur, sans
      // se contenter d'une copie que le navigateur aurait gardée de son côté.
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stratégie "cache d'abord, réseau en secours" : rapide et marche hors-ligne,
// au prix de pouvoir servir une version un peu ancienne d'un fichier tant que
// le cache n'a pas été mis à jour (normal pour ce genre d'appli).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
