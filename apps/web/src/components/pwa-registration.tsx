'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Unable to register the static-only PWA service worker.', error);
    });
  }, []);

  return null;
}
