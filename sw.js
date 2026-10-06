// Offline support. Pages: network first (so updates arrive), cache fallback. Everything else: cache first.
// Safari asks for audio in byte ranges, so cached audio is sliced into 206 responses.
const CACHE = 'apa-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'audio/roar.mp3', 'audio/bleat.mp3', 'audio/music.m4a', 'audio/music.mp3'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(FILES.map((f) => c.add(f)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      try { const r = await fetch(req); cache.put('index.html', r.clone()); return r; }
      catch { return (await cache.match('index.html')) || new Response('Offline', { status: 503 }); }
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (!hit) return fetch(req).catch(() => new Response('', { status: 504 }));
    const range = req.headers.get('range');
    const m = range && /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) return hit;
    const buf = await hit.arrayBuffer();
    const start = Number(m[1]), end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
    return new Response(buf.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1) } });
  })());
});
