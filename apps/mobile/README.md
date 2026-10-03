# Lumi Mobile (Flutter)

اپ اندروید و iOS لومی.

## راه‌اندازی
```bash
cd apps/mobile
flutter create . --platforms=android,ios --org com.beyondex --project-name lumi   # یک بار، برای ساخت پوشه‌های android/ios
flutter pub get
flutter run
```

ساختار: `lib/core` (تم، روتر، شبکه) و `lib/features/<feature>` (feature-first). توکن‌های دیزاین در `lib/core/theme/lumi_colors.dart` با `docs/DESIGN.md` هماهنگ است.
