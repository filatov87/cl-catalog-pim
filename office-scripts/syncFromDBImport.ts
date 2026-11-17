// Sync from DB_Import -> Catalog (исправленная версия, 2026-11-16)
//
// Что изменилось по сравнению со старой версией:
// - Берутся только поля из Schema с source = DB. Лишние колонки DB_Import игнорируются.
// - Проверки ДО записи (если хоть одна не прошла, Catalog не меняется):
//     * в DB_Import нет дублей code;
//     * govcode не склеен Excel-ем в число (40174,40161 -> 4017440161);
//     * ни одно поле не очищается массово (защита от съехавших колонок, как 06.11).
// - "NULL" и пустая ячейка считаются одним и тем же значением: нет ложных изменений.
// - В Catalog пишутся только изменённые колонки и новые строки, а не весь лист.
// - ChangeLog получает колонки Exported / BatchId, если их нет.

const MAX_CLEARED_SHARE = 0.05; // поле очистилось больше чем у 5% тестов -> стоп
const MAX_CLEARED_MIN = 30;     // ...но не меньше 30 тестов
const MAX_GOVCODE = 99999;      // код НВД длиннее 5 цифр = склеенный список

type CellValue = string | number | boolean;

function main(workbook: ExcelScript.Workbook) {
  const catalogSheet = requireSheet(workbook, "Catalog");
  const importSheet = requireSheet(workbook, "DB_Import");
  const dictionarySheet = requireSheet(workbook, "Dictionary");
  const schemaSheet = requireSheet(workbook, "Schema");

  const catalogData = readAll(catalogSheet);
  const importData = readAll(importSheet);
  const dictionaryData = readAll(dictionarySheet);
  const schemaData = readAll(schemaSheet);

  if (catalogData.length < 2) throw new Error("Catalog is empty");
  if (importData.length < 2) throw new Error("DB_Import is empty");

  // ---------- Schema ----------
  const dbFields: string[] = [];
  const dictionaryFields = new Set<string>();
  for (let r = 1; r < schemaData.length; r++) {
    const field = String(schemaData[r][0] ?? "").trim();
    if (!field) continue;
    const source = String(schemaData[r][1] ?? "").trim().toUpperCase();
    const dictionary = String(schemaData[r][2] ?? "").trim().toUpperCase();
    if (source === "DB" && field !== "code") dbFields.push(field);
    if (dictionary === "YES") dictionaryFields.add(field);
  }

  // ---------- Dictionary: field|id -> display ----------
  const displayMap: Record<string, string> = {};
  for (let r = 1; r < dictionaryData.length; r++) {
    const field = String(dictionaryData[r][0] ?? "").trim();
    const dbValue = normalize(dictionaryData[r][1]);
    const displayValue = String(dictionaryData[r][2] ?? "").trim();
    if (field && dbValue && displayValue) displayMap[field + "|" + dbValue] = displayValue;
  }

  // ---------- Headers ----------
  const catalogHeaders = catalogData[1].map(v => String(v ?? "").trim());
  const importHeaders = importData[0].map(v => String(v ?? "").trim());
  const catalogIndex = indexOf(catalogHeaders);
  const importIndex = indexOf(importHeaders);

  if (catalogIndex["code"] === undefined) throw new Error("Column 'code' not found in Catalog (row 2)");
  if (importIndex["code"] === undefined) throw new Error("Column 'code' not found in DB_Import");

  const syncFields = dbFields.filter(f => catalogIndex[f] !== undefined && importIndex[f] !== undefined);
  const skipped = dbFields.filter(f => syncFields.indexOf(f) < 0);
  if (skipped.length > 0) console.log("Fields skipped (missing in Catalog or DB_Import): " + skipped.join(", "));

  // ---------- DB_Import index + validation ----------
  const errors: string[] = [];
  const dbMap: Record<string, CellValue[]> = {};
  const govCol = importIndex["govcode"];

  for (let r = 1; r < importData.length; r++) {
    const row = importData[r];
    const code = String(row[importIndex["code"]] ?? "").trim();
    if (!code) continue;
    if (dbMap[code]) errors.push(`Duplicate code in DB_Import: ${code}`);
    dbMap[code] = row;

    if (govCol !== undefined) {
      const g = row[govCol];
      if (typeof g === "number" && g > MAX_GOVCODE) {
        errors.push(`govcode of ${code} looks merged by Excel: ${g}. Format the column as Text before pasting.`);
      }
    }
  }
  stopIf(errors);

  // ---------- Compare ----------
  const dataStart = 2;
  const catalogRowsCount = catalogData.length;
  const changedCols = new Set<number>();
  const clearedByField: Record<string, number> = {};
  const unknownDict: string[] = [];
  const log: CellValue[][] = [];
  const now = new Date().toISOString();
  const existingCodes = new Set<string>();

  let updatedCount = 0;
  let priceChanges = 0;
  let matched = 0;

  for (let r = dataStart; r < catalogRowsCount; r++) {
    const code = String(catalogData[r][catalogIndex["code"]] ?? "").trim();
    if (!code) continue;
    existingCodes.add(code);

    const src = dbMap[code];
    if (!src) continue;
    matched++;

    let rowUpdated = false;

    for (const field of syncFields) {
      const catCol = catalogIndex[field];
      const oldValue = catalogData[r][catCol];
      const newValue = mapValue(field, src[importIndex[field]], dictionaryFields, displayMap, unknownDict, code);

      if (normalize(oldValue) === normalize(newValue)) continue;

      if (normalize(oldValue) !== "" && normalize(newValue) === "") {
        clearedByField[field] = (clearedByField[field] ?? 0) + 1;
      }

      catalogData[r][catCol] = newValue;
      changedCols.add(catCol);
      rowUpdated = true;

      const isPrice = field.startsWith("fin_");
      if (isPrice) priceChanges++;
      log.push([now, code, field, String(oldValue ?? ""), String(newValue ?? ""), isPrice ? "PRICE" : "FIELD", "N/A", ""]);
    }

    if (rowUpdated) updatedCount++;
  }

  // Массовая очистка поля = почти наверняка съехали колонки
  const limit = Math.max(MAX_CLEARED_MIN, Math.ceil(matched * MAX_CLEARED_SHARE));
  for (const field of Object.keys(clearedByField)) {
    if (clearedByField[field] > limit) {
      errors.push(`Field '${field}' would be emptied for ${clearedByField[field]} tests (limit ${limit}). Check DB_Import columns.`);
    }
  }
  stopIf(errors);

  // ---------- New records ----------
  const newRows: CellValue[][] = [];
  for (const code of Object.keys(dbMap)) {
    if (existingCodes.has(code)) continue;
    const src = dbMap[code];
    const row: CellValue[] = Array(catalogHeaders.length).fill("") as CellValue[];
    row[catalogIndex["code"]] = code;
    for (const field of syncFields) {
      row[catalogIndex[field]] = mapValue(field, src[importIndex[field]], dictionaryFields, displayMap, unknownDict, code);
    }
    newRows.push(row);
    log.push([now, code, "*", "", "NEW", "NEW", "N/A", ""]);
  }

  // ---------- Write Catalog: only changed columns + new rows ----------
  const existingDataRows = catalogRowsCount - dataStart;
  for (const col of changedCols) {
    const column: CellValue[][] = [];
    for (let r = dataStart; r < catalogRowsCount; r++) column.push([catalogData[r][col]]);
    catalogSheet.getRangeByIndexes(dataStart, col, existingDataRows, 1).setValues(column);
  }
  if (newRows.length > 0) {
    catalogSheet.getRangeByIndexes(catalogRowsCount, 0, newRows.length, catalogHeaders.length).setValues(newRows);
  }

  // ---------- ChangeLog ----------
  appendChangeLog(workbook, log);

  // ---------- Actions ----------
  const actions = workbook.getWorksheet("Actions");
  if (actions) {
    actions.getRange("E4").setValue(now);
    actions.getRange("E5").setValue(updatedCount);
    actions.getRange("E6").setValue(newRows.length);
    actions.getRange("E7").setValue(priceChanges);
  }

  if (unknownDict.length > 0) {
    console.log(`IDs not found in Dictionary (${unknownDict.length}), kept as raw ID: ` + unknownDict.slice(0, 30).join("; "));
  }
  console.log(`Sync completed. Updated tests: ${updatedCount}, new: ${newRows.length}, price changes: ${priceChanges}`);
}

