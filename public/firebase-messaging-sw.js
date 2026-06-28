/* Firebase Cloud Messaging service worker — handles BACKGROUND push (tab not
 * focused / closed) and OS-notification clicks. Foreground pushes are handled
 * by the app via src/lib/fcm.ts (onMessage).
 *
 * Served from the origin root (/firebase-messaging-sw.js) so FCM can use it.
 * This file runs OUTSIDE the bundler and cannot read Vite env vars, so the
 * messaging config below must be kept in sync with the VITE_FIREBASE_* values
 * in .env (it is public web config, safe to commit).
 *
 * Until real values are filled in, background push is inert.
 */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyBEm8btwePIHHYpSs41zebr6KmHIuWinA0',
  authDomain: 'bingoo-22222.firebaseapp.com',
  projectId: 'bingoo-22222',
  messagingSenderId: '741831724264',
  appId: '1:741831724264:web:6741494f37bd0bd0d34d5d',
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Background messages — render the OS notification.
  messaging.onBackgroundMessage(({ notification, data }) => {
    if (!notification) return;
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: '/favicon.ico',
      data: data || {},
    });
  });
}

// Deep-link when the user clicks the OS notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
