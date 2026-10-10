const CACHE_VERSION = "tygies-static-v3";
const STATIC_CACHE = CACHE_VERSION;

const PRECACHE_URLS = [
  "/tygie-logo.png",
  "/wit-logo-tygies.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS)
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("nkrn-") || key.startsWith("tygies-")) &&
                key !== STATIC_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never cache or intercept live API traffic.
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Never intercept cross-origin traffic.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Fingerprinted Next.js assets are safe to cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        if (cached) {
          return cached;
        }

        const response = await fetch(request);

        if (response.ok) {
          cache.put(request, response.clone());
        }

        return response;
      })
    );

    return;
  }

  // Static visual assets.
  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        const networkPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(
                request,
                response.clone()
              );
            }

            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const networkResponse =
          await networkPromise;

        if (networkResponse) {
          return networkResponse;
        }

        return Response.error();
      })
    );

    return;
  }

  // Application pages remain network-first.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<meta
  name="theme-color"
  content="#0b0b0d"
>
<title>Tygerpoort Offline</title>

<style>
html,
body {
  margin: 0;
  min-height: 100%;
  background: #0b0b0d;
  color: #f4f4f5;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body {
  display: grid;
  place-items: center;
  padding: 24px;
}

main {
  max-width: 520px;
  border: 1px solid #27272a;
  border-radius: 22px;
  background: #111113;
  padding: 28px;
  box-shadow:
    0 20px 60px rgba(0,0,0,.35);
}

h1 {
  margin: 0 0 10px;
  font-size: 26px;
}

p {
  margin: 0;
  color: #a1a1aa;
  line-height: 1.6;
}

strong {
  color: #e4e4e7;
}
</style>
</head>

<body>
<main>
  <h1>Tygerpoort is offline</h1>

  <p>
    This device cannot reach the Tygerpoort
    server right now.
    <strong>
      No live school data has been cached.
    </strong>
    Reconnect to the network and try again.
  </p>
</main>
</body>
</html>`,
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/html; charset=utf-8",

                "Cache-Control":
                  "no-store",
              },
            }
          )
      )
    );
  }
});