// ================= helpers =================

function requireSheet(workbook: ExcelScript.Workbook, name: string): ExcelScript.Worksheet {
  const s = workbook.getWorksheet(name);
  if (!s) throw new Error(`Sheet '${name}' not found`);
  return s;
}

// Читает лист всегда начиная с A1, даже если used range начинается не с A1
function readAll(sheet: ExcelScript.Worksheet): CellValue[][] {
  const used = sheet.getUsedRange(true);
  if (!used) return [];
  const rows = used.getRowIndex() + used.getRowCount();
  const cols = used.getColumnIndex() + used.getColumnCount();
  return sheet.getRangeByIndexes(0, 0, rows, cols).getValues() as CellValue[][];
}

function indexOf(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] && idx[headers[i]] === undefined) idx[headers[i]] = i;
  }
  return idx;
}

// "NULL", пусто, пробелы -> ""; TRUE/true -> TRUE; "5.50" и 5.5 -> "5.5"
function normalize(v: CellValue | undefined | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (s === "" || s.toUpperCase() === "NULL") return "";
  const u = s.toUpperCase();
  if (u === "TRUE" || u === "FALSE") return u;
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s));
  return s;
}

function mapValue(
  field: string,
  raw: CellValue,
  dictionaryFields: Set<string>,
  displayMap: Record<string, string>,
  unknown: string[],
  code: string
): CellValue {
  const n = normalize(raw);
  if (n === "") return "";
  if (!dictionaryFields.has(field)) return raw;
  const mapped = displayMap[field + "|" + n];
  if (mapped !== undefined) return mapped;
  unknown.push(`${code}.${field}=${n}`);
  return raw;
}

function stopIf(errors: string[]) {
  if (errors.length === 0) return;
  const shown = errors.slice(0, 20).join("\n");
  const more = errors.length > 20 ? `\n...and ${errors.length - 20} more` : "";
  throw new Error(`Sync stopped, Catalog NOT changed:\n${shown}${more}`);
}

function appendChangeLog(workbook: ExcelScript.Workbook, log: CellValue[][]) {
  const header = ["Timestamp", "Code", "Field", "Old Value", "New Value", "Change Type", "Exported", "BatchId"];
  let sheet = workbook.getWorksheet("ChangeLog");
  if (!sheet) sheet = workbook.addWorksheet("ChangeLog");

  const used = sheet.getUsedRange(true);
  let nextRow = 0;
  if (!used) {
    sheet.getRangeByIndexes(0, 0, 1, header.length).setValues([header]);
    nextRow = 1;
  } else {
    nextRow = used.getRowIndex() + used.getRowCount();
    const current = sheet.getRange("G1:H1").getValues()[0];
    if (String(current[0] ?? "").trim() === "" && String(current[1] ?? "").trim() === "") {
      sheet.getRange("G1:H1").setValues([["Exported", "BatchId"]]);
    }
  }

  if (log.length > 0) {
    sheet.getRangeByIndexes(nextRow, 0, log.length, header.length).setValues(log);
  }
}
