# Lumi Mobile (Flutter)

اپ اندروید و iOS لومی — همان زبان طراحی «Soft Canvas × Night Glow» و فونت Meem.

## اجرا
```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:4000   # شبیه‌ساز اندروید
flutter run --dart-define=API_URL=http://localhost:4000  # شبیه‌ساز iOS
```

## ساختار
```
lib/
  core/        api (Dio + چرخش توکن)، providers (Riverpod)، data، realtime (Socket.IO)،
               theme (توکن‌ها)، widgets (Panel، HatchBars، SegmentGauge، Pulse…)، utils (شمسی، quick-add)
  features/    auth · home · tasks (sheet، quick add، my tasks) · projects (board) · inbox · team · shell
assets/
  fonts/       Meem
  i18n/        fa.json / en.json — کپی از apps/web/messages با tool/sync_i18n.sh
```

## نکات
- متن‌ها با وب مشترک‌اند: بعد از تغییر `apps/web/messages/*.json`، اجرا کنید `./tool/sync_i18n.sh`.
- `lib/core/utils/quick_add.dart` پورت `packages/shared/src/quick-add.ts` است؛ هر دو را هم‌زمان تغییر دهید.
- تست‌ها: `flutter analyze && flutter test`
