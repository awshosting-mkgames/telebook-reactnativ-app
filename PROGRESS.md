# Telebook App — Implementation Progress Doc

> **New chat shuru karte waqt pehle yeh file poori padho.** Yeh doc batata hai ki overall project kya hai, kya decide hua hai, ab tak kya ban gaya hai, aur aage kya karna hai. Har ~20 messages ke baad is file ko update karna hai taaki context na kho jaaye.

---

## 1. Project kya hai

Telebook (React Native/Expo, Android-only prebuilt, no `ios/` dir) ek WhatsApp-jaisa chat app hai jiska backend `FRONTEND_GUIDE.md` (208 endpoints, root mein rakhi gayi doc) ke hisaab se bana hai. User ne pura app backend doc ke against audit karne ko kaha — missing features add karna, jo hai use enhance karna, poora app smooth/realtime/superfast banana, WhatsApp jaisi screen-structure follow karna.

Scope bahut bada hai (saara app), isliye phase-wise kaam ho raha hai. **Phase 1 (abhi chal rahi hai): Real Calling (Agora) + Plans/Wallet screens.**

Pehla audit (pichhle session mein) yeh nikla tha — reference ke liye:
- Already theek: Chat (1:1/group), Broadcasts, Channels, Groups, Status, Contacts, socket handshake, join-chat/leave-chat.
- Bade gaps: `clientMessageId` missing, media upload purana multipart hai (presigned/resumable nahi), token AsyncStorage mein hai (Keychain nahi), error codes (PLAN_LIMIT/INSUFFICIENT_COINS/etc) kahin handle nahi, **Call screen pura mocked**, Linked Devices/Two-Step PIN/Auto Reply/**Plans**/**Coin Wallet**/Payments/Channel Boost/read-receipts-toggle/privacy-excepts sab missing, report sirf user ke liye hai.

User ne confirm kiya: pehle **Real Calling + Plans/Wallet** karo, baaki phases baad mein.

---

## 2. Scope-narrowing decisions (already locked in with user)

1. **Payments**: Server ka current config `{manual:true, play:false, gateway:false}` hai. Plans/Wallet screens pura data/history/usage dikhayenge, par koi Razorpay/Play Billing SDK is phase mein add NAHI hoga. Buy button sirf config-gated info dikhayega ("contact support") jab tak gateway/play on nahi hote.
2. **Calling UX**: MVP jab tak app foreground/background-with-socket-alive hai. App kill hone par existing FCM push se hi kaam chalega (tap karke app khule, call accept kare). CallKit/notifee full-screen-ringing-when-killed **nahi** banayenge. **Android-only** (no iOS project exists). Group calling backend contract mein hi nahi hai (sirf 1:1).

Poora detailed plan yahan hai: `/Users/masonsmarkpvtltd/.claude/plans/nested-bubbling-valiant.md` (agar accessible ho to padh lena, warna neeche ka summary kaafi hai).

---

## 3. Codebase conventions (verified, implementation inhi ko follow karega)

- **API calls**: `apiService({method, endpoint, data, params, isMultipart})` from `src/services/apiService.js` → `{success, data}` ya `{success, error}` (kabhi throw nahi karta). Endpoint relative string, e.g. `'calls'`, `'plans/me'`.
- **Socket**: `src/services/socketService.js` — singleton, `.on(event,cb)/.off(event,cb)/.emit()/.joinChat()/.leaveChat()`. `_watchAppState()` background par disconnect karta hai (Phase mein isme `setCallActive()` guard add karna hai).
- **Redux slices**: `createAsyncThunk` + `extraReducers` pattern, reference `src/redex/slices/userDataSlice.js`. Store whitelist (persist) sirf `['userData','totalappData']` hai — naye slices (plans/wallet) isme add NAHI karna (data fresh rehna chahiye).
- **Screen template**: `src/screens/MyBroadcastList/index.js` — `useFocusEffect` refetch, `loading` ternary → `ActivityIndicator`/`FlatList`, `refreshing/onRefresh`, local ad-hoc `Modal` bottom-sheet, custom colored header (no native header), FAB.
- **Settings rows**: `src/screens/Settings/index.js` — `Item`/`Section` components, APP section mein naya row add karna hai.
- **Navigation**: screens `src/screens/index.js` barrel se export hote hain, `src/navigation/main/index.js` mein `<Stack.Screen>` register hota hai (sab `{headerShown:false, statusBarTranslucent:true}`).
- **Theme**: `ThemeContext` → `{theme, toggleTheme}`, `theme.mode`/`theme.text`/`theme.background`. Screens apna local `colors` object bhi bana lete hain (jaise Settings karta hai) — `theme.main` dark mode mein undefined hai (bug, fix nahi karna).
- **App root** (`src/index.js`): always-mounted siblings order — `<SocketManager/>`, `<ChatListSocketSync/>`, `<ProfileLoader/>`, `<ContactsLoader/>`, `<ChatTabsLoader/>`, phir `<AppNavigator/>`, phir `<Toast/>`. Naye loaders/managers (CallConfigLoader, IncomingCallManager) yahin isi order mein (SocketManager ke baad, AppNavigator se pehle) add honge.
- **Global overlay pattern**: koi portal/modal-provider nahi hai — `<Toast/>` jaisa hi ek absolutely-positioned full-screen `View` (zIndex/elevation 9999) use karna hai incoming-call overlay ke liye.
- **Push notifications**: `src/components/notification.js` (active) + `src/components/notificationConfig.js` (`ENTITY_ROUTE_MAP`) — naya `call` entity add karna hai.
- **ChatHeader** (`src/screens/Chat/components/ChatHeader.js` lines 110-115): `videocam`/`call` icons already hain, abhi `gotouserDetails` par point karte hain — inhe real `onVoiceCall`/`onVideoCall` props se replace karna hai.
- **Call screen** (`src/screens/Call/index.js`): 100% hardcoded mock `CALLS` array — pura rewrite hona hai real `GET /api/calls` se.
- **react-native-agora@4.6.4** installed hai but kahin imported nahi — Track A isko wire karega.
- **app.json** Android permissions mein `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH_CONNECT` missing hain — add karna hai, AUR `android/app/src/main/AndroidManifest.xml` mein bhi hand-edit karna hai (kyunki `android/` already prebuilt hai, sirf app.json badalne se native project update nahi hota).

