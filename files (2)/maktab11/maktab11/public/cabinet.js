const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const J = (u, o = {}) => fetch(u, o).then(async r => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Xato: " + r.status);
  return d;
});
const post = (u, b, m = "POST") => J(u, { method: m, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const CL = Array.from({ length: 11 }, (_, i) => `<option value="${i + 1}">${i + 1}-sinf</option>`).join("");
const today = () => new Date().toISOString().slice(0, 10);

J("/api/umy").then(show).catch(() => show(null));
$("login").onsubmit = async e => {
  e.preventDefault();
  try { await post("/api/ulogin", { login: $("lg").value, password: $("pw").value }); $("pw").value = ""; $("lerr").textContent = ""; show(await J("/api/umy")); }
  catch (x) { $("lerr").textContent = x.message; }
};
$("logout").onclick = async () => { await post("/api/ulogout", {}); show(null); };

function show(u) {
  $("login").style.display = u ? "none" : "grid";
  $("view").hidden = !u; $("logout").hidden = !u;
  if (!u) return;
  u.role === "teacher" ? teacher(u) : pupil(u);
}

/* ===== O'quvchi / ota-ona ===== */
async function pupil(u) {
  const t = u.role === "student" ? u : u.child;
  $("view").innerHTML = `<h2 class="text4">${esc(u.name)}</h2>
    <p class="text3">${u.role === "parent" ? "Farzandingiz: " : "Sinf: "}${t ? esc(t.name) + " (" + t.cls + "-sinf)" : "biriktirilmagan"}</p>
    <p><a class="wrapper19" href="index.html#students">Dars jadvali</a></p>
    <h3 class="text5">Baholar</h3><div id="gr"></div>
    <h3 class="text5" style="margin-top:20px">Uy vazifalari</h3><ul class="wrapper24" id="hw"></ul>`;
  try {
    const [g, h] = await Promise.all([J("/api/grades/my"), J("/api/homework/my")]), by = {};
    g.forEach(x => (by[x.subject] = by[x.subject] || []).push(x));
    $("gr").innerHTML = Object.keys(by).length
      ? `<div class="wrapper23"><table class="sch"><tr><th>Fan</th><th>Baholar</th><th>O‘rtacha</th></tr>` +
        Object.entries(by).map(([s, a]) => `<tr><td>${esc(s)}</td><td>${a.map(x => `<span class="cls" title="${esc(x.date + " " + x.note)}">${x.value}</span>`).join(" ")}</td><td>${(a.reduce((p, x) => p + x.value, 0) / a.length).toFixed(1)}</td></tr>`).join("") + `</table></div>`
      : '<p class="text3">Hozircha baho yo‘q.</p>';
    $("hw").innerHTML = h.map(x => `<li><span><b>${esc(x.subject)}:</b> ${esc(x.text)}</span><small>${esc(x.due || "")}</small></li>`).join("") || "<li>Vazifa yo‘q.</li>";
  } catch (x) { $("gr").textContent = x.message; }
}

/* ===== O'qituvchi ===== */
function teacher(u) {
  $("view").innerHTML = `<h2 class="text4">${esc(u.name)}</h2><p class="text3">Fan: ${esc(u.subject || "—")}</p>
    <div class="wrapper27"><select id="tCls">${CL}</select></div>
    <h3 class="text5">Baho qo‘yish</h3>
    <form class="wrapper26" id="gForm">
      <select id="gSt" required></select>
      <select id="gVal"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
      <input id="gDate" type="date" required>
      <input id="gNote" placeholder="Izoh (ixtiyoriy)" maxlength="100">
      <button class="wrapper19">Baho qo‘yish</button>
    </form>
    <div class="wrapper23" id="gList"></div>
    <h3 class="text5" style="margin-top:20px">Uy vazifasi (tanlangan sinf uchun)</h3>
    <form class="wrapper26" id="hForm">
      <textarea id="hText" rows="3" placeholder="Vazifa matni" required maxlength="1000"></textarea>
      <input id="hDue" type="date"><button class="wrapper19">Vazifa qo‘shish</button>
    </form>
    <ul class="wrapper24" id="hList"></ul><p class="text3" id="tMsg"></p>`;
  $("gDate").value = today();
  const msg = t => $("tMsg").textContent = t;
  const cls = () => $("tCls").value;
  async function loadClass() {
    try {
      const st = await J("/api/students?cls=" + cls());
      $("gSt").innerHTML = st.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("") || "<option value=''>O‘quvchi yo‘q</option>";
      const g = await J("/api/grades/teacher?cls=" + cls());
      $("gList").innerHTML = `<table class="sch"><tr><th>Sana</th><th>O‘quvchi</th><th>Baho</th><th>Izoh</th><th></th></tr>` +
        (g.map(x => `<tr><td>${esc(x.date)}</td><td>${esc(x.name)}</td><td>${x.value}</td><td>${esc(x.note)}</td><td><button class="cls" data-g="${x.id}">✕</button></td></tr>`).join("") || '<tr><td colspan="5">Baho yo‘q</td></tr>') + `</table>`;
    } catch (x) { msg(x.message); }
  }
  async function loadHw() {
    const h = await J("/api/homework/teacher");
    $("hList").innerHTML = h.map(x => `<li><span><b>${x.cls}-sinf:</b> ${esc(x.text)} <small>${esc(x.due || "")}</small></span><button data-h="${x.id}">✕</button></li>`).join("") || "<li>Vazifa yo‘q.</li>";
  }
  $("tCls").onchange = loadClass;
  $("gForm").onsubmit = async e => {
    e.preventDefault();
    try { await post("/api/grades", { student: $("gSt").value, value: $("gVal").value, date: $("gDate").value, note: $("gNote").value }); $("gNote").value = ""; msg("Baho qo‘yildi."); loadClass(); }
    catch (x) { msg(x.message); }
  };
  $("hForm").onsubmit = async e => {
    e.preventDefault();
    try { await post("/api/homework", { cls: cls(), text: $("hText").value, due: $("hDue").value }); $("hText").value = ""; msg("Vazifa qo‘shildi."); loadHw(); }
    catch (x) { msg(x.message); }
  };
  $("gList").onclick = async e => { if (e.target.dataset.g) { await post("/api/grades/" + e.target.dataset.g, {}, "DELETE"); loadClass(); } };
  $("hList").onclick = async e => { if (e.target.dataset.h) { await post("/api/homework/" + e.target.dataset.h, {}, "DELETE"); loadHw(); } };
  loadClass(); loadHw();
}
