importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();

// Data-only messages: we build the notification ourselves (calls get action buttons + long vibration).
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const isCall = d.call === '1';
  self.registration.showNotification(d.title || 'Magma Chat Room', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: isCall ? 'call-' + d.id : (d.kind || 'msg') + '-' + (d.path || ''),
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [600, 300, 600, 300, 600, 300, 600, 300, 600] : [200, 100, 200],
    data: { path: d.path || '/' },
    actions: isCall
      ? [{ action: 'accept', title: '📞 Aceptar' }, { action: 'decline', title: '❌ Rechazar' }]
      : [],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'decline') return;
  const target = new URL(event.notification.data?.path || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) { await c.focus(); c.navigate(target); return; }
    }
    await clients.openWindow(target);
  })());
});
