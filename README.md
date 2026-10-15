# RAINY Chat 🌿

Монгол бизнесүүдийн Facebook/Instagram чат, автоматжуулалт болон сошиал контентыг удирдах вэб платформ. **Next.js 16 · React 19 · TypeScript · Node.js 24 · SQLite · SocialAPI.ai**.

## Боломжууд

- Монгол интерфэйс, responsive самбар, тусдаа тэмдэглэсэн туршилтын орчин.
- Бүртгэл, нэвтрэлт, scrypt нууц үг, httpOnly session; байгууллага тус бүрийн тусгаарлагдсан өгөгдөл.
- SocialAPI managed OAuth: Facebook, Instagram, Threads, Google, TikTok, YouTube, LinkedIn, Pinterest, X, Zalo. Telegram bot token, Bluesky app password.
- WhatsApp нь SocialAPI dashboard дахь Meta embedded signup-аар тухайн brand-д холбогдоно; popup SDK-г энэ аппд хараахан суулгаагүй.
- Нэгдсэн inbox: текстгүй зураг/файл ч илгээх rich composer, холбоос, медиа сан, QPay нэхэмжлэх, ажилтанд шилжүүлэх; 20 секунд тутмын шинэчлэлт, cursor pagination.
- Сэтгэгдэл, public/private хариу, платформын capability flag-аар нуух/like; mention болон Google review хариу.
- Монгол/латин түлхүүр үгийн visual bot builder: contains/exact/starts-with, priority, cooldown, once-per-person, ажиллах цаг, fallback, handoff. Текст/зураг/видео/аудио/файл/холбоос/QPay блок, дараалал ба preview.
- Харилцагчийн CRUD, тэмдэглэгээ, тэмдэглэл, CSV экспорт (formula injection хамгаалалттай).
- Контентын ноорог, Улаанбаатарын цагаар төлөвлөх, нийтлэх, засах, retry, metrics; олон сувгийн JSON editor ба validation.
- Зураг/видео/аудио upload, workspace ownership-тэй медиа сан, устгах.
- Brand analytics, daily series, эх сурвалжийн хамрагдалт; async Excel экспорт.
- 24 цагийн нэг удаагийн урилгаар баг нэмэх; owner/admin/agent эрх.
- HMAC-SHA256 V2 webhook, ±5 минут, delivery/event dedup, сервер талын хадгалалт.
- **142 баримтжуулсан JSON API үйлдлийн удирдлагын студи**: зөвхөн баталгаажсан системийн админ. API түлхүүр болон credential-management endpoint-уудыг зориуд оруулаагүй. Студи нь бүх provider brand-д эрхтэй; жирийн workspace хэрэглэгч ашиглахгүй.
- Серверийн rate limit, same-origin mutation, opaque ID encoding, timeout, provider error code/Retry-After, audit.

## Локал ажиллуулах

Node.js **24+** шаардлагатай (`node:sqlite` ашиглана).

```bash
npm ci --ignore-scripts
cp .env.example .env.local
npm run dev
```

`http://localhost:3000` нээнэ. API түлхүүргүй үед demo харагдана. Бүртгүүлсний дараа бодит workspace нь хоосон бөгөөд түлхүүр тохируулж сувгаа холбохыг сануулна. **Demo нь бодит мессеж/пост илгээдэггүй; browser tab шинэчлэгдэхэд reset хийнэ.**

## SocialAPI холболт

1. https://app.social-api.ai дээр API key авна. Түлхүүрийг зөвхөн серверийн `SOCIALAPI_KEY` environment variable-д хадгална. GitHub болон browser-д бүү оруул.
2. `APP_URL=https://your-domain` тохируулна.
3. SocialAPI → API configuration → Redirect URIs-д `https://your-domain/oauth/callback` бүртгэнэ.
4. Аппд бүртгүүлж **Сувгууд → Facebook холбох** дарна. Эхний холболт workspace-д зориулсан SocialAPI brand үүсгэнэ. Давхар хүсэлтээр давхар brand үүсгэхээс single-process lock хамгаална.
5. Зөвшөөрлийн цонхонд Page-ээ сонгоно. Тухайн сувгийн шаардлагатай permission олгосон байх ёстой.
6. Суваг харагдсаны дараа keyword automation үүсгэж, өөр хэрэглэгчийн Messenger-ээс туршина.

