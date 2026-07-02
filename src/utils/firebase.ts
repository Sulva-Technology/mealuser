// Firebase Cloud Messaging (web push) init.
//
// The firebaseConfig below is the public client config for the mealdirect-2192b
// project — it is safe to ship to browsers (it is not a secret; access is gated
// by Firebase Security Rules + App Check on the backend). The SAME literal config
// is duplicated in public/firebase-messaging-sw.js because a service worker cannot
// import this module; keep the two in sync.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey: 'AIzaSyAYKfgVS5WGsbZLQ42dsKTJy98fRRjj1w8',
  authDomain: 'mealdirect-2192b.firebaseapp.com',
  projectId: 'mealdirect-2192b',
  storageBucket: 'mealdirect-2192b.firebasestorage.app',
  messagingSenderId: '99018858239',
  appId: '1:99018858239:web:9ff663f20b28f8c5d036ca',
  measurementId: 'G-34V8S6D2GF',
};

let app: FirebaseApp | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

function getApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

// Returns a Messaging instance, or null when FCM is unsupported in this browser
// (e.g. no service worker / Push API, some in-app webviews, Safari < 16.4).
// Memoized so we only feature-detect + init once.
export function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((ok) => (ok ? getMessaging(getApp()) : null))
      .catch(() => null);
  }
  return messagingPromise;
}
