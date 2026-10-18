# Alder Ripple Koi

By **ALDER NEXOID** · package `com.aldernexoid.alderripplekoi` · Expo owner `889-893`.

A calm one-tap puzzle for Android. You never touch the fish: tap the water to drop a ripple, and the ring gently pushes every koi it reaches away from the drop. Guide each koi into the brush-painted ensō of its own colour.

- 24 ponds in three chapters: Garden Pond, Temple Stream (currents), Moon Pool (many colours)
- Seals (stars) for clearing a pond within par drops; Undo is free and unlimited
- Sumi-e ink-and-wash art on rice paper, painted procedurally; swimming koi bend as they swim
- Koto-like plucked music in Japanese pentatonic modes; each drop is a note in the scale
- Every pond is proven solvable within par by an automated solver

## Structure

| Path | What it is |
| --- | --- |
| `web/src/game/sim.ts` | Pure, deterministic ripple and koi physics |
| `web/src/game/bot.ts` | Beam-search solver; it sets each pond's par, and tests enforce it |
| `web/src/game/levels.ts` | All 24 ponds |
| `web/scripts/gen-fonts.mjs` | Ships only the Shippori Mincho slices containing the kanji the UI uses |
| `web/brand/` | Renders the icon, adaptive icon and splash |
| `src/native/` | Expo WebView shell |

## Commands

```bash
npm install && npm run web:install
npm run web:test          # 31 tests, including every pond solvable within par
npm run build:game
npm run validate:assets
npm run android
```

Changing a pond: edit `levels.ts`, run the tests, and if the solver needs more drops, raise `par` to match.

## Release builds

The Android release is configured for Google Play: target and compile SDK 36, R8 minification and resource shrinking, a non-debuggable release build, no Internet permission, and the game served offline from the app's own assets. Builds run on EAS; `eas.json` has two profiles:

```bash
npm install -g eas-cli && eas login
eas init                     # once: links this folder to your Expo project
npm run eas:apk              # preview profile: a signed APK for testing on devices
npm run eas:aab              # production profile: an AAB for Google Play (versionCode auto-increments)
```
