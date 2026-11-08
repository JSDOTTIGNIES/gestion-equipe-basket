const CACHE='jsdottignies-shell-v7-logo';
const SHELL=['./','./index.html','./styles.css','./assets/icon-192.png','./assets/icon-512.png','./assets/logo-officiel.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.endsWith('/config.js')||u.pathname.endsWith('/app.js'))return;
 if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));
 else e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});
// Les push distants nécessitent un service d'envoi sécurisé à configurer sur Supabase.
self.addEventListener('push',e=>{if(!e.data)return;let payload={};try{payload=e.data.json()}catch{return}e.waitUntil(self.registration.showNotification(payload.title||'JS Dottignies',{body:payload.body||'Nouvelle convocation',icon:'./assets/icon-192.png',data:{url:'./'}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.openWindow(e.notification.data?.url||'./'));});
