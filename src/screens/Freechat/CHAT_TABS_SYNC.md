# Chat Tabs — SQL + Redux Data Flow

Free Chat ke 4 tabs (**All / Groups / Unread / Calls**) ka data kaise aata hai, kahan
store hota hai, aur kya abhi tak test hua hai.

> Ye file isliye hai ki jab aap baad me is feature par kaam shuru karein, to poora
> context ek jagah mile — khaas kar wo ek cheez jo abhi tak test nahi hui (Socket sync).

---

## 1. Basic rule

| Layer | Kaam |
|---|---|
| **SQL** | Persistent / local source of truth |
| **Redux** | UI / runtime source |
| **UI** | Sirf Redux se padhti hai |

Tab change par **kabhi API call nahi hoti**. Chaaron tabs ka data pehle se Redux me
hota hai.

---

## 2. Flow

```
APP OPEN
   ↓
hasChatData()   ← SQL check
   ↓
   ├─ data hai   → getAllTabChats() → Redux → UI          (turant, loader nahi)
   │                  ↓
   │               syncAllTabData({ background: true })   (4 API, sirf "Syncing...")
   │
   └─ khali hai  → syncAllTabData() → SQL → Redux → UI    (4 API call + loader)


Header → Sync Data
   ↓
syncAllTabData({ background: true })  →  SQL  →  Redux
   ↓
Loader NAHI — sirf header par "Syncing..." indicator


Socket trigger (message-received / new-message)
   ↓
1.5s debounce
   ↓
syncAllTabData({ background: true })  →  SQL  →  Redux
   ↓
Loader NAHI — UI purane data par chalti rehti hai


App background → foreground (AppState 'active')
   ↓
wahi 1.5s debounce → syncAllTabData({ background: true })


Free Chat tab focus + Redux list khali (Fast Refresh / state reset)
   ↓
ensureChatTabsLoaded() → SQL → Redux   (SQL bhi khali ho to initChatTabs, ek hi baar)
```

---

## 3. Files

| File | Kaam |
|---|---|
| [`src/services/chatsDb.js`](../../services/chatsDb.js) | SQLite — schema, bulk replace, read, meta, clear |
| [`src/services/chatSync.js`](../../services/chatSync.js) | `syncAllTabData()`, `loadTabsFromDb()`, `initChatTabs()` |
| [`src/redex/slices/chatListSlice.js`](../../redex/slices/chatListSlice.js) | Redux — per-tab data, loading/syncing flags |
| [`src/index.js`](../../index.js) | `ChatTabsLoader` — app open par SQL check |
| [`src/screens/Freechat/index.js`](./index.js) | UI, Sync Data handler, socket listener |
| [`src/screens/Freechat/HeaderMenu.js`](./HeaderMenu.js) | 3-dot menu me "Sync Data" option |

Koi Repository / UseCase / Domain / Mapper layer **nahi** hai — jaan-boojh kar.

---

## 4. `syncAllTabData()` kahan se chalta hai

```js
syncAllTabData(dispatch, myUserId, { background?: boolean })
```

| # | Kahan se | background | Loader |
|---|---|---|---|
| 1 | `initChatTabs()` — SQL khali hone par | `false` | **Haan** |
| 2 | Header → Sync Data | `true` | Nahi |
| 3 | Socket trigger | `true` | Nahi |
| 4 | `initChatTabs()` — SQL me data ho to, SQL load ke baad | `true` | Nahi |
| 5 | App wapas foreground me aaye | `true` | Nahi |

Iske alawa kahin se call **mat** karo. Pin / delete / block ke baad refresh ke liye
`loadTabsFromDb(dispatch)` use hota hai — wo sirf SQL→Redux hai, koi API nahi.

Local badlav (chat kholne par unread clear, socket se naya message, apna bheja
message, nayi chat) Redux me turant hote hain aur `dispatch(persistChatTabs())` se
~600ms debounce ke baad SQL me likh diye jate hain — ye bhi koi API call nahi hai.

