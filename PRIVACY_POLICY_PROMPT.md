Tum ek privacy-policy writer ho jo Google Play ki User Data policy aur India ke DPDP Act 2023 ko achhe se jaanta hai. Neeche mere Android app "Telebook" ki verified technical details hain (maine app ka code check karke nikali hain). Inke basis par ek complete, plain-language Privacy Policy likho jo Google Play Console me submit ho sake. Jo cheez neeche nahi di hai wo apni taraf se mat banao — uski jagah [PLACEHOLDER] chhodo aur end me ek "Mujhe ye batana hoga" list do.

## 1. App basics
- App name: Telebook (Android package: com.telebookapp.chatapp, version 1.0.0)
- Type: messaging / social app — 1:1 chat, group chat, broadcast lists, channels, status (stories), voice & video calls, paid plans/wallet.
- Developer / company name: [PLACEHOLDER]
- Registered address: [PLACEHOLDER]
- Contact email for privacy: [PLACEHOLDER]
- Grievance officer (DPDP / IT Rules ke hisaab se): [PLACEHOLDER naam + email]
- Website / policy URL: [PLACEHOLDER] (app ke deep-link domains: telebook.app; API: api.telebookservices.com)
- Target countries: India (primary) [PLACEHOLDER agar aur ho]
- Target age: [PLACEHOLDER, e.g. 13+ / 18+]. Policy me children ke liye alag section rakho.

## 2. Data jo app collect karta hai (code se verified)
Account / profile
- Mobile number (OTP se login: POST auth/send-otp, auth/verify-otp)
- Name, "about" text (optional), profile picture
- Privacy settings (last seen/online, profile photo, about, status ke liye visibility)
- Language / theme preference

Contacts (READ_CONTACTS, WRITE_CONTACTS permission)
- Phone ke contacts (naam, phone number, contact photo) padhe jaate hain
- Phone numbers server ko bheje jaate hain ye pata karne ke liye ki kaun Telebook par registered hai (users/sync-contacts) aur contact list server par cache hoti hai (contact-cache PUT/GET)
- Contacts phone par SQLite me bhi save hote hain

User content
- Messages (text), forwarded/starred/reacted messages, reply, delete
- Media: photos, videos, audio/voice notes, documents (camera, gallery, file picker se; READ_MEDIA_IMAGES/VIDEO/AUDIO, CAMERA, RECORD_AUDIO)
- Status updates, channel posts, broadcast messages
- Group / channel info (naam, icon, members, subscribers)

Calls
- Voice/video calls Agora SDK (react-native-agora) se hote hain. Call history (kaun, kab, kitni der, missed) server par store hoti hai. Audio/video stream Agora ke servers se guzarti hai.

Payments
- Razorpay (react-native-razorpay) se plans, wallet top-up, channel boost ke payments. App khud card/UPI details store nahi karta (verify karo) — order id, transaction id, amount, plan history server par save hoti hai.

Device & technical
- FCM push token + deviceId (install ID) + deviceType (notifications/save-token, devices) — logged-in devices ki list aur "revoke other devices" feature ke liye
- IP address, API logs, crash/diagnostic data: [PLACEHOLDER — backend se confirm karo]
- Notification settings, auto-reply settings
- Blocked users list; user/channel reports (reports/user, reports/channel)

Local storage (phone par)
- SQLite: chats, messages, contacts cache; AsyncStorage / redux-persist: login token, user profile, settings. allowBackup=false hai (Android cloud backup me nahi jaata).

## 3. Third-party SDKs / processors (policy me naam se likho aur unki privacy policy link karo)
- Firebase Cloud Messaging (push notifications) — Google
- Firebase Auth / Firestore packages project me hain par code me active use nahi mila — [PLACEHOLDER: confirm karo; use nahi hota to mat likho]
- Agora (voice/video calling)
- Razorpay (payments)
- Notifee (local/full-screen call notifications — on-device)
- Socket.IO (apna realtime server, third party nahi)
- SMS/OTP provider: [PLACEHOLDER — backend se confirm karo]
- Hosting / cloud storage jahan media rakha jaata hai (media backend pe S3-type storage use hota hai): [PLACEHOLDER provider + region]
- Analytics / ads / crash-reporting SDK: app me koi nahi mila (Sentry/Crashlytics/Analytics/Ads nahi). Policy me likho ki app advertising ya cross-app tracking nahi karta — par pehle [CONFIRM] karo.

