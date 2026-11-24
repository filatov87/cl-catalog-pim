/* ===== CL Testu katalogs — pure logic (no DOM). Shared by the page and by tests. ===== */

const OWNER_LABEL = { smartlis: "SmartLIS", catalog: "Каталог" };
const EDIT_LABEL = { none: "Никто", editor: "Редактор", admin: "Администратор" };

// k: technical key, l: label, o: owner, t: type, web: goes to site JSON, jk: key in site JSON,
// req: required value (no empty), wreq: required for published tests, price: price field
// g: group — smartlis | price | catalog | web (LV) | web_ru | web_en | media; tr: LV field this one translates
const DEFAULT_FIELDS = [
  { k: "name", l: "Testa nosaukums", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "editor" },
  { k: "launch", l: "Launch (sastāvs)", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "none" },
  { k: "loinccode", l: "LOINC", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "admin" },
  { k: "active", l: "Aktīvs", g: "smartlis", o: "smartlis", t: "bool", web: 1, e: "admin" },
  { k: "labcode", l: "Laboratorijas kods", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "admin" },
  { k: "testtype", l: "Testa tips", g: "smartlis", o: "smartlis", t: "dict", web: 1, e: "admin" },
  { k: "govcode", l: "NVD kods", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "admin" },
  { k: "paytype", l: "Apmaksa", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "admin" },
  { k: "order", l: "Pasūtāms", g: "smartlis", o: "smartlis", t: "bool", web: 1, e: "admin" },
  { k: "bill", l: "Rēķināms", g: "smartlis", o: "smartlis", t: "bool", web: 1, e: "admin" },
  { k: "report", l: "Pārskatā", g: "smartlis", o: "smartlis", t: "bool", web: 1, e: "admin" },
  { k: "catalog", l: "Katalogā (Catalog API)", g: "smartlis", o: "smartlis", t: "bool", req: 1, web: 1, e: "editor" },
  { k: "timesolve", l: "Izpildes laiks, dienas", g: "smartlis", o: "smartlis", t: "num", web: 1, e: "admin" },
  { k: "sectionid", l: "Sekcija", g: "smartlis", o: "smartlis", t: "dict", web: 1, e: "admin" },
  { k: "sectiono", l: "Sekciju grupa", g: "smartlis", o: "smartlis", t: "dict", web: 1, e: "admin" },
  { k: "sampleid", l: "Materiāls", g: "smartlis", o: "smartlis", t: "dict", web: 1, e: "editor" },
  { k: "fin_price2", l: "Pašreizējā cena, EUR", g: "price", o: "smartlis", t: "num", price: 1, e: "admin" },
  { k: "fin_price1", l: "NVD cena, EUR", g: "price", o: "smartlis", t: "num", price: 1, e: "admin" },
  { k: "fin_cost1", l: "Cena ar atlaidi, EUR", g: "price", o: "smartlis", t: "num", price: 1, e: "admin" },
  { k: "fin_cost2", l: "Vecā cena (vecie līgumi), EUR", g: "price", o: "smartlis", t: "num", price: 1, e: "admin" },
  { k: "template", l: "Šablona ID", g: "smartlis", o: "smartlis", t: "text", web: 1, e: "none" },
  { k: "template_code", l: "Sastāvdaļas (kodi)", g: "smartlis", o: "smartlis", t: "list", web: 1, e: "none" },
  { k: "template_name", l: "Sastāvdaļas (nosaukumi)", g: "smartlis", o: "smartlis", t: "list", web: 1, e: "none" },
  { k: "publish", l: "Publicēšana mājaslapā", g: "catalog", o: "catalog", t: "publish", web: 0, e: "editor" },
  { k: "Veterinary", l: "Veterinary", g: "catalog", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "animalSpecies", l: "Dzīvnieka suga (VET)", g: "catalog", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "Referents", l: "References intervāli", g: "catalog", o: "catalog", t: "long", web: 1, e: "editor" },
  { k: "codename", l: "SEO URL", g: "web", o: "catalog", t: "text", web: 1, wreq: 1, e: "editor" },
  { k: "title", l: "Nosaukums mājaslapā", g: "web", o: "catalog", t: "text", web: 1, wreq: 1, e: "editor" },
  { k: "longDescription", l: "Īsais apraksts", g: "web", o: "catalog", t: "long", web: 1, wreq: 1, e: "editor" },
  { k: "description1Title", l: "Izvēlne 1 — virsraksts", g: "web", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "description1", l: "Izvēlne 1 — teksts", g: "web", o: "catalog", t: "long", web: 1, e: "editor" },
  { k: "description2Title", l: "Izvēlne 2 — virsraksts", g: "web", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "description2", l: "Izvēlne 2 — teksts", g: "web", o: "catalog", t: "long", web: 1, e: "editor" },
  { k: "description3Title", l: "Izvēlne 3 — virsraksts", g: "web", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "description3", l: "Izvēlne 3 — teksts", g: "web", o: "catalog", t: "long", web: 1, e: "editor" },
  { k: "description4Title", l: "Izvēlne 4 — virsraksts", g: "web", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "description4", l: "Izvēlne 4 — garais teksts", g: "web", o: "catalog", t: "long", web: 1, e: "editor" },
  { k: "relatedLisInfo", l: "Saistītās analīzes (4 kodi)", g: "web", o: "catalog", t: "text", web: 1, e: "editor" },
  { k: "metaTitle", l: "Meta virsraksts", g: "web", o: "catalog", t: "text", web: 1, wreq: 1, jk: "analizes-meta-virsraksts", e: "editor" },
  { k: "metaDescription", l: "Meta apraksts", g: "web", o: "catalog", t: "long", web: 1, wreq: 1, jk: "analizes-meta-apraksts", e: "editor" },
  { k: "longDescription_ru", l: "RU · Īsais apraksts", g: "web_ru", o: "catalog", t: "long", web: 1, tr: "longDescription", e: "editor" },
  { k: "description1Title_ru", l: "RU · Izvēlne 1 — virsraksts", g: "web_ru", o: "catalog", t: "text", web: 1, tr: "description1Title", e: "editor" },
  { k: "description1_ru", l: "RU · Izvēlne 1 — teksts", g: "web_ru", o: "catalog", t: "long", web: 1, tr: "description1", e: "editor" },
  { k: "description2Title_ru", l: "RU · Izvēlne 2 — virsraksts", g: "web_ru", o: "catalog", t: "text", web: 1, tr: "description2Title", e: "editor" },
  { k: "description2_ru", l: "RU · Izvēlne 2 — teksts", g: "web_ru", o: "catalog", t: "long", web: 1, tr: "description2", e: "editor" },
  { k: "description3Title_ru", l: "RU · Izvēlne 3 — virsraksts", g: "web_ru", o: "catalog", t: "text", web: 1, tr: "description3Title", e: "editor" },
  { k: "description3_ru", l: "RU · Izvēlne 3 — teksts", g: "web_ru", o: "catalog", t: "long", web: 1, tr: "description3", e: "editor" },
  { k: "description4Title_ru", l: "RU · Izvēlne 4 — virsraksts", g: "web_ru", o: "catalog", t: "text", web: 1, tr: "description4Title", e: "editor" },
  { k: "description4_ru", l: "RU · Izvēlne 4 — garais teksts", g: "web_ru", o: "catalog", t: "long", web: 1, tr: "description4", e: "editor" },
  { k: "longDescription_en", l: "EN · Īsais apraksts", g: "web_en", o: "catalog", t: "long", web: 1, tr: "longDescription", e: "editor" },
  { k: "description1Title_en", l: "EN · Izvēlne 1 — virsraksts", g: "web_en", o: "catalog", t: "text", web: 1, tr: "description1Title", e: "editor" },
  { k: "description1_en", l: "EN · Izvēlne 1 — teksts", g: "web_en", o: "catalog", t: "long", web: 1, tr: "description1", e: "editor" },
  { k: "description2Title_en", l: "EN · Izvēlne 2 — virsraksts", g: "web_en", o: "catalog", t: "text", web: 1, tr: "description2Title", e: "editor" },
  { k: "description2_en", l: "EN · Izvēlne 2 — teksts", g: "web_en", o: "catalog", t: "long", web: 1, tr: "description2", e: "editor" },
  { k: "description3Title_en", l: "EN · Izvēlne 3 — virsraksts", g: "web_en", o: "catalog", t: "text", web: 1, tr: "description3Title", e: "editor" },
  { k: "description3_en", l: "EN · Izvēlne 3 — teksts", g: "web_en", o: "catalog", t: "long", web: 1, tr: "description3", e: "editor" },
  { k: "description4Title_en", l: "EN · Izvēlne 4 — virsraksts", g: "web_en", o: "catalog", t: "text", web: 1, tr: "description4Title", e: "editor" },
  { k: "description4_en", l: "EN · Izvēlne 4 — garais teksts", g: "web_en", o: "catalog", t: "long", web: 1, tr: "description4", e: "editor" },
  { k: "media1", l: "Attēls 1 (URL)", g: "media", o: "catalog", t: "url", web: 1, e: "editor" },
  { k: "media2", l: "Attēls 2 (URL)", g: "media", o: "catalog", t: "url", web: 1, e: "editor" },
  { k: "media3", l: "Attēls 3 (URL)", g: "media", o: "catalog", t: "url", web: 1, e: "editor" },
];

