export async function register(){if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.NEXT_PHASE!=='phase-production-build'){const {startBotWorker}=await import('./lib/bot-engine');startBotWorker()}}
