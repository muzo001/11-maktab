const express = require("express"), Database = require("better-sqlite3"), multer = require("multer");
const crypto = require("crypto"), path = require("path"), fs = require("fs");

const { ADMIN_PASSWORD, SECRET, PORT = 3000 } = process.env;
if (!ADMIN_PASSWORD || !SECRET || SECRET.length < 16) {
  console.error("ADMIN_PASSWORD va SECRET (kamida 16 belgi) muhit o‘zgaruvchilarini o‘rnating.");
  process.exit(1);
}
const CATS = ["Tadbirlar", "Olimpiadalar", "Sport", "Bayramlar", "Yutuqlar"];
const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const TIMES = ["08:00–08:45", "08:50–09:35", "09:40–10:25", "10:40–11:25", "11:30–12:15", "12:20–13:05"];
const UP = path.join(__dirname, "uploads"); fs.mkdirSync(UP, { recursive: true });

/* ===== Ma'lumotlar bazasi ===== */
const db = new Database(path.join(__dirname, "data.db"));
db.exec(`CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT,category TEXT,date TEXT,summary TEXT,body TEXT,image TEXT);
CREATE TABLE IF NOT EXISTS schedules(cls INTEGER PRIMARY KEY,data TEXT,sample INTEGER)`);
const SUBJ = ["Matematika", "Ona tili", "Ingliz tili", "Tabiiy fan", "Tarix", "Informatika", "Jismoniy tarbiya", "Tasviriy san’at"];
const hasS = db.prepare("SELECT 1 FROM schedules WHERE cls=?"), putS = db.prepare("INSERT INTO schedules(cls,data,sample) VALUES(?,?,?)");
for (let c = 1; c <= 11; c++) {
  if (hasS.get(c)) continue;
  const seed = path.join(__dirname, "seed8.json");
  if (c === 8 && fs.existsSync(seed)) { putS.run(8, fs.readFileSync(seed, "utf8"), 0); continue; }
  const n = c < 5 ? 4 : c < 9 ? 5 : 6, d = {};
  DAYS.forEach((day, k) => d[day] = Array.from({ length: n }, (_, i) =>
    ({ n: i + 1, time: TIMES[i], s: SUBJ[(i + k + c) % SUBJ.length], t: "O‘qituvchi (namuna)", r: String(100 + c), g: 0 })));
  putS.run(c, JSON.stringify(d), 1);
}
if (!db.prepare("SELECT COUNT(*) n FROM news").get().n) {
  const ins = db.prepare("INSERT INTO news(title,category,date,summary,body) VALUES(?,?,?,?,?)");
  ins.run("Bilim kuni bayrami", "Bayramlar", "2026-09-01", "[NAMUNA] Bilim kuni munosabati bilan tadbir o‘tkazildi.", "[NAMUNA] To‘liq matnni admin paneldan yozing.");
  ins.run("Fan olimpiadasida yutuq", "Olimpiadalar", "2026-10-10", "[NAMUNA] O‘quvchilarimiz tuman olimpiadasida sovrinli o‘rin oldi.", "[NAMUNA] To‘liq matnni admin paneldan yozing.");
  ins.run("Sport musobaqasi", "Sport", "2026-10-15", "[NAMUNA] Maktablararo sport musobaqasi bo‘lib o‘tdi.", "[NAMUNA] To‘liq matnni admin paneldan yozing.");
}

/* ===== Autentifikatsiya: imzolangan, muddatli cookie ===== */
const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
const mkToken = () => { const e = Date.now() + 12 * 3600e3; return e + "." + sign(String(e)); };
const okToken = t => {
  if (!t) return false; const [e, s] = t.split("."); if (!s || +e < Date.now()) return false;
  const x = Buffer.from(sign(e)), y = Buffer.from(s); return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const getCookie = req => ((req.headers.cookie || "").split(";").map(c => c.trim()).find(c => c.startsWith("adm=")) || "").slice(4);
const auth = (req, res, next) => okToken(getCookie(req)) ? next() : res.status(401).json({ error: "Ruxsat yo‘q" });
const hash = s => crypto.createHash("sha256").update(String(s)).digest();
const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

const app = express();
app.use((q, r, n) => { r.setHeader("X-Content-Type-Options", "nosniff"); n(); });
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UP, { index: false }));
app.use(express.static(path.join(__dirname, "public")));

