/* JS Dottignies — interface GitHub Pages + Supabase */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = {db:null,user:null,coach:false,players:[],matches:[],selections:[],assignments:[],guardians:[],offers:[],links:[],responses:[],attendance:[],parentRoles:[],view:'matches'};
const formatDate = (iso) => new Intl.DateTimeFormat('fr-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
const month = (iso) => new Intl.DateTimeFormat('fr-BE',{month:'short',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
const hm = (t) => t ? String(t).slice(0,5).replace(':','h') : 'À définir';
const teamClean = (s) => String(s||'').replace(/^RU14H\s+/i,'');
const rival = (m) => teamClean(m.is_home?m.away_team:m.home_team);
let toastTimer;
function toast(msg){const e=$('toast');e.textContent=msg;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),4200)}
function mustOk(result){if(result.error)throw result.error;return result.data}
const isSetup = () => !window.JS_CONFIG || !/^https:\/\/.+\.supabase\.co\/?$/.test(window.JS_CONFIG.supabaseUrl||'') || !window.JS_CONFIG.supabaseAnonKey || window.JS_CONFIG.supabaseAnonKey.startsWith('VOTRE_');
async function boot(){
 if(isSetup()||!window.supabase){$('setup').hidden=false;return;}
 state.db=window.supabase.createClient(window.JS_CONFIG.supabaseUrl,window.JS_CONFIG.supabaseAnonKey,{auth:{detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
 state.db.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;setTimeout(()=>refreshAuth(),0)});
 await refreshAuth();
 await loadRegistrationPlayers();
}

async function loadRegistrationPlayers(){
 try{const result=await state.db.rpc('list_public_players');if(result.error)throw result.error;
 $('registerChild').innerHTML='<option value="">Choisir son enfant</option>'+(result.data||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
 }catch(e){console.warn('Liste des joueurs inaccessible',e);}
}

let refreshing=false;
async function refreshAuth(){
 if(refreshing)return;refreshing=true;
 try{
  const {data:{user},error}=await state.db.auth.getUser();if(error && error.name!=='AuthSessionMissingError')console.warn(error);
  state.user=user||null; $('setup').hidden=true;$('login').hidden=!!user;$('app').hidden=!user;$('logout').hidden=!user;
  $('userEmail').textContent=user?.email===window.JS_CONFIG?.coachLoginEmail?'Coach':(user?.email?.split('@')[0]||'');
  if(!user)return;
  const {data:profile,error:pErr}=await state.db.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(pErr)throw pErr;
  state.coach=profile?.role==='coach';$('roleBadge').textContent=state.coach?'ACCÈS COACH':'ESPACE PARENT';
  document.querySelectorAll('.admin-only').forEach(x=>x.hidden=!state.coach);
  await loadAll();showView(state.view);
 }catch(e){toast('Erreur : '+e.message);console.error(e)}finally{refreshing=false}
}
async function loadAll(){
 const tables=['players','matches','selections','assignments','guardians','transport_offers','parent_link_requests','match_responses','child_attendance','parent_roles'];
 const queries=[state.db.from('players').select('*').order('name'),state.db.from('matches').select('*').order('match_date').order('match_time'),state.db.from('selections').select('*'),state.db.from('assignments').select('*'),state.db.from('guardians').select('*').order('name'),state.db.from('transport_offers').select('*'),state.db.from('parent_link_requests').select('*'),state.db.from('match_responses').select('*'),state.db.from('child_attendance').select('*'),state.db.from('parent_roles').select('*')];
 const results=await Promise.all(queries);
 results.forEach((r,i)=>{if(r.error)throw r.error;state[({transport_offers:'offers',parent_link_requests:'links',match_responses:'responses',child_attendance:'attendance',parent_roles:'parentRoles'})[tables[i]]||tables[i]]=r.data||[]});
 renderAll();
}
function showView(view){if(view==='team'&&!state.coach)view='matches';state.view=view;for(const v of ['matches','transport','team'])$(v+'View').hidden=v!==view;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));const texts={matches:['Calendrier <em>des matchs.</em>','Suivez les rencontres, les convocations et les responsabilités.'],transport:['En route <em>ensemble.</em>','Organisez les voitures pour chaque déplacement.'],team:['Notre <em>effectif.</em>','Gérez les joueurs et les coordonnées des parents.']};$('pageTitle').innerHTML=texts[view][0];$('pageSubtitle').textContent=texts[view][1]}
function renderAll(){
 const home=state.matches.filter(m=>m.is_home).length;const away=state.matches.length-home;
 $('metrics').innerHTML=`<div class="metric"><span class="metric-icon">🏀</span><div><strong>${state.matches.length}</strong><small>Matchs programmés</small></div></div><div class="metric"><span class="metric-icon">⌂</span><div><strong>${home}</strong><small>À domicile</small></div></div><div class="metric"><span class="metric-icon">🚗</span><div><strong>${away}</strong><small>Déplacements</small></div></div>`;
 renderMatches();renderTransport();renderFamily();if(state.coach)renderTeam();
}
function renderMatches(){
 const f=$('matchFilter').value;
 const matches=state.matches.filter(m=>f==='all'||(f==='home')===m.is_home);
 $('matchList').innerHTML=matches.length?matches.map(m=>{
  const sel=state.selections.filter(s=>s.match_id===m.id).length;
  return `<button type="button" class="match-card" data-match="${m.id}" style="color:inherit;text-align:left;width:100%;cursor:pointer"><div class="match-day"><strong>${esc(m.match_date.slice(8,10))}</strong><span>${esc(month(m.match_date))}</span></div><div class="match-main"><div class="match-label"><span class="chip ${m.is_home?'':'away'}">${m.is_home?'DOMICILE':'DÉPLACEMENT'}</span><small>${esc(m.competition||'U14')} · ${esc(m.external_id||'')}</small></div><h3>${esc(rival(m))}</h3><div class="meta"><span>◷ <b>${hm(m.match_time)}</b></span><span>⌖ ${esc(m.venue||'Lieu à définir')}</span><span>♙ ${sel} convoqué${sel>1?'s':''}</span></div></div><span class="match-arrow">›</span></button>`
 }).join(''):'<div class="empty">Aucun match dans cette catégorie.</div>';
}
function offerFor(matchId,guardianId){return state.offers.find(o=>o.match_id===matchId&&o.guardian_id===guardianId)}
function renderTransport(){const away=state.matches.filter(m=>!m.is_home);
 $('transportList').innerHTML=away.length?away.map(m=>{
  const offers=state.offers.filter(o=>o.match_id===m.id&&o.available).filter((o,i,all)=>{const email=state.guardians.find(g=>g.id===o.guardian_id)?.email?.toLowerCase();return !email||all.findIndex(v=>state.guardians.find(g=>g.id===v.guardian_id)?.email?.toLowerCase()===email)===i;});
  const seats=offers.reduce((n,o)=>n+o.seats,0);
  const mine=myGuardians();
  return `<article class="transport-card"><div class="transport-info"><div><span class="chip away">DÉPLACEMENT</span><h3>${esc(rival(m))}</h3><p>${esc(formatDate(m.match_date))} · ${hm(m.match_time)} · ${esc(m.venue||'Salle à définir')}</p><p>Rendez-vous : <b>${esc(m.meeting_location||'à définir')}</b> · Départ : <b>${hm(m.departure_time)}</b></p></div><div><strong style="font:900 37px 'Barlow Condensed'">${seats}</strong><div class="small-text">place${seats>1?'s':''} proposée${seats>1?'s':''}</div></div></div><div class="offer-list">${offers.length?offers.map(o=>{const g=state.guardians.find(x=>x.id===o.guardian_id);const pl=state.players.find(x=>x.id===g?.player_id);return `<div class="offer-item"><span><b>${esc(g?.name||'Parent')}</b> <small>(${esc(pl?.name||'')})</small>${o.comment?`<small> · ${esc(o.comment)}</small>`:''}</span><strong>${o.seats} place${o.seats>1?'s':''}</strong></div>`}).join(''):'<p class="small-text">Aucune voiture proposée pour le moment.</p>'}</div><div class="form-actions">${mine.length?`<button class="button primary small" data-reply-first="${m.id}">Ma réponse</button>`:''}<button class="button small" data-match="${m.id}">Voir le match</button></div>${!mine.length&&!state.coach?'<p class="small-text">Associez votre compte à votre enfant dans la section « Mes enfants ».</p>':''}</article>`
 }).join(''):'<div class="empty">Aucun déplacement prévu.</div>';
}
function renderTeam(){
 $('pendingLinks').innerHTML='<div class="team-card"><h3>Parents inscrits</h3><p class="small-text">Les parents associent directement leur compte à leur enfant (Papa ou Maman). Aucune validation nécessaire.</p></div>';
 $('teamList').innerHTML=state.players.map(p=>{
 const guardians=state.guardians.filter(g=>g.player_id===p.id);
 return `<article class="team-card"><div style="display:flex;align-items:center;min-width:0"><span class="avatar">${esc(p.name.slice(0,1).toUpperCase())}</span><div><h3>${esc(p.name)}</h3><small>${guardians.length?guardians.map(g=>esc(g.name)).join(' / '):'Aucun parent renseigné'}</small></div></div><div class="team-actions"><button class="button small" data-guardian="${p.id}">+ Parent</button></div></article>`
 }).join('');
}
function assignmentsFor(id){return state.assignments.filter(a=>a.match_id===id)}
function meetingFields(m){
 const options=['Salle JS Dottignies','Actalex'].map(v=>`<option ${m.meeting_location===v?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('');
 const hours=Array.from({length:24*4},(_,i)=>`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`);
 const timeSelect=(name,value)=>`<select name="${name}"><option value="">À définir</option>${hours.map(t=>`<option value="${t}" ${String(value||'').startsWith(t)?'selected':''}>${t.replace(':','h')}</option>`).join('')}</select>`;
 return `<form id="meetingForm"><div class="form-grid"><div class="form-field"><label>Lieu du rendez-vous</label><select name="meeting_location"><option value="">À définir</option>${options}</select></div><div class="form-field"><label>Heure du rendez-vous</label>${timeSelect('meeting_time',m.meeting_time)}</div>${!m.is_home?`<div class="form-field"><label>Heure de départ</label>${timeSelect('departure_time',m.departure_time)}</div>`:''}<div class="form-field full"><label>Consignes du coach</label><textarea name="notes" rows="2" placeholder="Informations utiles">${esc(m.notes||'')}</textarea></div></div><div class="form-actions"><button class="button primary small" type="submit">Enregistrer le rendez-vous</button></div></form>`;
}
function openMatch(id){const m=state.matches.find(x=>x.id===id);if(!m)return;
 const selected=state.selections.filter(s=>s.match_id===id).map(s=>s.player_id);
 const assigned=assignmentsFor(id);const selectedNames=selected.map(pid=>state.players.find(p=>p.id===pid)?.name).filter(Boolean);
 const assignmentsHtml=assigned.length?assigned.map(a=>`<div class="role-row"><span>${esc(a.role)}</span><b>Famille ${esc(state.players.find(p=>p.id===a.player_id)?.name||'?')}</b></div>`).join(''):'<p class="small-text">Pas encore de désignations. Le coach peut effectuer le tirage après les convocations.</p>';
 const players=state.players.filter(p=>p.active).map(p=>`<label class="check-player"><input type="checkbox" name="selected" value="${p.id}" ${selected.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('');
 showModal(`<span class="chip ${m.is_home?'':'away'}">${m.is_home?'À DOMICILE':'EN DÉPLACEMENT'}</span><h2 id="modalTitle">JS Dottignies – ${esc(rival(m))}</h2><p class="modal-lead">${esc(formatDate(m.match_date))} à ${hm(m.match_time)} · ${esc(m.venue||'Salle à définir')}<br>${esc(m.competition||'U14')} · ${esc(m.external_id||'')}</p><div class="row-between"><span><b>Rendez-vous</b> : ${esc(m.meeting_location||'À définir')} à ${hm(m.meeting_time)}${m.is_home?'':`<br><b>Départ</b> : ${hm(m.departure_time)}`}</span></div>${m.notes?`<p class="alert">${esc(m.notes)}</p>`:''}
 <div class="modal-section"><h3>Joueurs convoqués (${selected.length})</h3>${state.coach?`<div class="coach-replies">${selected.map(pid=>{const p=state.players.find(p=>p.id===pid);const reply=state.attendance.find(r=>r.match_id===id&&r.player_id===pid);return `<p class="small-text"><b>${esc(p?.name||'')}</b> — ${reply?(reply.attendance==='yes'?'Présent':'Absent'):'En attente de réponse'}</p>`}).join('')}</div>`:''}${state.coach?`<form id="selectionForm"><div class="check-grid">${players}</div><div class="form-actions"><button type="submit" class="button primary small">Enregistrer la sélection</button></div></form>`:`<p class="small-text">${selectedNames.length?selectedNames.map(esc).join(' · '):'Sélection non communiquée'}</p>`}</div>
 <div class="modal-section"><h3>Désignations des parents ${m.is_home?'(domicile)':'(déplacement)'}</h3><div class="role-list">${assignmentsHtml}</div>${state.coach?`<div class="form-actions"><button id="drawButton" class="button primary small">🎲 Tirage automatique équilibré</button></div><p class="small-text">${m.is_home?'3 postes : délégué de banc, chrono et 24/14 secondes.':'2 postes : feuille de match et délégué de banc. Deux familles distinctes seront désignées.'} Un nouveau tirage remplace les désignations de ce match.</p>`:'<p class="small-text">Un parent de chaque joueur désigné assure la fonction indiquée.</p>'}</div>${m.is_home?'':`<div class="modal-section"><h3>Transport</h3><p class="small-text">Les parents renseignent leurs disponibilités dans l’onglet Covoiturage.</p><button class="button small" id="toTransport">Voir les voitures proposées</button></div>`}
 ${!state.coach?`<div class="modal-section"><h3>Ma réponse</h3>${parentReplyButtons(m)}</div>`:''}
 ${state.coach?`<div class="modal-section"><h3>Organisation du rendez-vous</h3>${meetingFields(m)}</div>`:''}`);
 if(state.coach){
  $('selectionForm').addEventListener('submit',async e=>{e.preventDefault();const ids=Array.from(e.target.querySelectorAll('input:checked')).map(x=>x.value);await action(async()=>{mustOk(await state.db.rpc('save_match_selections',{p_match_id:m.id,p_player_ids:ids}));toast('Convocations enregistrées (tirage réinitialisé si la sélection a changé)');await loadAll();openMatch(id)})});
  $('meetingForm').addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());let data={meeting_location:v.meeting_location||null,meeting_time:v.meeting_time||null,notes:v.notes||''};if(!m.is_home)data.departure_time=v.departure_time||null;await action(async()=>{mustOk(await state.db.from('matches').update(data).eq('id',id));await loadAll();openMatch(id);toast('Rendez-vous enregistré')})});
  $('drawButton').addEventListener('click',async()=>{if(!confirm(`Effectuer un nouveau tirage des ${m.is_home?'trois':'deux'} responsabilités ?`))return;await action(async()=>{mustOk(await state.db.rpc(m.is_home?'draw_home_assignments':'draw_away_assignments',{p_match_id:id}));await loadAll();openMatch(id);toast('Désignations effectuées')})});
 } else if(!m.is_home){$('toTransport').addEventListener('click',()=>{closeModal();showView('transport')})}
 if(!m.is_home&&state.coach)$('toTransport').addEventListener('click',()=>{closeModal();showView('transport')});
 if(!state.coach)document.querySelectorAll('[data-reply]').forEach(b=>b.addEventListener('click',()=>openReply(id,b.dataset.reply)));

}
function openOffer(id){if(!state.coach){const mine=myGuardians();if(mine.length){openReply(id,mine[0].id);return;}} const m=state.matches.find(x=>x.id===id);if(!m||m.is_home)return;
 const mine=myGuardians();if(!mine.length){toast('Votre e-mail doit être associé à un joueur.');return}
 const g=mine[0];const of=offerFor(id,g.id);const pl=state.players.find(p=>p.id===g.player_id);
 showModal(`<h2 id="modalTitle">Mon covoiturage</h2><p class="modal-lead">${esc(rival(m))} · ${esc(formatDate(m.match_date))}<br>${esc(g.name)} · parent de ${esc(pl?.name||'')}</p>${mine.length>1?'<p class="alert">Plusieurs associations parent-joueur sont présentes. Une seule offre de voiture est enregistrée par association.</p>':''}<form id="offerForm"><div class="form-grid"><div class="form-field full"><label>Je peux accompagner l'équipe</label><select name="available"><option value="yes" ${of?.available?'selected':''}>Oui, je propose ma voiture</option><option value="no" ${!of?.available?'selected':''}>Non, je ne suis pas disponible</option></select></div><div class="form-field"><label>Places passagers disponibles (hors conducteur)</label><select name="seats">${Array.from({length:9},(_,i)=>`<option value="${i}" ${of?.seats===i?'selected':''}>${i}</option>`).join('')}</select></div><div class="form-field full"><label>Remarque éventuelle</label><input name="comment" maxlength="250" value="${esc(of?.comment||'')}" placeholder="Ex. Je pars directement de chez moi"></div></div><div class="form-actions"><button type="submit" class="button primary">Enregistrer ma réponse</button></div></form>`);
 $('offerForm').addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());const available=v.available==='yes';const record={match_id:id,guardian_id:g.id,available,seats:available?Number(v.seats):0,comment:v.comment||''};await action(async()=>{mustOk(await state.db.from('transport_offers').upsert(record,{onConflict:'match_id,guardian_id'}));await loadAll();closeModal();toast('Votre réponse a été enregistrée')})});
}
function openGuardian(pid){const p=state.players.find(x=>x.id===pid);if(!p||!state.coach)return;
 const current=state.guardians.filter(g=>g.player_id===pid);
 showModal(`<h2 id="modalTitle">Parents de ${esc(p.name)}</h2><p class="modal-lead">Un parent peut accéder au covoiturage avec cette adresse e-mail (lien de connexion sécurisé).</p>${current.length?`<ul class="line-list">${current.map(g=>`<li><div class="row-between"><span><b>${esc(g.name)}</b><br><small class="muted">${esc(g.email)}</small></span><button class="button small danger" data-delguardian="${g.id}">Supprimer</button></div></li>`).join('')}</ul>`:''}<div class="modal-section"><h3>Ajouter un parent</h3><form id="guardianForm"><div class="form-grid"><div class="form-field"><label>Nom du parent</label><input name="name" required maxlength="100" placeholder="Prénom Nom"></div><div class="form-field"><label>E-mail</label><input type="email" name="email" required placeholder="parent@exemple.be"></div></div><div class="form-actions"><button type="submit" class="button primary small">Ajouter ce parent</button></div></form></div>`);
 $('guardianForm').addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());await action(async()=>{mustOk(await state.db.from('guardians').insert({player_id:pid,name:v.name.trim(),email:v.email.trim().toLowerCase()}));await loadAll();openGuardian(pid);toast('Parent ajouté')})});
 document.querySelectorAll('[data-delguardian]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Supprimer ce parent et ses propositions de voiture ?'))return;await action(async()=>{mustOk(await state.db.from('guardians').delete().eq('id',b.dataset.delguardian));await loadAll();openGuardian(pid);toast('Parent supprimé')})}));
}


