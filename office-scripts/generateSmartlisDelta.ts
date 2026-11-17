// Generate SmartLIS delta JSON (новая логика, 2026-11-16).
// Заменяет generate_smartlis_export_json.
//
// Старая версия строила дельту из ChangeLog, куда пишет только Sync. Поэтому в SmartLIS
// уходили его же собственные изменения, а правки бизнеса в Catalog не уходили никогда.
//
// Новая логика: дельта = поля, где Export (то, что в каталоге) отличается от DB_Import
// (то, что сейчас в SmartLIS). Это и есть правки, которых в SmartLIS ещё нет.
//
// ПОРЯДОК РАБОТЫ:
//   1. Вставить свежую выборку из SmartLIS в DB_Import (НЕ запускать Sync!).
//   2. Prepare Export.
//   3. Этот скрипт -> JSON на листе Export_SmartLIS.
//   4. Загрузить JSON в SmartLIS.
//   5. Только после этого — новая выборка в DB_Import и Sync.
// Если запустить Sync до шага 3, он перезапишет правки значениями из SmartLIS.

type CellValue = string | number | boolean;

const MAX_EXPORT_AGE_MINUTES = 15; // Export должен быть свежим
const MAX_TESTS_PER_FIELD = 200;    // поле изменилось у большего числа тестов -> стоп
const ALLOW_MASS_CHANGES = false;   // поставить true, если массовое изменение осознанное
const BOOLEAN_FIELDS = ["active", "order", "bill", "report", "catalog"];
const TEXT_FIELDS = ["code", "name", "launch", "loinccode", "govcode", "paytype", "template_code", "template_name"];

function main(workbook: ExcelScript.Workbook) {
  const exportData = readAll(requireSheet(workbook, "Export"));
  const importData = readAll(requireSheet(workbook, "DB_Import"));
  const schemaData = readAll(requireSheet(workbook, "Schema"));

  if (exportData.length < 2) throw new Error("Export is empty. Run Prepare Export first.");
  if (importData.length < 2) throw new Error("DB_Import is empty. Paste a fresh SmartLIS export first.");
  checkChangeLog(workbook);

  // ---------- Export freshness ----------
  const actions = workbook.getWorksheet("Actions");
  if (actions) {
    const last = Date.parse(String(actions.getRange("E8").getValue() ?? ""));
    if (isNaN(last) || (Date.now() - last) / 60000 > MAX_EXPORT_AGE_MINUTES) {
      throw new Error(`Export is older than ${MAX_EXPORT_AGE_MINUTES} minutes. Run Prepare Export first.`);
    }
  }

  // ---------- Fields ----------
  const smartlisFields: string[] = [];
  for (let r = 1; r < schemaData.length; r++) {
    const field = String(schemaData[r][0] ?? "").trim();
    if (field && field !== "code" && String(schemaData[r][4] ?? "").trim().toUpperCase() === "YES") {
      smartlisFields.push(field);
    }
  }

  const exportIndex = indexOf(exportData[0]);
  const importIndex = indexOf(importData[0]);
  if (exportIndex["code"] === undefined) throw new Error("'code' column not found in Export");
  if (importIndex["code"] === undefined) throw new Error("'code' column not found in DB_Import");

  const fields = smartlisFields.filter(f => exportIndex[f] !== undefined && importIndex[f] !== undefined);
  const notCompared = smartlisFields.filter(f => fields.indexOf(f) < 0);
  if (notCompared.length > 0) {
    console.log("Not compared (missing in Export or DB_Import): " + notCompared.join(", "));
  }

  // ---------- SmartLIS state ----------
  const dbMap: Record<string, CellValue[]> = {};
  for (let r = 1; r < importData.length; r++) {
    const code = String(importData[r][importIndex["code"]] ?? "").trim();
    if (code) dbMap[code] = importData[r];
  }

  // ---------- Diff ----------
  const now = new Date().toISOString();
  const batchId = now.replace(/[-:TZ.]/g, "").substring(0, 14);
  const tests: Record<string, string | number | boolean | null>[] = [];
  const log: CellValue[][] = [];
  const notInSmartlis: string[] = [];
  const fieldCounts: Record<string, number> = {};

  for (let r = 1; r < exportData.length; r++) {
    const row = exportData[r];
    const code = String(row[exportIndex["code"]] ?? "").trim();
    if (!code) continue;

    const db = dbMap[code];
    if (!db) {
      notInSmartlis.push(code);
      continue;
    }

    const test: Record<string, string | number | boolean | null> = { code: code };
    let changed = false;

    for (const field of fields) {
      const ours = row[exportIndex[field]];
      const theirs = db[importIndex[field]];
      if (normalize(ours) === normalize(theirs)) continue;

      test[field] = toJson(field, ours);
      changed = true;
      fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
      log.push([now, code, field, String(theirs ?? ""), String(ours ?? ""), "EXPORT", "YES", batchId]);
    }

    if (changed) tests.push(test);
  }

  // Массовое расхождение обычно значит сломанную выгрузку (кодировка, съехавшие колонки)
  if (!ALLOW_MASS_CHANGES) {
    const mass = Object.keys(fieldCounts).filter(f => fieldCounts[f] > MAX_TESTS_PER_FIELD);
    if (mass.length > 0) {
      throw new Error("Delta stopped, nothing written. Too many changes: " +
        mass.map(f => `${f}: ${fieldCounts[f]}`).join(", ") +
        `. Check DB_Import (UTF-8, columns). If intended, set ALLOW_MASS_CHANGES = true.`);
    }
  }

  // ---------- Output ----------
  const json = JSON.stringify({ tests: tests }, null, 2);
  let target = workbook.getWorksheet("Export_SmartLIS");
  if (!target) target = workbook.addWorksheet("Export_SmartLIS");
  target.getUsedRange()?.clear();
  const lines = json.split("\n").map(l => [l]);
  target.getRangeByIndexes(0, 0, lines.length, 1).setValues(lines);

  appendChangeLog(workbook, log);

  const summary = Object.keys(fieldCounts).map(f => `${f}: ${fieldCounts[f]}`).join(", ");
  console.log(`SmartLIS delta generated. Batch ${batchId}. Tests: ${tests.length}. Fields: ${summary || "none"}`);
  if (notInSmartlis.length > 0) {
    console.log(`In Catalog but not in DB_Import (${notInSmartlis.length}), not exported: ` + notInSmartlis.slice(0, 30).join(", "));
  }
}

