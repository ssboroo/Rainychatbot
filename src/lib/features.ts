export const platforms = [
 {id:'facebook',name:'Facebook',short:'f',color:'#1877f2',desc:'Page, Messenger, сэтгэгдэл, Reels',oauth:true},
 {id:'instagram',name:'Instagram',short:'◎',color:'#e34d88',desc:'DM, сэтгэгдэл, Story, Reels',oauth:true},
 {id:'threads',name:'Threads',short:'@',color:'#202b29',desc:'Пост, хариулт, mention (beta)',oauth:true},
 {id:'google',name:'Google Business',short:'G',color:'#4285f4',desc:'Үнэлгээ, байршил, пост',oauth:true},
 {id:'tiktok',name:'TikTok',short:'♪',color:'#202b29',desc:'Видео, сэтгэгдэл, аналитик',oauth:true},
 {id:'youtube',name:'YouTube',short:'▶',color:'#ee4b49',desc:'Видео, сэтгэгдэл, тайлан',oauth:true},
 {id:'linkedin',name:'LinkedIn',short:'in',color:'#0a66c2',desc:'Мэргэжлийн контент нийтлэх',oauth:true},
 {id:'pinterest',name:'Pinterest',short:'P',color:'#bd081c',desc:'Pin, board, зураг нийтлэх',oauth:true},
 {id:'twitter',name:'X / Twitter',short:'𝕏',color:'#202b29',desc:'Өөрийн X app шаардлагатай',oauth:true},
 {id:'telegram',name:'Telegram',short:'➤',color:'#229ed9',desc:'BotFather токеноор холбоно',oauth:false},
 {id:'bluesky',name:'Bluesky',short:'B',color:'#1185fe',desc:'App password-оор холбоно',oauth:false},
 {id:'zalo',name:'Zalo',short:'Z',color:'#0068ff',desc:'Official Account, DM, нийтлэл',oauth:true},
 {id:'whatsapp',name:'WhatsApp',short:'◉',color:'#20b467',desc:'Meta embedded signup',oauth:true}
];
export const templates=[
 {name:'Үнийн мэдээлэл',trigger:'dm',keywords:['үнэ','une','price'],reply:'Сайн байна уу! Манай үйлчилгээний үнийн мэдээллийг эндээс үзээрэй: https://example.com/price',category:'Борлуулалт'},
 {name:'Сэтгэгдлээс чат руу',trigger:'comment',keywords:['мэдээлэл','medeelel','info'],reply:'Сайн байна уу! Та манай үйлчилгээг сонирхсонд баярлалаа. Ямар мэдээлэл авахыг хүсэж байна вэ?',category:'Харилцаа'},
 {name:'Ажиллах цаг, хаяг',trigger:'dm',keywords:['хаяг','hayag','цаг','tsag'],reply:'Сайн байна уу! Манай хаяг: [хаягаа оруулна уу]. Ажиллах цаг: Даваа–Баасан 09:00–18:00.',category:'Үйлчилгээ'},
 {name:'Захиалгын мэдээлэл',trigger:'dm',keywords:['захиалга','zahialga','order'],reply:'Захиалга өгөхийн тулд сонирхсон бараа, тоо ширхэгээ бичнэ үү. Манай ажилтан тантай холбогдоно.',category:'Дэлгүүр'}
];
export function automationPayload(input: {account_id:string;name:string;trigger:string;keywords:string[];reply:string;once_per_person?:boolean;steps?:unknown[]}) { return {account_id:input.account_id,name:input.name,trigger:input.trigger,once_per_person:input.once_per_person??true,steps:input.steps||[{key:'start',filters:[{type:'keyword',keyword:{keywords:input.keywords,match:'contains'}}],actions:input.trigger==='comment'?[{type:'private_reply',private_reply:{texts:[input.reply]}}]:[{type:'send_dm',send_dm:{texts:[input.reply]}}]}]}; }