### Системийн админ

Админ имэйл бичээд шууд админ болдоггүй. Серверт:

```text
ADMIN_EMAIL=your-operator-email
ADMIN_SETUP_TOKEN=<cryptographically-random-token-at-least-32-characters>
```

Тэр имэйлээр бүртгүүлээд **Тохиргоо → Системийн админ** хэсэгт setup token-оо нэг удаа оруулна. Баталгаажсан хэрэглэгчийн ID DB-д хадгалагдана. Дараа нь setup token-ыг орчноос авч болно. Админ provider-ийн нийт usage болон API студид хандана.

### Webhook

Админ **Тохиргоо → Webhook бүртгэх** дарна. Endpoint:

```text
https://your-domain/api/webhooks/socialapi
```

Нэг удаа ирэх secret зөвхөн серверийн DB-д хадгалагдана. Эсвэл dashboard-оос бүртгээд `SOCIALAPI_WEBHOOK_SECRET` тохируулна. Signature V2 нь `<timestamp>.<raw body>`-г HMAC хийдэг. Хүлээн авагч provider руу сүлжээний дуудлага хийдэггүй: body-г баталгаажуулж DB-д хадгалаад 200 буцаана. Workspace mapping нь Сувгуудын шинэчлэлтээр бүрдэнэ; үл танигдах event нь workspace-д харагдахгүй. Шинэ зурагтай bot engine нь баталгаажсан webhook-ийг persistent bot_jobs queue-д атомикаар хадгална. Node instrumentation нь 5 секунд тутам queue-г боловсруулж, restart хооронд үргэлжлүүлнэ. Uncertain хүргэлтийг blind retry хийхгүй. Тодорхой 429 velocity/rate rejection-д unsent block-оос bounded Retry-After retry хийнэ.

## Railway deployment

Репод Dockerfile болон `railway.json` бэлэн.

1. GitHub repo-г Railway service-т холбоно.
2. **Persistent volume `/data`** заавал нэмнэ. DB: `DATABASE_PATH=/data/rainy.db`.
3. Нэг replica ажиллуулна. SQLite нь энэ нэг-instance MVP-д зориулагдсан; олон instance хэрэгтэй бол Postgres руу migration хийнэ.
4. `APP_URL`, `SOCIALAPI_KEY`, `ADMIN_EMAIL`, `ADMIN_SETUP_TOKEN` тохируулна.
5. Domain үүсгэж callback-аа SocialAPI-д зөвшөөрнө. Healthcheck: `/api/health`.

Volume нь хэрэглэгч, session, харилцагч, ownership, webhook болон админ ID-г redeploy хооронд хадгална. **Volume байхгүй production орчинд durable storage баталгаагүй.** Railway volume backup-аа идэвхжүүлж, сэргээх туршилт хийнэ. Backup нь өгөгдөл устгалын бодлоготой нийцэх ёстой.

## Үнэ ба платформын дүрэм

Энэ код өөрөө хязгааргүй/үнэгүй API эрх олгохгүй. SocialAPI plan, платформын rate limit, messaging window, permissions үйлчилнэ. Үнэ болон боломжийг https://social-api.ai/pricing болон https://docs.social-api.ai-ээс дахин шалгана.