// ================= helpers =================

function requireSheet(workbook: ExcelScript.Workbook, name: string): ExcelScript.Worksheet {
  const s = workbook.getWorksheet(name);
  if (!s) throw new Error(`Sheet '${name}' not found`);
  return s;
}

function readAll(sheet: ExcelScript.Worksheet): CellValue[][] {
  const used = sheet.getUsedRange(true);
  if (!used) return [];
  const rows = used.getRowIndex() + used.getRowCount();
  const cols = used.getColumnIndex() + used.getColumnCount();
  return sheet.getRangeByIndexes(0, 0, rows, cols).getValues() as CellValue[][];
}

function indexOf(headers: CellValue[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? "").trim();
    if (h && idx[h] === undefined) idx[h] = i;
  }
  return idx;
}

function normalize(v: CellValue | undefined | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (s === "" || s.toUpperCase() === "NULL") return "";
  const u = s.toUpperCase();
  if (u === "TRUE" || u === "FALSE") return u;
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s));
  return s;
}

// Пустое -> null, флаги -> true/false, текстовые поля -> строка, остальное -> число если похоже
function toJson(field: string, v: CellValue): string | number | boolean | null {
  const n = normalize(v);
  if (n === "") return null;
  if (BOOLEAN_FIELDS.indexOf(field) >= 0) return n === "TRUE";
  if (TEXT_FIELDS.indexOf(field) >= 0) return String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(n)) return Number(n);
  return String(v).trim();
}

function checkChangeLog(workbook: ExcelScript.Workbook) {
  const sheet = workbook.getWorksheet("ChangeLog");
  if (!sheet) throw new Error("ChangeLog sheet not found");
  const header = sheet.getRange("G1:H1").getValues()[0].map(v => String(v ?? "").trim());
  if (header[0] !== "Exported" || header[1] !== "BatchId") {
    throw new Error("ChangeLog has no Exported/BatchId columns. Run 00_fixChangeLog_once first.");
  }
}

function appendChangeLog(workbook: ExcelScript.Workbook, log: CellValue[][]) {
  if (log.length === 0) return;
  const sheet = workbook.getWorksheet("ChangeLog");
  if (!sheet) throw new Error("ChangeLog sheet not found");
  const used = sheet.getUsedRange(true);
  const nextRow = used ? used.getRowIndex() + used.getRowCount() : 1;
  sheet.getRangeByIndexes(nextRow, 7, log.length, 1).setNumberFormatLocal(log.map(() => ["@"]));
  sheet.getRangeByIndexes(nextRow, 0, log.length, 8).setValues(log);
}
