# Backend Changes Needed — Calling Feature (Frontend side done)

**For the backend team.** Frontend (React Native app) ne real calling (Agora) + Plans/Wallet
poora implement kar diya hai, `FRONTEND_GUIDE.md` mein already documented endpoints/socket
events use karke. **Koi naya REST endpoint ya socket event nahi chahiye** — sab kuch doc mein
pehle se maujood hai. Sirf **2 cheezein** backend par chahiye:

1. Agora credentials env mein set karna (feature already code mein hai, sirf config missing)
2. Incoming-call FCM push ka exact `data` shape (yeh doc mein kahin specify nahi tha — naya
   requirement hai, iske bina "app band/lock screen par full-screen ringing" kaam nahi karega)

---

## 1 · Agora credentials (env vars)

`GET /api/calls/config` abhi `available: false` deta hai jab tak yeh dono set nahi hain
(yeh pehle se doc mein likha hai, sirf confirm kar rahe hain):

```
AGORA_APP_ID=d98092d435584600b6d707d361889f3d
AGORA_APP_CERTIFICATE=<Primary Certificate — client ne chat mein diya tha, yahan nahi
                        likh rahe; .env/secret-manager mein daalein, kisi bhi file mein
                        commit na karein>
```

- `AGORA_APP_ID` sensitive nahi hai (client bhi isi ko use karta hai), par `AGORA_APP_CERTIFICATE`
  **sirf server ke env/secret-manager mein** — yeh RTC token generate karne ki key hai, kahin
  aur (git, logs, client code) jaana nahi chahiye.
- Set karne ke baad `GET /api/calls/config` ka `available` khud `true` ho jaana chahiye
  (agar aapke code mein yeh check already hai, jaisa doc kehta hai).
- Is step ke bina calling feature bilkul kaam nahi karega — client ka call button hi nahi
  dikhega (`available:false` ka matlab hi yahi hai).

---

## 2 · Incoming-call FCM push — exact `data` shape (NEW requirement)

### Kyun chahiye

Frontend ab WhatsApp jaisa **full-screen ringing** dikhata hai jab app band ho ya phone
locked ho (socket tab kaam nahi karta jab app background/killed hota hai). Yeh purely
client-side (`@notifee/react-native`) se implement hua hai, lekin isko kaam karne ke liye
FCM push mein specific fields chahiye.

`FRONTEND_GUIDE.md` §2.6 mein likha hai: *"callee: receives socket `call:incoming` (and an
FCM push if the app is closed)"* — par push ka exact **payload shape** kahin define nahi
kiya gaya. Yeh doc ab wahi gap bhar rahi hai.

### Kya chahiye — exact format

Jahan bhi backend mein `call:incoming` socket event emit hota hai (jab callee offline/app-
background ho to), wahi jagah FCM push bhi bhejni hai — **neeche diye exact shape mein**:

```json
{
  "data": {
    "entity": "call",
    "entityId": "<callId>",
    "callType": "audio",
    "callerName": "Rahul Sharma",
    "callerPhoto": "uploads/avatars/abc123.jpg"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `entity` | string | Hamesha literal `"call"` — client isi se pehchanta hai ki yeh call-push hai (baaki entity types — chat/channel/user/etc. — already existing convention follow kar rahe hain, naya pattern nahi hai) |
| `entityId` | string | Call ka `_id` (jo `POST /api/calls` response mein `call._id` hota hai) |
| `callType` | string | `"audio"` ya `"video"` |
| `callerName` | string | Caller ka naam — ringing screen par dikhta hai |
| `callerPhoto` | string | Caller ki `profilePicture` storage key (jaisa messages/users mein aata hai) — optional, na ho to default avatar dikhega |

### Zaroori rules (yeh 3 points bahut important hain)

1. **`data`-only message bhejein — `notification` block BILKUL NA bhejein.**
   Agar message mein top-level `notification: {title, body}` bhi hoga, to Android khud
   apna ek generic notification auto-show kar dega **alag se**, aur client ka custom
   full-screen ringing notification bhi dikhega — **dono ek saath dikhenge (duplicate bug)**.
   Sirf `data` object bhejna hai, kuch aur nahi.

2. **FCM priority `high`/`urgent` set karein** (jo bhi aapka FCM-sending library/SDK ka option
   hai — e.g. Admin SDK mein `android: { priority: 'high' }`). Isके bina Android device
   ko Doze/battery-optimization mode mein deliver karne mein der ho sakti hai ya bilkul
   na ho, aur call ka ring-timeout nikal jaayega.

3. Yeh push **sirf tab bhejein jab callee offline ho ya uska socket disconnected ho**
   (jaisa already likha hai doc mein) — jab callee app khula/foreground mein ho (socket se
   `call:incoming` already pahunch gaya), push dobara bhejne ki zarurat nahi (duplicate
   ringing screen se bachne ke liye — client foreground mein push ko ignore kar deta hai,
   par behtar hai push hi na bheje agar possible ho).

### Reference — client side kya karta hai (sirf context ke liye)

- Client in exact fields (`data.entity === 'call'`) ko dekh kar `@notifee/react-native` se
  ek full-screen notification dikhata hai — Accept/Decline buttons ke saath, locked screen
  ke upar bhi.
- "Decline" tap karne par client seedha `POST /api/calls/:callId/reject` call kar deta hai
  (app kholna zaroori nahi).
- "Accept" ya notification body tap karne par app `InCall` screen kholta hai, jahan user
  ko pehle Accept/Reject dikhta hai (ya "Accept" button se direct `POST /api/calls/:callId/accept`).
- Dono REST calls (`/accept`, `/reject`) already documented endpoints hain — inmein kuch
  badalna nahi hai.

---

## Summary — sirf yeh 2 kaam

- [ ] `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` env/secret-manager mein set karo
- [ ] Jahan `call:incoming` ke liye FCM push bheji jaati hai, uska payload upar diye exact
      `data` shape (aur `notification` block HATAKE) + high priority ke saath update karo

Baaki kuch bhi — REST endpoints, socket events, Plans/Wallet/Payments — bina kisi change
ke already kaam kar jaayenge, kyunki frontend ne strictly `FRONTEND_GUIDE.md` follow kiya hai.
