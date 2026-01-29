const CACHE_NAME = 'zenbudget-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ZB-logo-192.png',
  '/ZB-logo-512.png'
];

// Installation : Mise en cache des fichiers de base
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Force la mise à jour immédiate
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Stratégie : Network First (Priorité au réseau, sinon cache)
// C'est la meilleure stratégie pour une app de budget afin d'avoir les données fraîches
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});