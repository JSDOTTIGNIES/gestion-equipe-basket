const CACHE='jsdottignies-shell-v11-1-ride';
const SHELL=['./','./index.html','./styles.css','./assets/icon-192.png','./assets/icon-512.png','./assets/logo-officiel.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.endsWith('/config.js')||u.pathname.endsWith('/app.js')||u.pathname.endsWith('/service-worker.js'))return;
 if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
 else e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
// Les notifications utilisent une souscription Web Push par téléphone, créée après consentement.
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{}}catch{payload={body:event.data?.text()||''}}
 event.waitUntil(self.registration.showNotification(payload.title||'JS Dottignies',{
  body:payload.body||'Nouvelle convocation',
  icon:'./assets/icon-192.png',badge:'./assets/icon-192.png',tag:'jsd-'+(payload.url||'new'),
  data:{url:payload.url||'./'},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'./',self.registration.scope).href;
 event.waitUntil((async()=>{
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(client.url.startsWith(self.registration.scope)){await client.navigate(url);return client.focus()}}
  return clients.openWindow(url);
 })());
});
