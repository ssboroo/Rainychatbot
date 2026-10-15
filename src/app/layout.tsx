import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'RAINY Chat — Харилцаа бүрийг боломж болго',description:'Монгол бизнесүүдийн сошиал харилцаа, ухаалаг автоматжуулалт, контентыг нэг дор.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="mn"><body>{children}</body></html>}
