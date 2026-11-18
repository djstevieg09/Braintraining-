# BrainBlitz

A daily brain training app for Android: quick tests, a Brain Age check, progress charts, streaks and stamps.

- `www/` is the app itself (HTML, CSS and JavaScript, no build step). Open `www/index.html` through any static server to try it in a browser.
- `android/` is the Capacitor wrapper that turns it into an Android app.
- Every push to `main` builds a test APK with GitHub Actions and attaches it to the **test-build** release.
