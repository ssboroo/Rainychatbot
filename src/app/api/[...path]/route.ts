import catalog from '@/lib/api-catalog.json';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, audit, rateLimit, type User } from '@/lib/db';
import { currentUser, requireUser, createSession, logout, isAdmin } from '@/lib/auth';
import { AppError, hashPassword, checkPassword, requireSameOrigin, token, digest, verifyWebhook, id, requiredText } from '@/lib/security';
import { social, configured, accounts, ownAccount, ownConversation, ownAutomation, ownPost, brand, items, remember, ownResource } from '@/lib/social';
import { platforms, automationPayload } from '@/lib/features';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const success=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const userSchema=z.object({email:z.email().max(254),password:z.string().min(10).max(128),name:z.string().trim().min(2).max(80).optional(),workspace:z.string().trim().min(2).max(100).optional()});
function manager(u:User){if(!['owner','admin'].includes(u.role))throw new AppError(403,'Энэ үйлдэлд удирдах эрх шаардлагатай.');}
function query(params:URLSearchParams, allowed:string[]){const out=new URLSearchParams();for(const key of allowed){const v=params.get(key);if(v && v.length<1000)out.set(key,v);}return out;}
function localList(table:'contacts'|'audit'|'events',u:User){return db().prepare(`SELECT * FROM ${table} WHERE workspace_id=? ORDER BY ${table==='contacts'?'name':'created_at DESC'} LIMIT 200`).all(u.workspace_id);}
async function webhook(request:Request){
 const length=Number(request.headers.get('content-length')||0);if(length>1000000)throw new AppError(413,'Хэт том хүсэлт.');
 const raw=await request.text();if(raw.length>1000000)throw new AppError(413,'Хэт том хүсэлт.');
 const secret=process.env.SOCIALAPI_WEBHOOK_SECRET || (db().prepare("SELECT value FROM settings WHERE key='webhook_secret'").get() as any)?.value;
 if(!verifyWebhook(secret,raw,request.headers.get('x-socialapi-timestamp'),request.headers.get('x-socialapi-signature-v2')))throw new AppError(401,'Webhook гарын үсэг буруу.');
 const payload=JSON.parse(raw);const event=requiredText(payload.event,120);const delivery=request.headers.get('x-socialapi-delivery');
 const eventKey=digest(event+':'+(payload.data?.id||payload.data?.post_id||JSON.stringify(payload.data))); 
 if(db().prepare('SELECT id FROM deliveries WHERE id IN (?,?)').get(delivery||eventKey,eventKey))return success({ok:true,duplicate:true});
 let workspaceId:string|null=null;const data=Array.isArray(payload.data)?payload.data[0]:payload.data;
 if(data?.account_id)workspaceId=(db().prepare("SELECT workspace_id FROM resources WHERE kind='account' AND id=?").get(data.account_id) as any)?.workspace_id||null;
 else if(data?.brand_id)workspaceId=(db().prepare('SELECT id FROM workspaces WHERE brand_id=?').get(data.brand_id) as any)?.id||null;
 const d=db();d.exec('BEGIN IMMEDIATE');try{d.prepare('INSERT OR IGNORE INTO events(id,workspace_id,event,payload) VALUES(?,?,?,?)').run(eventKey,workspaceId,event,raw);d.prepare('INSERT OR IGNORE INTO deliveries(id,received_at) VALUES(?,?)').run(eventKey,Date.now());if(delivery)d.prepare('INSERT OR IGNORE INTO deliveries(id,received_at) VALUES(?,?)').run(delivery,Date.now());d.prepare('DELETE FROM deliveries WHERE received_at<?').run(Date.now()-30*86400000);d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e;}
 return success({ok:true});
}
async function getData(u:User,p:URLSearchParams){
 const resource=p.get('resource')||'accounts'; const q=query(p,['cursor','limit','status','platform','from','to','search','sort','page_id','since']); q.set('limit','50');
 if(resource==='contacts'||resource==='audit'||resource==='events'){db().prepare("DELETE FROM events WHERE created_at < datetime('now','-30 days')").run();db().prepare("DELETE FROM audit WHERE created_at < datetime('now','-90 days')").run();return {data:localList(resource,u)};}
 if(resource==='team')return {data:db().prepare('SELECT id,name,email,role FROM users WHERE workspace_id=?').all(u.workspace_id)};
 if(resource==='settings')return {configured:configured(),webhookConfigured:Boolean(process.env.SOCIALAPI_WEBHOOK_SECRET||(db().prepare("SELECT value FROM settings WHERE key='webhook_secret'").get())),isAdmin:isAdmin(u),callback:`${process.env.APP_URL||''}/oauth/callback`,webhook:`${process.env.APP_URL||''}/api/webhooks/socialapi`,workspace:u.workspace_name};
 if(resource==='usage'){if(!isAdmin(u))throw new AppError(403,'Зөвхөн системийн админд харагдана.');return social('/usage');}
 if(resource==='announcements'){if(!isAdmin(u))throw new AppError(403,'Удирдах эрх шаардлагатай.');return social('/announcements');}
 if(resource==='accounts')return {data:configured()?await accounts(u):[]};
 if(resource==='conversations'){if(!u.brand_id)return {data:[]};q.set('brand_id',u.brand_id);return social(`/inbox/conversations?${q}`);}
 if(resource==='posts'){if(!u.brand_id)return {data:[]};q.set('brand_id',u.brand_id);return social(`/posts?${q}`);}
 if(resource==='automations'){const accts=await accounts(u);const lists=await Promise.all(accts.filter(a=>['facebook','instagram'].includes(a.platform)).map(a=>social(`/automations?account_id=${id(a.id)}`)));return {data:lists.flatMap(items)};}
 if(resource==='media'){const ids=db().prepare("SELECT id FROM resources WHERE workspace_id=? AND kind='media'").all(u.workspace_id).map(r=>r.id);if(!ids.length)return {data:[]}; const data=await social(`/media?${q}`);return {...data,data:items(data).filter(x=>ids.includes(x.id))};}
 if(resource==='messages'){const cid=requiredText(p.get('conversation_id'),512);await ownConversation(u,cid);return social(`/inbox/conversations/${id(cid)}/messages?${q}`);}
 if(resource==='automationRuns'){const aid=requiredText(p.get('id'),512);await ownAutomation(u,aid);return social(`/automations/${id(aid)}/firings?${q}`);}
 if(resource==='analytics'){if(!u.brand_id)return {data:{series:[]}};return social(`/brands/${id(u.brand_id)}/analytics?${query(p,['from','to','metrics'])}`);}
 if(resource==='postMetrics'){const pid=requiredText(p.get('id'),512);await ownPost(u,pid);return social(`/posts/${id(pid)}/metrics`);}
 if(resource==='pending'){const pid=requiredText(p.get('id'),512);ownResource(u,'pending',pid);return social(`/accounts/pending/${id(pid)}`);}
 if(resource==='exports'){const result=await social('/exports');const ids=db().prepare("SELECT id FROM resources WHERE workspace_id=? AND kind='export'").all(u.workspace_id).map(x=>x.id);return {data:items(result).filter(x=>ids.includes(x.id))};}
 if(resource==='exportStatus'){const eid=requiredText(p.get('id'),512);ownResource(u,'export',eid);return social(`/exports/${id(eid)}`);}
 if(resource==='webhooks'){if(!isAdmin(u))throw new AppError(403,'Зөвхөн системийн админд харагдана.');return social('/webhooks');}
 if(resource==='webhookDeliveries'){if(!isAdmin(u))throw new AppError(403,'Удирдах эрх шаардлагатай.');return social(`/webhooks/${id(p.get('id'))}/deliveries?${q}`);}
 const account=requiredText(p.get('account_id'),512);await ownAccount(u,account);q.set('account_id',account);
 switch(resource){
 case 'comments':return social(`/inbox/comments?${q}`);
 case 'postComments':return social(`/inbox/comments/${id(p.get('post_id'))}?${q}`);
 case 'mentions':return social(`/accounts/${id(account)}/mentions?${q}`);
 case 'reviews':return social(`/inbox/reviews/${id(account)}?${q}`);
 case 'pages':return social(`/accounts/${id(account)}/pages`);
 case 'boards':return social(`/accounts/${id(account)}/boards`);
 case 'pins':return social(`/accounts/${id(account)}/pins?${q}`);
 case 'syncStatus':return social(`/inbox/sync?${q}`);
 case 'accountAnalytics':return social(`/accounts/${id(account)}/analytics?${q}`);
 default:throw new AppError(404,'Боломж олдсонгүй.');
 }
}
async function perform(u:User,input:any){
 const action=requiredText(input.action,80), b=input.payload||{}; let result:any;
 if(action==='provider.request'){
 if(!isAdmin(u))throw new AppError(403,'Зөвхөн баталгаажсан системийн админ ашиглана.');
 const index=z.number().int().min(0).max(catalog.length-1).parse(b.operation),operation=catalog[index];
 let path=operation.path;
 for(const p of operation.parameters.filter(p=>p.in==='path'))path=path.replace('{'+p.name+'}',id(b.params?.[p.name]));
 const qs=new URLSearchParams();for(const p of operation.parameters.filter(p=>p.in==='query')){const value=b.query?.[p.name];if(value!==undefined)qs.set(p.name,String(value));else if(p.required)throw new AppError(400,p.name+' параметр шаардлагатай.');}
 const result=await social(path+(qs.size?'?'+qs:''),operation.method,operation.method==='GET'?undefined:b.body||{});audit(u,'provider.'+operation.method+':'+operation.path);
 // Webhook secrets are returned once. Persist one registered endpoint's secret for signature verification, never echo it to a client.
 if(operation.path==='/webhooks'&&operation.method==='POST'&&result.secret){const expected=process.env.APP_URL?.replace(/\/$/,'')+'/api/webhooks/socialapi';if(b.body?.url===expected)db().prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('webhook_secret',?)").run(result.secret);}
 const redact=(value:any):any=>Array.isArray(value)?value.map(redact):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/secret|token|api_key|password/i.test(key)?'[серверт нууцалсан]':redact(v)])):value;
 return redact(result);
 }
 if(action==='admin.claim'){if(!process.env.ADMIN_SETUP_TOKEN||!process.env.ADMIN_EMAIL||u.email!==process.env.ADMIN_EMAIL.toLowerCase()||digest(String(b.setup_token||''))!==digest(process.env.ADMIN_SETUP_TOKEN))throw new AppError(403,'Админ баталгаажуулалт буруу байна.');if(db().prepare("SELECT key FROM settings WHERE key='platform_admin_id'").get())throw new AppError(409,'Системийн админ аль хэдийн баталгаажсан.');db().prepare("INSERT INTO settings(key,value) VALUES('platform_admin_id',?)").run(u.id);audit(u,action);return {ok:true};}
 if(!['message.send','conversation.read','conversation.status','message.react','message.unreact','contact.save','contact.delete','password.change'].includes(action))manager(u);
 const acct=async()=>{const a=requiredText(b.account_id,512);await ownAccount(u,a);return a;};
 if(action==='connect'){
  const platform=platforms.find(p=>p.id===b.platform);if(!platform)throw new AppError(400,'Платформ буруу байна.');
  if(platform.id==='whatsapp')throw new AppError(400,'WhatsApp-ийг SocialAPI dashboard дахь Meta embedded signup-аар энэ байгууллагын brand-д холбоно уу.');
  const brandId=await brand(u);const state=token();db().prepare('INSERT INTO oauth_states(hash,workspace_id,expires_at,platform) VALUES(?,?,?,?)').run(digest(state),u.workspace_id,Date.now()+3600000,platform.id);
  const metadata:Record<string,string>={};if(platform.id==='telegram')metadata.bot_token=requiredText(b.bot_token,300);if(platform.id==='bluesky'){metadata.identifier=requiredText(b.identifier,200);metadata.app_password=requiredText(b.app_password,200);}
  if(!process.env.APP_URL)throw new AppError(503,'APP_URL орчны тохиргоог оруулна уу.');
  result=await social('/accounts/connect','POST',{platform:platform.id,brand_id:brandId,redirect_uri:`${process.env.APP_URL.replace(/\/$/,'')}/oauth/callback`,state,metadata});
 }else if(action==='pending.select'){ownResource(u,'pending',b.id);result=await social(`/accounts/pending/${id(b.id)}/select`,'POST',{platform_account_id:b.platform_account_id,page_ids:b.page_ids});
 }else if(action==='account.disconnect'){await acct();result=await social(`/accounts/${id(b.account_id)}`,'DELETE');db().prepare("DELETE FROM resources WHERE workspace_id=? AND kind='account' AND id=?").run(u.workspace_id,b.account_id);
 }else if(action==='account.permissions'){await acct();result=await social(`/accounts/${id(b.account_id)}`,'PATCH',{permissions:b.permissions});
 }else if(action==='account.sync'){await acct();result=await social(`/accounts/${id(b.account_id)}/sync`,'POST');
 }else if(action==='inbox.sync'){await acct();result=await social('/inbox/sync','POST',{account_id:b.account_id});
 }else if(action==='message.send'){const c=await ownConversation(u,b.conversation_id);const text=requiredText(b.text,2000);result=await social(`/inbox/conversations/${id(b.conversation_id)}/messages`,'POST',{account_id:c.account_id,text,...(b.attachments?{attachments:b.attachments}:{}),...(b.buttons?{buttons:b.buttons}:{})});
 }else if(action==='conversation.read'||action==='conversation.status'){await ownConversation(u,b.id);result=await social(`/inbox/conversations/${id(b.id)}${action==='conversation.read'?'/read':''}`,action==='conversation.read'?'POST':'PATCH',action==='conversation.read'?undefined:{status:z.enum(['active','archived']).parse(b.status)});
 }else if(action==='message.react'||action==='message.unreact'){await ownConversation(u,b.conversation_id);result=await social(`/inbox/conversations/${id(b.conversation_id)}/messages/${id(b.message_id)}/reaction`,action==='message.react'?'POST':'DELETE',action==='message.react'?{emoji:requiredText(b.emoji,20)}:undefined);
 }else if(action.startsWith('comment.')){const account=await acct();const base=`/inbox/comments/${id(b.post_id)}`;const cid=b.comment_id?id(b.comment_id):'';
  if(action==='comment.reply')result=await social(base,'POST',{account_id:account,comment_id:b.comment_id,text:requiredText(b.text,2000)});
  else if(action==='comment.private')result=await social(`${base}/${cid}/private-reply`,'POST',{account_id:account,text:requiredText(b.text,2000)});
  else {const suffix:Record<string,string>={'comment.hide':'hide','comment.unhide':'hide','comment.like':'like','comment.unlike':'like','comment.delete':''};if(!(action in suffix))throw new AppError(400,'Үйлдэл буруу байна.');const del=['comment.unhide','comment.unlike','comment.delete'].includes(action);const path=`${base}/${cid}${suffix[action]?'/'+suffix[action]:''}`;result=await social(path+(del?`?account_id=${id(account)}`:''),del?'DELETE':'POST',del?undefined:{account_id:account});}
 }else if(action==='review.reply'){await acct();result=await social(`/inbox/reviews/${id(b.id)}/reply`,'POST',{account_id:b.account_id,text:requiredText(b.text,4000)});
 }else if(action==='mention.reply'){await acct();result=await social(`/accounts/${id(b.account_id)}/mentions/reply`,'POST',{media_id:b.id,text:requiredText(b.text,2000),...(b.comment_id?{comment_id:b.comment_id}:{})});
 }else if(action==='automation.create'){await acct();const input=z.object({account_id:z.string(),name:z.string().min(1).max(100),trigger:z.enum(['dm','comment']),keywords:z.array(z.string().min(1).max(100)).min(1).max(20),reply:z.string().min(1).max(1000),once_per_person:z.boolean().optional(),steps:z.array(z.unknown()).max(10).optional()}).parse(b);if(Buffer.byteLength(input.reply,'utf8')>1000)throw new AppError(400,'Автомат хариулт UTF-8-аар 1000 байтаас ихгүй байна. Текстээ богиносгоно уу.');result=await social('/automations','POST',automationPayload(input));
 }else if(action==='automation.update'||action==='automation.delete'){await ownAutomation(u,b.id);result=await social(`/automations/${id(b.id)}`,action==='automation.delete'?'DELETE':'PATCH',action==='automation.delete'?undefined:{...(b.status?{status:z.enum(['active','paused']).parse(b.status)}:{}),...(b.name?{name:requiredText(b.name,100)}:{}),...(b.steps?{steps:b.steps}:{})});
 }else if(action==='post.create'||action==='post.validate'){
  const targets=z.array(z.object({account_id:z.string(),page_id:z.string().optional(),platform_data:z.record(z.string(),z.unknown()).optional(),text:z.string().max(15000).optional()})).min(1).max(13).parse(b.targets);for(const target of targets)await ownAccount(u,target.account_id);
  if(b.scheduled_at && (!Number.isFinite(Date.parse(b.scheduled_at))||Date.parse(b.scheduled_at)<Date.now()))throw new AppError(400,'Ирээдүйн огноо сонгоно уу.');
  const media=z.array(z.object({source_type:z.enum(['url','media_id']),source:z.string().min(1).max(3000),type:z.enum(['image','video','audio','file'])})).max(20).parse(b.media||[]);for(const m of media){if(m.source_type==='media_id')ownResource(u,'media',m.source);else if(!m.source.startsWith('https://'))throw new AppError(400,'Медиа холбоос HTTPS байх ёстой.');}
  result=await social(action==='post.create'?'/posts':'/posts/validate','POST',{text:requiredText(b.text,15000),targets,media,...(b.scheduled_at?{scheduled_at:b.scheduled_at}:{}),publish_now:Boolean(b.publish_now),...(b.platform_data?{platform_data:b.platform_data}:{}),...(b.first_comment?{first_comment:requiredText(b.first_comment,2000)}:{}),...(b.title?{title:requiredText(b.title,200)}:{})});
 }else if(['post.publish','post.retry','post.delete','post.update','post.unpublish'].includes(action)){await ownPost(u,b.id);const verb=action.split('.')[1];result=await social(`/posts/${id(b.id)}${['publish','retry','unpublish'].includes(verb)?'/'+verb:''}`,verb==='delete'?'DELETE':verb==='update'?'PATCH':'POST',verb==='update'?{text:requiredText(b.text,15000),...(b.scheduled_at?{scheduled_at:b.scheduled_at}:{})}:undefined);
 }else if(action==='media.delete'){ownResource(u,'media',b.id);result=await social(`/media/${id(b.id)}`,'DELETE');db().prepare("DELETE FROM resources WHERE workspace_id=? AND kind='media' AND id=?").run(u.workspace_id,b.id);
 }else if(action==='contact.save'){
 const name=requiredText(b.name,100),contactId=b.id||randomUUID();const row=db().prepare('SELECT workspace_id FROM contacts WHERE id=?').get(contactId);if(row&&row.workspace_id!==u.workspace_id)throw new AppError(404,'Харилцагч олдсонгүй.');
 db().prepare('INSERT INTO contacts(id,workspace_id,name,phone,email,tags,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,email=excluded.email,tags=excluded.tags,note=excluded.note').run(contactId,u.workspace_id,name,String(b.phone||'').slice(0,50),String(b.email||'').slice(0,254),String(b.tags||'').slice(0,200),String(b.note||'').slice(0,3000));result={id:contactId};
 }else if(action==='contact.delete'){db().prepare('DELETE FROM contacts WHERE id=? AND workspace_id=?').run(b.id,u.workspace_id);result={ok:true};
 }else if(action==='team.invite'){const email=z.email().parse(b.email).toLowerCase();if(db().prepare('SELECT id FROM users WHERE email=?').get(email))throw new AppError(409,'Энэ имэйлээр хэрэглэгч бүртгэлтэй байна.');const invite=token();db().prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(`invite:${digest(invite)}`,JSON.stringify({workspace_id:u.workspace_id,email,role:z.enum(['agent','admin']).parse(b.role||'agent'),expires:Date.now()+86400000}));result={url:`${process.env.APP_URL}/?invite=${invite}`};
 }else if(action==='team.remove'){const target=db().prepare('SELECT role FROM users WHERE id=? AND workspace_id=?').get(b.id,u.workspace_id);if(!target||target.role==='owner'||b.id===u.id)throw new AppError(400,'Энэ хэрэглэгчийг хасах боломжгүй.');db().prepare('DELETE FROM users WHERE id=? AND workspace_id=?').run(b.id,u.workspace_id);result={ok:true};
 }else if(action==='password.change'){const saved=db().prepare('SELECT password_hash FROM users WHERE id=?').get(u.id) as any;if(!checkPassword(String(b.current_password||''),saved.password_hash))throw new AppError(400,'Одоогийн нууц үг буруу байна.');const password=z.string().min(10).max(128).parse(b.new_password);db().prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password),u.id);db().prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);await createSession(u.id);result={ok:true};
 }else if(action==='workspace.rename'){db().prepare('UPDATE workspaces SET name=? WHERE id=?').run(requiredText(b.name,100),u.workspace_id);if(u.brand_id)await social(`/brands/${id(u.brand_id)}`,'PATCH',{name:b.name});result={ok:true};
 }else if(action==='export.create'){await acct();result=await social(`/accounts/${id(b.account_id)}/export`,'POST',b.options||{});const eid=result.id||result.export_id;if(eid)remember(u,'export',eid);
 }else if(action==='webhook.register'){if(!isAdmin(u))throw new AppError(403,'Системийн админ шаардлагатай.');if(!process.env.APP_URL?.startsWith('https://'))throw new AppError(400,'APP_URL нь HTTPS хаяг байх ёстой.');if(process.env.SOCIALAPI_WEBHOOK_SECRET || db().prepare("SELECT key FROM settings WHERE key='webhook_secret'").get())throw new AppError(409,'Webhook бүртгэлтэй байна. SocialAPI dashboard-оос төлөвийг шалгана уу.');result=await social('/webhooks','POST',{url:`${process.env.APP_URL.replace(/\/$/,'')}/api/webhooks/socialapi`,events:['dm.received','comment.received','mention.received','review.received','post.published','post.failed','post.partial']});if(!result.secret)throw new AppError(502,'Webhook secret ирсэнгүй.');db().prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('webhook_secret',?)").run(result.secret);result={id:result.id,ok:true};
 }else if(action==='webhook.test'||action==='webhook.retry'){if(!isAdmin(u))throw new AppError(403,'Системийн админ шаардлагатай.');result=await social(`/webhooks/${id(b.id)}/${action==='webhook.test'?'test':`deliveries/${id(b.delivery_id)}/retry`}`,'POST',action==='webhook.test'?{event_type:'rainy.test',payload:{event:'rainy.test',data:{}}}:undefined);
 }else if(action==='board.create'||action==='board.update'||action==='board.delete'){await acct();const base=`/accounts/${id(b.account_id)}/boards`;result=await social(base+(action==='board.create'?'':`/${id(b.id)}`),action==='board.create'?'POST':action==='board.delete'?'DELETE':'PATCH',action==='board.delete'?undefined:{name:requiredText(b.name,100),privacy:b.privacy||'PUBLIC'});
 }else if(action==='feedback.send'){if(!isAdmin(u))throw new AppError(403,'Системийн админ шаардлагатай.');result=await social('/feedback','POST',{type:b.type||'general',message:requiredText(b.message,4000)});
 }else throw new AppError(404,'Үйлдэл олдсонгүй.');
 audit(u,action);return result;
}
async function handle(request:Request,ctx:{params:Promise<{path:string[]}>}){
 try{
 const path=(await ctx.params).path.join('/'),p=new URL(request.url).searchParams;
 if(path==='health')return success({ok:true,service:'rainychatbot'});
 if(path==='webhooks/socialapi'&&request.method==='POST')return await webhook(request);
 if(request.method!=='GET')requireSameOrigin(request);
 if(path==='auth/me')return success({user:await currentUser(),configured:configured()});
 if(path==='auth/logout'&&request.method==='POST'){await logout();return success({ok:true});}
 if(['auth/register','auth/login'].includes(path)&&request.method==='POST'){
  if(Number(request.headers.get('content-length')||0)>16000)throw new AppError(413,'Хэт том хүсэлт.');
  const client=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'local';if(!rateLimit('auth-ip:'+digest(client),60,900))throw new AppError(429,'Олон оролдлого хийсэн байна. Түр хүлээнэ үү.');
  const parsed=userSchema.safeParse(await request.json());if(!parsed.success)throw new AppError(400,'Имэйл, 10-аас дээш тэмдэгттэй нууц үг оруулна уу.');const b=parsed.data,email=b.email.toLowerCase();
  if(!rateLimit(`auth:${email}`,12,900))throw new AppError(429,'Олон оролдлого хийсэн байна. 15 минутын дараа оролдоно уу.');
  const existing=db().prepare('SELECT * FROM users WHERE email=?').get(email) as any;
  if(path==='auth/login'){if(!existing||!checkPassword(b.password,existing.password_hash))throw new AppError(401,'Имэйл эсвэл нууц үг буруу байна.');await createSession(existing.id);return success({user:await currentUser()});}
  if(existing)throw new AppError(409,'Энэ имэйлээр бүртгэл үүссэн байна.');
  if(!b.name)throw new AppError(400,'Нэрээ оруулна уу.');
  const inviteToken=p.get('invite');let invite:any=null;
  if(inviteToken){const saved=db().prepare('SELECT value FROM settings WHERE key=?').get(`invite:${digest(inviteToken)}`) as any;invite=saved?JSON.parse(saved.value):null;if(!invite||invite.email!==email||invite.expires<Date.now())throw new AppError(400,'Урилгын хугацаа дууссан эсвэл имэйл тохирохгүй байна.');}
  if(!invite&&!b.workspace)throw new AppError(400,'Байгууллагын нэрээ оруулна уу.');
  const uid=randomUUID(),wid=invite?.workspace_id||randomUUID();const hash=hashPassword(b.password);const d=db();d.exec('BEGIN IMMEDIATE');try{if(!invite)d.prepare('INSERT INTO workspaces(id,name) VALUES(?,?)').run(wid,b.workspace!);d.prepare('INSERT INTO users(id,workspace_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(uid,wid,b.name,email,hash,invite?.role||'owner');if(invite)d.prepare('DELETE FROM settings WHERE key=?').run(`invite:${digest(inviteToken!)}`);d.exec('COMMIT');}catch(e){d.exec('ROLLBACK');throw e;}await createSession(uid);return success({user:await currentUser()},201);
 }
 const user=await requireUser();if(!rateLimit(`api:${user.id}`,180,60))throw new AppError(429,'Хүсэлтийн хурд хэтэрсэн. Түр хүлээнэ үү.');
 if(path==='data'&&request.method==='GET')return success(await getData(user,p));
 if(path==='action'&&request.method==='POST'){if(Number(request.headers.get('content-length')||0)>200000)throw new AppError(413,'Хүсэлт хэт том байна.');return success(await perform(user,await request.json()));}
 if(path==='upload'&&request.method==='POST'){manager(user);if(Number(request.headers.get('content-length')||0)>51*1024*1024)throw new AppError(413,'Файл хэт том байна.');const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||file.size>50*1024*1024)throw new AppError(400,'50 MB хүртэлх файл сонгоно уу.');if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime)|audio\/(mpeg|mp4|ogg))$/.test(file.type))throw new AppError(400,'Дэмжихгүй файл байна. JPG, PNG, WebP, GIF, MP4 эсвэл аудио сонгоно уу.');const result=await social('/media/upload','POST',form);const mid=result.id||result.media_id||result.data?.id;if(mid)remember(user,'media',mid);return success(result);}
 throw new AppError(404,'Хуудас олдсонгүй.');
 }catch(error){if(error instanceof SyntaxError)return success({error:{message:'JSON бүтэц буруу байна.',code:'validation.json'}},400);if(error instanceof AppError)return NextResponse.json({error:{message:error.message,code:error.code}},{status:error.status,headers:error.retryAfter?{'Retry-After':error.retryAfter}:{}});if(error instanceof z.ZodError)return success({error:{message:'Оруулсан мэдээллийн бүтэц буруу байна.',code:'validation.failed'}},400);console.error('Rainy request failed',error instanceof Error?error.name:'unknown');return success({error:{message:'Хүсэлтийг боловсруулахад алдаа гарлаа.',code:'internal.error'}},500);}
}
export const GET=handle;export const POST=handle;