- Facebook/Instagram automation-д keyword хязгаар тавина. Давхардсан дүрэм давхар хариу үүсгэж болно.
- Шинэ local bot engine нь гараар хариулахад тохируулсан хугацаанд thread-ийг pause хийнэ. Engine асаах үед хуучин SocialAPI native automation-тай давхар хариулахаас сэргийлж explicit pause сонголт шаарддаг. Аль хэдийн илгээж эхэлсэн мессежийг буцаахгүй.
- X өөрийн developer app шаарддаг. Trustpilot холболт дэмжигдээгүй.
- AI чөлөөт хариулт / LLM холболт болон bulk cold messaging ороогүй. QPay нь доорх мерчантын тохиргоо шаарддаг.
- Visual builder нь дараалсан хариултын блок ба түлхүүр үгийн дүрэм удирдана; дурын branch/canvas workflow биш. Нарийвчилсан нийлүүлэгчийн multi-step API админ студид үлдэнэ.
- Provider credential/API key удирдах үйлдлийг клиентэд өгөхгүй. Админ API студи нь HTTP JSON endpoint-ууд; multipart/presigned-upload урсгалыг upload UI эсвэл нийлүүлэгчийн dashboard-оор ашиглана.
- Демо болон mocked шалгалт нь бодит Meta OAuth эсвэл SocialAPI production үйлдлийг батлахгүй. Нийлүүлэгчийн key болон Page зөвшөөрөлтэй end-to-end шалгалт зайлшгүй.

## Нууцлал, операторын хариуцлага

Хадгалдаг PII: хэрэглэгчийн нэр/имэйл, харилцагчийн сайн дураар өгсөн утас/имэйл/тэмдэглэл, webhook body. Нууц үг salted scrypt hash. Provider token-ууд SocialAPI-д үлдэнэ. API key нь environment-д; session token нь DB-д зөвхөн hash.

Webhook event 30 хоног, audit 90 хоногийн retention-тэй (эдгээр хуудсыг уншихад cleanup хийгдэнэ). Contacts ба users нь үйлчилгээг үзүүлэх хугацаанд хадгалагдана. Контакт, медиа болон холболтыг UI-гаас устгана. Одоогийн хувилбарт бүтэн account/workspace erase, password recovery email байхгүй; оператор баталгаажсан хүсэлтээр DB/provider/backup бүрийг хамтад нь цэвэрлэх шаардлагатай. Нийтэд нээхээс өмнө өөрийн privacy/terms, холбоо барих хаяг, мэдээлэл устгал/сэргээх процесс болон хэрэглэгчийн зөвшөөрлийг байгууллагын нөхцөлөөр баталгаажуулна.

## Шалгалт

```bash
npm test
npm run typecheck
npm run build
node scripts/smoke.mjs
npm audit --audit-level=high
```

Unit tests: webhook authenticity/replay, password, CSRF, ID injection, tenant account/thread/post/media isolation, concurrent brand creation, quota errors. Smoke test: production HTTP server дээр registration, admin claim, session, tenant contacts, invitation roles, CSRF, missing key, logout, headers.

CI нь Node 24 дээр дээрх шалгалтуудыг ажиллуулна. Browser visual QA болон live provider OAuth нь тусдаа баталгаажуулалт.

## Баримтын суурь

2026-10-15-нд SocialAPI албан ёсны `llms.txt`, guide болон OpenAPI specification-д тулгуурлав. `src/lib/api-catalog.json` нь тухайн үеийн allowlist snapshot. Нийлүүлэгч endpoint өөрчилбөл registry болон adapter-аа шинэчилнэ.

## Зурагтай бот ба QPay (шинэ)

