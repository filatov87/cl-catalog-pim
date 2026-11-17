// CatalogV2: отчёт по секциям с проверкой веб-контента (исправленная версия, 2026-11-16)
//
// Старая версия искала колонки по бизнес-названиям (row 1), а индекс строила по
// техническим (row 2), поэтому колонки были пустыми и предупреждения не срабатывали.
// Теперь всё по техническим именам. Жёлтым подсвечиваются опубликованные тесты
// (publish = TRUE/YES), у которых не заполнено хотя бы одно поле из REQUIRED_FIELDS.

type CellValue = string | number | boolean;

const REQUIRED_FIELDS = ["codename", "title", "longDescription", "analizes-meta-apraksts", "analizes-meta-virsraksts"];

const COLUMNS: { title: string; field: string }[] = [
  { title: "Code", field: "code" },
  { title: "Test Name", field: "name" },
  { title: "Section Group", field: "sectiono" },
  { title: "Material", field: "sampleid" },
  { title: "Price", field: "fin_price2" },
  { title: "Veterinary", field: "Veterinary" },
  { title: "Publish", field: "publish" },
  { title: "Referent", field: "Referents" },
  { title: "SEO URL", field: "codename" },
  { title: "Website Name", field: "title" },
];

function main(workbook: ExcelScript.Workbook) {
  const source = workbook.getWorksheet("Catalog");
  if (!source) throw new Error("Catalog sheet not found");
  const used = source.getUsedRange(true);
  if (!used) throw new Error("Catalog is empty");
  const data = source.getRangeByIndexes(0, 0, used.getRowIndex() + used.getRowCount(),
    used.getColumnIndex() + used.getColumnCount()).getValues() as CellValue[][];

  const idx: Record<string, number> = {};
  data[1].forEach((h, i) => { const k = String(h ?? "").trim(); if (k && idx[k] === undefined) idx[k] = i; });

  const missingCols = COLUMNS.map(c => c.field).concat(REQUIRED_FIELDS).filter(f => idx[f] === undefined);
  if (missingCols.length > 0) throw new Error("Columns not found in Catalog row 2: " + missingCols.join(", "));

  type RowInfo = { section: string; values: CellValue[]; missing: string[] };
  const rows: RowInfo[] = [];

  for (let r = 2; r < data.length; r++) {
    const row = data[r];
    if (!String(row[idx["code"]] ?? "").trim()) continue;

    const publish = String(row[idx["publish"]] ?? "").trim().toUpperCase();
    const missing: string[] = [];
    if (publish === "TRUE" || publish === "YES") {
      for (const f of REQUIRED_FIELDS) {
        const v = String(row[idx[f]] ?? "").trim();
        if (v === "" || v.toUpperCase() === "NULL") missing.push(f);
      }
    }

    rows.push({
      section: String(row[idx["sectionid"]] ?? "").trim(),
      values: COLUMNS.map(c => row[idx[c.field]] ?? ""),
      missing: missing,
    });
  }

  rows.sort((a, b) => a.section.localeCompare(b.section));

  const width = COLUMNS.length + 2;
  const output: CellValue[][] = [["Type"].concat(COLUMNS.map(c => c.title)).concat(["Missing web content"])];
  const sectionRows: number[] = [];
  const warningRows: number[] = [];
  let current = "\u0000";

  for (const row of rows) {
    if (row.section !== current) {
      current = row.section;
      sectionRows.push(output.length);
      const line: CellValue[] = Array(width).fill("") as CellValue[];
      line[0] = "SECTION";
      line[2] = current || "(no section)";
      output.push(line);
    }
    if (row.missing.length > 0) warningRows.push(output.length);
    output.push((["TEST"] as CellValue[]).concat(row.values).concat([row.missing.join(", ")]));
  }

  let target = workbook.getWorksheet("CatalogV2");
  if (!target) target = workbook.addWorksheet("CatalogV2");
  target.getUsedRange()?.clear();
  target.getRangeByIndexes(0, 0, output.length, width).setValues(output);

  const header = target.getRangeByIndexes(0, 0, 1, width).getFormat();
  header.getFont().setBold(true);
  header.getFont().setColor("white");
  header.getFill().setColor("#4472C4");

  for (const r of sectionRows) {
    const f = target.getRangeByIndexes(r, 0, 1, width).getFormat();
    f.getFill().setColor("#D9EAD3");
    f.getFont().setBold(true);
  }
  for (const r of warningRows) {
    target.getRangeByIndexes(r, 0, 1, width).getFormat().getFill().setColor("#FFF2CC");
  }

  target.getFreezePanes().freezeRows(1);
  target.getUsedRange()?.getFormat().autofitColumns();

  console.log(`CatalogV2 generated. Tests: ${rows.length}, published with missing content: ${warningRows.length}`);
}
