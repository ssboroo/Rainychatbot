# RAINY Chat 🌿

Монгол бизнесүүдийн Facebook/Instagram чат, автоматжуулалт болон сошиал контентыг удирдах вэб платформ. **Next.js 16 · React 19 · TypeScript · Node.js 24 · SQLite · SocialAPI.ai**.

## Боломжууд

- Монгол интерфэйс, responsive самбар, тусдаа тэмдэглэсэн туршилтын орчин.
- Бүртгэл, нэвтрэлт, scrypt нууц үг, httpOnly session; байгууллага тус бүрийн тусгаарлагдсан өгөгдөл.
- SocialAPI managed OAuth: Facebook, Instagram, Threads, Google, TikTok, YouTube, LinkedIn, Pinterest, X, Zalo. Telegram bot token, Bluesky app password.
- WhatsApp нь SocialAPI dashboard дахь Meta embedded signup-аар тухайн brand-д холбогдоно; popup SDK-г энэ аппд хараахан суулгаагүй.
- Нэгдсэн inbox: чат, уншсан төлөв, архив, гараар хариулах; 20 секунд тутмын шинэчлэлт, cursor pagination.
- Сэтгэгдэл, public/private хариу, платформын capability flag-аар нуух/like; mention болон Google review хариу.
- Монгол/латин түлхүүр үгийн автоматжуулалт: DM, comment-to-DM, pause/resume, runs, JSON multi-step editor.
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

Нэг удаа ирэх secret зөвхөн серверийн DB-д хадгалагдана. Эсвэл dashboard-оос бүртгээд `SOCIALAPI_WEBHOOK_SECRET` тохируулна. Signature V2 нь `<timestamp>.<raw body>`-г HMAC хийдэг. Хүлээн авагч provider руу сүлжээний дуудлага хийдэггүй: body-г баталгаажуулж DB-д хадгалаад 200 буцаана. Workspace mapping нь Сувгуудын шинэчлэлтээр бүрдэнэ; үл танигдах event нь workspace-д харагдахгүй. Provider-ийн Automations өөрсдийн сервер дээр ажилладаг тул webhook worker шаардлагагүй.

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
- Ажилтан гараар хариулах нь provider automation-ыг тухайн thread дээр автоматаар зогсоохгүй. Шаардлагатай дүрмээ pause хийнэ.
- X өөрийн developer app шаарддаг. Trustpilot холболт дэмжигдээгүй.
- AI чөлөөт хариулт / LLM холболт, QPay, bulk cold messaging энэ хувилбарт ороогүй.
- Бүрэн visual flow canvas-ийн оронд template + JSON multi-step editor ашиглана.
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
