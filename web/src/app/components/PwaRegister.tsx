"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
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
          "NKRN service worker registration failed.",
          error
        );
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}