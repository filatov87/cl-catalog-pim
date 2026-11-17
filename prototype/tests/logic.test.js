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

test("edit levels: prices admin-only, launch read-only, catalog fields editable", () => {
  const lvl = (k) => L.editLevel(F.find(f => f.k === k));
  assert.equal(lvl("fin_price2"), "admin");
  assert.equal(lvl("launch"), "none");
  assert.equal(lvl("sampleid"), "editor");
  assert.equal(lvl("publish"), "editor");
  assert.equal(lvl("govcode"), "admin");
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
