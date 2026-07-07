/* ============================================================
   إنجاز — Service Worker
   يوفّر عمل التطبيق بدون إنترنت عبر تخزين الملفات الأساسية مؤقتًا
   ============================================================ */

const CACHE_VERSION = 'injaz-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/* الملفات الأساسية التي يجب تخزينها فور التثبيت
   حتى يفتح التطبيق كاملًا وهو بدون إنترنت */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './offline.html',
  './icons/favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon-120.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-167.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png'
];

/* ===================== التثبيت (Install) ===================== */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ===================== التفعيل (Activate) ===================== */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('injaz-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* ===================== استراتيجية الجلب (Fetch) =====================
   - لملفات HTML (التنقل): جرّب الشبكة أولًا، وإن فشلت استخدم الكاش،
     وإن لم يوجد استخدم offline.html.
   - لبقية الملفات (CSS/JS/صور/خطوط): استخدم الكاش أولًا لسرعة أعلى،
     وحدّثه في الخلفية من الشبكة إن كانت متاحة (Stale-While-Revalidate).
================================================================== */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // نتجاهل الطلبات من نوع غير GET (مثل POST) ونتركها تمر عادي
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // طلبات التنقل بين الصفحات (فتح التطبيق نفسه)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./offline.html'))
        )
    );
    return;
  }

  // نفس النطاق (ملفات المشروع): كاش أولًا مع تحديث بالخلفية
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const resClone = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, resClone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // موارد خارجية (مثل خطوط Google): جرّب الشبكة، واحفظها في الكاش كنسخة احتياطية
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