// Espace parent : demande d'association validée par le coach, réponse par enfant convoqué.
function myGuardians(){return state.guardians.filter(g=>g.email.toLowerCase()===(state.user?.email||'').toLowerCase());}
function parentReplyButtons(m){
 const mine=myGuardians();if(!mine.length)return '<p class="small-text">Aucun joueur associé à votre compte.</p>';
 const selected=state.selections.filter(s=>s.match_id===m.id).map(s=>s.player_id);
 return mine.map(g=>{const child=state.players.find(p=>p.id===g.player_id);const reply=state.attendance.find(r=>r.match_id===m.id&&r.player_id===g.player_id);return `<div class="request-line"><span><b>${esc(child?.name||'Enfant')}</b> : ${selected.includes(g.player_id)?(reply?.attendance==='yes'?'Présent':reply?.attendance==='no'?'Absent':'Réponse attendue'):'Non convoqué'}</span>${selected.includes(g.player_id)?`<button class="button primary small" data-reply="${g.id}">Répondre</button>`:''}</div>`}).join('');
}
function renderFamily(){
 const panel=$('familyPanel');panel.hidden=state.coach||!state.user;if(panel.hidden)return;
 const mine=myGuardians();const role=state.parentRoles.find(r=>r.user_id===state.user.id);
 const replies=state.matches.flatMap(m=>mine.filter(g=>state.selections.some(s=>s.match_id===m.id&&s.player_id===g.player_id)).map(g=>({m,g,r:state.attendance.find(r=>r.match_id===m.id&&r.player_id===g.player_id)})));
 panel.innerHTML=`<div class="family-head"><h2>Mes enfants & convocations</h2><button type="button" class="button small" id="installApp">📲 Installer l'application</button></div><p class="small-text">Compte : ${esc(state.user.email?.split('@')[0]||'Parent')} · ${esc(role?.relationship||'Responsable')}. La session reste enregistrée sur votre téléphone tant qu'elle est valide.</p><div class="family-children">${mine.length?`<p><b>Mon enfant :</b> ${mine.map(g=>esc(state.players.find(p=>p.id===g.player_id)?.name||'')).join(' · ')}</p>`:'<p>Votre compte n’est pas encore lié à un joueur. Vous pouvez terminer l’association ci-dessous.</p><form id="finishParentLink" class="parent-inline"><input name="name" placeholder="Votre prénom et nom" required minlength="2" maxlength="100"><select name="player" required><option value="">Choisir son enfant</option>${state.players.filter(p=>p.active).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select><select name="relation"><option value="papa">Papa</option><option value="maman">Maman</option></select><button class="button primary small" type="submit">Associer mon enfant</button></form>'}</div><h3>Mes convocations</h3>${replies.length?replies.map(({m,g,r})=>`<div class="request-line"><span><b>${esc(state.players.find(p=>p.id===g.player_id)?.name||'')}</b> · ${esc(formatDate(m.match_date))} · ${esc(rival(m))}<br><small>${r?('Présence : '+(r.attendance==='yes'?'OUI':'NON')):'Réponse attendue'}</small></span><button class="button primary small" data-reply="${g.id}" data-reply-match="${m.id}">Répondre</button></div>`).join(''):'<p class="small-text">Aucune convocation pour le moment.</p>'}<p class="small-text">Les notifications push automatiques ne sont pas encore activées : le service d'envoi doit être configuré séparément.</p>`;
 document.querySelectorAll('[data-reply-match]').forEach(b=>b.addEventListener('click',()=>openReply(b.dataset.replyMatch,b.dataset.reply)));
 const finish=$('finishParentLink');if(finish)finish.addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget).entries());await action(async()=>{mustOk(await state.db.rpc('claim_parent_role',{p_player_id:v.player,p_relationship:v.relation,p_display_name:v.name}));await loadAll();toast('Votre enfant est associé à votre compte.');})});
 $('installApp').addEventListener('click',installPwa);
}
function openReply(matchId,guardianId){
 const m=state.matches.find(x=>x.id===matchId),g=myGuardians().find(x=>x.id===guardianId);if(!m||!g)return;
 if(!state.selections.some(s=>s.match_id===m.id&&s.player_id===g.player_id)){toast('Cet enfant n’est pas convoqué pour cette rencontre.');return;}
 const r=state.responses.find(x=>x.match_id===m.id&&x.guardian_id===g.id);const childReply=state.attendance.find(x=>x.match_id===m.id&&x.player_id===g.player_id);
 const o=offerFor(matchId,guardianId);
 showModal(`<h2 id="modalTitle">Réponse à la convocation</h2><p class="modal-lead">${esc(state.players.find(p=>p.id===g.player_id)?.name||'')} · ${esc(formatDate(m.match_date))} · ${esc(rival(m))}</p><form id="parentReplyForm"><div class="form-grid"><div class="form-field full"><label>Mon enfant sera présent</label><select name="attendance"><option value="yes" ${childReply?.attendance==='yes'?'selected':''}>OUI</option><option value="no" ${childReply?.attendance==='no'?'selected':''}>NON</option></select></div><div class="form-field full"><label>Organisation du trajet</label><select name="travel"><option value="direct" ${r?.travel==='direct'?'selected':''}>Nous allons directement sur place</option><option value="car" ${r?.travel==='car'?'selected':''}>Je peux prendre des personnes dans ma voiture</option><option value="need_ride" ${r?.travel==='need_ride'?'selected':''}>Nous avons besoin d'une place</option><option value="none" ${r?.travel==='none'?'selected':''}>Pas de trajet (absent / sans objet)</option></select></div><div class="form-field full"><label>Places passagers disponibles (hors conducteur)</label><select name="seats">${Array.from({length:9},(_,i)=>`<option value="${i}" ${(r?.seats??0)===i?'selected':''}>${i}</option>`).join('')}</select></div></div><div class="form-actions"><button class="button primary" type="submit">Enregistrer ma réponse</button></div></form>`);
 $('parentReplyForm').addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());const yes=v.attendance==='yes',car=yes&&v.travel==='car',seats=car?Number(v.seats):0;await action(async()=>{
 mustOk(await state.db.rpc('save_parent_reply',{p_match_id:matchId,p_guardian_id:g.id,p_attendance:v.attendance,p_travel:yes?v.travel:'none',p_seats:seats}));
 await loadAll();closeModal();toast('Réponse enregistrée pour '+(state.players.find(p=>p.id===g.player_id)?.name||'votre enfant'))})});
}
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});
async function installPwa(){if(deferredInstall){deferredInstall.prompt();deferredInstall=null;return;}toast('iPhone : Partager → Sur l’écran d’accueil. Android : menu du navigateur → Installer l’application.');}
if('serviceWorker' in navigator && location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));

