// Every real-money purchase goes through here, so going live is a change to this one file.
//
//   mode 'test' — the purchase succeeds immediately and nothing is charged (web prototype).
//   mode 'live' — the purchase goes to the App Store / Google Play through RevenueCat
//                 (@revenuecat/purchases-capacitor). The player pays before anything is granted.
//
// See docs/PUBLISHING.md, "Real purchases".

export function purchaseMode(cfg) {
  const m = cfg.monetization.mode;
  if (m === 'off') return 'off';
  const native = !!window.Capacitor?.isNativePlatform?.();
  return m === 'live' || native ? 'live' : 'test';
}

export async function purchase(cfg, productId) {
  const mode = purchaseMode(cfg);
  if (mode === 'off') return { ok: false, reason: 'off' };
  if (mode === 'test') {
    await new Promise((r) => setTimeout(r, 450)); // feels like a store sheet opening and closing
    return { ok: true, test: true };
  }
  const Purchases = window.Capacitor?.Plugins?.Purchases;
  if (!Purchases) return { ok: false, reason: 'Purchases are not set up in this build yet.' };
  try {
    const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
    if (!products?.length) return { ok: false, reason: 'This item is not available right now.' };
    await Purchases.purchaseStoreProduct({ product: products[0] });
    return { ok: true, test: false };
  } catch (err) {
    if (err?.code === '1' || /cancel/i.test(err?.message || '')) return { ok: false, cancelled: true };
    return { ok: false, reason: err?.message || 'The purchase did not go through.' };
  }
}
