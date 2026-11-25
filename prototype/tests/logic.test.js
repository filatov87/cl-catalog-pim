// Tests for prototype/logic.js — run with: node --test prototype/tests
// Uses only the synthetic sample (seed.sample.json); no real catalog data.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const L = require("../logic.js");

const sample = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "seed.sample.json"), "utf8"));
const F = L.DEFAULT_FIELDS;
const S = L.DEFAULT_SETTINGS;
const fresh = () => new Map(sample.tests.map(t => [t.code, JSON.parse(JSON.stringify(t))]));
const IMPORT_FIELDS = ["code", "name", "active", "catalog", "sampleid", "fin_price2"];

// A SmartLIS export of the current state (header + one row per active test)
function exportRows(tests, edit = {}) {
  const rows = [IMPORT_FIELDS];
  for (const t of tests.values()) {
    if (t.meta && t.meta.missing) continue;
    const row = IMPORT_FIELDS.map(k => (k === "code" ? t.code : t.sl[k] === null || t.sl[k] === undefined ? "NULL" : String(t.sl[k])));
    const e = edit[t.code] || {};
    for (const k of Object.keys(e)) row[IMPORT_FIELDS.indexOf(k)] = e[k];
    rows.push(row);
  }
  return rows;
}
const apply = (tests, plan) => { for (const [code, p] of Object.entries(plan.patches)) tests.set(code, L.applyPatch(tests.get(code) || { code }, p)); };

test("norm treats NULL, empty and null alike; numbers and booleans normalised", () => {
  assert.equal(L.norm(null), "");
  assert.equal(L.norm("NULL"), "");
  assert.equal(L.norm(" "), "");
  assert.equal(L.norm("5.50"), "5.5");
  assert.equal(L.norm(true), "TRUE");
  assert.equal(L.norm("true"), "TRUE");
});

test("clean sample has nothing to send to SmartLIS", () => {
  assert.equal(L.planExport(fresh(), F, S).tests.length, 0);
});

test("web JSON: published tests only, regular tests get only fin_price2", () => {
  const tests = fresh();
  const web = L.buildWebJson(tests, F, sample.dicts, S);
  assert.ok(web.tests.length > 0);
  assert.equal(web.promotions, undefined);
  for (const r of web.tests) {
    assert.deepEqual(Object.keys(r).filter(k => k.startsWith("fin_")), ["fin_price2"]);
    assert.equal(tests.get(r.code).val.publish, "TRUE");
  }
});

test("web JSON: AKC go to promotions with fin_cost1 when enabled", () => {
  const tests = fresh();
  const akc = [...tests.values()].find(t => t.val.publish === "AKC");
  assert.ok(akc, "sample contains an AKC test");
  const web = L.buildWebJson(tests, F, sample.dicts, { ...S, includeAkc: true });
  const p = web.promotions.find(r => r.code === akc.code);
  assert.ok(p);
  assert.ok("fin_cost1" in p && "fin_price2" in p);
});

test("CSV not in UTF-8 is rejected", () => {
  assert.ok(L.decodeUtf8(Uint8Array.from([0x41, 0x9a, 0x42])).error);
  assert.equal(L.decodeUtf8(Buffer.from("Āboli", "utf8")).text, "Āboli");
});

test("parseCsv: delimiter detection and quotes", () => {
  const rows = L.parseCsv('code;name\r\nA;"x; ""y"""\r\n');
  assert.deepEqual(rows, [["code", "name"], ["A", 'x; "y"']]);
});

test("import: SmartLIS change of an unedited field is taken", () => {
  const tests = fresh();
  const plan = L.planImport(exportRows(tests, { ALT: { sampleid: "4" } }), tests, F, sample.dicts, S);
  assert.deepEqual(plan.errors, []);
  assert.ok(plan.changes.some(c => c.code === "ALT" && c.f === "sampleid"));
  apply(tests, plan);
  assert.equal(L.cv(tests.get("ALT"), "sampleid"), 4);
});

test("import: catalog edit + different SmartLIS change = conflict, nothing overwritten", () => {
  const tests = fresh();
  const t = tests.get("ACE"); t.val.sampleid = 7;           // catalog edit
  const plan = L.planImport(exportRows(tests, { ACE: { sampleid: "10" } }), tests, F, sample.dicts, S);
  assert.ok(plan.conflicts.some(c => c.code === "ACE" && c.f === "sampleid"));
  apply(tests, plan);
  assert.equal(tests.get("ACE").val.sampleid, 7);
  assert.ok(!L.planExport(tests, F, S).tests.some(r => r.code === "ACE"), "conflicts are not exported");
});

