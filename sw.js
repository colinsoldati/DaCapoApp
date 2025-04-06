// sw.js - Service Worker basique pour DaCapo.

const CACHE_NAME = 'dacapo-cache-v1';
// Fichiers essentiels à mettre en cache.
// Note: Les ressources externes (CDN Tailwind, Fonts) ne sont pas mises en cache ici
// pour simplifier. L'app nécessitera une connexion pour ces éléments.
const urlsToCache = [
  '/', // La racine, souvent votre index.html
  'index.html', // Explicitement le fichier HTML
  // Ajoutez ici d'autres ressources locales si nécessaire (ex: 'style.css', 'app.js' si séparés)
];

// Événement d'installation : mise en cache des ressources initiales
self.addEventListener('install', event => {
  console.log('[Service Worker] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Mise en cache des fichiers de l\'application');
        // Important: addAll est atomique. Si un fichier échoue, tout échoue.
        return cache.addAll(urlsToCache).catch(error => {
          console.error('[Service Worker] Échec de la mise en cache initiale:', error);
          // Ne pas empêcher l'installation si le cache initial échoue (stratégie possible)
        });
      })
      .then(() => {
        console.log('[Service Worker] Installation terminée, fichiers mis en cache.');
        // Force le service worker installé à devenir actif immédiatement
        return self.skipWaiting();
      })
  );
});

// Événement d'activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activation...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Suppression de l\'ancien cache :', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation terminée, anciens caches nettoyés.');
      // Prend le contrôle de la page immédiatement
      return self.clients.claim();
    })
  );
});

// Événement fetch : intercepter les requêtes réseau
self.addEventListener('fetch', event => {
  // Nous ne gérons que les requêtes GET pour la mise en cache
  if (event.request.method !== 'GET') {
    return;
  }

  // Stratégie : Cache d'abord, puis réseau (Cache falling back to network)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si la réponse est dans le cache, la retourner
        if (cachedResponse) {
          // console.log('[Service Worker] Ressource trouvée dans le cache :', event.request.url);
          return cachedResponse;
        }

        // Sinon, essayer de récupérer depuis le réseau
        // console.log('[Service Worker] Ressource non trouvée dans le cache, récupération réseau :', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Vérifier si nous avons reçu une réponse valide
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
               // Ne pas mettre en cache les réponses invalides ou non-basic (ex: CDN opaque responses)
               // console.log('[Service Worker] Réponse réseau invalide, non mise en cache :', event.request.url);
               return networkResponse;
            }

            // Cloner la réponse car elle ne peut être consommée qu'une fois
            const responseToCache = networkResponse.clone();

            // Mettre la nouvelle réponse en cache pour une utilisation future
            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log('[Service Worker] Mise en cache de la nouvelle ressource :', event.request.url);
                cache.put(event.request, responseToCache);
              });

            // Retourner la réponse réseau originale au navigateur
            return networkResponse;
          }
        ).catch(error => {
           console.error('[Service Worker] Erreur de récupération réseau :', error);
           // Optionnel: Retourner une page hors ligne personnalisée ici
           // return caches.match('offline.html');
        });
      })
  );
});
