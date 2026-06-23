require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const express = require("express");

const path = require("path");

const TARIF_IMAGE = path.join(__dirname, "tariflar.jpg"); // shu rasmni projectga tashlang

const app = express();
app.get("/", (_, res) => res.send("Bot ishlayapti ✅"));
app.listen(process.env.PORT || 3000);

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("✅ Bot ishga tushdi! Token:", process.env.BOT_TOKEN?.slice(0,15));

// ── Supabase ────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabaseInsert(table, data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.log("⚠️ Supabase env yo'q"); return null; }
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
    console.log("📦 Supabase insert:", JSON.stringify(json).slice(0, 100));
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
    const json = await res.json();
    console.log("📦 Supabase update:", JSON.stringify(json).slice(0, 100));
    return json;
  } catch(e) {
    console.error("❌ Supabase update xato:", e.message);
    return null;
  }
}

// ── Google Sheets ───────────────────────────────────────────────
const WEBAPP_URL = process.env.WEBAPP_URL;

async function writeToSheets(params) {
  if (!WEBAPP_URL) { console.log("⚠️ WEBAPP_URL yo'q"); return; }
  try {
    const url = new URL(WEBAPP_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("t", Date.now());
    console.log("📊 Sheets ga yuborilmoqda:", url.toString().slice(0, 80));
    const res = await fetch(url.toString(), { method: "GET", redirect: "follow" });
    const text = await res.text();
    console.log("📊 Sheets javob:", text.slice(0, 100));
  } catch(e) {
    console.error("❌ Sheets xato:", e.message);
    try {
      const url = new URL(WEBAPP_URL);
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      await fetch(url.toString(), { method: "GET", mode: "no-cors" });
    } catch(_) {}
  }
}

// ── Sessions ────────────────────────────────────────────────────
const sessions = {};

const TARIF_TEXT = `
🎨 Ana endi to'lov qismiga o'tamiz.

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
@nargiza_khayitbayevna_admin
`;

// ── /start ──────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log("▶️ /start — chatId:", chatId);
  sessions[chatId] = { step: "ask_name" };
  await bot.sendMessage(
    chatId,
    `Assalomu alaykum ro'yxatdan o'tish uchun ism-familiyangizni qoldiring!`,
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
});

// ── Barcha xabarlar ─────────────────────────────────────────────
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const photo = msg.photo;
  const contact = msg.contact;

  console.log(`📨 Xabar [${chatId}]: text="${text}" photo=${!!photo} contact=${!!contact}`);

  // /start ni skip qilish (onText allaqachon ishladi)
  if (text?.startsWith("/")) return;

  const session = sessions[chatId];
  if (!session) {
    bot.sendMessage(chatId, "Boshlash uchun /start ni bosing 👆");
    return;
  }

  console.log(`📍 Session [${chatId}]: step=${session.step}`);

  // ── Ism ─────────────────────────────────────────────────────
  if (session.step === "ask_name") {
    if (!text || text.trim().length < 2) {
      bot.sendMessage(chatId, "Iltimos, to'liq ismingizni kiriting:");
      return;
    }
    session.name = text.trim();
    session.step = "ask_phone";
    console.log(`✏️ Ism saqlandi: ${session.name}`);

    await bot.sendMessage(
      chatId,
      `Rahmat, *${session.name}*! 😊\n\n📞 *Telefon raqamingizni* kiriting:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          keyboard: [[{ text: "📱 Raqamimni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
    return;
  }

  // ── Telefon ─────────────────────────────────────────────────
  if (session.step === "ask_phone") {
    let phone = null;
    if (contact) {
      phone = contact.phone_number;
    } else if (text) {
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

    console.log(`📞 Raqam saqlandi: ${session.phone}`);

    // 1. Supabase ga yangi lid
    const result = await supabaseInsert("leads", {
      name: session.name,
      phone: session.phone,
      stage: "Yangi lid"
    });
    session.leadId = result?.[0]?.id || null;
    console.log(`🆔 Lead ID: ${session.leadId}`);

    // 2. Sheets ga
    await writeToSheets({
      action: "add",
      name: session.name,
      phone: session.phone,
      date: session.date
    });

    await bot.sendPhoto(
      chatId,
      TARIF_IMAGE,
      {
        caption: TARIF_TEXT,
        reply_markup: {
          remove_keyboard: true
        }
      }
    );
    return;
  }

  // ── Chek (rasm) ─────────────────────────────────────────────
  if (session.step === "wait_payment") {
    if (photo?.length > 0) {
      session.step = "done";
      console.log(`✅ Chek keldi — leadId: ${session.leadId}`);

      // Supabase yangilash
      if (session.leadId) {
        await supabaseUpdate(session.leadId, { stage: "Chek yubordi" });
      }
      // Sheets
      await writeToSheets({
        action: "move",
        phone: session.phone,
        stage: "Chek yubordi"
      });

      await bot.sendMessage(
        chatId,
        `✅ *Rahmat, ${session.name}!*\n\n🎉 😊Tabriklaymiz siz muvaffaqiyatli ro'yxatdan o'tdingiz!
      Operatorlarimiz 24 soat ichida siz bilan bog'lanishadi

      To'lovda muammo bo'lsa:
      +998906297017
      +998777413014

      raqamga aloqaga chiqing.`,
        { parse_mode: "Markdown" }
      );

      if (process.env.ADMIN_CHAT_ID) {
        await bot.sendMessage(
          process.env.ADMIN_CHAT_ID,
          `💰 *Yangi to'lov!*\n👤 ${session.name}\n📞 ${session.phone}`,
          { parse_mode: "Markdown" }
        );
        bot.forwardMessage(process.env.ADMIN_CHAT_ID, chatId, msg.message_id);
      }
      return;
    }

    // Rasm emas — bosqich tanlash
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
    bot.sendMessage(chatId, "✅ Siz allaqachon ro'yxatdan o'tgansiz!\nSavollar: @nargiza_admin");
  }
});

// ── Callback (inline tugmalar) ──────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const session = sessions[chatId];
  if (!session) return;

  const stage = query.data.replace("stage_", "");
  console.log(`🔘 Callback: ${stage} — leadId: ${session.leadId}`);

  if (session.leadId) {
    await supabaseUpdate(session.leadId, { stage });
  }
  await writeToSheets({ action: "move", phone: session.phone, stage });

  bot.answerCallbackQuery(query.id, { text: `✅ "${stage}" ga o'tkazildi` });
  bot.editMessageText(
    `Holat: *${stage}* ✅\n\nChek yuborishni unutmang 📸`,
    { chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown" }
  );
});

bot.on("polling_error", (e) => console.error("🔴 Polling xato:", e.message));
