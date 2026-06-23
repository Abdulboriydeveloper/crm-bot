const { google } = require("googleapis");

// Ustunlar tartibi (Sheets da)
// A: Ism | B: Telefon | C: Sana | D: Bosqich

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
}

async function getSheets() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Bosqich nomlari va Sheets sahifalari
const STAGE_SHEETS = {
  "YANGI LID": "YANGI LID",
  "CHEK YUBORDI": "CHEK YUBORDI",
  "QAYTA ALOQA": "QAYTA ALOQA",
  "MA'LUMOT BERILDI": "MA'LUMOT BERILDI",
  "TO'LOV KUTILMOQDA": "TO'LOV KUTILMOQDA",
};

/**
 * Yangi lid qo'shish — "YANGI LID" sahifasiga
 */
async function appendToSheet({ name, phone, date, stage }) {
  const sheets = await getSheets();
  const sheetName = STAGE_SHEETS[stage] || "YANGI LID";

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:D`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[name, phone, date, stage]],
    },
  });

  console.log(`✅ Sheets ga yozildi: [${sheetName}] ${name} | ${phone}`);
}

/**
 * Telefon raqami bo'yicha lidni topib, yangi bosqichga o'tkazish
 * — Eski sahifadan o'chiradi, yangi sahifaga qo'shadi
 */
async function moveLeadToStage(phone, newStage) {
  const sheets = await getSheets();
  const targetSheet = STAGE_SHEETS[newStage];

  if (!targetSheet) {
    console.error("Noto'g'ri bosqich:", newStage);
    return;
  }

  // Barcha sahifalardan shu raqamni qidirish
  let foundRow = null;
  let foundSheet = null;
  let foundData = null;

  for (const [stageName, sheetName] of Object.entries(STAGE_SHEETS)) {
    if (sheetName === targetSheet) continue; // Maqsad sahifani o'tkazib yubor

    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:D`,
      });

      const rows = res.data.values || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // B ustuni (index 1) — telefon raqami
        if (row[1] && row[1].toString().replace(/\s/g, "") === phone.toString().replace(/\s/g, "")) {
          foundRow = i + 1; // 1-indexed
          foundSheet = sheetName;
          foundData = row;
          break;
        }
      }
    } catch (e) {
      // Sahifa yo'q bo'lishi mumkin, davom etamiz
    }

    if (foundRow) break;
  }

  // Yangi sahifaga qo'shish
  const date = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
  const rowData = foundData
    ? [foundData[0], foundData[1], foundData[2] || date, newStage]
    : ["Noma'lum", phone, date, newStage];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${targetSheet}!A:D`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowData],
    },
  });

  // Eski sahifadan o'chirish
  if (foundRow && foundSheet) {
    // Sheet ID ni olish
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = meta.data.sheets.find(
      (s) => s.properties.title === foundSheet
    );

    if (sheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: foundRow - 1,
                  endIndex: foundRow,
                },
              },
            },
          ],
        },
      });
    }

    console.log(
      `✅ [${foundSheet}] → [${targetSheet}]: ${phone} ko'chirildi`
    );
  } else {
    console.log(`ℹ️ Raqam topilmadi, faqat [${targetSheet}] ga qo'shildi: ${phone}`);
  }
}

module.exports = { appendToSheet, moveLeadToStage };