Chat screen band hone par us chat ka sabse naya message `setChatLatestMessage` se list
me aa jata hai (koi API nahi), taaki list ka last message chat se match kare.

Khuli chat `activeChatId` (Redux) me rehti hai: us chat par aane wale message se
unread nahi badhta, aur sync ke baad bhi us chat ka badge 0 rehta hai.

> Socket listener hatate waqt **hamesha callback do**: `socketService.off(event, cb)`.
> Bina callback ke us event ke saare listeners hat jate hain — pehle Chat screen band
> karte hi chat list ka `message-received` listener hat jata tha aur list update hona
> band ho jata tha.

---

## 5. Redux shape

```js
{
  tabs: { All: [], Groups: [], Unread: [], Calls: [] },
  loading: false,       // sirf SQL→Redux load / SQL-empty wali pehli API sync
  syncing: false,       // manual Sync Data aur socket background sync
  lastSyncedAt: null,
  error: null,
}
```

**`loading` aur `syncing` alag kyun hain:** socket sync par loader nahi dikhana tha.
Agar ek hi flag hota to har incoming message par poori list ek loader se replace ho jaati.

UI me:
- `loading` → full-screen "Loading chats..." ([index.js](./index.js) ~line 335)
- `syncing` → header me chhota "Syncing..." text

> **`chatList` redux-persist me NAHI hai** (dekho [`src/redex/store.js`](../../redex/store.js)).
> Persistence SQL karta hai. Pehle ye whitelist me tha aur rehydrate par purana shape
> (`{ chats: [] }`) naye shape ko overwrite kar deta tha → `Cannot set property 'All' of undefined`.
> Isliye slice ke reducers me `if (!state.tabs) state.tabs = emptyTabs()` guards bhi hain.

---

## 6. SQL schema

```sql
CREATE TABLE chat_tabs (
    tab        TEXT    NOT NULL,          -- 'All' | 'Groups' | 'Unread' | 'Calls'
    chat_id    TEXT    NOT NULL,
    position   INTEGER NOT NULL,          -- server ka order preserve karta hai
    data       TEXT    NOT NULL,          -- poora chat object, JSON
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (tab, chat_id)
);

CREATE TABLE chat_tabs_meta (key TEXT PRIMARY KEY, value TEXT);  -- lastSyncedAt
```

DB file: `telebook.db` (contacts wali tables bhi isi me hain).

- `(tab, chat_id)` primary key → duplicate nahi bante, dobara sync par row UPDATE hoti hai
- Poora chat object JSON me hai kyunki wo gehra nested hai (`users[]`, `latestMessage{}`,
  `readBy[]`) aur screens use poora consume karti hain. Column-wise todne se mapper
  layer banani padti.

Device se DB nikalne ke liye:

```bash
export ANDROID_SERIAL=<device-id>
for f in telebook.db telebook.db-shm telebook.db-wal; do
  adb exec-out run-as com.Telebookapp.Telebook cat "files/SQLite/$f" > "$f"
done
sqlite3 -header telebook.db "SELECT tab, COUNT(*) FROM chat_tabs GROUP BY tab;"
```

(WAL mode hai — teeno files chahiye, sirf `.db` se data adhura milega.)

---

## 7. ⚠️ Tab sources — yahan asli gap hai

[`chatSync.js`](../../services/chatSync.js) me `TAB_SOURCES`:

| Tab | Endpoint | Note |
|---|---|---|
| All | `chats` | ✅ asli API |
| Groups | `chats/groups` | ✅ asli API |
| Unread | `chats` | ⚠️ `unreadCount > 0` se **derive** hota hai |
| Calls | `chats` | ⚠️ **Calls ki koi API hai hi nahi** — poori chat list dikhti hai |

Backend par abhi **2 hi endpoints** hain, 4 nahi. Jab Unread / Calls ke asli endpoints
ban jayein, sirf `TAB_SOURCES` me endpoint badalna hai — baaki poora flow waisa hi rahega:

