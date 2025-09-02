// Turbó Szerviz Kezelő Service Worker
const CACHE_NAME = 'turbo-szerviz-v1.0.0';
const API_CACHE_NAME = 'turbo-api-cache-v1';

// Cached resources for offline use
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installed');
        return self.skipWaiting();
      })
  );
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== API_CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle offline/online requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests with IndexedDB fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(request).then((fetchResponse) => {
          // Cache successful responses
          if (fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return fetchResponse;
        });
      })
      .catch(() => {
        // Offline fallback
        if (request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

// Handle API requests with offline support
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const method = request.method;
  
  try {
    // Try network first
    const response = await fetch(request);
    
    if (response.ok && method === 'GET') {
      // Cache successful GET responses
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Network failed, trying offline mode:', url.pathname);
    
    // Network failed - use offline data from IndexedDB
    if (method === 'GET') {
      // Try to get cached response
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline data from IndexedDB
      return handleOfflineApiRequest(url.pathname, method);
    }
    
    if (method === 'POST' || method === 'PUT') {
      // Store offline mutations in IndexedDB
      return handleOfflineApiMutation(request);
    }
    
    // Return error response
    return new Response(JSON.stringify({ 
      error: 'Offline mode - network unavailable',
      offline: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle offline API requests
function handleOfflineApiRequest(pathname, method) {
  // Return mock response for offline mode
  const mockData = getOfflineMockData(pathname);
  
  return new Response(JSON.stringify(mockData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle offline mutations
async function handleOfflineApiMutation(request) {
  const data = await request.json();
  
  // Store in IndexedDB for later sync
  // This would integrate with the app's offline storage
  
  return new Response(JSON.stringify({ 
    success: true, 
    offline: true,
    id: generateOfflineId(),
    ...data
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Generate offline ID
function generateOfflineId() {
  return 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Mock data for offline mode
function getOfflineMockData(pathname) {
  const mockData = {
    '/api/': { message: 'Turbó Szerviz Kezelő API (Offline mód)' },
    '/api/clients': [],
    '/api/work-orders': [],
    '/api/car-makes': [
      { id: '1', name: 'BMW' },
      { id: '2', name: 'Audi' },
      { id: '3', name: 'Mercedes-Benz' },
      { id: '4', name: 'Volkswagen' }
    ],
    '/api/work-processes': [
      { id: '1', name: 'Szétszerelés', category: 'Disassembly', base_price: 80.0 },
      { id: '2', name: 'Tisztítás', category: 'Cleaning', base_price: 120.0 }
    ],
    '/api/turbo-parts': []
  };
  
  return mockData[pathname] || { error: 'Not found', offline: true };
}