const BOOL_FIELDS = ["active", "order", "bill", "report", "catalog"];
const NUM_FIELDS = ["testtype", "sectionid", "sectiono", "sampleid", "timesolve", "fin_price1", "fin_price2", "fin_cost1", "fin_cost2"];
const PRICES_REGULAR = ["fin_price2"];
const PRICES_AKC = ["fin_price2", "fin_cost1"];
const DEFAULT_SETTINGS = { includeAkc: false, massLimit: 200, clearShare: 0.05, clearMin: 30 };
const CHUNKS = 32;
const HIST_CAP = 20;

// Field lives in SmartLIS ("both" is the old name for an editable SmartLIS field)
const isSl = (f) => f.o === "smartlis" || f.o === "both";
// Who may edit: none | editor | admin. Missing -> default registry -> legacy owner.
function editLevel(f) {
  if (f.e) return f.e;
  const d = DEFAULT_FIELDS.find(x => x.k === f.k);
  if (d && d.e) return d.e;
  return f.o === "smartlis" ? "none" : "editor";
}
// Site content groups: LV texts, translations, media
const isWebGroup = (f) => !!f && (f.g === "web" || f.g === "web_ru" || f.g === "web_en" || f.g === "media");
const LANGS = [["web_ru", "RU"], ["web_en", "EN"]];
// Registry stored in the database wins; defaults that appeared later (new SSoT columns) are added at their default place
function mergeFields(stored, defaults) {
  if (!Array.isArray(stored) || !stored.length) return defaults.map(f => ({ ...f }));
  const out = stored.map(f => ({ ...f }));
  const have = new Set(out.map(f => f.k));
  defaults.forEach((d, i) => {
    if (have.has(d.k)) { const f = out.find(x => x.k === d.k); for (const p of ["g", "tr", "t"]) if (f[p] === undefined && d[p] !== undefined) f[p] = d[p]; return; }
    let at = out.length;
    for (let j = i - 1; j >= 0; j--) { const idx = out.findIndex(x => x.k === defaults[j].k); if (idx >= 0) { at = idx + 1; break; } }
    out.splice(at, 0, { ...d }); have.add(d.k);
  });
  return out;
}
const hasOwn = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
// Current value of a field: catalog fields from val; SmartLIS fields from val if edited, else from SmartLIS
function cv(t, k) { return hasOwn(t.val, k) ? t.val[k] : (t.sl ? t.sl[k] : null); }