## 4. Android permissions aur unka maqsad (har ek ko policy me justify karo)
- READ_CONTACTS, WRITE_CONTACTS — contacts dikhana, kaun app par hai ye pata karna, contact save/invite
- CAMERA — photo/video khichna, video call
- RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, BLUETOOTH_CONNECT — voice notes, voice/video calls, headset
- READ_MEDIA_IMAGES / VIDEO / AUDIO / VISUAL_USER_SELECTED, READ/WRITE_EXTERNAL_STORAGE (Android 12 tak), ACCESS_MEDIA_LOCATION — media bhejna / save karna
- POST_NOTIFICATIONS, VIBRATE, WAKE_LOCK — notifications
- USE_FULL_SCREEN_INTENT, SYSTEM_ALERT_WINDOW — incoming call ko full-screen dikhana (lock screen par)
- FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK — audio/voice-note playback
- INTERNET
- Location: app location permission NAHI maangta — policy me ye likho.

## 5. User ke rights aur controls (app me jo sach me hai)
- Account delete: Settings → Delete Account (server: DELETE users/delete-account). API doc ke hisaab se data hata diya jaata hai, doosron ko "Deleted account" dikhta hai, aur number dobara register ho sakta hai. Exact retention/backup period: [PLACEHOLDER — backend se confirm karo]
- Logout, "clear all data" (settings/clear-all-data), chat clear, message delete (for me / for everyone)
- Privacy settings (last seen, photo, about, status), block/unblock, report user/channel
- Contacts sync manually band/chalu (Settings → Sync Contacts); permission Android settings se kabhi bhi hata sakte hain
- Logged-in devices dekhna aur doosre devices revoke karna
- Data access / correction / deletion request ka tareeka: [PLACEHOLDER email]

## 6. Sharing
- Messages/media sirf un users ko jinhe user bhejta hai (group/channel members). Channels public ho sakte hain — public posts koi bhi dekh sakta hai.
- Service providers (upar section 3) sirf service dene ke liye.
- Law enforcement / legal request: [PLACEHOLDER]
- Data bechna nahi: [CONFIRM karke likho]

## 7. Security
- Transport: production API https://api.telebookservices.com par chalta hai. Dhyan: app me usesCleartextTraffic=true set hai (build config me) — policy me "all data encrypted in transit" tabhi likho jab main ye band kar dun; abhi isko [CONFIRM] mark karo.
- End-to-end encryption: code me nahi mila — policy me E2E ka koi claim MAT karo.
- Token phone me local store hota hai; allowBackup=false.
- Login: mobile number + OTP (password nahi). Har request token se authenticate hoti hai.
- User ke paas security controls: logged-in devices dekhna aur "revoke other devices", logout, block/report, privacy settings.
- Payments Razorpay ke through hote hain; app card/UPI details apne paas store nahi karta [CONFIRM].
- Server-side security (encryption at rest, access control, backups, breach notification process, data retention period): [PLACEHOLDER — backend se confirm karo]. Jo confirm na ho wo policy me claim mat karo; generic line rakho: "hum reasonable technical aur organisational measures use karte hain, par koi system 100% secure nahi hota."
- Data breach hone par users aur zaroorat padne par authority ko kaise batayenge (DPDP): [PLACEHOLDER]
- Policy me alag "Data Security" section likho jisme upar ki saari baatein ho, aur Data safety form me "Data is encrypted in transit" ka answer isi se match kare.

## 8. Mujhe kya output chahiye
1. Poori Privacy Policy (English me, saaf aur simple; neeche Hinglish summary optional) — sections: Introduction, Information we collect, How we use it, Legal basis/consent (DPDP), Sharing & third parties, Data retention, User rights & account deletion, Children, Security, International transfers, Changes, Contact + Grievance officer.
2. Android permissions wali alag table (permission → kyun).
3. Google Play ke liye alag se "Data safety form" ka answer-sheet: har data type (Personal info, Contacts, Messages, Photos & videos, Audio, Files, App activity, Device or other IDs, Financial info) ke liye — Collected? Shared? Optional? Purpose? Encrypted in transit? Deletion request ka option?
4. Account deletion page ke liye short text (Play Console "Delete account URL" ke liye) — in-app steps + web request ka tareeka + kaunsa data delete hota hai/kaunsa legal reasons se rakha jaata hai.
5. End me "Mujhe ye batana hoga" checklist — saare [PLACEHOLDER] / [CONFIRM] items ek jagah.

Rules: koi aisi baat mat likho jo upar di hui details se confirm nahi hoti. Jahan data collect hota hai par maine detail nahi di, wahan assume mat karo — placeholder rakho.
