# BrainBlitz

A daily brain training app for Android: quick tests, a Brain Age check, progress charts, streaks and stamps.

- `www/` is the app itself (HTML, CSS and JavaScript, no build step). Open `www/index.html` through any static server to try it in a browser.
- `android/` is the Capacitor wrapper that turns it into an Android app.
- Every push to `main` builds a test APK with GitHub Actions and attaches it to the **test-build** release.

## Handwriting reader

`www/js/digitnet.js` runs a small neural network trained on the MNIST handwritten digits plus synthetic pen strokes (`tools/train_digits.py`, weights in `www/js/digitmodel.js`). Players can also teach it their own handwriting from Settings.

## BrainBlitz Full (one-off purchase)

Free: the Brain Age check, 5 exercises, 1 player. A single non-consumable Google Play product, `brainblitz_full`, unlocks all 15 exercises, progress charts and up to 4 players. Billing uses `cordova-plugin-purchase`. Test builds have **Settings > Test unlock**; remove that toggle before the store release.
