# Tank Duel: Sandstorm

> یک دوئل توپخانه‌ای turn-based با فیزیک پرتابه، زمین destructible، و باد — PWA با Vanilla JS.

[![Version](https://img.shields.io/badge/version-v0.0.5-blue)](https://github.com/andrbi107/tank-duel-sandstorm/releases/tag/v0.0.5) [![PWA](https://img.shields.io/badge/PWA-installable-purple)](https://andrbi107.github.io/tank-duel-sandstorm/) [![deps](https://img.shields.io/badge/deps-Howler.js_local-blueviolet)](https://github.com/andrbi107/tank-duel-sandstorm) [![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

🎮 **[بازی کن](https://andrbi107.github.io/tank-duel-sandstorm/)** — نسخه‌ی آنلاین روی GitHub Pages
📦 **[مخزن گیت‌هاب](https://github.com/andrbi107/tank-duel-sandstorm)** · 🏷️ **[Release v0.0.5](https://github.com/andrbi107/tank-duel-sandstorm/releases/tag/v0.0.5)**

---

## تغییرات v0.0.2 (جدید)

**Tank Duel** — پالت آسمان چهارم «Dawn» (صبحگاه، صورتی-هلویی) در صفحه‌ی شروع. haptic روی شلیک بازیکن.

**همه‌ی بازی‌ها** — `mobile-ux.js` مشترک (haptics/install prompt/version stamp) + cache sw.js به v2.

---

## تغییرات v0.0.5 (جدید)

**همه‌ی بازی‌ها (v0.0.5)** — لایه‌ی متای محصول افزوده شد: **صفحه‌ی لودینگ** برندشده، **منوی اصلی** (راهنما / آمار و تاریخچه / امتیازات و رقابت / تنظیمات)، **تاریخچه و آمار** (آخرین بازی‌ها + مجموع/میانگین/بهترین + دستاوردها)، **جدول امتیازات و رقابت** (مدال‌های 🥇🥈🥉 + تیرهای Bronze→Diamond + کد اشتراک رکورد)، و **بروزرسانی خودکار PWA** (بنر «نسخه‌ی جدید آماده است» → با یک کلیک بروزرسانی، نسخه‌ی جدید جایگزین می‌شود). `sw.js` بازنویسی شد: cache v5 + network-first برای صفحات (دریافت خودکار HTML جدید) + skipWaiting از طریق بنر + رفع باگ cache آفلاین SFX (پسوند .wav).

---

## تغییرات v0.0.4

(v0.0.4 فقط کیت مشترک؛ گیم‌پلی v0.0.3 حفظ شد: ۳ سلاح + تنظیمات inline).

**همه‌ی بازی‌ها (v0.0.4)** — `gamekit.js` مشترک + `vendor/howler.min.js` محلی: صدای Howler با SFX خودکار (pickup/collision/game-over از طریق پل MUX)، صفحه‌ی **راهنما**، صفحه‌ی **تنظیمات** (قطع/وصل صدا)، قلاب‌های تست (`render_game_to_text`/`advanceTime`)، **فول‌اسکرین** (کلید F)، و سیستم **دستاوردها**. cache سرویس‌ورکر به v4 ارتقا یافت (آفلاین کامل با vendor).

---

## تغییرات v0.0.3

**Tank Duel** — تنوع سلاح: ۳ سلاح (استاندارد/خوشه‌ای/سنگین) + انتخاب‌گر در منو + کلید Q برای تغییر در بازی.

---

## معرفی

Tank Duel: Sandstorm یک دوئل توپخانه‌ای turn-based ۲بعدی است که روی یک HTML5 `<canvas>` landscape که viewport را پر می‌کند رسم می‌شود. دو تانک در یک بیابان تپه‌ای procedural روبروی هم قرار دارند: تانک بازیکن در چپ و AI در راست. هر نوبت، بازیکن فعال یک زاویه‌ی نشانه‌گیری (۰–۹۰ درجه از افق) و قدرت شلیک (۰–۱۰۰) را تنظیم می‌کند، سپس یک گلوله شلیک می‌کند. gravity گلوله را پایین می‌کشد و باد — که هر نوبت در بازه‌ی -۵..+۵ دوباره roll می‌شود — آن را به کنار هل می‌دهد.

گلوله یا hit مستقیم می‌زند، یا در شعاع انفجار damage splash می‌دهد، یا miss می‌خورد و یک دهانه در زمین می‌زند. اولین تانکی که HP طرف مقابل را از ۱۰۰ به ۰ برساند، round را می‌برد. بازیکن قبل از مسابقه یکی از سه پالت آسمان (day/dusk/night) را انتخاب می‌کند.

## ویژگی‌ها

- **زمین procedural destructible** — heightmap با چند فرکانس sine + random drift؛ هر انفجار یک دهانه می‌تراشد که هندسه‌ی شلیک‌های بعدی را تغییر می‌دهد.
- **فیزیک پرتابه با باد** — gravity + wind که هر نوبت re-roll می‌شود، با فلش و عدد باد بالای صفحه.
- **damage falloff** — hit مستقیم ۲۵–۴۰، نزدیک‌miss ۱۰–۲۰ بر اساس فاصله از مرکز تانک.
- **AI با difficulty** — Easy/Normal/Hard؛ grid search روی (angle, power) با شبیه‌سازی فیزیک + خطای تصادفی scaled.
- **۳ پالت آسمان** — day (آبی روشن)، dusk (نارنجی-بنفش)، night (ستاره‌دار moonlit).
- **Best-of-1 یا Best-of-3** در صفحه‌ی شروع.
- **رکورد persist** — `localStorage['tankDuel.record']` (wins/losses/hardest difficulty) و نام بازیکن در `tankDuel.name`.
- **کنترل کامل تاچ + کیبورد + موس** (با hint «دستگاه را بچرخان» در portrait).
- **PWA آفلاین**.

## نحوه‌ی بازی

| دستگاه | زاویه | قدرت | شلیک | توقف |
|---|---|---|---|---|
| **کیبورد** | ↑/↓ یا W/S (hold repeat) | ←/→ یا A/D | Space یا Enter | P/Esc · R restart |
| **تاچ** | ▲/▼ یا swipe عمودی روی تانک | ◀/▶ | دکمه‌ی بزرگ FIRE | دکمه‌ی Pause |
| **موس** | حرکت مکان‌نما بالای تانک → atan2 | فاصله‌ی افقی از تانک (clamp ۰–۱۰۰) | کلیک روی کانواس | — |

### مکانیک بازی

- **تولید زمین**: heightmap با `TERRAIN_STEP=8px`؛ هر ستون = `base + sin·amp1 + sin·amp2 + sin·amp3 + drift`.
- **جاگذاری تانک**: بازیکن در ~۱۵٪ عرض، دشمن در ~۸۲٪، snap به ارتفاع زمین.
- **نشانه‌گیری**: زاویه ۰–۹۰° از افق؛ barrel line با `(x + dir*cos·len, y - 15 - sin·len)`.
- **شلیک**: `v = power*POWER_SCALE + POWER_BASE`؛ `vx = dir*cos·v`, `vy = -sin·v`.
- **فیزیک گلوله**: `vx += wind*WIND_ACCEL*dt`, `vy += GRAVITY*dt`؛ trail محو رسم می‌شود.
- **انفجار/damage**: شعاع ~۴۲px؛ hit مستقیم (<۱۴px) = ۲۵–۴۰، نزدیک‌miss (<۴۲px) = ۱۰–۲۰؛ دهانه شعاع ~۳۴px در زمین.
- **باد**: هر نوبت re-roll در `[-5, 5]`؛ فلش + عدد.
- **AI**: grid search (angle, power) با شبیه‌سازی + خطای Easy ±۸°/±۱۵، Normal ±۴°/±۸، Hard ±۱°/±۳.
- **HP/round**: هر تانک ۱۰۰؛ ۰ = پایان round؛ Best-of-3 اولین به ۲ برد.
- **persist**: `tankDuel.record` و `tankDuel.name`.

## نصب روی موبایل/دسکتاپ (PWA)

1. لینک بازی را در **Chrome** یا **Edge** باز کنید (اندروید/دسکتاپ) یا **Safari** (iOS).
2. منوی مرورگر → **Install app** / **Add to Home screen** (اندروید) یا **Share → Add to Home Screen** (iOS).
3. آیکن روی صفحه‌ی اصلی ظاهر می‌شود؛ اجرای آن تمام‌صفحه و مستقل از مرورگر است.
4. پس از اولین بارگذاری، بازی **بدون اینترنت** هم کار می‌کند (service worker کل shell را cache کرده است).

## تکنولوژی

- **HTML5 `<canvas>`** — تمام رندر با primitives (`arc`, `fillRect`, `translate`, `rotate`, `shadowBlur`).
- **Vanilla JavaScript** — بدون هیچ کتابخانه، framework یا CDN.
- **CSS** با `clamp()` برای تایپوگرافی responsive، `safe-area-inset` برای notch موبایل، و `100dvh`.
- **PWA**: `manifest.json` + `sw.js` (service worker که کل shell را precache می‌کند) → بازی پس از اولین بارگذاری **کاملاً آفلاین** و **قابل نصب** روی اندروید/iOS/دسکتاپ است.
- بدون تصویر، فونت یا فایل صوتی خارجی — همه‌چیز با کد تولید می‌شود.

## ساختار پروژه

| فایل | نقش |
|---|---|
| `index.html` | meta PWA، canvas، overlayهای start/pause/round-over/match-over/rotate، HUD + کنترل‌های تاچ |
| `styles.css` | canvas تمام‌viewport، overlayها، HUD، دکمه‌های تاچ، clamp، safe-area، rotate hint |
| `main.js` | کل بازی: ثابت‌ها، state، localStorage، زمین، تانک، فیزیک گلوله، AI، render، input، screen flow |
| `manifest.json` | PWA، `orientation:landscape` |
| `sw.js` | precache + cache-first با fallback به index.html |
| `icon.svg` | سیلوئت تانک روی تپه زیر آسمان dusk |

## شخصی‌سازی

تمام tuningها در بلوک `CONFIG`/ثابت‌ها بالای `main.js`:

- `GRAVITY`, `WIND_ACCEL`, `POWER_SCALE`, `POWER_BASE` — حس فیزیک.
- `TERRAIN_STEP`, دامنه‌های sine در `generateTerrain` — خشونت و رزولوشن زمین.
- `EXPLOSION_RADIUS`, `TANK_HIT_RADIUS`, بازه‌های damage — بالانس blast/damage.
- `TANK_HP` (۱۰۰) — طول round.
- جدول `DIFFICULTY` — خطای aim و گام search هر difficulty.
- `SKY_THEMES` — سه پالت (day/dusk/night).
- `RECORD_KEY`, `NAME_KEY` — کلیدهای localStorage.
- طول مسابقه در runtime (Best-of-1/Best-of-3) در صفحه‌ی شروع.

## توسعه و اجرای محلی

```bash
git clone https://github.com/andrbi107/tank-duel-sandstorm.git
cd tank-duel-sandstorm
# سرویس‌ورکر فقط روی http(s) ثبت می‌شود، پس یک سرور محلی راه بیندازید:
python3 -m http.server 8080
# سپس http://localhost:8080/ را در مرورگر باز کنید
```

برای آزمایش روی موبایل، می‌توانید پوشه را روی گوشی با یک سرور استاتیک سرو کنید یا از `ngrok`/مرورگر موبایل روی همان شبکه استفاده کنید.

## استقرار

محتوای شاخه‌ی `main` به‌صورت خودکار از طریق **GitHub Pages** سرو می‌شود:

**https://andrbi107.github.io/tank-duel-sandstorm/**

هیچ build stepی لازم نیست — همه‌ی مسیرها relative هستند (`./`)، پس بازی هم از root مخزن و هم از زیرپوشه کار می‌کند.

## نسخه‌گذاری (SemVer)

این پروژه از [Semantic Versioning](https://semver.org/lang/fa/) پیروی می‌کند:

- نسخه‌ها از **`0.0.1`** آغاز می‌شوند (مرحله‌ی پیش از پایداری نهایی؛ هر تغییر می‌تواند breaking باشد).
- قالب: `MAJOR.MINOR.PATCH` → در فاز 0.x: `0.MINOR.PATCH`.
- **هر توسعه یا شخصی‌سازی** در یک شاخه‌ی جداگانه انجام می‌شود:
  - `feat/<name>` برای قابلیت جدید یا شخصی‌سازی
  - `fix/<name>` برای رفع باگ
  - `docs/<name>` برای مستندسازی
  - `refactor/<name>` برای بازسازمان‌دهی کد
- پس از merge به `main`، تگ SemVer بعدی زده می‌شود و یک **GitHub Release** منتشر می‌گردد.
- RELEASE NOTES هر بار در صفحه‌ی Releases مخزن ثبت می‌شود.

### نقشه‌ی نسخه‌بندی پیشنهادی برای توسعه‌های بعدی

| نوع تغییر | bump | مثال |
|---|---|---|
| رفع باگ کوچک، tweak رنگ/عدد | PATCH | `0.0.1` → `0.0.2` |
| قابلیت جدید، مکانیک جدید، level جدید | MINOR | `0.0.1` → `0.1.0` |
| بازنویسی API/ساختار، تغییر breaking | MAJOR (هنوز در 0.x) | `0.1.0` → `0.2.0` |
| رسیدن به پایداری نهایی | — | `0.x.0` → `1.0.0` |

## لایسنس

MIT — استفاده، تغییر و بازنشر آزاد. ساختهشده بهعنوان یک مهارت/قالب آموزشی برای بازی‌سازی PWA با Vanilla JS.