---

## 4. Implementation checklist

### Track A — Real Calling (Agora) — ✅ DONE (code written, not yet device-tested)
- [x] A1. `src/services/callService.js` (NEW) — Agora engine wrapper singleton
- [x] A2. `src/services/socketService.js` (MODIFY) — `setCallActive()` + AppState guard
- [x] A3. `src/components/IncomingCallManager.js` (NEW) — global incoming-call overlay manager
- [x] A4. (design decision, no separate file) — REST-only call mutations, confirmed
- [x] A5. `src/screens/Call/IncomingCallOverlay.js` (NEW) + `src/screens/InCallScreen/index.js` (NEW)
- [x] A6. `src/screens/Chat/components/ChatHeader.js` (MODIFY) + `src/screens/Chat/index.js` (MODIFY) — call entry point
- [x] A7. `src/screens/Call/index.js` (REWRITE) — real call history
- [x] A8. `src/services/callConfigStore.js` (NEW) + `src/components/CallConfigLoader.js` (NEW)
- [x] A9. `src/index.js` (MODIFY) — mount new loaders/managers
- [x] A10. `src/screens/index.js` + `src/navigation/main/index.js` (MODIFY) — register `InCall` route
- [x] A11. `app.json` + `android/app/src/main/AndroidManifest.xml` (MODIFY) — permissions (added RECORD_AUDIO/MODIFY_AUDIO_SETTINGS/BLUETOOTH_CONNECT to app.json; manifest already had first two, added BLUETOOTH_CONNECT)
- [x] A12. `src/components/notificationConfig.js` (MODIFY) — `call` entity route
- [x] `src/services/callHelpers.js` (NEW) — shared `startCall`/`acceptCall`/`rejectCall`/`endCall` helpers