1. **Автоматжуулалт → Хариулт бүтээх**: суваг, DM/comment, түлхүүр үг, тааруулах арга, давуу эрх, cooldown тохируулна.
2. Текст, зураг/GIF, видео, аудио, PDF/ZIP/TXT, холбоос эсвэл QPay блок нэмээд дарааллыг дээш/доош сольж preview харна. Медиагаа upload эсвэл HTTPS URL-аар холбоно.
3. **Нарийн тохиргоо**: Улаанбаатарын ажиллах цаг (шөнө дамнах дэмжлэгтэй), цагийн гаднах хариулт, fallback, нэг хүн/байгууллагын цагийн хариултын лимит, ажилтанд шилжүүлэх үгс ба хугацаа.
4. Engine асаахад SocialAPI key болон webhook хэрэгтэй. Native SocialAPI automation идэвхтэй байвал explicit pause шаарддаг. Шинэ engine болон native хариултыг зэрэг бүү ажиллуул.
5. Төлбөр авах бол **QPay төлбөр → Мерчантын эрх**: өөрийн QPay гэрээний Client ID, Client secret, invoice_code, Sandbox/Production сонгоно. Серверт `DATA_ENCRYPTION_KEY` (64 hex, 32 bytes) тохируулсан байх шаардлагатай. Түлхүүрийг сольбол хуучин encrypted credentials тайлагдахгүй тул найдвартай хадгална.
6. Бүтээгдэхүүн, үнэ нэмнэ. Нийтэд өгөх `/buy/<opaque-token>` холбоос, шууд үүсгэсэн `/pay/<opaque-token>` invoice хуудастай. Product checkout-ийн үнийг server DB тогтооно; клиент үнийг өөрчилж болохгүй.
7. Чатын QPay товчоор invoice үүсгээд төлбөрийн холбоос + QR зургийг илгээнэ. Ботын payment блок мөн event бүрт idempotent invoice үүсгэж илгээнэ. Төлбөр баталгаажвал 24 цагийн платформын цонх дотор paid message queue-д орно.

### QPay мөнгөн гүйлгээний хамгаалалт

- QPay Merchant V2-ийн албан ёсны `/v2/auth/token`, `/v2/auth/refresh`, `/v2/invoice`, `/v2/payment/check` contract ашиглана. Production ба sandbox URL нь allowlist; дурын host оруулахгүй.
- Credentials, cached provider tokens нь workspace-bound AES-256-GCM. Нууц secret-ийг API response буцаахгүй.
- Invoice side effect-ээс өмнө DB-д unique workspace/request-key claim хийнэ. Timeout/unknown хүсэлтийг автоматаар давтан үүсгэхгүй; админ QPay самбараар reconcile хийнэ.
- Callback-ийн opaque secret-ийг шалгаад **серверээс** payment/check дуудна. `PAID`, `MNT`, unique payment ID, төлөгдсөн нийлбэр дүнг шалгаж байж paid болгоно. Клиент болон callback body-ийн “paid” утгад итгэхгүй.
- Provider payment polling cron байхгүй. Public checkout 10 секунд тутам зөвхөн манай DB-ийн төлөв уншина; QPay шалгалтыг зөвхөн callback өдөөдөг.
- Public нэхэмжлэх зөвхөн merchant нэр/тайлбар/дүн/QR/банк/төлөвийг харуулна; хэрэглэгч, workspace ID, credential, callback token буцаахгүй. QR нь PNG header шалгалттай.
- Инвойс үүсгэх нь төлбөр төлөгдсөн гэсэн үг биш; eBarimt/refund/cancel автоматаар хийгдэхгүй.

### Платформын бодит хязгаар

Facebook DM-ийн SocialAPI send нь image/video/file дэмждэг ч button/card-ыг үл хүргэж болно. Тиймээс холбоосыг текстэд заавал давхар оруулна. Instagram DM text 1000 UTF-8 байт; зураг 8 MB, бусад messaging хавсралт 25 MB хүртэл (provider/platform нөхцөл өөрчлөгдөж болно). Comment-ийн эхний private reply-д текст/холбоос л өгнө; зураг, QPay-г хэрэглэгч DM бичсэний дараах дүрмээр хүргэнэ.

`bot_jobs` raw payload ба manual outbound idempotency records 30 хоног хадгалагдана (data endpoint access дээр cleanup). Rule-run-ийн recipient metadata нь cooldown/once-per-person хэрэгжүүлэх зорилгоор дүрэм устгах хүртэл хадгалагдана. QPay invoice нь санхүүгийн бүртгэл тул операторын батлагдсан retention/backup бодлогоор цэвэрлэнэ.

QPay эх сурвалж: https://developer.qpay.mn/mn/docs/merchant?version=2.0.0
Rich DM contract: https://docs.social-api.ai/guides/direct-messages
