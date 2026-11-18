// One-off "Brainlark Full" unlock through Google Play Billing
// (cordova-plugin-purchase). No ads, no subscription.
import * as store from './store.js';
import { TEST_BUILD } from './buildinfo.js';

export const PRODUCT_ID = 'brainlark_full';
export const FALLBACK_PRICE = '£3.99';
export const FREE_PROFILES = 1;

let product = null, ready = false;
const listeners = new Set();
const notify = () => listeners.forEach(f => { try { f(); } catch {} });
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

export const isFull = () => !!(store.settings().full || store.settings().reviewer || (TEST_BUILD && store.settings().unlockAll));

// Google Play app review access: a code entered in Settings (tap the version
// line 7 times) unlocks everything. Only the code's SHA-256 is stored here.
const REVIEWER_HASH = 'decddece0a5d48becc9ea3b1b3e74cf52d86ef11bda5767aa751851309c873b2';
export async function tryReviewerCode(code) {
  const data = new TextEncoder().encode(String(code || '').trim().toUpperCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== REVIEWER_HASH) return false;
  store.setSetting('reviewer', true); notify(); return true;
}
export const price = () => product?.pricing?.price || FALLBACK_PRICE;
export const storeReady = () => ready && !!product && product.canPurchase !== false;

function grant() {
  if (!store.settings().full) { store.setSetting('full', true); notify(); }
}

export function initPurchases() {
  const start = () => {
    const C = window.CdvPurchase; if (!C) return;
    const s = C.store;
    s.verbosity = C.LogLevel.WARNING;
    s.register([{ id: PRODUCT_ID, type: C.ProductType.NON_CONSUMABLE, platform: C.Platform.GOOGLE_PLAY }]);
    s.when()
      .productUpdated(p => { if (p.id === PRODUCT_ID) { product = p; if (p.owned) grant(); notify(); } })
      .approved(t => t.verify())
      .verified(r => r.finish())
      .finished(t => { if (t.products.some(p => p.id === PRODUCT_ID)) grant(); })
      .receiptUpdated(() => { if (s.owned(PRODUCT_ID)) grant(); });
    s.error(e => console.warn('billing', e?.message));
    s.initialize([C.Platform.GOOGLE_PLAY]).then(() => { ready = true; product = s.get(PRODUCT_ID, C.Platform.GOOGLE_PLAY) || product; notify(); });
  };
  if (window.CdvPurchase) start(); else document.addEventListener('deviceready', start, { once: true });
}

// Returns 'ok' | 'cancelled' | 'unavailable' | 'error'
export async function buy() {
  if (!storeReady()) return 'unavailable';
  const offer = product.getOffer(); if (!offer) return 'unavailable';
  const err = await offer.order();
  if (!err) return 'ok';
  return err.code === window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED ? 'cancelled' : 'error';
}

export async function restore() {
  const C = window.CdvPurchase; if (!C || !ready) return 'unavailable';
  await C.store.restorePurchases();
  if (C.store.owned(PRODUCT_ID)) { grant(); return 'ok'; }
  return 'none';
}