function fieldMap(fields) { const m = {}; for (const f of fields) m[f.k] = f; return m; }

// "NULL", "", spaces -> ""; booleans -> TRUE/FALSE; "5.50" -> "5.5"
function norm(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = String(v).trim();
  if (s === "" || s.toUpperCase() === "NULL") return "";
  const u = s.toUpperCase();
  if (u === "TRUE" || u === "FALSE") return u;
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s));
  return s;
}
const same = (a, b) => norm(a) === norm(b);
const isEmpty = (v) => norm(v) === "";

// Raw import cell -> typed value for field k
function parseCell(k, raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") {
    if (k === "govcode" || k === "labcode" || k === "loinccode" || k === "name" || k === "template_code") return String(raw);
    return raw;
  }
  const s = String(raw).trim();
  if (s === "" || s.toUpperCase() === "NULL") return null;
  if (BOOL_FIELDS.includes(k)) {
    const u = s.toUpperCase();
    if (["TRUE", "T", "1", "YES", "JĀ"].includes(u)) return true;
    if (["FALSE", "F", "0", "NO", "NĒ"].includes(u)) return false;
    return s;
  }
  if (NUM_FIELDS.includes(k)) {
    const n = Number(s.replace(",", "."));
    return isNaN(n) ? s : n;
  }
  return s;
}

function chunkOf(code) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "c" + String((h >>> 0) % CHUNKS).padStart(2, "0");
}

// Current value of a field for a test (owner decides where it lives)
function valueOf(t, f) {
  if (!f) return null;
  if (!isSl(f)) return t.val ? t.val[f.k] : null;
  return cv(t, f.k);
}

function conflictsOf(t) {
  const c = (t.meta && t.meta.conflicts) || {};
  const out = {};
  for (const k of Object.keys(c)) if (c[k]) out[k] = c[k];
  return out;
}

// Fields of a test whose catalog value is not yet in SmartLIS
function pendingFields(t, fields) {
  if (t.meta && t.meta.missing) return [];
  const conf = conflictsOf(t);
  return fields.filter(f => isSl(f) && hasOwn(t.val, f.k) && !conf[f.k] && !same(t.val[f.k], t.sl ? t.sl[f.k] : null)).map(f => f.k);
}

/* ---------- CSV ---------- */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const first = text.split(/\r?\n/, 1)[0];
  const delim = (first.split(";").length > first.split(",").length) ? ";" : ",";
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

// Strict UTF-8 decode; returns {text} or {error}
function decodeUtf8(buf) {
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf) }; }
  catch (e) { return { error: "Файл не в кодировке UTF-8: латышские буквы (ā, ē, ņ…) потеряются. Выгрузите CSV заново с кодировкой UTF-8." }; }
}

