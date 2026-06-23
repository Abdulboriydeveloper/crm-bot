require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const path = require("path");
const fs = require("fs");

const TARIF_IMAGE = path.join(__dirname, "tariflar.jpg");

const app = express();
app.use(express.json());

app.get("/", (_, res) => res.send("Bot ishlayapti ✅"));
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.post("/send-message", async (req, res) => {
  const { chat_id, text, lead_id } = req.body;
  if (!chat_id || !text) return res.status(400).json({ error: "chat_id va text kerak" });
  try {
    await bot.sendMessage(chat_id, text);
    if (lead_id) {
      await saveMessage({ lead_id, chat_id: Number(chat_id), text, from_bot: true, msg_type: "text" });
    }
    res.json({ status: "ok" });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server port ${PORT} da ishlamoqda`));

const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
  setInterval(async () => {
    try { await fetch(`${RENDER_URL}/health`); console.log("💓 Keep-alive"); }
    catch(e) { console.log("⚠️ Keep-alive xato:", e.message); }
  }, 5 * 60 * 1000);
}

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("✅ Bot ishga tushdi! Token:", process.env.BOT_TOKEN?.slice(0, 15));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBAPP_URL = process.env.WEBAPP_URL;

async function supabaseInsert(table, data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    console.log(`📦 Insert [${table}]:`, JSON.stringify(json).slice(0, 120));
    return Array.isArray(json) ? json : [json];
  } catch(e) {
    console.error("❌ Supabase xato:", e.message);
    return null;
  }
}

async function supabaseUpdate(id, data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch(e) {
    console.error("❌ Update xato:", e.message);
    return null;
  }
}

async function saveMessage({ lead_id, chat_id, text, from_bot = false, msg_type = "text", file_id = null }) {
  if (!lead_id) return null;
  return supabaseInsert("messages", { lead_id, chat_id, text, from_bot, msg_type, file_id });
}

async function writeToSheets(params) {
  if (!WEBAPP_URL) return;
  try {
    const url = new URL(WEBAPP_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("t", Date.now());
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    console.log("📊 Sheets:", (await res.text()).slice(0, 80));
  } catch(e) {
    try {
      const url = new URL(WEBAPP_URL);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      await fetch(url.toString(), { method: "GET", mode: "no-cors" });
    } catch(_) {}
  }
}

const sessions = {};

const TARIF_TEXT = `Ana endi to'lov qismiga o'tamiz.

━━━━━━━━━━━━━━━

Humo:
💳 9860060943559306
👤 Tojiyeva Nargiza

Uzcard:
💳 6262480057951125
👤 Tojiyeva Nargiza

Visa:
💳 4278320027976132
👤 Tojiyeva Nargiza

━━━━━━━━━━━━━━━

To'lov qilgandan so'ng screenshot qilib mana shu telegram botga yuborasiz.

(Screenshotda summa, sana va to'lov amalga oshgan vaqti bo'lishi shart) ✅

Menjer bilan bog'lanish👇
@nargiza_khayitbayevna_admin`;

// ── /start ──────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("▶️ /start — chatId:", chatId);
  sessions[chatId] = { step: "ask_name" };

  const startText = "Assalomu alaykum ro'yxatdan o'tish uchun ism-familiyangizni qoldiring!";
  await bot.sendMessage(chatId, startText, { reply_markup: { remove_keyboard: true } });

  // /start xabarini ham saqlash (lead_id yo'q hali, sessionga qo'shamiz)
  sessions[chatId].pendingMessages = [
    { text: "/start bosdi", from_bot: false, msg_type: "text" },
    { text: startText, from_bot: true, msg_type: "text" }
  ];
});

// ── Barcha xabarlar ─────────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const photo = msg.photo;
  const contact = msg.contact;

  if (text?.startsWith("/")) return;

  const session = sessions[chatId];

  // Session yo'q yoki done — ro'yxatdan o'tgan lid keyingi xabarlari
  if (!session || session.step === "done") {
    const leadId = session?.leadId;
    if (leadId) {
      if (text) {
        await saveMessage({ lead_id: leadId, chat_id: chatId, text, from_bot: false, msg_type: "text" });
      } else if (photo?.length > 0) {
        const fileId = photo[photo.length - 1].file_id;
        await saveMessage({ lead_id: leadId, chat_id: chatId, text: "📸 Rasm yubordi", from_bot: false, msg_type: "photo", file_id: fileId });
      }
    }
    return;
  }

  // ── Ism ────────────────────────────────────────────────────
  if (session.step === "ask_name") {
    if (!text || text.trim().length < 2) {
      bot.sendMessage(chatId, "Iltimos, to'liq ismingizni kiriting:");
      return;
    }
    session.name = text.trim();
    session.step = "ask_phone";

    // Foydalanuvchi ismini pending ga qo'shish
    session.pendingMessages = session.pendingMessages || [];
    session.pendingMessages.push({ text: text.trim(), from_bot: false, msg_type: "text" });

    const askPhoneText = `Rahmat, ${session.name}! 😊\n\n📞 Telefon raqamingizni kiriting:`;
    session.pendingMessages.push({ text: askPhoneText, from_bot: true, msg_type: "text" });

    await bot.sendMessage(chatId, askPhoneText, {
      reply_markup: {
        keyboard: [[{ text: "📱 Raqamimni yuborish", request_contact: true }]],
        resize_keyboard: true, one_time_keyboard: true
      }
    });
    return;
  }

  // ── Telefon ────────────────────────────────────────────────
  if (session.step === "ask_phone") {
    let phone = contact?.phone_number || null;
    if (!phone && text) {
      const c = text.replace(/\s/g, "");
      if (/^[+]?[0-9]{9,13}$/.test(c)) phone = c;
    }
    if (!phone) {
      bot.sendMessage(chatId, "Iltimos, to'g'ri raqam kiriting yoki tugmani bosing:");
      return;
    }

    session.phone = phone;
    session.step = "wait_payment";
    session.date = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

    // Raqamni pending ga qo'shish
    session.pendingMessages = session.pendingMessages || [];
    session.pendingMessages.push({ text: phone, from_bot: false, msg_type: "text" });

    // Supabase ga yangi lid
    const result = await supabaseInsert("leads", {
      name: session.name,
      phone: session.phone,
      stage: "Yangi lid",
      chat_id: chatId
    });
    session.leadId = result?.[0]?.id || null;
    console.log(`🆔 Lead ID: ${session.leadId}`);

    // Pending xabarlarni saqlash (lead_id endi bor)
    if (session.leadId && session.pendingMessages?.length > 0) {
      for (const pm of session.pendingMessages) {
        await saveMessage({ lead_id: session.leadId, chat_id: chatId, ...pm });
      }
      session.pendingMessages = [];
    }

    // Sheets
    await writeToSheets({ action: "add", name: session.name, phone: session.phone, date: session.date });

    // Tariflar yuborish
    if (fs.existsSync(TARIF_IMAGE)) {
      await bot.sendPhoto(chatId, TARIF_IMAGE, {
        caption: TARIF_TEXT,
        reply_markup: { remove_keyboard: true }
      });
    } else {
      await bot.sendMessage(chatId, TARIF_TEXT, { reply_markup: { remove_keyboard: true } });
    }

    // Tariflar xabarini saqlash
    await saveMessage({ lead_id: session.leadId, chat_id: chatId, text: TARIF_TEXT, from_bot: true, msg_type: "text" });
    return;
  }

  // ── Chek yoki matn ─────────────────────────────────────────
  if (session.step === "wait_payment") {
    if (photo?.length > 0 || text) {
      session.step = "done";

      if (photo?.length > 0) {
        const fileId = photo[photo.length - 1].file_id;
        // Rasmni Telegram URL orqali saqlash
        try {
          const fileInfo = await bot.getFile(fileId);
          const photoUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;
          await saveMessage({ lead_id: session.leadId, chat_id: chatId, text: photoUrl, from_bot: false, msg_type: "photo", file_id: fileId });
        } catch(e) {
          await saveMessage({ lead_id: session.leadId, chat_id: chatId, text: "📸 Chek rasmi", from_bot: false, msg_type: "photo", file_id: fileId });
        }
      } else if (text) {
        await saveMessage({ lead_id: session.leadId, chat_id: chatId, text, from_bot: false, msg_type: "text" });
      }

      if (session.leadId) await supabaseUpdate(session.leadId, { stage: "Chek yubordi" });
      await writeToSheets({ action: "move", phone: session.phone, stage: "Chek yubordi" });

      const reply = `✅ Rahmat, ${session.name}!\n\n🎉 Tabriklaymiz siz muvaffaqiyatli ro'yxatdan o'tdingiz!\nOperatorlarimiz 24 soat ichida siz bilan bog'lanishadi\n\nTo'lovda muammo bo'lsa:\n+998906297017\n+998777413014\n\nraqamga aloqaga chiqing.`;
      await bot.sendMessage(chatId, reply);
      await saveMessage({ lead_id: session.leadId, chat_id: chatId, text: reply, from_bot: true, msg_type: "text" });

      if (process.env.ADMIN_CHAT_ID) {
        await bot.sendMessage(process.env.ADMIN_CHAT_ID, `💰 Yangi to'lov!\n👤 ${session.name}\n📞 ${session.phone}`);
        if (photo?.length > 0) bot.forwardMessage(process.env.ADMIN_CHAT_ID, chatId, msg.message_id);
      }
      return;
    }

    bot.sendMessage(chatId, "📸 Chek rasmini yuboring yoki holatni tanlang:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔁 Qayta aloqa kerak", callback_data: "stage_Qayta aloqa" }],
          [{ text: "ℹ️ Ma'lumot berildi", callback_data: "stage_Ma'lumot berildi" }],
          [{ text: "💳 To'lov kutilmoqda", callback_data: "stage_To'lov kutilmoqda" }]
        ]
      }
    });
    return;
  }

  if (session.step === "done") {
    const leadId = session.leadId;
    if (leadId) {
      if (text) await saveMessage({ lead_id: leadId, chat_id: chatId, text, from_bot: false, msg_type: "text" });
      else if (photo?.length > 0) {
        const fileId = photo[photo.length - 1].file_id;
        await saveMessage({ lead_id: leadId, chat_id: chatId, text: "📸 Rasm yubordi", from_bot: false, msg_type: "photo", file_id: fileId });
      }
    }
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const session = sessions[chatId];
  if (!session) return;
  const stage = query.data.replace("stage_", "");
  if (session.leadId) await supabaseUpdate(session.leadId, { stage });
  await writeToSheets({ action: "move", phone: session.phone, stage });
  bot.answerCallbackQuery(query.id, { text: `✅ "${stage}" ga o'tkazildi` });
  bot.editMessageText(`Holat: ${stage} ✅`, { chat_id: chatId, message_id: query.message.message_id });
});

bot.on("polling_error", (e) => console.error("🔴 Polling xato:", e.message));
