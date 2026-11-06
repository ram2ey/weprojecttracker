// Retirement worker for previous opt-in offline installations.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith("wassa-public-"))await caches.delete(key);await self.clients.claim();await self.registration.unregister();})()));