/* ---------- Import from SmartLIS ---------- */
// rows: array of arrays, first row = header. tests: Map code -> test. Returns a plan, nothing is changed.
function planImport(rows, tests, fields, dicts, settings) {
  const fm = fieldMap(fields);
  const plan = { errors: [], warnings: [], newTests: [], changes: [], conflicts: [], converged: [], missing: [], cleared: {}, byField: {}, unknownHeaders: [], absentFields: [], unknownIds: [], rowsCount: 0, patches: {} };
  if (!rows.length) { plan.errors.push("Файл пустой."); return plan; }
  const header = rows[0].map(h => String(h ?? "").trim());
  const ci = header.indexOf("code");
  if (ci < 0) { plan.errors.push("В первой строке нет колонки code. Вставьте выгрузку вместе со строкой заголовков."); return plan; }
  const importFields = fields.filter(f => isSl(f) && header.includes(f.k));
  plan.unknownHeaders = header.filter(h => h && h !== "code" && !fm[h]);
  plan.absentFields = fields.filter(f => isSl(f) && !header.includes(f.k)).map(f => f.k);
  const col = {}; header.forEach((h, i) => { if (h) col[h] = i; });

  const seen = new Set(); const incoming = new Map();
  let suspicious = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const code = String(row[ci] ?? "").trim();
    if (!code) continue;
    if (seen.has(code)) { plan.errors.push(`Код ${code} встречается в файле дважды.`); continue; }
    seen.add(code);
    const rec = {};
    for (const f of importFields) {
      const raw = row[col[f.k]];
      if (f.k === "govcode" && typeof raw === "number" && raw > 99999) plan.errors.push(`govcode у ${code} склеен Excel в число ${raw}. Сделайте колонку текстовой и выгрузите заново.`);
      rec[f.k] = parseCell(f.k, raw);
    }
    if (typeof rec.name === "string" && /[A-Za-z]\?[A-Za-z]/.test(rec.name)) suspicious++;
    if (rec.active === false) { plan.skippedInactive = (plan.skippedInactive || 0) + 1; continue; }
    incoming.set(code, rec);
  }
  plan.rowsCount = incoming.size;
  if (suspicious > 20) plan.errors.push(`У ${suspicious} тестов в названии «?» вместо букв: файл сохранён не в UTF-8.`);
  if (tests.size > 50 && incoming.size < tests.size * 0.5) plan.errors.push(`В файле ${incoming.size} тестов, а в каталоге ${tests.size}. Похоже, выгрузка неполная (например, только первая страница результатов).`);

  // dictionary ids check
  for (const f of importFields.filter(f => f.t === "dict")) {
    const known = new Set((dicts[f.k] || []).map(p => norm(p[0])));
    const unk = new Set();
    for (const rec of incoming.values()) if (!isEmpty(rec[f.k]) && !known.has(norm(rec[f.k]))) unk.add(norm(rec[f.k]));
    if (unk.size) plan.unknownIds.push(`${f.k}: ${[...unk].slice(0, 10).join(", ")}`);
  }

  const now = new Date().toISOString();
  let matched = 0;
  for (const [code, rec] of incoming) {
    const t = tests.get(code);
    if (!t) {
      const sl = {}, val = {}, base = {};
      for (const f of importFields) sl[f.k] = rec[f.k];
      plan.newTests.push(code);
      plan.patches[code] = { code, sl, val, base, meta: { addedAt: now, lastImport: now, missing: false, conflicts: {} }, _new: true };
      continue;
    }
    matched++;
    const p = { sl: {}, val: {}, base: {}, meta: { lastImport: now } };
    let touched = false;
    if (t.meta && t.meta.missing) { p.meta.missing = false; touched = true; }
    const conf = conflictsOf(t);
    for (const f of importFields) {
      const theirs = rec[f.k];
      const slOld = t.sl ? t.sl[f.k] : null;
      if (!hasOwn(t.val, f.k)) {   // never edited in the catalog: SmartLIS value simply wins
        if (!same(slOld, theirs)) {
          p.sl[f.k] = theirs; touched = true;
          plan.changes.push({ code, f: f.k, old: slOld, new: theirs, kind: "smartlis" });
          plan.byField[f.k] = (plan.byField[f.k] || 0) + 1;
          if (!isEmpty(slOld) && isEmpty(theirs)) plan.cleared[f.k] = (plan.cleared[f.k] || 0) + 1;
        }
        continue;
      }
      // edited in the catalog: three-way compare against base (value at last sync)
      const base = hasOwn(t.base, f.k) ? t.base[f.k] : slOld;
      const ours = t.val ? t.val[f.k] : null;
      const theirsChanged = !same(theirs, base);
      const oursChanged = !same(ours, base);
      if (!same(slOld, theirs)) { p.sl[f.k] = theirs; touched = true; }
      if (!theirsChanged) continue;
      if (!oursChanged) {
        p.val[f.k] = theirs; p.base[f.k] = theirs; touched = true;
        plan.changes.push({ code, f: f.k, old: ours, new: theirs, kind: "take" });
        plan.byField[f.k] = (plan.byField[f.k] || 0) + 1;
        if (!isEmpty(ours) && isEmpty(theirs)) plan.cleared[f.k] = (plan.cleared[f.k] || 0) + 1;
      } else if (same(ours, theirs)) {
        p.base[f.k] = theirs; touched = true;
        if (conf[f.k]) { p.meta.conflicts = Object.assign(p.meta.conflicts || {}, { [f.k]: null }); }
        plan.converged.push({ code, f: f.k, value: theirs });
      } else {
        p.meta.conflicts = Object.assign(p.meta.conflicts || {}, { [f.k]: { theirs, at: now } }); touched = true;
        plan.conflicts.push({ code, f: f.k, ours, theirs, base });
      }
    }
    if (t.meta && t.meta.lastExport && plan.converged.some(c => c.code === code)) {
      const still = pendingFields(applyPatch(t, p), fields);
      if (!still.length) p.meta.lastExport = null;
    }
    if (touched) plan.patches[code] = p;
  }
  for (const [code, t] of tests) {
    if (!incoming.has(code) && !(t.meta && t.meta.missing)) {
      plan.missing.push(code);
      plan.patches[code] = { meta: { missing: true } };
    }
  }
  const limit = Math.max(settings.clearMin, Math.ceil(matched * settings.clearShare));
  plan.massCleared = Object.keys(plan.cleared).filter(k => plan.cleared[k] > limit).map(k => ({ f: k, n: plan.cleared[k], limit }));
  return plan;
}

