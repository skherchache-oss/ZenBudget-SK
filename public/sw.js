const CACHE_NAME = 'zenbudget-v2.1'; // Version incrémentée
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
      return cache.addAll(ASSETS).catch(err => console.warn("Erreur mise en cache initiale:", err));
    })
  );
  self.skipWaiting();
});

// Activation : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie : Stale-While-Revalidate avec exclusions critiques
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // NE PAS INTERCEPTER : Requêtes Firebase, Gemini, et requêtes non-GET
  if (
    !url.startsWith('http') || 
    event.request.method !== 'GET' ||
    url.includes('generativelanguage') || 
    url.includes('firestore.googleapis.com') || 
    url.includes('firebaseinstallations.googleapis.com') ||
    url.includes('identitytoolkit.googleapis.com') ||
    url.includes('google-analytics')
  ) {
    return; // On laisse le navigateur gérer directement
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // On met à jour le cache si la réponse est valide
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          return cachedResponse;
        });

        // Retourne la version cachée si elle existe, sinon attend le réseau
        return cachedResponse || fetchPromise;
      });
    })
  );
});