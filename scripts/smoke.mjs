import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const port=Number(process.env.SMOKE_PORT||3189),base=`http://localhost:${port}`,dir=mkdtempSync(join(tmpdir(),'rainy-smoke-'));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port),'--hostname','127.0.0.1'],{env:{...process.env,APP_URL:base,DATABASE_PATH:join(dir,'app.db'),ADMIN_EMAIL:'operator@example.com',ADMIN_SETUP_TOKEN:'test-only-setup-token',SOCIALAPI_KEY:'',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
async function call(path,{cookie,body,origin=base,...options}={}){const r=await fetch(base+'/api/'+path,{...options,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),Origin:origin},body:body===undefined?undefined:JSON.stringify(body)});const json=await r.json();return {status:r.status,json,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers}}
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.equal(ready,true,logs);
 assert.equal((await call('data?resource=contacts')).status,401);
 const register=async(email,workspace)=>call('auth/register',{method:'POST',body:{name:'Тест',email,password:'test-password-123',workspace}});
 const a=await register('operator@example.com','Бизнес А');assert.equal(a.status,201,JSON.stringify(a.json));const cookieA=a.cookie;
 assert.equal((await call('data?resource=settings',{cookie:cookieA})).json.isAdmin,false,'Claiming an admin email alone must never grant platform privileges');
 assert.equal((await call('action',{method:'POST',cookie:cookieA,body:{action:'admin.claim',payload:{setup_token:'wrong'}}})).status,403);
 assert.equal((await call('action',{method:'POST',cookie:cookieA,body:{action:'admin.claim',payload:{setup_token:'test-only-setup-token'}}})).status,200);
 assert.equal((await call('data?resource=settings',{cookie:cookieA})).json.isAdmin,true);
 const contact=await call('action',{method:'POST',cookie:cookieA,body:{action:'contact.save',payload:{name:'Нууц харилцагч',phone:'99112233'}}});assert.equal(contact.status,200);
 const b=await register('other@example.com','Бизнес Б');assert.equal(b.status,201);const cookieB=b.cookie;
 assert.equal((await call('data?resource=contacts',{cookie:cookieB})).json.data.length,0);
 assert.equal((await call('action',{method:'POST',cookie:cookieB,body:{action:'contact.save',payload:{id:contact.json.id,name:'Халдах оролдлого'}}})).status,404);
 assert.equal((await call('action',{method:'POST',cookie:cookieB,body:{action:'contact.delete',payload:{id:contact.json.id}}})).status,200);
 assert.equal((await call('data?resource=contacts',{cookie:cookieA})).json.data.length,1);
 assert.equal((await call('action',{method:'POST',cookie:cookieA,origin:'https://evil.example',body:{action:'contact.save',payload:{name:'CSRF'}}})).status,403);
 assert.equal((await call('action',{method:'POST',cookie:cookieB,body:{action:'provider.request',payload:{operation:0}}})).status,403);
 assert.equal((await call('action',{method:'POST',cookie:cookieA,body:{action:'connect',payload:{platform:'facebook'}}})).status,503);
 const invite=await call('action',{method:'POST',cookie:cookieA,body:{action:'team.invite',payload:{email:'agent@example.com',role:'agent'}}});assert.equal(invite.status,200);
 const inviteToken=new URL(invite.json.url).searchParams.get('invite');const agent=await call('auth/register?invite='+inviteToken,{method:'POST',body:{name:'Ажилтан',email:'agent@example.com',password:'test-agent-password'}});assert.equal(agent.status,201,JSON.stringify(agent.json));
 assert.equal((await call('action',{method:'POST',cookie:agent.cookie,body:{action:'workspace.rename',payload:{name:'Эрхгүй засвар'}}})).status,403);
 assert.equal((await call('data?resource=contacts',{cookie:agent.cookie})).json.data.length,1);
 assert.equal((await call('auth/logout',{method:'POST',cookie:cookieA})).status,200);assert.equal((await call('data?resource=contacts',{cookie:cookieA})).status,401);
 const home=await fetch(base);assert.equal(home.status,200);assert.equal(home.headers.get('x-content-type-options'),'nosniff');
 console.log('PASS: registration, sessions, admin claim, CSRF, tenant isolation, invitation roles, configuration failure, logout, health and headers.');
}finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));rmSync(dir,{recursive:true,force:true})}
