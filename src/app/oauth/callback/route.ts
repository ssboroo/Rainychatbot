import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { digest } from '@/lib/security';
import { remember } from '@/lib/social';
export const runtime='nodejs';
export async function GET(request:Request){
 const url=new URL(request.url), p=url.searchParams, user=await currentUser();
 const target=new URL('/',process.env.APP_URL||url.origin);target.searchParams.set('view','channels');
 if(!user){target.searchParams.set('notice','Нэвтэрч ороод сувгаа дахин холбоно уу.');return NextResponse.redirect(target);}
 const state=p.get('state');const row=state?db().prepare('SELECT * FROM oauth_states WHERE hash=? AND workspace_id=? AND expires_at>?').get(digest(state),user.workspace_id,Date.now()):null;
 if(!row){target.searchParams.set('notice','Холболтын баталгаажуулалт хүчингүй. Дахин эхлүүлнэ үү.');return NextResponse.redirect(target);}
 db().prepare('DELETE FROM oauth_states WHERE hash=?').run(digest(state!));
 if(p.get('status')==='selection_required'&&p.get('connection_id')){remember(user,'pending',p.get('connection_id')!);target.searchParams.set('pending',p.get('connection_id')!);}
 else target.searchParams.set('notice',p.get('status')==='success'?'Суваг холбогдлоо.':'Холболт амжилтгүй. SocialAPI болон платформын зөвшөөрлөө шалгана уу.');
 return NextResponse.redirect(target);
}
