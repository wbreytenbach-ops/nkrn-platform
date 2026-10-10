"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // A service worker from a previous production build can otherwise make
    // local development appear to jump back to an older homepage.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ("caches" in window) {
        void caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("nkrn-") || key.startsWith("tygies-"))
              .map((key) => caches.delete(key))
          )
        );
      }

      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
            }
          );

        await registration.update();
      } catch (error) {
        console.error(
          "Tygerpoort service worker registration failed.",
          error
        );
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
