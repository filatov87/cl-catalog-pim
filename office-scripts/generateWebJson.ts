// Generate WEB JSON (исправленная версия, 2026-11-16)
//
// Что изменилось:
// - Цены по правилу, а не по Schema:
//     обычный тест (publish = TRUE/YES): только fin_price2
//     AKC (publish = AKC):               fin_price2 + fin_cost1
//   fin_cost2 и fin_price1 на сайт не уходят никогда.
// - AKC собираются в отдельный массив "promotions". Пока INCLUDE_AKC = false, его нет в JSON.
// - "NULL" превращается в "" (как остальные пустые поля сейчас).

type CellValue = string | number | boolean;

const INCLUDE_AKC = false; // включить, когда раздел акций на сайте будет готов
const PRICE_FIELDS = ["fin_cost1", "fin_cost2", "fin_price1", "fin_price2"];
const PRICES_REGULAR = ["fin_price2"];
const PRICES_AKC = ["fin_price2", "fin_cost1"];

function main(workbook: ExcelScript.Workbook) {
  const catalogData = readAll(requireSheet(workbook, "Catalog"));
  const schemaData = readAll(requireSheet(workbook, "Schema"));
  if (catalogData.length < 3) throw new Error("Catalog is empty");

  const headers = catalogData[1].map(v => String(v ?? "").trim());
  const headerMap: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] && headerMap[headers[i]] === undefined) headerMap[headers[i]] = i;
  }
  const publishCol = headerMap["publish"];
  if (publishCol === undefined) throw new Error("'publish' column not found in Catalog (row 2)");

  // Поля сайта из Schema; цены добавляются по правилу ниже
  const webFields: string[] = [];
  const missing: string[] = [];
  for (let r = 1; r < schemaData.length; r++) {
    const field = String(schemaData[r][0] ?? "").trim();
    if (!field || String(schemaData[r][3] ?? "").trim().toUpperCase() !== "YES") continue;
    if (PRICE_FIELDS.indexOf(field) >= 0) continue;
    if (headerMap[field] === undefined) { missing.push(field); continue; }
    if (webFields.indexOf(field) < 0) webFields.push(field);
  }
  if (missing.length > 0) console.log("Schema fields not found in Catalog: " + missing.join(", "));

  const tests: Record<string, CellValue>[] = [];
  const promotions: Record<string, CellValue>[] = [];

  for (let r = 2; r < catalogData.length; r++) {
    const row = catalogData[r];
    if (!String(row[headerMap["code"]] ?? "").trim()) continue;

    const publish = String(row[publishCol] ?? "").trim().toUpperCase();
    const isRegular = publish === "TRUE" || publish === "YES";
    const isAkc = publish === "AKC";
    if (!isRegular && !(isAkc && INCLUDE_AKC)) continue;

    const record: Record<string, CellValue> = {};
    for (const field of webFields) record[field] = clean(row[headerMap[field]]);
    for (const field of (isAkc ? PRICES_AKC : PRICES_REGULAR)) {
      if (headerMap[field] !== undefined) record[field] = clean(row[headerMap[field]]);
    }

    if (isAkc) promotions.push(record); else tests.push(record);
  }

  const output: Record<string, Record<string, CellValue>[]> = { tests: tests };
  if (INCLUDE_AKC) output["promotions"] = promotions;

  const json = JSON.stringify(output, null, 2);
  let sheet = workbook.getWorksheet("Export_Web");
  if (!sheet) sheet = workbook.addWorksheet("Export_Web");
  sheet.getUsedRange()?.clear();
  const lines = json.split("\n").map(l => [l]);
  sheet.getRangeByIndexes(0, 0, lines.length, 1).setValues(lines);

  console.log(`Website JSON generated. Tests: ${tests.length}` + (INCLUDE_AKC ? `, promotions: ${promotions.length}` : ""));
}

function clean(v: CellValue): CellValue {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" && v.trim().toUpperCase() === "NULL") return "";
  return v;
}

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
