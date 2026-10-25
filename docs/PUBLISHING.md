# Testing and publishing Street Story

The game is a web build (Three.js) wrapped into native iOS and Android apps with [Capacitor](https://capacitorjs.com). One codebase ships to the browser, the App Store and Google Play.

Store rules and fees change often. Check each step against Apple's and Google's current documentation before you rely on it.

---

## Stage 1: Playtest the prototype (now, free)

1. **Play it on your phone.** Open the private artifact link, or run `npm start` on a computer and open the LAN address it prints on a phone on the same Wi-Fi.
2. **Watch five to ten people play cold.** Don't explain anything. Note where they hesitate.
3. **Read the numbers** in Settings → Playtest stats after each session:
   - *Bakery appeared at* and *Bought bakery at*: is the gap long enough to hurt?
   - *$0.99 taps* vs *$0.99 dismissed*: this is your willingness-to-pay signal.
   - Use **Copy full log** to collect the raw events from each tester.
4. **Tune** `config/game.json`, run `npm run sim` to check pacing, and play again.

Move to Stage 2 only once people ask to keep playing and some of them tap the $0.99 buttons.

---

## Stage 2: Accounts (one-time)

| | Apple | Google |
|---|---|---|
| Program | Apple Developer Program | Google Play Console |
| Cost | $99 / year | $25 one-time |
| Enroll as a company | Needs a D-U-N-S number. The seller name shows as your company. | Organization account |
| Gotcha | Enrollment verification can take days | New **personal** accounts must run a closed test with at least 12 testers for 14 days before releasing to production. Organization accounts avoid this. |

Enroll as **Form Creative** (the organization) rather than as an individual. It keeps your personal name off the store listing, and on Google it avoids the 12-tester rule.

---

## Stage 3: Build the native apps (on a Mac)

You need Node 20+, the latest **Xcode** for iOS, and **Android Studio** for Android. Capacitor's docs list the exact minimum versions.

```sh
npm install
npx cap add ios          # first time only, creates ios/
npx cap add android      # first time only, creates android/
npm run ios              # copies the game into the app and opens Xcode
npm run android          # same, opens Android Studio
```

- In **Xcode**: select the `App` target → Signing & Capabilities → choose your Team. The bundle ID is `com.formcreative.streetstory` (set in `capacitor.config.json`). Connect an iPhone and press Run.
- In **Android Studio**: plug in an Android phone with USB debugging on, then press Run.
- **Icons and splash screen:** create a 1024×1024 icon and a splash image, then run `npx @capacitor/assets generate`.
- After any change to the game, run `npm run ios` / `npm run android` again to re-copy it.

**Test on a 3–4 year old Android phone.** WebGL in Android's WebView is the main performance risk. If it stutters, lower the shadow map size in `src/scene/stage.js` and cap the pixel ratio at 1.5.

---

## Stage 4: Beta test through the stores

**iOS, TestFlight**
1. Create the app in App Store Connect (My Apps → +).
2. Xcode → Product → Archive → Distribute App → App Store Connect.
3. Internal testers (your team, up to 100) can install within minutes. External testers (up to 10,000, via a public link) need a short Beta App Review first.

**Android, Internal testing**
1. Create the app in Play Console.
2. Android Studio → Build → Generate Signed App Bundle (.aab). Keep the upload key safe, and use Play App Signing.
3. Play Console → Testing → Internal testing → upload the .aab → add tester emails → share the opt-in link.

---

## Stage 5: Real purchases

The game already calls one function for every purchase: `purchase()` in `src/store.js`. In the web prototype (`monetization.mode: "test"`) it succeeds for free. Inside the app it switches to real purchases automatically. You need to:

1. Sign the **Paid Apps agreement** and add banking and tax details (App Store Connect → Agreements), and set up a **payments profile** in Play Console.
2. In **both** stores, create the in-app products with the **same ids as `store.products` in `config/game.json`**:
   - consumable: `cash_small`, `cash_medium`, `cash_large`, `skip_build`, `rush_helper`, `cash_boost`
   - non-consumable: `starter`, `builder`
   Set the store prices to match the config's `price` labels, or better, show the price the store returns (see step 5).
3. Install RevenueCat: `npm install @revenuecat/purchases-capacitor`, create a RevenueCat project, add both apps, and call `Purchases.configure({ apiKey })` once at startup (in `src/main.js`). RevenueCat handles receipts for both stores.
4. Set `monetization.mode` to `"live"` for store builds. On a phone, the app also detects Capacitor and goes live on its own.
5. Before submitting, replace the hard-coded price labels with the localized price from `Purchases.getProducts()`. Apple rejects apps that show a different price than the store charges.
6. Test with **Sandbox testers** (Apple) and **License testers** (Google). No real money changes hands.
7. Add a **Restore purchases** button in Settings for the non-consumables (`starter`, `builder`). Apple requires it.
8. Rewarded ads (the "Watch ad" buttons): add AdMob or AppLovin MAX through their Capacitor plugin and replace `playAd()` in `src/game.js`. Grant the reward only in the ad's "reward earned" callback.
9. Fees: Apple and Google keep 15% under their small-business programs (under $1M a year), 30% above that.

While you're here, swap `localStorage` saves for `@capacitor/preferences` so the OS can't clear progress.

---

## Stage 6: Submit

**Both stores need:** a privacy policy URL (even if you collect nothing), a support URL or email, an age rating questionnaire, a data-collection disclosure (Apple's App Privacy, Google's Data safety), screenshots, and a description.

- **App Store:** iPhone screenshots at the currently required sizes, keywords, the encryption question (the game uses only standard HTTPS, so it's typically exempt). Review usually takes about one to two days.
- **Google Play:** a 512×512 icon, a 1024×500 feature graphic, phone screenshots, the IARC content rating and the target-audience form. Review takes hours to a few days.

**Rejection risks to know about**
- *Apple 4.2 (minimum functionality):* wrapped web apps get rejected when they feel like a website. Ours is a full-screen game with no browser UI, which is the right side of that line. Keep it that way: no links out, no visible scrolling.
- *Apple 3.1.1:* digital goods must use Apple's in-app purchase. That's why the fake doors have to go.
- *Misleading pricing:* show the real store price from the plugin, never a hard-coded "$0.99".

---

## Checklist

- [ ] Playtests show people want the bakery and tap $0.99
- [ ] Apple Developer + Google Play accounts (as Form Creative)
- [ ] Final game name chosen, store names checked for availability
- [ ] App icon, splash, screenshots
- [ ] Privacy policy + support page
- [ ] RevenueCat wired, products created in both stores with matching ids, `monetization.mode: "live"`
- [ ] Restore purchases button; rewarded-ad SDK in place of the placeholder
- [ ] Saves moved to `@capacitor/preferences`
- [ ] Tested on an older Android phone and an iPhone
- [ ] TestFlight + Play internal test with 10+ people
- [ ] Submit
