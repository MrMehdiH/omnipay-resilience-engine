# انتشار تغییرات بازبینی اول

تغییرات آمادهٔ مرور در شاخهٔ محلی `feature/resilience-simulation` هستند. هیچ commit، push، PR یا merge توسط این بازبینی انجام نشده است. مبنای آخرین بررسی سازگاری `origin/main` برابر `47fdecc` بود.

## ۱. مرور و ثبت تغییرات

دستورها برای PowerShell و ریشهٔ همین ریپو هستند. ابتدا diff را بخوان؛ اگر پس از این بازبینی تغییر دیگری اضافه کرده‌ای، فقط فایل‌های مربوط به این کار را stage کن.

```powershell
git status --short
git branch --show-current
git diff --stat
git diff
git diff --check

git add README.md SECURITY.md CLAUDE.md docs eslint.config.mjs package.json vitest.config.mts src
git diff --cached --stat
git diff --cached --check
git commit -m "fix: harden payment simulation and align demo guarantees"
```

این commit شامل محافظت claim فعال، نتیجهٔ امن خطاهای پس از رزرو، خطای جبران، اعتبارسنجی store، preset و replay، دسترس‌پذیری و موبایل، توکن‌ها، قواعد lint، تست‌ها و مستندات است. اصلاح استعلام نتیجهٔ مبهم از main در baseline فایل‌ها قرار دارد و قابلیت جدید این بازبینی نیست. `out/`، `.next/` و `node_modules/` را stage نکن.

## ۲. همگام‌سازی و بررسی دوباره

```powershell
git fetch origin
git merge origin/main
npm run lint
npm run typecheck
npm test
$env:GITHUB_ACTIONS = "true"
npm run build
Remove-Item Env:GITHUB_ACTIONS
```

هر دستور باید موفق شود؛ در صورت خطا مرحلهٔ بعد را اجرا نکن. اگر merge تعارض داشت، ابتدا همان فایل‌ها را اصلاح و تغییرات را مرور کن، سپس merge را تکمیل و بررسی‌ها را تکرار کن. نتیجهٔ بررسی قبلی تضمین نبود تعارض با main آینده نیست.

## ۳. Push و Pull Request

```powershell
git push -u origin feature/resilience-simulation
```

در GitHub یک PR با **base: main** و **compare: feature/resilience-simulation** باز کن.

عنوان پیشنهادی:

```text
Harden simulation failure handling, state transitions and demo guarantees
```

شرح پیشنهادی:

```text
Preserve in-flight idempotency claims when clearing completed results. Turn
post-reservation infrastructure failures and failed compensations into explicit,
replayable dead-letter outcomes instead of releasing ambiguous work or reporting
successful compensation.

Validate simulation inputs, isolate chaos presets, preserve original replay
intents, and align ecosystem transitions, VPN notices and node telemetry with
actual execution. Improve mobile RTL, accessible controls, design tokens and
enforced architectural imports. Document the simulator's production limits.

Validation: 39 passing tests, ESLint with zero warnings, TypeScript checks and
GitHub Pages production export. Manual local Chrome smoke checks in EN/LTR and
FA/RTL, including a 390px viewport. Public deployment could not be verified.

See docs/critical-review-01.fa.md for findings, evidence and remaining work.
```

## ۴. Merge و کنترل انتشار

1. منتظر موفق‌شدن check با نام `Lint, Typecheck, Test & Static Export` بمان. اجرای CI نصب تمیز و Node 22 را نیز بررسی می‌کند.
2. تب Files changed را مرور کن؛ پوشه‌های خروجی build و اطلاعات خصوصی نباید در PR باشند.
3. پس از تأیید، **Squash and merge** به main انجام بده. push مستقیم به main برای این مسیر لازم نیست.
4. workflow پس از push به main، artifact را برای Pages می‌سازد و deploy می‌کند. `workflow_dispatch` فعلی فقط بررسی می‌کند و deploy ندارد.
5. پس از موفقیت deployment، سایت عمومی را با refresh کامل بررسی کن: دو اکوسیستم، فارسی RTL در موبایل، baseline موفق، replay بدون اجرای مجدد gateway، preset VPN و بستن هشدار بدون خاموش‌شدن fault، و بارگیری صحیح CSS/فونت با base path.

اگر deploy یا کنترل سایت شکست خورد، log همان اجرا را مبنا قرار بده و اصلاح را با PR بعدی انجام بده؛ سبزبودن build محلی تأیید سلامت سایت عمومی نیست.
