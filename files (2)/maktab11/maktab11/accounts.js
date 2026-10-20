/* Hisoblar: o‘qituvchi, o‘quvchi, ota-ona. server.js dan ulanadi. */
const crypto = require("crypto");

module.exports = (app, db, { sign, auth, secure }) => {
  db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,role TEXT,login TEXT UNIQUE,salt TEXT,hash TEXT,name TEXT,cls INTEGER,child INTEGER,subject TEXT);
CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY AUTOINCREMENT,student INTEGER,subject TEXT,value INTEGER,date TEXT,note TEXT,teacher INTEGER);
CREATE TABLE IF NOT EXISTS homework(id INTEGER PRIMARY KEY AUTOINCREMENT,cls INTEGER,subject TEXT,text TEXT,due TEXT,teacher INTEGER)`);

  const D = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const S = (v, m) => String(v ?? "").trim().slice(0, m);
  const pw = (p, salt) => crypto.scryptSync(String(p), salt, 32).toString("hex");
  const mk = id => { const b = id + "." + (Date.now() + 12 * 3600e3); return b + "." + sign("u" + b); };
  const parse = req => {
    const c = ((req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("usr=")) || "").slice(4);
    const [id, e, s] = c.split("."); if (!s || +e < Date.now()) return null;
    const x = Buffer.from(sign("u" + id + "." + e)), y = Buffer.from(s);
    if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
    return db.prepare("SELECT id,role,login,name,cls,child,subject FROM users WHERE id=?").get(+id) || null;
  };
  const who = (...roles) => (q, r, n) => {
    const u = parse(q);
    if (!u || (roles.length && !roles.includes(u.role))) return r.status(401).json({ error: "Ruxsat yo‘q" });
    q.user = u; n();
  };
  const target = u => u.role === "student" ? u : db.prepare("SELECT id,name,cls FROM users WHERE id=? AND role='student'").get(u.child || 0);

  /* ----- Kirish / chiqish ----- */
  const tries = new Map();
  app.post("/api/ulogin", (q, r) => {
    const t = tries.get(q.ip) || { n: 0, u: 0 };
    if (t.n >= 8 && Date.now() >= t.u) t.n = 0;
    if (t.n >= 8) return r.status(429).json({ error: "Ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring." });
    const u = db.prepare("SELECT * FROM users WHERE login=?").get(S(q.body.login, 30).toLowerCase());
    const h = Buffer.from(pw(q.body.password, u ? u.salt : "0".repeat(32)), "hex");
    if (!u || !crypto.timingSafeEqual(h, Buffer.from(u.hash, "hex"))) {
      tries.set(q.ip, { n: t.n + 1, u: Date.now() + 15 * 60e3 });
      return r.status(401).json({ error: "Login yoki parol noto‘g‘ri" });
    }
    tries.delete(q.ip);
    r.setHeader("Set-Cookie", `usr=${mk(u.id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
    r.json({ role: u.role, name: u.name });
  });
  app.post("/api/ulogout", (q, r) => { r.setHeader("Set-Cookie", `usr=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`); r.json({ ok: 1 }); });
  app.get("/api/umy", who(), (q, r) => r.json({ ...q.user, child: q.user.role === "parent" ? target(q.user) || null : null }));

  /* ----- Admin: foydalanuvchilarni boshqarish ----- */
  app.get("/api/users", auth, (q, r) => r.json(db.prepare(
    "SELECT u.id,u.role,u.login,u.name,u.cls,u.subject,c.name AS childName FROM users u LEFT JOIN users c ON c.id=u.child ORDER BY u.role,u.cls,u.name").all()));
  app.post("/api/users", auth, (q, r) => {
    const b = q.body, role = b.role, login = S(b.login, 30).toLowerCase(), name = S(b.name, 80);
    if (!["teacher", "student", "parent"].includes(role) || !/^[a-z0-9_.-]{3,30}$/.test(login) || !name || String(b.password || "").length < 6)
      return r.status(400).json({ error: "Maydonlar noto‘g‘ri (parol kamida 6 belgi, login 3–30 lotin harf/raqam)" });
    let cls = null, child = null, subject = null;
    if (role === "student") { cls = +b.cls; if (!(cls >= 1 && cls <= 11)) return r.status(400).json({ error: "Sinfni tanlang" }); }
    if (role === "parent") { child = +b.child; if (!db.prepare("SELECT 1 FROM users WHERE id=? AND role='student'").get(child)) return r.status(400).json({ error: "Farzandni tanlang" }); }
    if (role === "teacher") subject = S(b.subject, 60) || null;
    const salt = crypto.randomBytes(16).toString("hex");
    try {
      db.prepare("INSERT INTO users(role,login,salt,hash,name,cls,child,subject) VALUES(?,?,?,?,?,?,?,?)").run(role, login, salt, pw(b.password, salt), name, cls, child, subject);
      r.json({ ok: 1 });
    } catch { r.status(400).json({ error: "Bu login band" }); }
  });
  app.put("/api/users/:id/password", auth, (q, r) => {
    if (String(q.body.password || "").length < 6) return r.status(400).json({ error: "Parol kamida 6 belgi" });
    const salt = crypto.randomBytes(16).toString("hex");
    db.prepare("UPDATE users SET salt=?,hash=? WHERE id=?").run(salt, pw(q.body.password, salt), +q.params.id);
    r.json({ ok: 1 });
  });
  app.delete("/api/users/:id", auth, (q, r) => {
    const id = +q.params.id;
    db.prepare("DELETE FROM grades WHERE student=?").run(id);
    db.prepare("DELETE FROM users WHERE id=? OR (role='parent' AND child=?)").run(id, id);
    r.json({ ok: 1 });
  });

  /* ----- O'qituvchi ----- */
  app.get("/api/students", who("teacher"), (q, r) =>
    r.json(db.prepare("SELECT id,name FROM users WHERE role='student' AND cls=? ORDER BY name").all(+q.query.cls)));
  app.get("/api/grades/teacher", who("teacher"), (q, r) => r.json(db.prepare(
    "SELECT g.id,g.value,g.date,g.note,u.name FROM grades g JOIN users u ON u.id=g.student WHERE g.teacher=? AND u.cls=? ORDER BY g.date DESC,g.id DESC LIMIT 100").all(q.user.id, +q.query.cls)));
  app.post("/api/grades", who("teacher"), (q, r) => {
    const b = q.body, v = +b.value;
    if (!db.prepare("SELECT 1 FROM users WHERE id=? AND role='student'").get(+b.student) || !(v >= 1 && v <= 5) || !D(b.date))
      return r.status(400).json({ error: "Maydonlar noto‘g‘ri" });
    db.prepare("INSERT INTO grades(student,subject,value,date,note,teacher) VALUES(?,?,?,?,?,?)").run(+b.student, q.user.subject || "—", v, b.date, S(b.note, 100), q.user.id);
    r.json({ ok: 1 });
  });
  app.delete("/api/grades/:id", who("teacher"), (q, r) => { db.prepare("DELETE FROM grades WHERE id=? AND teacher=?").run(+q.params.id, q.user.id); r.json({ ok: 1 }); });
  app.get("/api/homework/teacher", who("teacher"), (q, r) =>
    r.json(db.prepare("SELECT id,cls,text,due FROM homework WHERE teacher=? ORDER BY id DESC LIMIT 50").all(q.user.id)));
  app.post("/api/homework", who("teacher"), (q, r) => {
    const b = q.body, cls = +b.cls, text = S(b.text, 1000);
    if (!(cls >= 1 && cls <= 11) || !text || (b.due && !D(b.due))) return r.status(400).json({ error: "Maydonlar noto‘g‘ri" });
    db.prepare("INSERT INTO homework(cls,subject,text,due,teacher) VALUES(?,?,?,?,?)").run(cls, q.user.subject || "—", text, b.due || null, q.user.id);
    r.json({ ok: 1 });
  });
  app.delete("/api/homework/:id", who("teacher"), (q, r) => { db.prepare("DELETE FROM homework WHERE id=? AND teacher=?").run(+q.params.id, q.user.id); r.json({ ok: 1 }); });

  /* ----- O'quvchi va ota-ona ----- */
  app.get("/api/grades/my", who("student", "parent"), (q, r) => {
    const t = target(q.user);
    r.json(t ? db.prepare("SELECT id,subject,value,date,note FROM grades WHERE student=? ORDER BY date,id").all(t.id) : []);
  });
  app.get("/api/homework/my", who("student", "parent"), (q, r) => {
    const t = target(q.user);
    r.json(t ? db.prepare("SELECT subject,text,due FROM homework WHERE cls=? ORDER BY id DESC LIMIT 50").all(t.cls) : []);
  });
};
