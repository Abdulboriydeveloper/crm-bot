# 🤖 Nargiza Bot — Sozlash Qo'llanmasi

## 1. Google Sheets tayyorlash

Google Sheets oching va **5 ta sahifa (tab)** yarating:
```
YANGI LID
CHEK YUBORDI
QAYTA ALOQA
MA'LUMOT BERILDI
TO'LOV KUTILMOQDA
```

Har bir sahifaga 1-qatorda sarlavhalar qo'shing:
```
A1: Ism   B1: Telefon   C1: Sana   D1: Bosqich
```

---

## 2. Google Service Account yaratish

1. https://console.cloud.google.com/ ga kiring
2. Yangi loyiha yarating yoki mavjudini tanlang
3. **APIs & Services → Enable APIs** → "Google Sheets API" ni yoqing
4. **APIs & Services → Credentials → Create Credentials → Service Account**
5. Nomini kiriting → Create
6. **Keys → Add Key → JSON** — fayl yuklab olinadi

JSON faylni oching, ichidagi `client_email` ni nusxalab oling.

---

## 3. Sheets ga ruxsat berish

1. Google Sheets ni oching
2. Yuqori o'ngdagi **"Ulashish"** tugmasini bosing
3. Yuqoridagi `client_email` ni qo'shing (Muharrir sifatida)

---

## 4. Telegram Bot yaratish

1. Telegramda @BotFather ga yozing
2. `/newbot` → nomini kiriting → username kiriting
3. **Token** ni nusxalab oling

---

## 5. Render.com ga deploy qilish

1. https://github.com ga kiring → New Repository yarating
2. Bu papkadagi fayllarni yuklang (`.env` ni YUKLAMANG!)
3. https://render.com ga kiring → New → Web Service
4. GitHub reponi ulang
5. **Environment Variables** ga quyidagilarni qo'shing:

```
BOT_TOKEN        = (BotFather dan olgan token)
SPREADSHEET_ID   = (Sheets URL dagi ID)
GOOGLE_CREDENTIALS = (JSON faylning BUTUN mazmuni — bir qatorda)
ADMIN_CHAT_ID    = (Sizning Telegram ID ingiz — @userinfobot dan bilib oling)
```

> ⚠️ GOOGLE_CREDENTIALS ni qo'shishda JSON faylni oching,
> barcha mazmunini ko'chirib, bir qatorda joylashtiring.

6. **Deploy** tugmasini bosing ✅

---

## 6. Bot ishlashini tekshirish

Telegramda botingizni toping va `/start` yuboring.

### Bot oqimi:
```
/start
  ↓
Salomlashish → Ism so'rash
  ↓
Raqam so'rash → [Sheets: YANGI LID]
  ↓
Tariflar + karta raqamlar ko'rsatish
  ↓
Chek (rasm) kutish
  ↓ (rasm kelsa)
[Sheets: CHEK YUBORDI] → Tabrik xabari
  ↓ (tugma bossа)
[Sheets: QAYTA ALOQA / MA'LUMOT BERILDI / TO'LOV KUTILMOQDA]
```

---

## Tariflar va karta raqamlarni o'zgartirish

`bot.js` faylida `TARIFLAR_XABAR` o'zgaruvchisini toping va tahrirlang.