test("export then confirmation: pending edit disappears once SmartLIS shows the same value", () => {
  const tests = fresh();
  tests.get("ACP").val.catalog = !tests.get("ACP").sl.catalog;
  const want = tests.get("ACP").val.catalog;
  const ex = L.planExport(tests, F, S);
  assert.ok(ex.tests.some(r => r.code === "ACP" && r.catalog === want));
  tests.get("ACP").meta.lastExport = { id: "b1" };
  const plan = L.planImport(exportRows(tests, { ACP: { catalog: String(want).toUpperCase() } }), tests, F, sample.dicts, S);
  assert.ok(plan.converged.some(c => c.code === "ACP"));
  apply(tests, plan);
  assert.ok(!L.planExport(tests, F, S).tests.some(r => r.code === "ACP"));
  assert.equal(tests.get("ACP").meta.lastExport, null);
});

test("import: new, missing and inactive tests", () => {
  const tests = fresh();
  const rows = exportRows(tests);
  rows.push(["NEWTEST", "Jauns tests", "TRUE", "FALSE", "8", "1.5"]);
  rows.push(["OLDTEST", "Neaktīvs", "FALSE", "FALSE", "8", "1.5"]);
  const gone = rows.splice(1, 1)[0][0];                     // first test disappears from SmartLIS
  const plan = L.planImport(rows, tests, F, sample.dicts, S);
  assert.deepEqual(plan.newTests, ["NEWTEST"]);
  assert.equal(plan.skippedInactive, 1);
  assert.ok(plan.missing.includes(gone));
});

test("import: shifted columns are blocked by the mass-clear guard", () => {
  const tests = fresh();
  const rows = exportRows(tests).map((r, i) => (i === 0 ? r : [r[0], r[1], r[2], "NULL", "NULL", r[5]]));
  const plan = L.planImport(rows, tests, F, sample.dicts, { ...S, clearMin: 3 });
  assert.ok(plan.massCleared.length > 0);
});

test("import: duplicate codes and missing code column are errors", () => {
  const tests = fresh();
  const rows = exportRows(tests); rows.push(rows[1]);
  assert.ok(L.planImport(rows, tests, F, sample.dicts, S).errors.some(e => e.includes("дважды")));
  assert.ok(L.planImport([["name"], ["x"]], tests, F, sample.dicts, S).errors.length);
});

test("edit levels (25.11): SmartLIS fields and prices — business, launch read-only, site texts — marketing", () => {
  const lvl = (k) => L.editLevel(F.find(f => f.k === k));
  assert.equal(lvl("fin_price2"), "business");
  assert.equal(lvl("launch"), "none");
  assert.equal(lvl("sampleid"), "business");
  assert.equal(lvl("publish"), "business");
  assert.equal(lvl("govcode"), "business");
  assert.equal(lvl("codename"), "marketing");
});

test("edited SmartLIS price is exported; SmartLIS-only change of an unedited price overwrites", () => {
  const tests = fresh();
  const t = tests.get("ALT"); t.base.fin_price2 = t.sl.fin_price2; t.val.fin_price2 = 99;
  assert.ok(L.planExport(tests, F, S).tests.some(r => r.code === "ALT" && r.fin_price2 === 99));
  const plan = L.planImport(exportRows(tests, { ALT: { fin_price2: "7" }, AST: { fin_price2: "1.23" } }), tests, F, sample.dicts, S);
  assert.ok(plan.conflicts.some(c => c.code === "ALT" && c.f === "fin_price2"));
  assert.ok(plan.changes.some(c => c.code === "AST" && c.f === "fin_price2" && c.kind === "smartlis"));
});

test("checks run on the sample without errors", () => {
  const tests = fresh();
  for (const c of L.CHECKS) for (const t of tests.values()) c.fn(t, F);
  assert.ok(Array.isArray(L.dictDuplicates(sample.dicts)));
});

