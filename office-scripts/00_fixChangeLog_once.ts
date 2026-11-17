// ОДНОРАЗОВЫЙ скрипт. Запустить один раз, потом удалить.
// 1) Добавляет в ChangeLog колонки G "Exported" и H "BatchId".
// 2) Строки, где в Timestamp записан batchId (например 20261028090107),
//    получают: Timestamp = время выгрузки в ISO, Exported = YES, BatchId = этот номер.
// 3) Все остальные существующие строки помечаются Exported = YES, BatchId = PRE_FIX
//    (это изменения, пришедшие из SmartLIS, отправлять их обратно не нужно).

function main(workbook: ExcelScript.Workbook) {
  const sheet = workbook.getWorksheet("ChangeLog");
  if (!sheet) {
    throw new Error("ChangeLog sheet not found");
  }

  const used = sheet.getUsedRange(true);
  if (!used) {
    throw new Error("ChangeLog is empty");
  }

  const rowCount = used.getRowIndex() + used.getRowCount();
  const data = sheet.getRangeByIndexes(0, 0, rowCount, 8).getValues();

  const header = data[0].map(v => String(v ?? "").trim());
  if (header[0] !== "Timestamp" || header[1] !== "Code" || header[2] !== "Field") {
    throw new Error("Unexpected ChangeLog header: " + header.join(", "));
  }
  if (header[6] === "Exported" && header[7] === "BatchId") {
    throw new Error("ChangeLog already has Exported/BatchId columns. Nothing to do.");
  }
  if (header[6] !== "" || header[7] !== "") {
    throw new Error("Columns G/H are not empty: " + header[6] + " / " + header[7]);
  }

  const colA: (string | number | boolean)[][] = [];
  const colGH: (string | number | boolean)[][] = [];
  let repaired = 0;

  for (let r = 1; r < data.length; r++) {
    const a = data[r][0];
    const aText = String(a ?? "").trim();

    if (/^\d{14}$/.test(aText)) {
      // batchId вида YYYYMMDDHHMMSS -> ISO
      const iso =
        aText.substring(0, 4) + "-" + aText.substring(4, 6) + "-" + aText.substring(6, 8) +
        "T" + aText.substring(8, 10) + ":" + aText.substring(10, 12) + ":" + aText.substring(12, 14) + "Z";
      colA.push([iso]);
      colGH.push(["YES", aText]);
      repaired++;
    } else {
      colA.push([a]);
      colGH.push(["YES", "PRE_FIX"]);
    }
  }

  sheet.getRange("G1:H1").setValues([["Exported", "BatchId"]]);

  if (colA.length > 0) {
    // BatchId храним как текст, чтобы Excel не превратил его в число 2,03E+13
    sheet.getRangeByIndexes(1, 7, colGH.length, 1).setNumberFormatLocal(colGH.map(() => ["@"]));
    sheet.getRangeByIndexes(1, 0, colA.length, 1).setValues(colA);
    sheet.getRangeByIndexes(1, 6, colGH.length, 2).setValues(colGH);
  }

  console.log(`ChangeLog fixed. Rows: ${colA.length}, timestamps repaired: ${repaired}`);
}
