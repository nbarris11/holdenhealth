/* No page or message caching: authenticated data stays on the server. */
self.addEventListener('push', event => {
 let data = {};
 try { data = event.data?.json() || {}; } catch {}
 const valid = /^\/(portal|admin)\/communicate\?conversation=[0-9a-f-]{36}$/.test(data.url || '');
 event.waitUntil(self.registration.showNotification('Holden Health', {
 body: 'You have a new message in Holden Health.',
 icon: '/apple-icon.png', tag: typeof data.tag === 'string' ? data.tag : 'holden-chat',
 data: { url: valid ? data.url : '/portal/communicate' }
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const url = new URL(event.notification.data?.url || '/portal/communicate', self.location.origin).href;
 event.waitUntil((async () => {
 const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for (const client of windows) if (new URL(client.url).origin === self.location.origin) {
 await client.navigate(url); return client.focus();
 }
 return self.clients.openWindow(url);
 })());
});