/* ---- SSoT v2 (24.11.2026): RU/EN translations and media ---- */
function sheetsV2() {
  const tech = ["code", "name", "catalog", "sampleid", "publish ", "codename", "title", "longDescription", null, "longDescription_ru", "description1_ru", "longDescription_en", "media1", "media2", "media3"];
  const biz = tech.map(h => h || "Dzīvnieka suga VET analīzēm");
  return {
    Catalog: [biz, tech,
      ["T1", "Tests 1", true, "NULL", true, "t1", "Tests 1", "LV teksts", null, "RU текст", null, null, "https://example.com/a.jpg", null, null],
      ["T2", "Tests 2", false, "NULL", false, null, null, null, "Suns; Kaķis", null, null, null, "ftp://bad", null, null],
      ["T2", "Tests 2", false, "NULL", true, "t2", "Tests 2", "LV 2", null, "RU 2", null, "EN 2", null, null, null]],
    Dictionary: [["field", "db_value", "display_value"]],
  };
}

test("mergeFields keeps the stored registry and adds new default fields in place", () => {
  const stored = F.filter(f => !/_ru$|_en$|^media/.test(f.k)).map(f => ({ ...f, e: f.k === "title" ? "admin" : f.e }));
  const m = L.mergeFields(stored, F);
  assert.equal(m.length, F.length);
  assert.equal(m.find(f => f.k === "title").e, "admin", "stored setting is kept");
  assert.deepEqual(m.map(f => f.k), F.map(f => f.k), "new fields land at their default place");
});

test("Excel v2: translations and media are read, duplicate row with more content wins", () => {
  const r = L.buildFromExcel(sheetsV2(), F);
  assert.equal(r.errors.length, 0);
  assert.equal(r.tests.length, 2);
  const t1 = r.tests.find(t => t.code === "T1"), t2 = r.tests.find(t => t.code === "T2");
  assert.equal(t1.val.longDescription_ru, "RU текст");
  assert.equal(t1.val.media1, "https://example.com/a.jpg");
  assert.equal(t2.val.publish, "TRUE", "the richer duplicate row is used");
  assert.equal(t2.val.longDescription_en, "EN 2");
  assert.ok(r.warnings.some(w => w.includes("T2") && w.includes("дважды")));
});

test("missing translations and bad media links are reported; site JSON carries _ru/_en and media", () => {
  const r = L.buildFromExcel(sheetsV2(), F);
  const tests = new Map(r.tests.map(t => [t.code, t]));
  const t1 = tests.get("T1");
  assert.ok(L.missingTranslations(t1, F).includes("longDescription_en"));
  assert.ok(!L.missingTranslations(t1, F).includes("longDescription_ru"));
  const chk = (id) => L.CHECKS.find(c => c.id === id);
  assert.equal(chk("translation-missing").fn(t1, F), true);
  t1.val.media2 = "ftp://bad";
  assert.equal(chk("media-bad").fn(t1, F), true);
  const web = L.buildWebJson(tests, F, r.dicts, S);
  const rec = web.tests.find(x => x.code === "T1");
  assert.equal(rec.longDescription_ru, "RU текст");
  assert.equal(rec.media1, "https://example.com/a.jpg");
  assert.equal(rec.longDescription_en, "");
});

/* ---- Column filters and sorting (24.11.2026) ---- */
test("column filters: text contains / not contains / empty, numbers, choices", () => {
  const dicts = { sectionid: [[5, "Klīniskā ķīmija"], [4, "Hematoloģija"]] };
  const t = { code: "ALT", sl: { name: "Alanīnaminotransferāze", sectionid: 5, fin_price2: 3.3, catalog: true, timesolve: null }, val: { publish: "AKC" } };
  const fm = L.fieldMap(F);
  assert.equal(L.matchCol(t, fm.name, "amino", dicts), true);
  assert.equal(L.matchCol(t, fm.name, "!amino", dicts), false);
  assert.equal(L.matchCol(t, L.CODE_FIELD, "al", dicts), true);
  assert.equal(L.matchCol(t, fm.sectionid, "5", dicts), true, "dictionary columns filter by the chosen id");
  assert.equal(L.matchCol(t, fm.fin_price2, ">3", dicts), true);
  assert.equal(L.matchCol(t, fm.fin_price2, "1–3", dicts), false);
  assert.equal(L.matchCol(t, fm.fin_price2, "3,3", dicts), true);
  assert.equal(L.matchCol(t, fm.fin_price2, ">", dicts), true, "unfinished number filter does not hide rows");
  assert.equal(L.matchCol(t, fm.timesolve, "=", dicts), true);
  assert.equal(L.matchCol(t, fm.timesolve, "!=", dicts), false);
  assert.equal(L.matchCol(t, fm.publish, "AKC", dicts), true);
  assert.equal(L.matchCol(t, fm.catalog, "FALSE", dicts), false);
  assert.equal(L.matchCol(t, fm.catalog, "EMPTY", dicts), false);
});

