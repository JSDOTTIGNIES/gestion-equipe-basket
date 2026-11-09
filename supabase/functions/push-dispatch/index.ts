// JS Dottignies — Web Push dispatcher (Supabase Edge Function).
// Invocation serveur uniquement : X-Cron-Secret doit correspondre à CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!; // mailto:club@example.org ou URL HTTPS
const admin = createClient(URL,SERVICE_KEY,{auth:{persistSession:false}});
webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
const bad = (message:string,status=500)=>Response.json({error:message},{status});

Deno.serve(async (req)=>{
 if(req.method!=='POST')return bad('Méthode non autorisée',405);
 if(!CRON_SECRET || req.headers.get('x-cron-secret')!==CRON_SECRET)return bad('Non autorisé',401);
 try {
  const {error:remErr}=await admin.rpc('enqueue_24h_reminders');if(remErr)throw remErr;
  const {data:events,error:evtErr}=await admin.from('push_events').select('id,match_id,player_id,kind,created_at').is('delivered_at',null).order('created_at').limit(60);
  if(evtErr)throw evtErr;
  let sent=0,errors=0;
  for(const event of events||[]){
   // Ne pas notifier les convocations annulées ou un parent ayant déjà répondu.
   const {data:selection}=await admin.from('selections').select('player_id').eq('match_id',event.match_id).eq('player_id',event.player_id).maybeSingle();
   const {data:match}=await admin.from('matches').select('match_date,match_time,home_team,away_team,is_home').eq('id',event.match_id).maybeSingle();
   if(!selection||!match){await admin.from('push_events').update({delivered_at:new Date().toISOString()}).eq('id',event.id);continue}
   if(event.kind==='reminder_24h'){
    const {data:answered}=await admin.from('child_attendance').select('player_id').eq('match_id',event.match_id).eq('player_id',event.player_id).maybeSingle();
    if(answered){await admin.from('push_events').update({delivered_at:new Date().toISOString()}).eq('id',event.id);continue}
   }
   const {data:parents,error:parentErr}=await admin.from('parent_roles').select('user_id').eq('player_id',event.player_id);
   if(parentErr)throw parentErr;
   const users=(parents||[]).map(p=>p.user_id);
   if(!users.length){ // Ne pas perdre les invitations si les parents ne sont pas encore inscrits.
    if(Date.now()-new Date(event.created_at).getTime()>7*86400000)await admin.from('push_events').update({delivered_at:new Date().toISOString()}).eq('id',event.id);
    continue;
   }
   const {data:subs,error:subErr}=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth_secret').in('user_id',users);
   if(subErr)throw subErr;
   if(!subs?.length)continue; // Attend l'activation des notifications sur les téléphones.
   const {data:done,error:doneErr}=await admin.from('push_deliveries').select('subscription_id').eq('event_id',event.id);
   if(doneErr)throw doneErr;
   const finished=new Set((done||[]).map(x=>x.subscription_id));
   const rival=match.is_home?match.away_team:match.home_team;
   const title=event.kind==='convocation'?'JS Dottignies · Nouvelle convocation':'JS Dottignies · Rappel 24 h';
   const body=event.kind==='convocation'?`Match contre ${rival} le ${match.match_date}. Confirmez la présence de votre enfant.`:`Match contre ${rival} dans 24 h. Votre réponse est attendue.`;
   let allGood=true;
   for(const sub of subs){
    if(finished.has(sub.id))continue;
    try{
     await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify({title,body,url:`./?match=${encodeURIComponent(event.match_id)}`}),{TTL:86400,urgency:'normal'});
     const {error:writeErr}=await admin.from('push_deliveries').upsert({event_id:event.id,subscription_id:sub.id},{onConflict:'event_id,subscription_id'});
     if(writeErr)throw writeErr;
     sent++;
    }catch(e){
     const status=(e as {statusCode?:number}).statusCode;
     if(status===404||status===410){await admin.from('push_subscriptions').delete().eq('id',sub.id);continue}
     allGood=false;errors++;console.error('Web Push delivery failed',event.id,status||e);
    }
   }
   if(allGood){const {error:markErr}=await admin.from('push_events').update({delivered_at:new Date().toISOString()}).eq('id',event.id);if(markErr)throw markErr}
  }
  return Response.json({ok:true,events:events?.length||0,sent,errors});
 }catch(e){console.error('push-dispatch',e);return bad('Erreur de distribution des notifications')}
});