// Merge a patch into a test copy (same semantics as the store's nested merge)
function applyPatch(t, p) {
  const out = JSON.parse(JSON.stringify(t || {}));
  for (const part of ["sl", "val", "base", "meta"]) {
    if (!p[part]) continue;
    out[part] = out[part] || {};
    for (const k of Object.keys(p[part])) {
      const v = p[part][k];
      if (v && typeof v === "object" && !Array.isArray(v) && out[part][k] && typeof out[part][k] === "object") out[part][k] = Object.assign({}, out[part][k], v);
      else out[part][k] = v;
    }
  }
  if (p.code) out.code = p.code;
  return out;
}

/* ---------- Export to SmartLIS ---------- */
function toJsonValue(f, v) {
  if (isEmpty(v)) return null;
  if (f.t === "bool") return norm(v) === "TRUE";
  if (f.t === "num" || f.t === "dict") { const n = Number(norm(v)); return isNaN(n) ? String(v) : n; }
  return String(v).trim();
}

function planExport(tests, fields, settings) {
  const fm = fieldMap(fields);
  const out = { tests: [], items: [], byField: {}, nullRequired: [], mass: [] };
  for (const t of tests.values()) {
    const pf = pendingFields(t, fields);
    if (!pf.length) continue;
    const rec = { code: t.code };
    for (const k of pf) {
      const f = fm[k];
      const v = toJsonValue(f, t.val[k]);
      rec[k] = v;
      out.items.push({ code: t.code, f: k, smartlis: t.sl ? t.sl[k] : null, catalog: t.val[k], sentBefore: !!(t.meta && t.meta.lastExport) });
      out.byField[k] = (out.byField[k] || 0) + 1;
      if (v === null && f.req) out.nullRequired.push(`${t.code}.${k}`);
    }
    out.tests.push(rec);
  }
  out.mass = Object.keys(out.byField).filter(k => out.byField[k] > settings.massLimit).map(k => ({ f: k, n: out.byField[k] }));
  out.tests.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

/* ---------- Website JSON ---------- */
function dictName(dicts, k, v) {
  if (isEmpty(v)) return "";
  const p = (dicts[k] || []).find(x => norm(x[0]) === norm(v));
  return p ? p[1] : String(v);
}

function buildWebJson(tests, fields, dicts, settings) {
  const webFields = fields.filter(f => f.web);
  const regular = [], promotions = [];
  for (const t of [...tests.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    if (t.meta && t.meta.missing) continue;
    const pub = norm(t.val && t.val.publish);
    const isAkc = pub === "AKC";
    if (!(pub === "TRUE" || (isAkc && settings.includeAkc))) continue;
    const rec = { code: t.code };
    for (const f of webFields) {
      const v = valueOf(t, f);
      const key = f.jk || f.k;
      if (f.t === "dict") rec[key] = dictName(dicts, f.k, v);
      else if (f.t === "bool") rec[key] = norm(v) === "TRUE";
      else if (f.t === "num") rec[key] = isEmpty(v) ? "" : Number(norm(v));
      else rec[key] = isEmpty(v) ? "" : v;
    }
    rec.publish = true;
    for (const k of (isAkc ? PRICES_AKC : PRICES_REGULAR)) { const v = cv(t, k); rec[k] = isEmpty(v) ? "" : Number(norm(v)); }
    (isAkc ? promotions : regular).push(rec);
  }
  const res = { tests: regular };
  if (settings.includeAkc) res.promotions = promotions;
  return res;
}

/* ---------- Quality checks ---------- */
function missingWebContent(t, fields) {
  return fields.filter(f => f.wreq && isEmpty(t.val ? t.val[f.k] : null)).map(f => f.k);
}

// Translation fields that are empty while their LV original is filled
function missingTranslations(t, fields) {
  const v = t.val || {};
  return fields.filter(f => f.tr && !isEmpty(v[f.tr]) && isEmpty(v[f.k])).map(f => f.k);
}

const CHECKS = [
  { id: "conflict", sev: "bad", l: "Конфликт: поле изменили и в каталоге, и в SmartLIS", fn: (t) => Object.keys(conflictsOf(t)).length > 0 },
  { id: "catalog-empty", sev: "bad", l: "Katalogā не заполнено (нужно да/нет)", fn: (t) => !(t.meta && t.meta.missing) && isEmpty(cv(t, "catalog")) },
  { id: "web-missing", sev: "warn", l: "Опубликован, но не хватает текстов для сайта", fn: (t, F) => norm(t.val && t.val.publish) === "TRUE" && missingWebContent(t, F).length > 0 },
  { id: "price-missing", sev: "warn", l: "Опубликован без цены (fin_price2)", fn: (t) => norm(t.val && t.val.publish) === "TRUE" && isEmpty(cv(t, "fin_price2")) },
  { id: "catalog-vs-publish", sev: "warn", l: "Katalogā и публикация на сайте расходятся", fn: (t) => !(t.meta && t.meta.missing) && !isEmpty(cv(t, "catalog")) && ((norm(t.val.catalog) === "TRUE") !== (norm(t.val.publish) === "TRUE")) },
  { id: "publish-empty", sev: "info", l: "Решение о публикации не принято", fn: (t) => !(t.meta && t.meta.missing) && isEmpty(t.val && t.val.publish) },
  { id: "no-material", sev: "info", l: "Активный тест без материала", fn: (t) => !(t.meta && t.meta.missing) && t.sl && t.sl.active === true && isEmpty(cv(t, "sampleid")) },
  { id: "translation-missing", sev: "info", l: "Опубликован, LV-текст есть, нет перевода RU или EN", fn: (t, F) => norm(t.val && t.val.publish) === "TRUE" && missingTranslations(t, F).length > 0 },
  { id: "media-bad", sev: "warn", l: "Ссылка на изображение не похожа на https-адрес", fn: (t, F) => F.some(f => f.t === "url" && !isEmpty(t.val && t.val[f.k]) && !/^https:\/\/\S+$/i.test(String(t.val[f.k]).trim())) },
  { id: "paytype-odd", sev: "info", l: "Apmaksa: нестандартное значение (не NVD / M / GOV)", fn: (t) => !(t.meta && t.meta.missing) && !isEmpty(cv(t, "paytype")) && !["NVD", "M", "GOV"].includes(norm(cv(t, "paytype")).toUpperCase()) },
  { id: "missing", sev: "info", l: "Нет в последней выгрузке SmartLIS", fn: (t) => !!(t.meta && t.meta.missing) },
];

function dictDuplicates(dicts) {
  const out = [];
  for (const k of Object.keys(dicts)) {
    const by = {};
    for (const [id, name] of dicts[k]) { const n = String(name).trim().toLowerCase(); (by[n] = by[n] || []).push(id); }
    for (const n of Object.keys(by)) if (by[n].length > 1) out.push({ field: k, name: n, ids: by[n] });
  }
  return out;
}

function seoDuplicates(tests) {
  const by = {};
  for (const t of tests.values()) { const c = norm(t.val && t.val.codename); if (c) (by[c] = by[c] || []).push(t.code); }
  return Object.keys(by).filter(c => by[c].length > 1).map(c => ({ url: c, codes: by[c] }));
}

/* ---------- Catalog table: column values, filters, sorting ---------- */
const CODE_FIELD = { k: "code", l: "Kods", t: "text", g: "smartlis" };
const colRaw = (t, k) => (k === "code" ? t.code : cv(t, k));
// What the user sees in a cell (and what text filters match against)
function colText(t, f, dicts) {
  const v = colRaw(t, f.k);
  if (isEmpty(v)) return "";
  if (f.t === "dict") return dictName(dicts, f.k, v);
  if (f.t === "bool") return norm(v) === "TRUE" ? "Jā" : "Nē";
  if (f.t === "publish") { const n = norm(v); return n === "TRUE" ? "Jā" : n === "FALSE" ? "Nē" : n; }
  return String(v);
}
// Filter kind for a column: choice (select from values) | num (range) | text (contains)
const filterKind = (f) => (["dict", "bool", "publish"].includes(f.t) ? "choice" : f.t === "num" ? "num" : "text");
// Choice options: [value, label]; "EMPTY" = no value
function choiceOptions(f, dicts) {
  if (f.t === "bool") return [["TRUE", "Jā"], ["FALSE", "Nē"], ["EMPTY", "(пусто)"]];
  if (f.t === "publish") return [["TRUE", "Jā"], ["AKC", "AKC"], ["FALSE", "Nē"], ["EMPTY", "Не решено"]];
  const opts = (dicts[f.k] || []).map(([id, n]) => [norm(id), String(n)]).sort((a, b) => a[1].localeCompare(b[1], "lv"));
  return [...opts, ["EMPTY", "(пусто)"]];
}
// Number filter: "5", ">5", ">=5", "<5", "<=5", "5-10" / "5–10" / "5..10"; comma as decimal point is fine
function parseNumFilter(s) {
  const x = String(s).trim().replace(/,/g, ".").replace(/\s+/g, "");
  let m;
  if ((m = x.match(/^(>=|<=|>|<|=)?(-?\d+(?:\.\d+)?)$/))) {
    const op = m[1] || "=", n = Number(m[2]);
    return (v) => (op === ">" ? v > n : op === ">=" ? v >= n : op === "<" ? v < n : op === "<=" ? v <= n : v === n);
  }
  if ((m = x.match(/^(-?\d+(?:\.\d+)?)(?:-|–|\.\.)(-?\d+(?:\.\d+)?)$/))) { const a = Number(m[1]), b = Number(m[2]); return (v) => v >= Math.min(a, b) && v <= Math.max(a, b); }
  return null;
}
// One column filter. Everywhere: "=" = empty, "!=" = not empty. Text: contains, "!word" = does not contain.
function matchCol(t, f, filter, dicts) {
  const q = String(filter ?? "").trim();
  if (!q) return true;
  const raw = colRaw(t, f.k);
  if (q === "=" || q === "EMPTY") return isEmpty(raw);
  if (q === "!=") return !isEmpty(raw);
  const kind = filterKind(f);
  if (kind === "choice") return !isEmpty(raw) && norm(raw) === q;
  if (kind === "num") {
    const pred = parseNumFilter(q);
    if (!pred) return true;                // unfinished input: do not hide everything while typing
    if (isEmpty(raw)) return false;
    const n = Number(norm(raw)); return !Number.isNaN(n) && pred(n);
  }
  const text = colText(t, f, dicts).toLowerCase();
  if (q.startsWith("!") && q.length > 1) return !text.includes(q.slice(1).toLowerCase());
  return text.includes(q.toLowerCase());
}
// Sort by one column; empty values always go last; ties by code
function compareBy(f, dir, dicts) {
  const num = f.t === "num";
  const key = (t) => { const raw = colRaw(t, f.k); if (isEmpty(raw)) return null; return num ? Number(norm(raw)) : colText(t, f, dicts); };
  return (a, b) => {
    const x = key(a), y = key(b);
    if (x === null || y === null) return x === y ? a.code.localeCompare(b.code) : x === null ? 1 : -1;
    const c = num ? x - y : String(x).localeCompare(String(y), "lv", { numeric: true, sensitivity: "base" });
    return c ? c * dir : a.code.localeCompare(b.code);
  };
}

/* ---------- Excel migration (current SharePoint workbook) ---------- */
// sheets: {Catalog: rows[][], Dictionary: rows[][], DB_Import: rows[][] (optional)}
// Catalog-owned fields are read from the column with the same technical name (row 2), or with the site JSON key (jk)
const EXCEL_ALIASES = { publish: ["publish"], animalSpecies: ["animalSpecies"] };
function catalogFieldsInSheet(fields, col) {
  const out = [];
  for (const f of fields.filter(f => f.o === "catalog")) {
    const names = [f.k, f.jk, ...(EXCEL_ALIASES[f.k] || [])].filter(Boolean);
    const h = names.find(n => col[n] !== undefined);
    if (h !== undefined) out.push([f, col[h]]);
  }
  return out;
}
const filledCount = (r, from) => r.slice(from).filter(c => !isEmpty(c)).length;

function buildFromExcel(sheets, fields) {
  const res = { errors: [], warnings: [], tests: [], dicts: {} };
  const cat = sheets.Catalog;
  if (!cat || cat.length < 3) { res.errors.push("В файле нет листа Catalog или он пустой."); return res; }
  const biz = cat[0].map(h => String(h ?? "").trim());
  const tech = cat[1].map(h => String(h ?? "").trim());
  const col = {}; tech.forEach((h, i) => { if (h && col[h] === undefined) col[h] = i; });
  const animal = biz.findIndex(h => /Dzīvnieka/i.test(h));
  if (col.code === undefined) { res.errors.push("На листе Catalog во второй строке нет колонки code."); return res; }

  const dict = {};
  for (const r of (sheets.Dictionary || []).slice(1)) {
    const f = String(r[0] ?? "").trim(); if (!f || r[1] === null || r[1] === undefined || r[1] === "") continue;
    (dict[f] = dict[f] || []).push([parseCell("sampleid", r[1]), String(r[2] ?? "").trim()]);
  }
  res.dicts = dict;
  const reverse = (k, display) => { const p = (dict[k] || []).find(x => x[1] === String(display).trim()); return p ? p[0] : undefined; };

  let dbRows = null;
  if (sheets.DB_Import && sheets.DB_Import.length > 1) {
    const h = sheets.DB_Import[0].map(x => String(x ?? "").trim());
    const ci = h.indexOf("code");
    if (ci >= 0) { dbRows = new Map(); for (const r of sheets.DB_Import.slice(1)) { const c = String(r[ci] ?? "").trim(); if (c) dbRows.set(c, Object.fromEntries(h.map((k, i) => [k, r[i]]))); } }
  }
  if (!dbRows) res.warnings.push("Лист DB_Import не найден: значения SmartLIS взяты из Catalog. Сделайте импорт из SmartLIS сразу после переноса.");

  const now = new Date().toISOString();
  const catCols = catalogFieldsInSheet(fields, col);
  const firstCatalogCol = Math.min(...catCols.map(c => c[1]), tech.length);
  const known = new Set([...fields.map(f => f.k), ...fields.map(f => f.jk).filter(Boolean), "code", "publish"]);
  const unknown = tech.filter(h => h && !known.has(h));
  if (unknown.length) res.warnings.push(`Колонки Catalog без поля в реестре (не перенесены): ${unknown.join(", ")}. Добавьте поле в «Настройки → Реестр полей», если оно нужно.`);
  // Duplicate codes: keep the row with more filled catalog/site cells, report the other one
  const pick = {};
  for (let ri = 2; ri < cat.length; ri++) {
    const code = String(cat[ri][col.code] ?? "").trim(); if (!code) continue;
    const score = filledCount(cat[ri], firstCatalogCol);
    if (!pick[code]) { pick[code] = { ri, score }; continue; }
    const prev = pick[code]; const keep = score > prev.score ? ri : prev.ri; const drop = keep === ri ? prev.ri : ri;
    res.warnings.push(`Код ${code} дважды на листе Catalog (строки ${prev.ri + 1} и ${ri + 1}): взята строка ${keep + 1} (в ней больше заполненных полей каталога), строку ${drop + 1} удалите в Excel.`);
    pick[code] = { ri: keep, score: Math.max(score, prev.score) };
  }
  for (let ri = 2; ri < cat.length; ri++) {
    const r = cat[ri];
    const code = String(r[col.code] ?? "").trim(); if (!code) continue;
    if (pick[code].ri !== ri) continue;
    const t = { code, sl: {}, val: {}, base: {}, meta: { conflicts: {} } };
    const db = dbRows ? dbRows.get(code) : null;
    if (dbRows && !db) t.meta.missing = true;
    for (const f of fields.filter(f => f.o !== "catalog")) {
      let v;
      if (db && f.k in db) v = parseCell(f.k, db[f.k]);
      else {
        v = col[f.k] !== undefined ? parseCell(f.k, r[col[f.k]]) : null;
        if (f.t === "dict" && typeof v === "string") { const id = reverse(f.k, v); if (id !== undefined) v = id; }
      }
      t.sl[f.k] = v;
    }
    for (const f of fields.filter(f => isSl(f) && ["name", "sampleid", "catalog"].includes(f.k))) {
      let v = col[f.k] !== undefined ? parseCell(f.k, r[col[f.k]]) : null;
      if (f.t === "dict" && typeof v === "string") {
        const slName = dictName(dict, f.k, t.sl[f.k]);
        if (slName === v) v = t.sl[f.k];
        else { const id = reverse(f.k, v); if (id === undefined) res.warnings.push(`${code}: «${v}» нет в справочнике ${f.k}`); v = id === undefined ? t.sl[f.k] : id; }
      }
      t.val[f.k] = isEmpty(v) && f.k !== "catalog" ? t.sl[f.k] : v;
      t.base[f.k] = t.sl[f.k];
    }
    for (const [f, ci] of catCols) {
      let v = r[ci];
      if (f.k === "publish") { const n = norm(v); v = n === "" ? null : n; }
      else v = isEmpty(v) ? null : String(v).trim();
      if (v !== null) t.val[f.k] = v;
    }
    if (animal >= 0 && t.val.animalSpecies === undefined && !isEmpty(r[animal])) t.val.animalSpecies = String(r[animal]).trim();
    t.meta.lastImport = now;
    res.tests.push(t);
  }
  return res;
}

if (typeof module !== "undefined") module.exports = { isSl, editLevel, cv, hasOwn, EDIT_LABEL, DEFAULT_FIELDS, DEFAULT_SETTINGS, CHECKS, norm, same, isEmpty, parseCell, parseCsv, decodeUtf8, planImport, applyPatch, planExport, buildWebJson, pendingFields, conflictsOf, chunkOf, valueOf, dictName, dictDuplicates, seoDuplicates, missingWebContent, buildFromExcel, fieldMap, HIST_CAP, CHUNKS, mergeFields, isWebGroup, LANGS, missingTranslations, CODE_FIELD, colText, filterKind, choiceOptions, parseNumFilter, matchCol, compareBy };
