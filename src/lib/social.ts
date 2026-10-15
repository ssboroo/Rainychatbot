import { AppError } from './security';
import { db, type User } from './db';
let transport: typeof fetch = (...args) => fetch(...args);
export function setTransportForTests(fn: typeof fetch) { transport=fn; }
export function configured() { return Boolean(process.env.SOCIALAPI_KEY); }
export async function social(path: string, method='GET', body?: unknown) {
 if (!configured()) throw new AppError(503,'SocialAPI түлхүүр тохируулаагүй байна. Тохиргооны зааврыг дагана уу.','integration.not_configured');
 const form = body instanceof FormData;
 let response: Response;
 try { response = await transport(`https://api.social-api.ai/v1${path}`, { method, headers: { Authorization:`Bearer ${process.env.SOCIALAPI_KEY}`, ...(!form && body ? {'Content-Type':'application/json'} : {}) }, body: body === undefined ? undefined : form ? body : JSON.stringify(body), signal: AbortSignal.timeout(25000), cache:'no-store', redirect:'error' }); }
 catch { throw new AppError(502,'SocialAPI-д холбогдож чадсангүй. Дахин илгээхээс өмнө үйлдлийн төлөвийг шалгана уу.','integration.network'); }
 const data = await response.json().catch(()=>({}));
 if (!response.ok) { const code = data.error?.code || 'integration.failed'; const messages: Record<string,string> = {'auth.invalid_key':'SocialAPI түлхүүр хүчингүй байна.','auth.insufficient_scope':'API түлхүүрт шаардлагатай эрх дутуу байна.','resource.not_supported':'Энэ платформ уг үйлдлийг дэмжихгүй байна.','billing.brands_limit':'Холбох байгууллагын багцын лимит хүрсэн.','validation.interaction_limit_exhausted':'Энэ сарын харилцааны лимит хүрсэн.','validation.redirect_uri_not_whitelisted':'Callback хаягийг SocialAPI тохиргоонд бүртгэнэ үү.','billing.past_due':'SocialAPI багцын төлбөрийг шалгана уу.','account.reconnection_required':'Сувгаа дахин холбоно уу.'}; throw new AppError(response.status,messages[code] || (response.status===429?'Хүсэлтийн лимит хүрсэн. Түр хүлээгээд дахин оролдоно уу.':`SocialAPI хүсэлт амжилтгүй (${code}).`),code,response.headers.get('retry-after') || undefined,data.error?.meta); }
 return data;
}
export const items = (value: unknown): Record<string,any>[] => Array.isArray(value) ? value : Array.isArray((value as any)?.data) ? (value as any).data : [];
const brandLocks = new Map<string, Promise<string>>();
export async function brand(user: User): Promise<string> {
 const existing=brandLocks.get(user.workspace_id); if(existing)return existing;
 const task=(async()=>{const row=db().prepare('SELECT brand_id FROM workspaces WHERE id=?').get(user.workspace_id) as {brand_id:string|null}; if(row.brand_id)return row.brand_id;
 const result=await social('/brands','POST',{name:user.workspace_name});const brandId=result.id||result.data?.id;if(!brandId)throw new AppError(502,'Байгууллагын ID ирсэнгүй.');db().prepare('UPDATE workspaces SET brand_id=? WHERE id=? AND brand_id IS NULL').run(brandId,user.workspace_id);return brandId as string;})();
 brandLocks.set(user.workspace_id,task);try{return await task}finally{brandLocks.delete(user.workspace_id)}
}
export async function accounts(user: User) {
 if(!user.brand_id)return [];
 const result=items(await social(`/accounts?brand_id=${encodeURIComponent(user.brand_id)}`));
 // Reconcile the local ownership index used by the webhook receiver; never call the provider in its 10-second delivery path.
 const d=db();d.exec('BEGIN IMMEDIATE');try{d.prepare("DELETE FROM resources WHERE workspace_id=? AND kind='account'").run(user.workspace_id);for(const a of result)d.prepare("INSERT INTO resources(workspace_id,kind,id) VALUES(?,'account',?)").run(user.workspace_id,a.id);d.exec('COMMIT')}catch(e){d.exec('ROLLBACK');throw e}
 return result;
}
export async function ownAccount(user: User, accountId: string) { const account=(await accounts(user)).find(a=>a.id===accountId);if(!account)throw new AppError(404,'Суваг олдсонгүй.','resource.not_found');return account; }
export async function ownConversation(user: User, conversationId: string) { const c=await social(`/inbox/conversations/${encodeURIComponent(conversationId)}`); const result=c.data || c; await ownAccount(user,result.account_id); return result; }
export async function ownAutomation(user: User, automationId: string) { const a=await social(`/automations/${encodeURIComponent(automationId)}`); await ownAccount(user,(a.data||a).account_id); return a.data||a; }
export async function ownPost(user: User, postId: string) { const p=await social(`/posts/${encodeURIComponent(postId)}`); const post=p.data||p; const owned=new Set((await accounts(user)).map(a=>a.id)); if (!post.targets?.length || !post.targets.every((t:any)=>owned.has(t.account_id))) throw new AppError(404,'Пост олдсонгүй.'); return post; }
export function remember(user: User, kind: string, resourceId: string) { db().prepare('INSERT OR IGNORE INTO resources(workspace_id,kind,id) VALUES(?,?,?)').run(user.workspace_id,kind,resourceId); }
export function ownResource(user: User, kind: string, resourceId: string) { if (!db().prepare('SELECT id FROM resources WHERE workspace_id=? AND kind=? AND id=?').get(user.workspace_id,kind,resourceId)) throw new AppError(404,'Мэдээлэл олдсонгүй.'); }
