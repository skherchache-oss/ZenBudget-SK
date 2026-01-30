const CACHE_NAME = 'zenbudget-v2'; // Changement de version pour forcer le refresh
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
      // On utilise addAll mais on ne bloque pas si certains assets échouent
      return cache.addAll(ASSETS).catch(err => console.warn("Erreur mise en cache initiale:", err));
    })
  );
  self.skipWaiting();
});

// Activation : Nettoyage radical des anciens caches
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
  // Prend le contrôle des pages immédiatement
  self.clients.claim();
});

// Stratégie : Stale-While-Revalidate (La plus sûre pour une PWA)
// On sert le cache immédiatement MAIS on met à jour le cache en arrière-plan
self.addEventListener('fetch', (event) => {
  // On ne gère pas les requêtes vers l'API Gemini ou les extensions Chrome
  if (!event.request.url.startsWith('http') || event.request.url.includes('generativelanguage')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Si la réponse est valide, on met à jour le cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // En cas de panne réseau totale, on espère avoir le match en cache
          return response;
        });

        // On retourne la réponse du cache si elle existe, sinon on attend le réseau
        return response || fetchPromise;
      });
    })
  );
});