// Gestion des rencontres : insertion manuelle et import Excel, réservés au coach.
const localTeam = 'RU14H JS Dottignies';
const normalize = v => String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
const clockOptions = (value='') => `<option value="">Choisir une heure</option>${Array.from({length:96},(_,i)=>`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`).map(t=>`<option value="${t}" ${String(value).slice(0,5)===t?'selected':''}>${t}</option>`).join('')}`;
function identicalMatch(a,b){
 if(a.external_id && b.external_id && normalize(a.external_id)===normalize(b.external_id))return true;
 return a.match_date===b.match_date && normalize(a.home_team)===normalize(b.home_team) && normalize(a.away_team)===normalize(b.away_team);
}
function addMatchModal(){if(!state.coach)return;
 showModal(`<h2 id="modalTitle">Ajouter un match</h2><p class="modal-lead">Enregistrez une nouvelle rencontre dans le calendrier de l'équipe.</p><form id="createMatchForm"><div class="form-grid"><div class="form-field"><label>Date du match</label><input name="match_date" type="date" required></div><div class="form-field"><label>Heure du match</label><input name="match_time" type="time" step="60" required></div><div class="form-field full"><label>Lieu du match</label><select name="is_home"><option value="yes">À domicile</option><option value="no">En déplacement</option></select></div><div class="form-field full"><label>Équipe adverse</label><input name="opponent" required maxlength="200" placeholder="Ex. Royal Excelsior Brussels"></div><div class="form-field full"><label>Salle / adresse du match</label><input name="venue" maxlength="200" placeholder="Ex. Hall de l'Europe"></div><div class="form-field"><label>Compétition / série</label><input name="competition" maxlength="100" value="U14HB B"></div><div class="form-field"><label>Numéro officiel du match (facultatif)</label><input name="external_id" maxlength="100" placeholder="Ex. AW136100"></div></div><div class="form-actions"><button class="button primary" type="submit">Ajouter la rencontre</button></div></form>`);
 $('createMatchForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const v=Object.fromEntries(new FormData(form).entries());const home=v.is_home==='yes';const row={match_date:v.match_date,match_time:v.match_time,home_team:home?localTeam:v.opponent.trim(),away_team:home?v.opponent.trim():localTeam,is_home:home,venue:v.venue.trim()||null,competition:v.competition.trim()||null,external_id:v.external_id.trim()||null};
 if(state.matches.some(m=>identicalMatch(m,row))){toast('Ce match existe déjà dans le calendrier.');return}
 await action(async()=>{const b=form.querySelector('[type=submit]');b.disabled=true;try{mustOk(await state.db.from('matches').insert(row));await loadAll();closeModal();toast('Match ajouté au calendrier.')}finally{b.disabled=false}})
 });
}
function excelDate(v){
 if(v instanceof Date && !Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
 if(typeof v==='number'&&v>1000&&v<100000){const d=new Date(Math.round((v-25569)*86400000));return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
 const text=String(v??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
 const m=text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m){const d=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return Number.isNaN(Date.parse(d+'T12:00:00Z'))?'':d}
 return '';
}
function excelTime(v){
 if(v instanceof Date)return `${String(v.getUTCHours()).padStart(2,'0')}:${String(v.getUTCMinutes()).padStart(2,'0')}`;
 if(typeof v==='number'&&v>=0){let minutes=Math.round((v%1)*1440)%1440;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`}
 let t=String(v??'').trim().replace('h',':');const m=t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);if(m&&Number(m[1])<24&&Number(m[2])<60)return `${m[1].padStart(2,'0')}:${m[2]}`;
 return '';
}
function parseSchedule(buffer){
 if(!window.XLSX)throw Error('Lecteur Excel indisponible. Vérifiez la connexion Internet.');
 const wb=XLSX.read(buffer,{type:'array',cellDates:false});const parsed=[];const problems=[];
 for(const sheetName of wb.SheetNames){
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:'',raw:true});
  let headerIndex=-1,positions={};
  for(let i=0;i<Math.min(20,rows.length);i++){
    const headers=(rows[i]||[]).map(normalize);
    const search=(terms)=>headers.findIndex(h=>terms.includes(h));
    const d=search(['date','date du match','date match']);const h=search(['heure','horaire','heure du match']);const home=search(['visites','domicile','home','equipe domicile','equipe a domicile']);const away=search(['visiteurs','exterieur','equipe exterieure','equipe visiteuse','away']);
    if(d>=0&&h>=0&&home>=0&&away>=0){headerIndex=i;positions={date:d,time:h,home,away,venue:search(['salle','lieu','adresse','gymnase']),id:search(['num.','num','numero','n°','numero de match','numero du match','id match']),competition:search(['serie','competition','categorie'])};break}
  }
  if(headerIndex<0){problems.push(`Feuille « ${sheetName} » : colonnes Date, Heure, Visités et Visiteurs introuvables.`);continue}
  for(let i=headerIndex+1;i<rows.length;i++){
   const cells=rows[i]||[];if(cells.every(v=>v===''||v===null))continue;
   const get=k=>positions[k]>=0?cells[positions[k]]:'';
   const match_date=excelDate(get('date'));const match_time=excelTime(get('time'));
   const home_team=String(get('home')||'').trim();const away_team=String(get('away')||'').trim();
   const is_home=normalize(home_team).includes('js dottignies');const visitor=normalize(away_team).includes('js dottignies');
   if(!match_date||!match_time||!home_team||!away_team||is_home===visitor){problems.push(`${sheetName}, ligne ${i+1} : date, heure ou équipe JS Dottignies non reconnue.`);continue}
   const row={match_date,match_time,home_team,away_team,is_home,venue:String(get('venue')||'').trim()||null,external_id:String(get('id')||'').trim()||null,competition:String(get('competition')||'').trim()||null};
   parsed.push(row);
  }
 }
 return {parsed,problems};
}
function importMatchesModal(){if(!state.coach)return;
 showModal(`<h2 id="modalTitle">Importer les prochaines rencontres</h2><p class="modal-lead">Ajoutez le calendrier de la deuxième partie de saison sans modifier les rencontres déjà enregistrées.</p><div class="alert">Format accepté : Excel .xlsx ou .xls. Colonnes du fichier initial : Serie, Num., Salle, Date, Heure, Visités, Visiteurs. Les colonnes supplémentaires sont ignorées.</div><div class="form-field"><label for="scheduleFile">Fichier Excel des matchs</label><input type="file" id="scheduleFile" accept=".xlsx,.xls"></div><div id="schedulePreview" class="modal-section"></div>`);
 $('scheduleFile').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;const box=$('schedulePreview');box.textContent='Lecture du calendrier…';
  try{
   if(file.size>5*1024*1024)throw Error('Fichier trop volumineux (maximum 5 Mo).');
   const {parsed,problems}=parseSchedule(await file.arrayBuffer());const seen=[];
   const entries=parsed.map(row=>{const duplicate=state.matches.some(m=>identicalMatch(m,row))||seen.some(m=>identicalMatch(m,row));if(!duplicate)seen.push(row);return {row,duplicate}});
   const fresh=entries.filter(e=>!e.duplicate);box.innerHTML=`<h3>Vérification avant importation</h3><p class="small-text"><b>${fresh.length} nouvelle(s) rencontre(s)</b> · ${entries.length-fresh.length} doublon(s) ignoré(s) · ${problems.length} ligne(s) à vérifier</p>${entries.length?`<div class="import-preview">${entries.map(({row,duplicate})=>`<div class="import-preview-item"><span>${esc(row.match_date)} · ${esc(hm(row.match_time))} · ${esc(row.is_home?'Domicile':'Extérieur')}<br><b>${esc(rival(row))}</b></span><span class="chip ${duplicate?'away':''}">${duplicate?'Déjà présent':'Nouveau'}</span></div>`).join('')}</div>`:''}${problems.length?`<div class="alert">${problems.slice(0,12).map(esc).join('<br>')}${problems.length>12?'…':''}</div>`:''}<div class="form-actions"><button class="button primary" id="confirmScheduleImport" type="button" ${!fresh.length?'disabled':''}>Importer ${fresh.length} nouveau(x) match(s)</button></div>`;
   const confirm=$('confirmScheduleImport');confirm.addEventListener('click',async()=>{
     confirm.disabled=true;let added=0;const errors=[];
     for(const {row} of fresh){
       const result=await state.db.from('matches').insert(row);
       if(result.error){if(result.error.code==='23505')continue;errors.push(`${row.match_date} ${rival(row)} : ${result.error.message}`)}else added++;
     }
     await action(async()=>{await loadAll();if(!errors.length){closeModal();toast(`${added} rencontre(s) ajoutée(s) au calendrier.`)}else{$('schedulePreview').insertAdjacentHTML('beforeend',`<div class="alert">${errors.slice(0,8).map(esc).join('<br>')}</div>`);toast(`${added} ajoutée(s) ; ${errors.length} erreur(s).`)}});
   });
  }catch(error){box.textContent='Impossible de lire le calendrier : '+error.message}
 });
}
$('addMatchButton').addEventListener('click',addMatchModal);
$('importMatchesButton').addEventListener('click',importMatchesModal);
async function action(fn){try{await fn()}catch(e){console.error(e);toast('Erreur : '+(e.message||'Opération impossible'))}}
function showModal(html){$('modalBody').innerHTML=html;$('modalRoot').hidden=false;document.body.style.overflow='hidden'}
function closeModal(){$('modalRoot').hidden=true;$('modalBody').innerHTML='';document.body.style.overflow=''}
document.addEventListener('click',e=>{const first=e.target.closest('[data-reply-first]');if(first){const mine=myGuardians();if(mine.length)openReply(first.dataset.replyFirst,mine[0].id);return;}const review=e.target.closest('[data-review]');if(review){reviewLink(review.dataset.review,review.dataset.approve==='yes');return;}const target=e.target.closest('[data-match],[data-offer],[data-guardian],[data-view],[data-close]');if(!target)return;if(target.dataset.close){closeModal();return}if(target.dataset.match){openMatch(target.dataset.match);return}if(target.dataset.offer){openOffer(target.dataset.offer);return}if(target.dataset.guardian){openGuardian(target.dataset.guardian);return}if(target.dataset.view){showView(target.dataset.view)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
$('matchFilter').addEventListener('change',renderMatches);
// Supabase Auth utilise une adresse technique (non affichée), aucun e-mail n'est envoyé.
const parentEmail=username=>`${String(username).trim().toLowerCase()}@parents.jsdottignies.be`;
const validUsername=username=>/^[a-zA-Z0-9_-]{4,24}$/.test(username);
$('parentLoginTab').addEventListener('click',()=>{$('loginForm').hidden=false;$('registerForm').hidden=true;});
$('parentRegisterTab').addEventListener('click',()=>{$('loginForm').hidden=true;$('registerForm').hidden=false;});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const username=$('parentUsername').value.trim().toLowerCase();if(!validUsername(username))return toast('Identifiant invalide');await action(async()=>{mustOk(await state.db.auth.signInWithPassword({email:parentEmail(username),password:$('parentPassword').value}));$('parentPassword').value='';await refreshAuth();toast('Connexion parent réussie.')})});
$('registerForm').addEventListener('submit',async e=>{e.preventDefault();const username=$('registerUsername').value.trim().toLowerCase();const pass=$('registerPassword').value;const player=$('registerChild').value;const name=$('registerName').value.trim();const relationship=$('registerRelation').value;
 if(!validUsername(username)||pass.length<8||!player||!name)return toast('Complétez les informations demandées.');
 const button=e.currentTarget.querySelector('button[type=submit]');button.disabled=true;
 try{
  const r=await state.db.auth.signUp({email:parentEmail(username),password:pass,options:{data:{display_name:name}}});mustOk(r);
  if(!r.data.session)throw Error('Supabase demande encore la confirmation e-mail. Désactivez « Confirm email » dans Authentication → Providers → Email.');
  mustOk(await state.db.rpc('claim_parent_role',{p_player_id:player,p_relationship:relationship,p_display_name:name}));
  $('registerPassword').value='';await refreshAuth();toast('Compte parent créé et enfant associé.');
 }catch(err){console.error(err);toast('Inscription : '+(err.message||'Impossible de créer le compte'));}
 finally{button.disabled=false}
});
$('coachLoginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const coachEmail=String(window.JS_CONFIG?.coachLoginEmail||'').trim().toLowerCase();
 const code=$('coachCode').value;
 if(!coachEmail){toast('Le compte coach doit d’abord être configuré par le développeur.');return;}
 if(!/^[A-Za-z]{2}[0-9]{4}$/.test(code)){toast('Le code du coach doit contenir 2 lettres suivies de 4 chiffres.');return;}
 const button=$('coachLoginForm').querySelector('button');button.disabled=true;
 try{
  const result=await state.db.auth.signInWithPassword({email:coachEmail,password:code});
  mustOk(result);
  // La mise à jour de session déclenche déjà refreshAuth via onAuthStateChange.
  // Ne pas lire state.coach immédiatement : la requête de profil peut encore être en cours.
  const authenticatedUser = result.data?.user;
  if (!authenticatedUser?.id) throw new Error('Session coach non créée.');
  const {data: coachProfile, error: roleError} = await state.db
    .from('profiles').select('role').eq('id', authenticatedUser.id).maybeSingle();
  if (roleError) throw new Error('Impossible de vérifier le rôle coach : ' + roleError.message);
  if (coachProfile?.role !== 'coach') {
    await state.db.auth.signOut();
    toast('Le profil lié à ce compte n’a pas le rôle coach dans Supabase.');
    return;
  }
  state.coach = true;
  $('coachCode').value='';
  // refreshAuth est déclenché automatiquement et finalise l’affichage admin.
  await refreshAuth();
 }catch(err){toast('Connexion coach : '+(err?.message||'échec inconnu'));console.warn('Connexion coach refusée',err?.message)}
 finally{button.disabled=false}
});
$('logout').addEventListener('click',async()=>{if(!state.db)return;await state.db.auth.signOut();state.coach=false;state.user=null;closeModal();$('app').hidden=true;$('login').hidden=false;$('logout').hidden=true});
boot();
