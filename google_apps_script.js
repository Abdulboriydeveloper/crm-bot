// ================================================================
// GOOGLE APPS SCRIPT — Nargiza CRM + Sheets
// Deploy: Web app | Execute as: Me | Who has access: Anyone
//
// Sheets strukturasi (har bir lid alohida QATOR):
// Qator 1: sarlavhalar (Ism | Raqam | Bosqich | Sana)
// Qator 2+: lidlar
// ================================================================

const SPREADSHEET_ID = "1QLlIBT0_ytulG8HZ_P3kuen44VeZUnNWrWI2Dn8Sh4s";

const STAGES = [
  "Yangi lid",
  "Chek yubordi",
  "Ma'lumot berildi",
  "Qayta aloqa",
  "To'lov kutilmoqda",
  "Joy band qildi",
  "To'liq to'lov",
  "Atkaz",
];

// Sarlavhalar — ustunlar
const HEADERS = ["Ism", "Raqam", "Bosqich", "Sana"];

function getSheet(tabName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (tabName) {
    const s = ss.getSheetByName(tabName);
    if (s) return s;
    // Tab yo'q bo'lsa — yangi yaratish
    const newSheet = ss.insertSheet(tabName);
    setupHeaders(newSheet);
    return newSheet;
  }
  return ss.getSheets()[0];
}

function setupHeaders(sheet) {
  const range = sheet.getRange(1, 1, 1, HEADERS.length);
  range.setValues([HEADERS]);
  range.setFontWeight("bold")
    .setBackground("#4A90D9")
    .setFontColor("#FFFFFF")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  // Ustun kengliklari
  sheet.setColumnWidth(1, 180); // Ism
  sheet.setColumnWidth(2, 150); // Raqam
  sheet.setColumnWidth(3, 180); // Bosqich dropdown
  sheet.setColumnWidth(4, 150); // Sana
}

function ensureHeaders(sheet) {
  const first = sheet.getRange(1, 1).getValue();
  if (!first || first === "") setupHeaders(sheet);
}

// Raqam bo'yicha qator topish (2-qatordan boshlab)
function findRowByPhone(sheet, phone) {
  const clean = phone.toString().replace(/[\s+\-()]/g, "");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const phones = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = 0; i < phones.length; i++) {
    const cell = phones[i][0].toString().replace(/[\s+\-()]/g, "");
    if (cell.includes(clean) || (clean.length >= 9 && cell.includes(clean.slice(-9)))) {
      return i + 2; // 1-indexed, +1 sarlavha uchun
    }
  }
  return -1;
}

// Bosqich uchun dropdown
function addStageDropdown(sheet, row) {
  try {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STAGES, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(row, 3).setDataValidation(rule);
  } catch(e) {
    Logger.log("Dropdown xato: " + e);
  }
}

// Yangi lid qo'shish
function addLead(name, phone, date, tabName) {
  const sheet = getSheet(tabName || "Sheet1");
  ensureHeaders(sheet);

  // Avval shu raqam bor-yo'qligini tekshir
  const existing = findRowByPhone(sheet, phone);
  if (existing > 0) {
    Logger.log("Raqam allaqachon bor, yangilanmadi: " + phone);
    return;
  }

  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1, 1, 4).setValues([[
    name,
    phone,
    "Yangi lid",
    date || new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })
  ]]);

  // Bosqich ustuniga dropdown
  addStageDropdown(sheet, newRow);

  // Alternating row colors
  const bgColor = newRow % 2 === 0 ? "#F8F9FA" : "#FFFFFF";
  sheet.getRange(newRow, 1, 1, 4).setBackground(bgColor);

  Logger.log("Yangi lid: " + name + " | " + phone + " | qator: " + newRow);
}

// Bosqichni yangilash
function updateStage(phone, newStage, tabName) {
  const sheet = getSheet(tabName || "Sheet1");
  ensureHeaders(sheet);

  const row = findRowByPhone(sheet, phone);
  if (row < 0) {
    Logger.log("Raqam topilmadi: " + phone);
    return { found: false };
  }

  sheet.getRange(row, 3).setValue(newStage);
  Logger.log("Bosqich yangilandi: " + phone + " → " + newStage + " (qator " + row + ")");
  return { found: true, row };
}

// Barcha lidlarni olish (CRM uchun emas, Sheets monitoring uchun)
function getLeadsFromSheet(tabName) {
  const sheet = getSheet(tabName || "Sheet1");
  ensureHeaders(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: "ok", leads: [] };

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const leads = data
    .filter(row => row[0] || row[1])
    .map((row, i) => ({
      row: i + 2,
      name: row[0],
      phone: row[1],
      stage: row[2],
      date: row[3]
    }));
  return { status: "ok", leads, total: leads.length };
}

function corsResponse(data) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function doGet(e) {
  try {
    const p = e.parameter || {};
    const action = p.action || "list";
    const tab = p.tab || null;

    if (action === "list") {
      return corsResponse(getLeadsFromSheet(tab));
    }

    if (action === "add") {
      addLead(
        decodeURIComponent(p.name || ""),
        p.phone || "",
        p.date || "",
        tab
      );
      return corsResponse({ status: "ok", action: "added" });
    }

    if (action === "move") {
      const result = updateStage(p.phone || "", decodeURIComponent(p.stage || ""), tab);
      return corsResponse({ status: "ok", ...result });
    }

    return corsResponse({ status: "error", message: "Noto'g'ri action: " + action });
  } catch(err) {
    return corsResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const tab = data.tab || null;

    if (data.action === "add") {
      addLead(data.name || "", data.phone || "", data.date || "", tab);
      return corsResponse({ status: "ok", action: "added" });
    }
    if (data.action === "move") {
      const result = updateStage(data.phone || "", data.stage || "", tab);
      return corsResponse({ status: "ok", ...result });
    }

    return corsResponse({ status: "error", message: "Unknown action" });
  } catch(err) {
    return corsResponse({ status: "error", message: err.toString() });
  }
}