```js
const TAB_SOURCES = {
    Calls: { endpoint: 'calls/history', pick: (d) => d?.calls },   // ← bas itna
};
```

---

## 8. Kya test ho chuka hai

Sab kuch asli device par (Samsung SM-M045F, dev build):

| Test | Result |
|---|---|
| App open, SQL khali | 4 API → SQL bhara (All 3, Groups 1, Calls 3) |
| App open, SQL me data | UI turant SQL se; uske baad background me 4 API (loader nahi) — *ye behaviour 18 Sep 2026 ko badla, pehle 0 API tha aur list purani reh jaati thi* |
| Chaaron tabs pe tap | **0 API calls**, Groups sirf 1 group |
| Header → Sync Data | **exactly 4 API calls**, SQL ka `syncedAt` update |
| Sync ke dauran UI | Loader nahi, "Syncing..." indicator, chat list visible |
| Network off → Sync Data | `GET chats failed: Network Error`; UI ke 3 chats aur SQL dono intact |
| Reducer logic | 20/20 node tests pass (per-tab update, unread, remove, legacy state) |

---

## 9. ❌ Jo test NAHI hua — Socket background sync

**Ye ek hi cheez bachi hai.** Iske liye kisi doosre account se incoming message chahiye tha,
jo test ke waqt nahi kar paye.

Code [`Freechat/index.js`](./index.js) me hai (~line 84-108):

```js
let timer = null;
const scheduleBackgroundSync = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
        timer = null;
        syncAllTabData(dispatch, MY_USER_ID, { background: true });
    }, 1500);
};

const handleNewMessage = (msg) => {
    ...
    dispatch(updateChatLastMessage({ msg, myUserId: MY_USER_ID }));  // turant UI update
    scheduleBackgroundSync();                                        // background me full refresh
};

socketService.on('message-received', handleNewMessage);
socketService.on('new-message', handleNewMessage);
```

**1.5s debounce kyun:** ek burst me 10 message aayein to 10 baar 4-API sync na ho — ek hi chale.

### Test kaise karein

1. Device ko USB se jodein, app kholein, Free Chat screen par rahein
2. Logcat clear karke watch karein:
   ```bash
   export ANDROID_SERIAL=<device-id>
   adb logcat -c
   adb logcat | grep -aE "token___________|syncAllTabData error"
   ```
3. Kisi **doosre account/device** se is number par message bhejein
4. Expected:
   - Message turant list me top par aa jaye (optimistic update)
   - **Loader na dikhe** — list waise hi visible rahe
   - ~1.5s baad **4 API calls** logs me dikhein
   - SQL me `chat_tabs_meta.lastSyncedAt` update ho jaye

### Agar kaam na kare — kahan dekhein

- **Event name galat ho sakta hai.** Abhi `message-received` aur `new-message` dono sun rahe
  hain. Server koi teesra naam bhejta ho to [`socketService.js`](../../services/socketService.js)
  aur backend check karein.
- **Socket connect hi na hua ho.** `SocketManager` ([`src/index.js`](../../index.js)) token
  aur userId par connect karta hai. `socketService.isConnected()` check karein.
- **Debounce me atka ho.** 1500ms wait karein; screen unmount hone par `clearTimeout` chalta
  hai, to Free Chat screen par hi rahein.

---

## 10. Logout

Dono logout raaste chats SQL + Redux clear karte hain:

- [`Settings/index.js`](../Settings/index.js) → `handleLogout` (Delete Account bhi isi ko call karta hai)
- [`services/Logoutcall.js`](../../services/Logoutcall.js) → `logoutUser` (abhi kahin use nahi hota)

```js
await clearChatsDb();
dispatch(clearChatList());
```

Contacts ke liye bhi bilkul yahi pattern hai — dekho `contactsDb.js` / `contactSync.js`.