**NOT yet done for Track A**: actual device/emulator testing (no test suite exists, needs manual run per the plan's Verification section). Code is written and should be syntax-correct but UNTESTED.

### Track B — Plans & Wallet — ✅ DONE (code written, not yet device-tested)
- [x] B1. `src/redex/slices/plansSlice.js` + `walletSlice.js` (NEW)
- [x] B2. `src/redex/reducers/rootReducer.js` (MODIFY) — register slices (store.js whitelist untouched, deliberate)
- [x] B3. `src/screens/Plans/index.js` (NEW)
- [x] B4. `src/screens/Wallet/index.js` (NEW)
- [x] B5. `src/services/paymentConfigStore.js` + `src/services/paymentActions.js` (NEW)
- [x] B6. `src/screens/Settings/index.js` (MODIFY) — add Plans/Wallet rows
- [x] B7. `src/screens/index.js` + `src/navigation/main/index.js` (MODIFY) — register `Plans`/`Wallet` routes

**Verification done so far**: all 23 new/modified files (Track A + B) passed a Babel syntax/parse check (`babel-preset-expo`, via a scratchpad script) — zero syntax errors. **NOT yet done**: no device/emulator run, no visual QA, no real API calls exercised against the live server.

---

## 5. Status as of last update

**Date**: 2026-10-13
**Stage**: Both Track A (Real Calling) and Track B (Plans/Wallet) are **fully coded** per the plan in §4. Every file listed there now exists/is modified as described. All files passed a Babel syntax check — no parse errors. **This has NOT been run on a device/emulator yet** — that is the only remaining step before this phase can be called complete.

### What was verified
- Read `node_modules/react-native-agora/src/*.ts` directly to confirm exact v4 API: `createAgoraRtcEngine()`, `ChannelProfileType.ChannelProfileCommunication`, `ClientRoleType.ClientRoleBroadcaster`, `engine.initialize/joinChannel/leaveChannel/registerEventHandler/unregisterEventHandler/release/muteLocalAudioStream/setEnableSpeakerphone/enableLocalVideo/switchCamera`, `RtcSurfaceView` (from `AgoraRtcRenderView.tsx`), `onUserJoined(connection, remoteUid, elapsed)` / `onUserOffline(connection, remoteUid, reason)` signatures.
- `android/app/src/main/AndroidManifest.xml` already had `RECORD_AUDIO`/`MODIFY_AUDIO_SETTINGS` — added `BLUETOOTH_CONNECT` there and to `app.json`'s permissions array (all three now in both places).
- Ran a Babel (`babel-preset-expo`) parse check over all 23 touched files — all passed.

**Confirmed with user (2026-10-13)**: "complete" meant code-complete, NOT device-tested. No Android device/emulator is currently connected (`adb devices` returned empty) — testing needs either the user's own device/emulator, or one connected in this environment before Claude can run/debug it directly.

**Confirmed again (2026-10-13)**: user said "everthing complate" then clarified via question — still means code-complete only, testing is still pending. Nothing new has been run on a device.

### Next immediate steps (in priority order)
1. **Run the app on a real Android device/emulator** (`npx expo run:android` or dev client) and smoke-test:
   - App boots without crashing (new Redux slices, new always-mounted components `CallConfigLoader`/`IncomingCallManager` don't break root render).
   - Settings → "Plans / Subscription" and "Coin Wallet" rows navigate and load real data.
   - Open a 1:1 chat → voice/video icons appear only if `GET /api/calls/config.available` is true server-side (check this is actually true on the real server; if `available:false`, buttons will correctly stay hidden — that's expected behavior, not a bug).
   - If calling is available: place a call between two test accounts, verify the full flow per the plan's Verification section (`/Users/masonsmarkpvtltd/.claude/plans/nested-bubbling-valiant.md` → "Verification").
2. Fix whatever breaks during that manual run (this is new, untested code — bugs are expected on first run, especially around Agora native linking/permissions and exact response-shape assumptions in `callHelpers.js`/`plansSlice.js`/`walletSlice.js` if the live server's JSON differs even slightly from the doc excerpts this was built against).
3. Once Phase 1 (Calling + Plans/Wallet) is confirmed working, move to the next phase of the original full-app audit (see §1) — candidates in priority order per the first audit: `clientMessageId` dedupe + presigned/resumable media upload (foundation), then the remaining missing WhatsApp-style screens (Linked Devices, Two-Step PIN, Auto Reply, Privacy excepts, Read-receipts toggle, Report message/group/channel).

---

## 5b. Scope expansion (2026-10-13, after user explicitly asked for it): WhatsApp-style full-screen ringing when app killed/device locked

The original plan (§2 point 2) deliberately scoped calling to "foreground/background-with-socket-alive only, rely on normal FCM tap when killed" — the user explicitly asked to upgrade this to **true full-screen ringing even when the app is killed or the device is locked**, matching WhatsApp. This is a real scope expansion beyond the original approved plan, implemented as follows:

**New native dependency**: `@notifee/react-native@^9.1.8` (installed via `npm install`, confirmed in `package.json`). Autolinking confirmed automatic (project uses standard Expo/RN Gradle autolinking — `android/settings.gradle` + `android/app/build.gradle`'s `autolinkLibrariesWithApp()`), so no manual Gradle wiring needed beyond what's below.

**New files**:
- `android/app/src/main/java/com/Telebookapp/Telebook/LockScreenModule.kt` — native module exposing `showOverLockScreen(show: Boolean)`, toggling `Activity.setShowWhenLocked`/`setTurnScreenOn` (API 27+, with legacy `WindowManager` flag fallback below that) + `KeyguardManager.requestDismissKeyguard`. **Deliberately NOT a static manifest flag** on `MainActivity` — a static `showWhenLocked=true` would let ANY app-open (including tapping a normal chat notification) bypass the lock screen, a privacy regression. Instead this is toggled imperatively, only while `InCallScreen` considers the call "incoming", and cleared on teardown.
- `android/app/src/main/java/com/Telebookapp/Telebook/LockScreenPackage.kt` — `ReactPackage` wrapper, registered in `MainApplication.kt`'s `PackageList(this).packages.apply { add(LockScreenPackage()) }`.
- `src/services/lockScreenModule.js` — thin JS wrapper (`showOverLockScreen(bool)`), no-ops on iOS/if module missing.

**Modified files**:
- `android/app/src/main/AndroidManifest.xml` + `app.json` — added `USE_FULL_SCREEN_INTENT` permission (required by notifee's `fullScreenAction`; note Android 14+/API 34+ — this project's `targetSdkVersion` is **35** per Expo SDK 57 defaults — tightened this permission; it may need the user to grant "Full screen notifications" via special app access in Settings on some OEMs/Android versions. Not handled with an in-app prompt yet — flagged as a possible follow-up if testing shows it's silently denied.)
- `src/components/notification.js` — added: a second notification channel `incoming_calls` (`setupCallChannel()`, HIGH importance, own vibration pattern — Android channel settings are immutable after first creation, hence a separate channel from the existing `default_channel`); `displayIncomingCallNotification(data)` (notifee full-screen notification with Accept/Decline actions + `fullScreenAction`); `cancelIncomingCallNotification(callId)`; `registerCallBackgroundEvents()` (module-scope `notifee.onBackgroundEvent`, called from `src/index.js` top-level so "Decline" works even app-killed); `setupCallForegroundHandlers()` (notifee foreground events + `getInitialNotification()`, called from the App component's effect). `setupBackgroundHandler` now branches: if `remoteMessage.data?.entity === 'call'`, calls `displayIncomingCallNotification` instead of nothing. `setupForegroundHandler`'s `onMessage` now SKIPS call-type messages entirely (foreground already has the socket-driven `IncomingCallManager` overlay — showing notifee's full-screen notification too would be redundant/intrusive).
- `src/index.js` — calls `registerCallBackgroundEvents()` at module top-level (next to the existing `setupBackgroundHandler()`), and `setupCallChannel()` + `setupCallForegroundHandlers()` inside the existing init `useEffect`.
- `src/screens/InCallScreen/index.js` — **reworked the "no agora token yet" path**: previously it silently auto-accepted; now it shows a proper ring screen (`phase: 'incoming'`, reusing `IncomingCallOverlay`) with Accept/Reject, UNLESS opened via the notification's explicit "Accept" quick-action (`route.params.autoAccept === true`, in which case it still auto-accepts+joins immediately — matches tapping "Accept" directly on a lock-screen notification action). Calls `showOverLockScreen(true)` on mount (only when `isIncoming`) and `showOverLockScreen(false)` in `teardown()`/on unmount. Calls `cancelIncomingCallNotification(callId)` on mount to clear the notification once the in-app ring UI is showing.
- `src/components/IncomingCallManager.js` — now also calls `cancelIncomingCallNotification` on accept/reject/ended, defensively, in case both the socket path and the push path raced.

**Backend assumption that MUST be verified/communicated**: this only works correctly if the backend's FCM push for `call:incoming` is sent with `data: {entity: 'call', entityId: <callId>, callType: 'audio'|'video', callerName, callerPhoto}` and ideally as a **data-only message** (no top-level `notification` block — otherwise Android may also auto-show a plain system notification alongside the custom full-screen one, a duplicate). This field-naming convention was NOT given in the original `FRONTEND_GUIDE.md` excerpt (it only documents the REST/socket contract, not the FCM push payload shape) — it is this implementation's own assumption, matching the existing `entity`/`entityId` convention already used by `notificationConfig.js` for other push types. **This needs confirmation from whoever controls the backend's push-sending code** before this feature can work end-to-end; if the real payload uses different field names, only `notification.js`'s `displayIncomingCallNotification`/background-handler branch (reading `remoteMessage.data.*`) needs updating — nothing else.

**Known limitations of this implementation (by design, given no device to test against and no dedicated native Activity built)**:
1. Possible brief lock-screen flash before the call UI settles over it on a cold app start, since `showOverLockScreen(true)` only fires once the RN bridge boots and JS runs (not instantly at native `onCreate`). A dedicated native `CallActivity` (not routing through the full RN bridge boot) would eliminate this but is a much larger undertaking, not attempted here.
2. `USE_FULL_SCREEN_INTENT` special-access grant on Android 14+ is not proactively requested/checked from JS — if a device silently denies it, the full-screen intent simply won't fire (regular heads-up notification + Accept/Decline actions should still work though, since those don't need this permission).
3. None of this (notifee channel, native module, full-screen behavior, lock-screen bypass, Accept/Decline actions) has been tested on a device — same caveat as the rest of this phase, but **this sub-feature carries materially higher risk of first-run bugs** than the plain-JS Track A/B work, because it touches native Android code (`LockScreenModule.kt`/`LockScreenPackage.kt`).

**Update (2026-10-13)**: `./gradlew :app:compileDebugKotlin` was run (online, background task). First run caught a real bug: `currentActivity` is not a direct property on `ReactContextBaseJavaModule` — fixed to `reactApplicationContext.currentActivity` in `LockScreenModule.kt`. Re-ran after the fix → `BUILD SUCCESSFUL` (only a harmless deprecation warning on `LockScreenPackage.kt`'s overridden `createViewManagers`, no errors). Native code for the lock-screen module is now confirmed to compile. This does NOT mean it works correctly at runtime (lock-screen bypass behavior, notifee full-screen intent, etc. still unverified) — only that it builds.

**Update 2 (2026-10-13) — ringtone sound gap found and fixed**: user reported the incoming-call notification had no ring sound. Root cause: the background/killed FCM-push path (`notification.js`'s `incoming_calls` channel, `sound:'default'`+`loopSound:true`) was already configured, but the **foreground** path (socket `call:incoming` → `IncomingCallManager`'s overlay, and `InCallScreen`'s `'incoming'` phase when opened without `autoAccept`) played NO sound at all — `setupForegroundHandler` deliberately skips showing the notifee notification in foreground (to avoid a duplicate with the socket-driven overlay), so nothing was left to make noise.

Fix — new native module (same pattern as `LockScreenModule.kt`, registered in the same `LockScreenPackage.kt`):
- `android/app/src/main/java/com/Telebookapp/Telebook/RingtoneModule.kt` (NEW) — `playRingtone()`/`stopRingtone()`, uses `RingtoneManager.getActualDefaultRingtoneUri(ctx, TYPE_RINGTONE)` + a looping `MediaPlayer` with `AudioAttributes.USAGE_NOTIFICATION_RINGTONE`. Plays the device's actual default ringtone (not just the generic notification-default sound notifee's channel uses).
- `android/app/src/main/java/com/Telebookapp/Telebook/LockScreenPackage.kt` (MODIFY) — `createNativeModules` now also returns `RingtoneModule(reactContext)`.
- `src/services/ringtoneModule.js` (NEW) — thin JS wrapper `playRingtone()`/`stopRingtone()`, no-ops on iOS/missing module (same convention as `lockScreenModule.js`).
- `src/components/IncomingCallManager.js` (MODIFY) — `playRingtone()` on `call:incoming`; `stopRingtone()` on accept, reject, `call:ended`, and unmount.
- `src/screens/InCallScreen/index.js` (MODIFY) — new `useEffect` keyed on `phase`: plays while `phase === 'incoming'`, cleanup (on any phase change or unmount) stops it — covers accept/reject/ended/back automatically.

Verified: Babel syntax check passed on all touched/new JS files; `./gradlew :app:compileDebugKotlin` → `BUILD SUCCESSFUL` with `RingtoneModule.kt` included. **Still not device-tested** (ringer-volume/silent-mode interaction, actual audibility, and looping behavior are unverified until run on a real device).

## 6. Important reminders for whoever picks this up

- Follow conventions in §3 exactly — don't introduce a new state-management style, new API-client pattern, or a shared Modal component (codebase deliberately doesn't have one).
- Don't add Razorpay/IAP packages — explicitly deferred.
- Don't touch iOS — no `ios/` dir exists.
- Don't duplicate call-mutation logic between REST and socket emits — REST is authoritative (see §3/A4).
- `"unlimited"` is a valid string value for plan-usage `limit`/`remaining` fields — never do arithmetic on it blindly.
- After finishing a chunk of the checklist in §4, tick the boxes and update §5's status before the conversation gets long.

---

## 7. Phase 2 (started 2026-10-14): Free Chat header, offline messages (SQLite), Group/Channel/Broadcast limits, Channel Sponsor, header cleanup

User ne 5 naye changes maange (Phase 1 — Calling/Plans/Wallet — se alag, parallel kaam). Research session mein research kiya (frontend + backend dono repos), user se 3 product decisions confirm kiye. Yahan final scope + decisions:

### 7.0 Research findings (important, taaki dobara audit na karna pade)
- **Sponsor/Boost feature backend par already 100% implement hai** (`src/services/boostService.js`, `src/models/ChannelBoost.js`, routes `channels/boost/options`, `channels/:id/boost`, `channels/:id/boosts` in `telebook-backend-api`). Frontend ne isko kahin use nahi kiya abhi — sirf wiring chahiye.
- **Groups aur Broadcasts par plan-limit enforcement already hai** backend mein (`entitlementService.blockIfOverLimit`, code `PLAN_LIMIT`, HTTP 403). **Channels par koi limit check nahi hai** — yeh gap hai, backend mein add karna hai.
- **Contact sync**: purana `src/components/useContactSync.js` (deleted) dead code tha, already superseded by `src/services/contactSync.js` + `Settings` screen ka "Contact Sync" row. Freechat header mein koi automatic sync already nahi ho raha (sirf `HeaderMenu`'s "Sync Data" hai, jo **chat-tabs** sync karta hai, contacts nahi).
- **Messages ke liye koi local persistence nahi hai** — `Chat/index.js` sirf in-memory `useState`, har baar screen khulne par API se fetch. `chatsDb.js` (SQLite) sirf chat-list **summaries** store karta hai, poore message thread nahi. Yeh real gap hai jo naya SQLite table maangta hai.
- Messages list endpoint (`GET /api/messages/:chatId`) mein **koi `since`/cursor param nahi hai** — sirf `page`/`limit`. Aur yeh endpoint call karne se unread messages **read mark ho jaate hain** (socket `message-read-update` fire hota hai) — background silent-refresh isi endpoint se karni hai to read-marking side-effect accept karni padegi (abhi tak koi "peek" variant backend mein nahi hai; agar zaroori hua to backend se `since` param maangna padega — abhi pehle existing endpoint se hi chalate hain).

### 7.1 Product decisions confirmed with user (2026-10-14)
1. **Channel limits**: naya `channels` field `Plan.limits` mein add karo, default values **Groups jaise same** (basic=5, higher tiers zyada/unlimited) — admin DB se baad mein tune ho sakta hai.
2. **Headers/StatusBar**: koi naya shared `<Header>` component **nahi** banana — existing per-screen convention follow karo. Sirf Call screen ke header ko doosre similar screens (jaise `ChatHeader`/Freechat pattern) jaisa align karna hai (padding/StatusBar/colors), baaki screens untouched.
3. **Free Chat header**: FAB "+" hatao, header mein ek "+" icon (Contacts screen) aur ek separate "Sync" icon (naya — `contactSync(dispatch)` call kare, jo abhi sirf Settings mein hai) add karo — WhatsApp jaisa.

### 7.2 Implementation checklist

**Backend (`telebook-backend-api`)**
- [ ] P2-B1. `src/models/Plan.js` — `limits.channels` field add karo (default matches `groups` default: `5`)
- [ ] P2-B2. `src/services/entitlementService.js` — `channels` ko `LIMIT_KEYS` mein add karo, usage counter (`Channel.countDocuments({admin/creator: userId})` — exact field naam `channelController.js`/`Channel` model dekh ke confirm karna)
- [ ] P2-B3. `src/controllers/channelController.js` (`createChannel`) — `blockIfOverLimit(res, req.user._id, 'channels')` call add karo (groups/broadcasts jaisa pattern)
- [ ] P2-B4. Existing seeded `Plan` documents (DB) mein `channels` limit value set karna (migration/script ya admin panel se) — code default sirf nayi plans ke liye kaam karega, existing seeded rows ko explicit update chahiye

**Frontend (`Archive_back`)**
- [ ] P2-F1. `src/screens/Freechat/index.js` — FAB hatao, header mein "+" (→ `Contact` screen) aur "Sync" (→ `contactSync(dispatch)`, loading/disable state jab `contacts.syncing`, `Toast` success/error jaisa Settings karta hai) icons add karo
- [ ] P2-F2. New SQLite module `src/services/messagesDb.js` (mirror `chatsDb.js` pattern) — table `messages` (chat_id, message_id PK, `data` JSON blob, createdAt) + `messages_meta` per-chat `lastSyncedAt`/`lastMessageId`
- [ ] P2-F3. New `src/services/messageSync.js` — `loadMessagesFromDb(chatId)` (SQL→state, instant, no network), `syncMessages(chatId, dispatch/setMessages)` (background: `GET messages/:chatId?page=1&limit=50`, merge-by-id into SQL, return merged list) — call on `Chat/index.js` mount: load from DB first (instant render, works offline), then background-sync and update UI when response lands or on reconnect (listen `NetInfo`/socket reconnect event if available)
- [ ] P2-F4. `src/screens/Chat/index.js` — wire P2-F3: render cached messages immediately, keep existing pagination/send/edit/delete flow, write new/updated messages to SQL (via `messagesDb.js`) alongside existing REST calls so cache stays fresh without re-fetching
- [ ] P2-F5. Groups/Channels/Broadcasts create screens (`CreateGroup/index.js`, `CreateBroadcast/index.js`, Channel creation in `Contact/index.js`'s `CreateChannelPopup`) — on `!res.success`, branch on `res.error?.code === 'PLAN_LIMIT'` → show the backend's `message` (mentions limit/used, has `upgrade:true`) with an "Upgrade" affordance pointing at `Plans` screen, else fall back to existing generic `Alert.alert` path. Reuse `apiErrorMessage` helper pattern from `chatActions.js` if it fits.
- [ ] P2-F6. `src/screens/Mychannelscreen/` — add "Sponsor" button per channel (near Edit/Delete in `ChannelListHeader.js` or per-channel in list). Tap → `GET channels/boost/options` → bottom-sheet (ad-hoc Modal, matching `MyBroadcastList` template per §3) showing options + `affordable` flag → confirm → `POST channels/:id/boost {optionId}`. On `402 INSUFFICIENT_COINS` → navigate to `Wallet` screen. On success → show "sponsored" badge (`isSponsored`/boost `status` from response) on the channel row.
- [ ] P2-F7. `src/screens/Call/index.js` — align header markup/padding/StatusBar with the nearest-pattern screen (`Freechat`/`ChatHeader` style), no new shared component, no behavior change otherwise.

### 7.3 Order of work (this session)
Backend channel-limit plumbing first (small, isolated) → Free Chat header (small) → Call header (small) → Groups/Channels/Broadcasts error handling (medium) → Sponsor wiring (medium) → Offline messages SQLite (largest, done last).

### 7.4 Status (2026-10-14)
- [x] P2-B1/B2/B3 — Channel plan-limit backend plumbing done (`Plan.js` `limits.channels` default 5, `entitlementService.js` LIMIT_KEYS/LIMIT_LABELS/countUsage case using `Channel.countDocuments({creator:uid})`, `channelController.js createChannel` calls `blockIfOverLimit`). Syntax-checked, not server-tested. **P2-B4 (seeding `channels` limit value into existing DB Plan documents) still pending — needs DB migration/admin-panel action, out of code scope.**
- [x] P2-F1 — Free Chat header done (`src/screens/Freechat/index.js`): FAB removed, header now has Sync (contactSync) + "+" (Contact) icons before the 3-dot menu.
- [x] P2-F7 — Call screen header done (`src/screens/Call/index.js`): fixed StatusBar/header color mismatch (#1199ff vs #1296f3) and moved status-bar-height padding into the header itself (was on `container`, leaving a gap), matching Freechat's pattern.
- [x] P2-F5 — PLAN_LIMIT error handling done (`CreateGroup/index.js`, `CreateBroadcast/index.js`, `CreateChannelPopup.js`). Bonus: fixed a real pre-existing bug in `CreateGroup`/`CreateBroadcast` where the error path read `res?.message`/`response?.message` instead of `res?.error?.message` — those alerts were always silently showing "Something went wrong" with no real detail. Also fixed `CreateChannelPopup.js` having NO `else` branch at all on failure (silent no-feedback bug). Babel syntax check passed on all 3.
- [x] P2-F2/F3/F4 — offline messages SQLite done. New `src/services/messagesDb.js` (table `messages`, additive upsert, mirrors `chatsDb.js` style) + `src/services/messageSync.js` (`loadCachedMessages`/`cacheMessages`, never throw). `Chat/index.js` wired at 8 points (mount cache-read, fetchMessages, refreshLatest, loadMoreMessages, sendMessage success, saveEdit success, deleteMessage forEveryone branch, socket `onMessageReceived` + new `connect` listener triggering `refreshLatestRef.current()`). `Logoutcall.js` now also clears the new messages DB. Manually reviewed the diff — correct, defensive (try/catch everywhere), purely additive, no behavior change when online. **Not yet device-tested** (airplane-mode open-chat scenario, send-while-offline-then-reconnect scenario) — same caveat as Phase 1's untested work.
- [x] P2-F6 — Sponsor/Boost wiring done, `src/screens/Updates/index.js` only (no new files). Sponsor button/Sponsored badge added to "My Channels" rows only (`type === 'mychannel'`, subscribed rows untouched). On-demand `GET channels/boost/options` fetch per tap (no eager prefetch), local ad-hoc bottom-sheet Modal (matches `MyBroadcastList`'s pattern, no shared Modal component) to pick a boost tier, `POST channels/:id/boost` on pick, `INSUFFICIENT_COINS` → Alert with "Buy coins" → navigates to `Wallet`. Confirmed `GET channels/my/owned` does NOT return `isSponsored` (unlike the general `GET channels` listing) — so the "Sponsored" badge uses local optimistic state after a successful boost, not server data; it won't clear on expiry until the list is refetched (acceptable, documented limitation). Manually reviewed the diff — correct, matches spec. Babel syntax check passed. **Not device-tested.**
- [ ] P2-B4 — seed `channels` limit on existing Plan DB rows (admin action, not code).

**All of Phase 2's code-level work (7.2) is now done.**

### 7.5 Device smoke test (2026-10-14) — a real Android device became available (R9ZW10AAK5T)

Installed the existing `android/app/build/outputs/apk/debug/app-debug.apk` (built 2026-10-13, includes all of Phase 1's native code — Agora, LockScreenModule, RingtoneModule — so no native rebuild was needed for Phase 2's pure-JS changes), started Metro (`npx expo start --dev-client`), connected via the dev-launcher. User logged into a real account on the production backend (`api.telebookservices.com`) and tested live.

**One real bug found and documented (not a Phase 2 regression):** first cold load after a fresh install hit `[runtime not ready]: Error: Exception in HostObject::get for prop 'RNSModule': NullPointerException: null cannot be cast to non-null type com.facebook.react.fabric.FabricUIManager` at `ScreensModule.setupFabric` (react-native-screens' Fabric init racing the New Architecture's `FabricUIManager` attachment). This is almost certainly the exact unresolved item flagged at the end of [[telebook-sdk57-upgrade]] ("verify app reaches its real UI" was never actually confirmed before now) — a Fabric/TurboModule startup race, not something Phase 1 or Phase 2 code touches. **It only reproduced once**; a force-stop + relaunch loaded clean every time after. Workaround for now: if a cold start ever shows this red error screen, force-stop and reopen the app once. Root-causing it properly (pinning a different `react-native-screens` version, or finding what's actually racing) is a separate follow-up, not blocking — flagging here so it's not re-discovered from scratch.

**Phase 2 features verified working, live, against production:**
- **P2-F1 (Free Chat header)**: confirmed both new icons render and work — "+" navigates to `Contact` (New group/New Channel/New broadcast + contacts list all render correctly); "Sync" shows the "Syncing..." label + spinner and completes (`📇 contactSync: device=34, synced=9, on app=1` in logs), matching the exact behavior of the existing Settings "Contact Sync" row.
- **P2-F2/F3/F4 (offline messages SQLite)**: pulled the on-device SQLite DB (`run-as` + `adb exec-out cat`, debug build) and queried it directly — the `messages` table has 22 real cached message rows (full JSON, matching schema) for the open chat, `messages_meta` has a correct `last_synced_at`. This conclusively proves the cache **write path** works end-to-end against the real backend. The cache **read-on-mount-before-network** path could not be visually verified on this build: it's a dev-client build, so the JS bundle itself loads from Metro over the same LAN Wi-Fi — killing Wi-Fi to simulate "offline" also disconnects Metro, so the app can't boot at all in that state (dev-client limitation, not an app bug). Read path was verified by direct code review instead (confirmed correct — see §7.4). A true "airplane mode mid-use" visual test would need a release/standalone build (JS bundle embedded in the APK) — noted as a possible follow-up, not done here.
- **P2-F7 (Calls header)**: visually confirmed — status bar and header are now one seamless blue block, no color-mismatch seam (the bug that was fixed). Bonus: real call history is populated and real Agora calls were placed/received during this session (several entries with real durations) — Phase 1's calling feature is confirmed working live too, not just code-complete.
- **P2-F6 (Sponsor)**: tapped "Sponsor" on the one owned channel — fired `GET channels/boost/options` against production, got back `enabled:false` (coins/boost feature is globally off on this server), and the app correctly showed the exact "Not available — Channel sponsoring isn't available right now" alert per spec. Confirms the full request/response wiring is correct; the "not available" outcome is a server-side feature flag, not a client bug.
- **P2-F5 (PLAN_LIMIT errors)**: not exercised against a real over-limit response this session (the test account doesn't have enough groups/channels/broadcasts to trip the limit, and creating 4+ more just to force it wasn't done) — covered by code review + Babel syntax check only. Low risk: the change is a small, isolated branch added to an existing working flow.

**Not yet tested**: My Channels screen itself beyond the Sponsor tap, Call screen's actual call-placement UI (confirmed working incidentally, not deliberately exercised), and hitting a real PLAN_LIMIT 403.

---

## 8. Mid-session bugs found during the Phase 2 device test (2026-10-14) — unrelated to Phase 2, found via live testing

While device-testing Phase 2, user reported "notifications band app me nahi aa rahe" and "video call screen blurry, dono screen nahi dikh rahi" — both turned out to be real, previously-undiscovered bugs in Phase 1 (Calling/Plans/Wallet), which per §5 was coded but never actually device-tested before this session. Investigated and fixed all of them, both frontend (`Archive_back`) and backend (`telebook-backend-api`).

### 8.1 FCM token silently disappearing after login (root cause of "no notifications at all")
- **Symptom**: token gets saved at login, then vanishes from the DB shortly after, no explicit delete anywhere in the code.
- **Backend root cause**: `attachToUserDoc`/`removeFromUser` (`src/services/deviceTokenService.js`) and `pruneInvalidTokens` (`src/services/messageDeliveryService.js`) all did fetch-full-user-doc → mutate-in-memory → `.save()`. `pruneInvalidTokens` in particular fetches its `receiver` snapshot early in `deliverMessage()`, then (after several awaits) saves that stale snapshot back — if a login's token write lands in that window, it gets silently overwritten with the pre-login array. **Fixed**: converted all three to atomic MongoDB `$push`/`$pull`/pipeline updates scoped by `_id` — committed as `1c87b87` on `telebook-backend-api` main, **pushed to GitHub but NOT yet deployed to production** (no CI/CD workflow in the repo — needs a manual pull+restart on whatever host runs `api.telebookservices.com`).
- **Frontend gap** (`Archive_back`): the project's own `TELEBOOK_API_REFERENCE.md` (§8, "the rule most often missed") documents that the FCM token must be re-sent via `POST /api/notifications/save-token` on **every app start** and **on every refresh** — the app was doing neither (only sent once, at login, inside `verify-otp`). Fixed: new `src/services/deviceId.js` (stable per-install UUID, no new dependency), `notification.js`'s `setupTokenRefreshListener` now actually posts the refreshed token (was a no-op callback before), new `syncPushToken()` called on every app start (`src/index.js`) when logged in, `deviceId` now included in the `verify-otp` payload (`Otp/index.js`), and logout (`Logoutcall.js`) now also calls `messaging().deleteToken()` after the backend logout call, per the doc's rule 4. **Live-verified on device**: no errors, `save-token` call fires silently (success) on app start.

### 8.2 Incoming-call notification channel never created (root cause of "no ring when app killed/backgrounded")
- `src/components/notification.js`'s `setupCallChannel()` had `vibrationPattern: [0, 1000, 500, 1000]` — notifee's validator rejects a leading `0` ("expected an array containing an even number of **positive** values"), so `notifee.createChannel()` threw before ever reaching native code. The `incoming_calls` channel was **never created on the device at all**, and Android silently drops any notification posted against a non-existent channel — no error, no ring, nothing. Fixed: `[1000, 500, 1000, 500]`. Also moved `setupCallChannel()` to run at module top-level (`src/index.js`, alongside `setupBackgroundHandler`/`registerCallBackgroundEvents`) instead of only inside the foreground `useEffect`, so the channel exists even if a call push arrives before the app is ever opened in foreground once.

### 8.3 Two more call-notification bugs found via live device test (real calls placed between two phones)
- **`action: 'dismiss'` pushes (call cancelled/rejected/timed-out) were calling `displayIncomingCallNotification()` again** instead of `cancelIncomingCallNotification()` — `setupBackgroundHandler()` branched only on `entity === 'call'`, not on `data.action`. Fixed: now branches `action === 'dismiss'` → cancel, else → display.
- **`largeIcon: data.callerPhoto || undefined`** — when `callerPhoto` is absent (true for dismiss pushes, which don't carry it), this explicitly sets the `largeIcon` key to `undefined`, which notifee's validator rejects (`'notification.android.largeIcon' expected a React Native ImageResource value or a valid string URL`) — this is what was throwing in the logs (`❌ displayIncomingCallNotification error`) every time a dismiss push arrived. Also, when a photo IS present, it was a bare storage-relative path (`uploads/images/...jpg`), not a full URL — would likely fail to actually load as an icon even when validation passed. Fixed: build `Config.MEDIA_URL + callerPhoto` into a real URL, and only include the `largeIcon` key at all when a photo exists (conditional spread, no more `undefined` key).
- Confirmed via real logcat from live test calls: `🌙 Background FCM` for both `action:"incoming"` and `action:"dismiss"` payloads now visible, correct shape, matches `BACKEND_CHANGES_NEEDED.md`'s spec exactly (data-only, no `notification` block, `callType`/`callerName`/`callerPhoto`/`entity`/`entityId` all present) — backend's FCM-sending side was already correct; all 3 bugs found were frontend-only.

### 8.4 Video call quality ("blurry") + self-view ("dono screen") — `src/services/callService.js`, `src/screens/InCallScreen/index.js`
- No explicit `setVideoEncoderConfiguration` was ever set — Agora was left on its implicit default. Added an explicit config (640×480 @ 15fps, `DegradationPreference.MaintainQuality` so a weak network drops frame-rate rather than resolution/sharpness first).
- The local self-view PiP (`localVideoWrap`, small box top-right) was **already implemented in code** (`RtcSurfaceView canvas={{uid:0}}`) — but neither `RtcSurfaceView` (remote full-screen nor local PiP) had an explicit `renderMode`, and critically the local PiP `RtcSurfaceView` had no `zOrderOnTop`/`zOrderMediaOverlay`. Android native `SurfaceView`s (which `RtcSurfaceView` wraps) have their own Z-order system separate from React Native's view hierarchy — two overlapping SurfaceViews (remote full-screen + local small box) need `zOrderMediaOverlay` on the one that should appear on top, or it can render behind/incorrectly regardless of RN-level `position:absolute` styling. This is the likely reason "dono screen" wasn't actually appearing correctly. Fixed: added `renderMode: RenderModeType.RenderModeHidden` to both, plus `zOrderOnTop`/`zOrderMediaOverlay` on the local PiP view.
- **Not yet re-verified with an actual live video call** (only syntax-checked + app relaunched cleanly, no crash) — next step whenever a video call is tested again: confirm both the remote view and the small local self-view box render correctly and look sharper.

### 8.5 Files touched this mid-session detour
- Backend (`telebook-backend-api`, committed + pushed, commits `20be5d5` + `1c87b87`): `src/services/deviceTokenService.js`, `src/controllers/notificationController.js`, `src/controllers/authController.js`, `src/services/messageDeliveryService.js`.
- Frontend (`Archive_back`, **not yet committed** — ask before committing/pushing): `src/services/deviceId.js` (new), `src/components/notification.js`, `src/index.js`, `src/screens/Authpage/Otp/index.js`, `src/services/Logoutcall.js`, `src/services/callService.js`, `src/screens/InCallScreen/index.js`.
