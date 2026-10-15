import PublicCheckout from '@/components/public-checkout';
export const metadata={title:'QPay төлбөр | RAINY Chat',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){return <PublicCheckout token={(await params).token} mode="invoice"/>}
