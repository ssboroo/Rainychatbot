import { cookies } from 'next/headers';
import { db, type User } from './db';
import { AppError, digest, token } from './security';
export async function currentUser(): Promise<User | null> { const session=(await cookies()).get('rainy_session')?.value; if (!session) return null; return db().prepare(`SELECT u.id,u.workspace_id,u.name,u.email,u.role,w.name AS workspace_name,w.brand_id FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.id=u.workspace_id WHERE s.hash=? AND s.expires_at>?`).get(digest(session),Date.now()) as User || null; }
export async function requireUser() { const user=await currentUser(); if (!user) throw new AppError(401,'Үргэлжлүүлэхийн тулд нэвтэрнэ үү.','auth.required'); return user; }
export function isAdmin(user: User) { const approved=db().prepare("SELECT value FROM settings WHERE key='platform_admin_id'").get() as {value:string}|undefined; return approved?.value===user.id; }
export async function createSession(userId: string) { const value=token(); db().prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now()); db().prepare('INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)').run(digest(value),userId,Date.now()+7*86400000); (await cookies()).set('rainy_session',value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400}); }
export async function logout() { const jar=await cookies(), value=jar.get('rainy_session')?.value; if(value)db().prepare('DELETE FROM sessions WHERE hash=?').run(digest(value)); jar.delete('rainy_session'); }
