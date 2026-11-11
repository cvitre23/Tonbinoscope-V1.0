const prefix = 'trombinoscope-demo:' + self.registration.scope + ':';
const cacheName = prefix + 'v3.3';
const files = [
  './', './index.html', './styles.css', './app.js', './vault.js', './passkey.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'
].map(path => new URL(path, self.registration.scope).href);

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(
    files.map(url => new Request(url, { cache: 'reload' }))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const root = self.registration.scope;
  if (url.origin !== self.location.origin) return;
  const isHome = event.request.mode === 'navigate' &&
    (url.pathname === new URL(root).pathname || url.pathname === new URL('./index.html', root).pathname);
  const key = isHome ? root : url.href;
  if (!files.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(key)) || fetch(event.request);
  })());
});
