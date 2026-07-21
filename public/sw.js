// Service Worker for Choir Collective Web Push Notifications
// File: public/sw.js

self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Choir Collective Alert';
    const options = {
      body: data.body || '',
      icon: data.icon || '/collective-logo.png',
      badge: '/collective-logo.png',
      tag: data.tag || 'choir-urgent-alert',
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || '/dashboard',
      },
      vibrate: [200, 100, 200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event:', err);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
