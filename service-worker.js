/**
 * service-worker.js
 * =====================================================================
 * PWA Service Worker — "Selamanya Itu Lama Banget" Novel Reader
 *
 * Strategi:
 *  • Cache-first untuk semua asset lokal (HTML, audio, gambar, ikon)
 *  • Network-first untuk Google Fonts agar selalu mendapat font terbaru
 *  • Pesan SKIP_WAITING dari kode utama untuk update seamless
 * =====================================================================
 */

const CACHE_NAME      = 'novel-ariel-alie-v2';
const FONTS_CACHE     = 'novel-fonts-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './asset/preview.jpg',
  './audio/robbers.mp3',
  './audio/breathe.mp3',
  './audio/somebody.mp3',
  './audio/cute.mp3',
  './audio/about_you.mp3',
  './audio/kota.mp3',
  './audio/watchsleep.mp3',
  './audio/default_1.mp3',
  './audio/default_2.mp3',
];

// ──────────────────────────────────────────
// INSTALL — Pre-cache semua asset utama
// ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Gunakan addAll dengan catch individual agar satu file gagal
      // tidak membatalkan seluruh install
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Gagal cache:', url, err);
          })
        )
      );
    })
  );
  // Langsung aktif setelah install selesai (tanpa menunggu tab lama ditutup)
  self.skipWaiting();
});

// ──────────────────────────────────────────
// ACTIVATE — Hapus cache versi lama
// ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== FONTS_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ──────────────────────────────────────────
// FETCH — Strategi Cache-first / Network-first
// ──────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya tangani request GET
  if (request.method !== 'GET') return;

  // ── Google Fonts: Network-first, fallback ke cache ──
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(FONTS_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ── Asset lokal: Cache-first, fallback ke network ──
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Hanya cache response yang valid
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        return response;
      });
    })
  );
});

// ──────────────────────────────────────────
// MESSAGE — Terima pesan SKIP_WAITING dari UI
// ──────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