const tries = new Map();
app.post("/api/login", (req, res) => {
  const t = tries.get(req.ip) || { n: 0, u: 0 };
  if (t.n >= 5 && Date.now() >= t.u) t.n = 0;
  if (t.n >= 5) return res.status(429).json({ error: "Ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring." });
  if (!crypto.timingSafeEqual(hash(req.body.password), hash(ADMIN_PASSWORD))) {
    tries.set(req.ip, { n: t.n + 1, u: Date.now() + 15 * 60e3 });
    return res.status(401).json({ error: "Parol noto‘g‘ri" });
  }
  tries.delete(req.ip);
  res.setHeader("Set-Cookie", `adm=${mkToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
  res.json({ ok: 1 });
});
app.post("/api/logout", (q, res) => { res.setHeader("Set-Cookie", `adm=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`); res.json({ ok: 1 }); });
app.get("/api/me", auth, (q, res) => res.json({ ok: 1 }));

/* ===== Yangiliklar ===== */
const upload = multer({
  storage: multer.diskStorage({
    destination: UP,
    filename: (q, f, cb) => cb(null, crypto.randomBytes(12).toString("hex") + { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[f.mimetype])
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (q, f, cb) => cb(["image/jpeg", "image/png", "image/webp"].includes(f.mimetype) ? null : new Error("Faqat JPG, PNG yoki WEBP rasm (3 MB gacha)"), true)
});
const rmImg = img => { if (img) fs.rmSync(path.join(UP, path.basename(img)), { force: true }); };
const clean = b => {
  const o = { title: String(b.title || "").trim(), category: b.category, date: b.date, summary: String(b.summary || "").trim(), body: String(b.body || "").trim() };
  return o.title && o.title.length <= 200 && CATS.includes(o.category) && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && o.summary && o.summary.length <= 300 && o.body.length <= 10000 ? o : null;
};

app.get("/api/news", (q, r) => {
  const { category, sort, limit } = q.query, a = [];
  let sql = "SELECT id,title,category,date,summary,image FROM news";
  if (CATS.includes(category)) { sql += " WHERE category=?"; a.push(category); }
  sql += ` ORDER BY date ${sort === "old" ? "ASC" : "DESC"}, id DESC`;
  if (+limit > 0) { sql += " LIMIT ?"; a.push(Math.min(+limit, 50)); }
  r.json(db.prepare(sql).all(...a));
});
app.get("/api/news/:id", (q, r) => {
  const n = db.prepare("SELECT * FROM news WHERE id=?").get(+q.params.id);
  n ? r.json(n) : r.status(404).json({ error: "Topilmadi" });
});
app.post("/api/news", auth, upload.single("image"), (q, r) => {
  const d = clean(q.body);
  if (!d) { if (q.file) rmImg(q.file.filename); return r.status(400).json({ error: "Maydonlar noto‘g‘ri to‘ldirilgan" }); }
  const id = db.prepare("INSERT INTO news(title,category,date,summary,body,image) VALUES(?,?,?,?,?,?)")
    .run(d.title, d.category, d.date, d.summary, d.body, q.file ? "/uploads/" + q.file.filename : null).lastInsertRowid;
  r.json({ id });
});
app.put("/api/news/:id", auth, upload.single("image"), (q, r) => {
  const old = db.prepare("SELECT image FROM news WHERE id=?").get(+q.params.id), d = clean(q.body);
  if (!old || !d) { if (q.file) rmImg(q.file.filename); return r.status(old ? 400 : 404).json({ error: "Xato" }); }
  let img = old.image;
  if (q.file) { rmImg(img); img = "/uploads/" + q.file.filename; }
  else if (q.body.removeImage === "1") { rmImg(img); img = null; }
  db.prepare("UPDATE news SET title=?,category=?,date=?,summary=?,body=?,image=? WHERE id=?").run(d.title, d.category, d.date, d.summary, d.body, img, +q.params.id);
  r.json({ ok: 1 });
});
app.delete("/api/news/:id", auth, (q, r) => {
  const n = db.prepare("SELECT image FROM news WHERE id=?").get(+q.params.id);
  if (n) { rmImg(n.image); db.prepare("DELETE FROM news WHERE id=?").run(+q.params.id); }
  r.json({ ok: 1 });
});

/* ===== Dars jadvallari ===== */
app.get("/api/schedule/:cls", (q, r) => {
  const c = +q.params.cls, row = c >= 1 && c <= 11 && db.prepare("SELECT data,sample FROM schedules WHERE cls=?").get(c);
  row ? r.json({ cls: c, data: JSON.parse(row.data), sample: !!row.sample }) : r.status(404).json({ error: "Topilmadi" });
});
app.put("/api/schedule/:cls", auth, (q, r) => {
  const c = +q.params.cls, src = q.body.data, out = {}, S = (v, m) => String(v ?? "").trim().slice(0, m);
  if (!(c >= 1 && c <= 11) || !src) return r.status(400).json({ error: "Xato" });
  for (const d of DAYS) {
    const rows = Array.isArray(src[d]) ? src[d].slice(0, 12) : [];
    out[d] = rows.map(x => ({ n: Math.min(Math.max(parseInt(x.n) || 1, 1), 20), time: S(x.time, 20), s: S(x.s, 60), t: S(x.t, 60), r: S(x.r, 20), g: x.g ? 1 : 0 }));
  }
  db.prepare("INSERT INTO schedules(cls,data,sample) VALUES(?,?,0) ON CONFLICT(cls) DO UPDATE SET data=excluded.data,sample=0").run(c, JSON.stringify(out));
  r.json({ ok: 1 });
});

require("./accounts")(app, db, { sign, auth, secure });

app.use((err, q, r, n) => r.status(400).json({ error: err.message || "Xato" }));
app.listen(PORT, () => console.log("11-Maktab: http://localhost:" + PORT));
