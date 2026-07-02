/* Firebase Cloud Messaging background service worker.
 *
 * Handles pushes while the app is backgrounded/closed. The firebaseConfig here
 * is the public client config (safe to ship) and MUST stay in sync with
 * src/utils/firebase.ts. Version pinned to the installed `firebase` npm major.
 */
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAYKfgVS5WGsbZLQ42dsKTJy98fRRjj1w8',
  authDomain: 'mealdirect-2192b.firebaseapp.com',
  projectId: 'mealdirect-2192b',
  storageBucket: 'mealdirect-2192b.firebasestorage.app',
  messagingSenderId: '99018858239',
  appId: '1:99018858239:web:9ff663f20b28f8c5d036ca',
  measurementId: 'G-34V8S6D2GF'
});

const messaging = firebase.messaging();

// Show a notification for data-only messages. (For "notification" payloads the
// SDK/browser already displays one automatically, so we skip to avoid dupes.)
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return;
  const data = payload.data || {};
  const title = data.title || 'Meal Direct';
  self.registration.showNotification(title, {
    body: data.body || data.message || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || data.linkPath || '/' }
  });
});

// Focus an existing tab (or open one) when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data && (event.notification.data.url || event.notification.data.FCM_MSG?.data?.url)) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
