/* Service worker магазина: быстрая загрузка, работа при плохой связи и офлайн-страница.
   Данные (цены, наличие, корзина, заказы) всегда берутся из сети — API не кешируется. */
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const IMAGES_CACHE = `images-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_IMAGES = 300;
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.disable();
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API, админка и служебные запросы — только сеть
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname === "/sw.js") return;

  // Статика Next.js с хешем в имени — неизменяемая, отдаём из кеша
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Фото товаров: сразу из кеша, в фоне обновляем
  if (url.pathname.startsWith("/media/")) {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) {
              cache.put(request, res.clone());
              trim(IMAGES_CACHE, MAX_IMAGES);
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  // Страницы: сначала сеть (актуальные цены), при отсутствии связи — сохранённая копия или офлайн-страница
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(PAGES_CACHE).then((c) => c.put(request, copy).then(() => trim(PAGES_CACHE, MAX_PAGES)));
          }
          return res;
        } catch {
          return (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});