test("column sort: numbers numerically, text by Latvian alphabet, empty values last in both directions", () => {
  const fm = L.fieldMap(F);
  const mk = (code, name, p) => ({ code, sl: { name, fin_price2: p }, val: {} });
  const list = [mk("A", "Čūska", 10), mk("B", "Cits", 9.5), mk("C", "", null), mk("D", "Zeta", 100)];
  const codes = (k, dir) => list.slice().sort(L.compareBy(fm[k], dir, {})).map(t => t.code).join("");
  assert.equal(codes("fin_price2", 1), "BADC");
  assert.equal(codes("fin_price2", -1), "DABC");
  assert.equal(codes("name", 1), "BADC", "C before Č in Latvian order");
  assert.equal(codes("name", -1), "DABC");
});

/* ---- Roles by AD groups and price protection (25.11.2026) ---- */
test("field rights by role: business edits SmartLIS fields, prices, publish, Veterinary; marketing edits site texts", () => {
  const fm = L.fieldMap(F);
  const can = (k, r) => L.canEditWith(k === "code" ? L.CODE_FIELD : fm[k], [r]);
  for (const k of ["name", "sampleid", "catalog", "fin_price2", "publish", "Veterinary"]) { assert.equal(can(k, "business"), true, k); assert.equal(can(k, "marketing"), false, k); }
  for (const k of ["title", "longDescription", "longDescription_ru", "description2_en", "media1", "animalSpecies", "Referents", "metaTitle"]) { assert.equal(can(k, "marketing"), true, k); assert.equal(can(k, "business"), false, k); }
  for (const k of ["launch", "template", "code"]) assert.equal(can(k, "admin"), false, `${k}: nobody`);
  assert.equal(can("fin_price2", "admin"), true);
  assert.equal(can("title", "viewer"), false);
  assert.equal(L.canEditWith(fm.title, ["business", "marketing"]), true, "several groups add up");
});

test("actions by role", () => {
  assert.equal(L.canDoWith("import", ["business"]), true);
  assert.equal(L.canDoWith("export", ["marketing"]), false);
  assert.equal(L.canDoWith("web", ["marketing"]), true);
  assert.equal(L.canDoWith("settings", ["business"]), false);
  assert.equal(L.canDoWith("settings", ["admin"]), true);
});

test("registry saved before 25.11 (editor/admin levels) moves to role defaults", () => {
  const old = F.map(f => ({ ...f, e: f.e === "none" ? "none" : f.price ? "admin" : "editor" }));
  const m = L.mergeFields(old, F);
  assert.equal(m.find(f => f.k === "fin_price2").e, "business");
  assert.equal(m.find(f => f.k === "title").e, "marketing");
  const fresh = L.mergeFields(F.map(f => ({ ...f, e: f.k === "title" ? "admin" : f.e })), F);
  assert.equal(fresh.find(f => f.k === "title").e, "admin", "a level set by an administrator is kept");
});

test("price changes are listed with relative change; big jumps flagged", () => {
  const t = { code: "ALT", sl: { fin_price2: 10, fin_price1: null }, val: {} };
  const rows = L.priceChanges(t, { fin_price2: 11, fin_price1: 5, name: "x" }, F, S);
  assert.equal(rows.length, 2);
  const p2 = rows.find(r => r.f === "fin_price2");
  assert.ok(Math.abs(p2.rel - 0.1) < 1e-9); assert.equal(p2.jump, false);
  assert.equal(rows.find(r => r.f === "fin_price1").jump, true, "no previous price → flagged");
  assert.equal(L.priceChanges(t, { fin_price2: 20 }, F, S)[0].jump, true);
  assert.equal(L.priceChanges(t, { fin_price2: 10 }, F, S).length, 0);
});
