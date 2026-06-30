/* Service worker - Gestion Contrats / Rémunération
 *
 * Stratégie :
 *  - Code & markup de l'app (HTML / JS / CSS / manifest) : NETWORK-FIRST.
 *    Indispensable pour que index.html et app.js/logic.js restent toujours
 *    cohérents : un index.html mis à jour ne doit jamais être servi avec un
 *    app.js périmé du cache (sinon le formulaire plante, cf. #contractIagType).
 *    Repli sur le cache quand on est hors-ligne.
 *  - Assets lourds et quasi immuables (icônes, librairie Chart.js) : CACHE-FIRST
 *    pour un chargement instantané et un vrai fonctionnement hors-ligne.
 *
 * Incrémentez CACHE_VERSION à chaque mise à jour des fichiers mis en cache.
 */
const CACHE_VERSION = 'v6';
const CACHE_NAME = `remuneration-${CACHE_VERSION}`;

// Chemins relatifs au scope du service worker (fonctionne quel que soit
// le sous-dossier d'hébergement, ex: GitHub Pages /rem_bastien/).
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './logic.js',
  './app.js',
  './chart.umd.min.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// Code/markup propre à l'app : doit toujours rester synchronisé avec la version
// déployée. Tout le reste (Chart.js, icônes) est traité en cache-first.
const APP_CODE = /\/(?:index\.html|app\.js|logic\.js|style\.css|manifest\.webmanifest)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // allSettled : une ressource manquante ne fait pas échouer l'installation.
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Réseau d'abord : récupère la version fraîche, met le cache à jour au passage,
// et se replie sur le cache (puis index.html) en cas d'échec réseau.
function networkFirst(req) {
  return fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
    }
    return res;
  }).catch(() =>
    caches.match(req).then((cached) => cached || caches.match('./index.html'))
  );
}

// Cache d'abord, puis réseau (et on met en cache au passage).
function cacheFirst(req) {
  return caches.match(req).then((cached) => {
    if (cached) return cached;
    return fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return res;
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que les GET same-origin.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations + code de l'app : network-first (cohérence HTML/JS/CSS garantie).
  if (req.mode === 'navigate' || APP_CODE.test(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Autres ressources (icônes, Chart.js…) : cache-first.
  event.respondWith(cacheFirst(req));
});
