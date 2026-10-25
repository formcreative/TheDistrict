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

## Stage 5: Real purchases (replacing the fake doors)

The fake-door buttons **must not ship** in a store build. They look like purchases but aren't, which breaks Apple's and Google's rules. Before submitting, either set `monetization.mode` to `"off"` or wire in real in-app purchases:

1. Sign the **Paid Apps agreement** and add banking and tax details (App Store Connect → Agreements), and set up a **payments profile** in Play Console.
2. Create **consumable** products in both stores with the same IDs, for example:
   - `skip_build` — $0.99, finishes the current timer
   - `cash_1000` — $0.99, +$1,000 in-game cash
3. Add a purchases plugin. [RevenueCat](https://www.revenuecat.com) (`@revenuecat/purchases-capacitor`) handles both stores and receipt validation, and is free up to a revenue threshold.
4. In `src/game.js`, `fakeDoor()` already has the hook: replace the "It's yours!" grant with the plugin's purchase call, and grant only on success.
5. Test with **Sandbox testers** (Apple) and **License testers** (Google). No real money changes hands.
6. Fees: Apple and Google keep 15% under their small-business programs (under $1M a year), 30% above that.

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
- [ ] Real IAP wired (or `monetization.mode: "off"`)
- [ ] Saves moved to `@capacitor/preferences`
- [ ] Tested on an older Android phone and an iPhone
- [ ] TestFlight + Play internal test with 10+ people
- [ ] Submit
