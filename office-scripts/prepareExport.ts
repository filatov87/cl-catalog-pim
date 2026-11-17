// Prepare Export: Catalog -> Export (исправленная версия, 2026-11-16)
//
// Что изменилось:
// - Названия из справочника переводятся в ID строго. Если название не найдено
//   или встречается в Dictionary дважды с разными ID, выгрузка останавливается
//   со списком проблем, а не отправляет текст вместо ID.
// - "NULL" превращается в пустую ячейку.
// - govcode пишется как текст (иначе Excel склеивает "40174,40161" в число).
// - Лист читается с A1 независимо от used range.

type CellValue = string | number | boolean;

const TEXT_FIELDS = ["code", "govcode", "loinccode", "launch", "template_code"];

function main(workbook: ExcelScript.Workbook) {
  const catalogData = readAll(requireSheet(workbook, "Catalog"));
  const dictionaryData = readAll(requireSheet(workbook, "Dictionary"));
  const schemaData = readAll(requireSheet(workbook, "Schema"));

  if (catalogData.length < 3) throw new Error("Catalog is empty");

  // ---------- Schema ----------
  const dictionaryFields = new Set<string>();
  const exportFields = new Set<string>();
  for (let r = 1; r < schemaData.length; r++) {
    const field = String(schemaData[r][0] ?? "").trim();
    if (!field) continue;
    if (String(schemaData[r][2] ?? "").trim().toUpperCase() === "YES") dictionaryFields.add(field);
    if (String(schemaData[r][4] ?? "").trim().toUpperCase() === "YES") exportFields.add(field);
  }

  // ---------- Reverse dictionary: field|display -> id ----------
  const reverseMap: Record<string, string> = {};
  const ambiguous = new Set<string>();
  for (let r = 1; r < dictionaryData.length; r++) {
    const field = String(dictionaryData[r][0] ?? "").trim();
    const dbValue = String(dictionaryData[r][1] ?? "").trim();
    const display = String(dictionaryData[r][2] ?? "").trim();
    if (!field || !dbValue || !display) continue;
    const key = field + "|" + display;
    if (reverseMap[key] !== undefined && reverseMap[key] !== dbValue) ambiguous.add(key);
    reverseMap[key] = dbValue;
  }

  // ---------- Columns ----------
  const technicalHeaders = catalogData[1].map(v => String(v ?? "").trim());
  const codeCol = technicalHeaders.indexOf("code");
  if (codeCol < 0) throw new Error("Column 'code' not found in Catalog (row 2)");

  const exportColumns: number[] = [];
  const exportHeaders: string[] = [];
  for (let c = 0; c < technicalHeaders.length; c++) {
    if (exportFields.has(technicalHeaders[c]) && exportHeaders.indexOf(technicalHeaders[c]) < 0) {
      exportColumns.push(c);
      exportHeaders.push(technicalHeaders[c]);
    }
  }

  // ---------- Rows ----------
  const errors: string[] = [];
  const exportData: CellValue[][] = [exportHeaders];

  for (let r = 2; r < catalogData.length; r++) {
    const code = String(catalogData[r][codeCol] ?? "").trim();
    if (!code) continue;

    const row: CellValue[] = [];
    for (let i = 0; i < exportColumns.length; i++) {
      const field = exportHeaders[i];
      let value = catalogData[r][exportColumns[i]];
      const text = String(value ?? "").trim();

      if (text === "" || text.toUpperCase() === "NULL") {
        value = "";
      } else if (dictionaryFields.has(field)) {
        const key = field + "|" + text;
        if (/^-?\d+$/.test(text)) {
          value = text; // уже ID
        } else if (ambiguous.has(key)) {
          errors.push(`${code}: '${text}' in ${field} has several IDs in Dictionary`);
        } else if (reverseMap[key] === undefined) {
          errors.push(`${code}: '${text}' in ${field} not found in Dictionary`);
        } else {
          value = reverseMap[key];
        }
      }
      row.push(value);
    }
    exportData.push(row);
  }

  if (errors.length > 0) {
    const shown = errors.slice(0, 25).join("\n");
    const more = errors.length > 25 ? `\n...and ${errors.length - 25} more` : "";
    throw new Error(`Export stopped, Export sheet NOT changed:\n${shown}${more}`);
  }

  // ---------- Write ----------
  let exportSheet = workbook.getWorksheet("Export");
  if (!exportSheet) exportSheet = workbook.addWorksheet("Export");
  exportSheet.getUsedRange()?.clear();

  for (const f of TEXT_FIELDS) {
    const c = exportHeaders.indexOf(f);
    if (c >= 0) {
      exportSheet.getRangeByIndexes(0, c, exportData.length, 1)
        .setNumberFormatLocal(exportData.map(() => ["@"]));
    }
  }
  exportSheet.getRangeByIndexes(0, 0, exportData.length, exportHeaders.length).setValues(exportData);

  const actions = workbook.getWorksheet("Actions");
  if (actions) {
    actions.getRange("E8").setValue(new Date().toISOString());
    actions.getRange("E9").setValue(exportData.length - 1);
  }

  console.log(`PrepareExport completed. Rows: ${exportData.length - 1}`);
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
