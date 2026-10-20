const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = ["Tadbirlar", "Olimpiadalar", "Sport", "Bayramlar", "Yutuqlar"];
const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const J = (u, o = {}) => fetch(u, o).then(async r => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Xato: " + r.status);
  return d;
});

$("nCat").innerHTML = CATS.map(c => `<option>${c}</option>`).join("");
$("sCls").innerHTML = Array.from({ length: 11 }, (_, i) => `<option value="${i + 1}">${i + 1}-sinf</option>`).join("");
$("sDay").innerHTML = DAYS.map(d => `<option>${d}</option>`).join("");

function ui(on) {
  $("login").style.display = on ? "none" : "grid";
  $("panel").hidden = !on; $("logout").hidden = !on;
  if (on) { loadNews(); loadSch(); loadUsers(); }
}
J("/api/me").then(() => ui(true)).catch(() => ui(false));
$("login").onsubmit = async e => {
  e.preventDefault();
  try {
    await J("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("pw").value }) });
    $("pw").value = ""; $("lerr").textContent = ""; ui(true);
  } catch (x) { $("lerr").textContent = x.message; }
};
$("logout").onclick = async () => { await J("/api/logout", { method: "POST" }); ui(false); };
document.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
  document.querySelectorAll("[data-p]").forEach(x => x.classList.toggle("on", x === b));
  ["pn", "ps", "pu"].forEach(i => $(i).hidden = i !== b.dataset.p);
});

/* ===== Yangiliklar ===== */
function resetForm() {
  $("nForm").reset(); $("nId").value = ""; $("nSave").textContent = "Qo‘shish";
  $("nDate").value = new Date().toISOString().slice(0, 10);
}
async function loadNews() {
  const list = await J("/api/news?sort=new");
  $("nList").innerHTML = list.map(n => `<div class="wrapper11"><span><b>${esc(n.title)}</b><br><small>${esc(n.date)} · ${esc(n.category)}</small></span>
    <span><button class="cls" data-e="${n.id}">Tahrirlash</button> <button class="cls" data-d="${n.id}">O‘chirish</button></span></div>`).join("") || '<p class="text3">Yangilik yo‘q.</p>';
}
$("nReset").onclick = resetForm; resetForm();
$("nForm").onsubmit = async e => {
  e.preventDefault();
  const id = $("nId").value;
  try {
    await J(id ? "/api/news/" + id : "/api/news", { method: id ? "PUT" : "POST", body: new FormData($("nForm")) });
    $("nMsg").textContent = id ? "Yangilik yangilandi." : "Yangilik qo‘shildi.";
    resetForm(); loadNews();
  } catch (x) { $("nMsg").textContent = x.message; }
};
$("nList").onclick = async e => {
  const ed = e.target.dataset.e, del = e.target.dataset.d;
  try {
    if (ed) {
      const n = await J("/api/news/" + ed), f = $("nForm");
      f.title.value = n.title; f.category.value = n.category; f.date.value = n.date; f.summary.value = n.summary; f.body.value = n.body || "";
      $("nId").value = n.id; $("nSave").textContent = "Saqlash"; window.scrollTo(0, 0);
    }
    if (del && confirm("Bu yangilik o‘chirilsinmi?")) { await J("/api/news/" + del, { method: "DELETE" }); loadNews(); }
  } catch (x) { $("nMsg").textContent = x.message; }
};

/* ===== Dars jadvali ===== */
let SC = null;
async function loadSch() {
  SC = await J("/api/schedule/" + $("sCls").value);
  $("sNote").textContent = SC.sample ? "[NAMUNA] Hozir namunaviy ma’lumot. Saqlasangiz, haqiqiy jadval bo‘ladi." : "";
  renderSch();
}
function renderSch() {
  const rows = SC.data[$("sDay").value] || [];
  $("sRows").innerHTML = rows.map((x, i) => `<tr>${["n", "time", "s", "t", "r"].map(k =>
    `<td><input data-i="${i}" data-k="${k}" value="${esc(x[k])}"></td>`).join("")}<td><button class="cls" data-x="${i}">✕</button></td></tr>`).join("");
}
$("sCls").onchange = loadSch; $("sDay").onchange = renderSch;
$("sRows").oninput = e => { const { i, k } = e.target.dataset; if (i !== undefined) SC.data[$("sDay").value][i][k] = e.target.value; };
$("sRows").onclick = e => {
  if (e.target.dataset.x === undefined) return;
  SC.data[$("sDay").value].splice(+e.target.dataset.x, 1); renderSch();
};
$("sAdd").onclick = () => {
  const d = SC.data[$("sDay").value] = SC.data[$("sDay").value] || [];
  d.push({ n: d.length + 1, time: "", s: "", t: "", r: "", g: 0 }); renderSch();
};
$("sSave").onclick = async () => {
  try {
    await J("/api/schedule/" + $("sCls").value, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: SC.data }) });
    $("sMsg").textContent = "Jadval saqlandi."; $("sNote").textContent = "";
  } catch (x) { $("sMsg").textContent = x.message; }
};

/* ===== Foydalanuvchilar: o‘qituvchi, o‘quvchi, ota-ona ===== */
const RL = { teacher: "O‘qituvchi", student: "O‘quvchi", parent: "Ota-ona" };
$("uCls").innerHTML = Array.from({ length: 11 }, (_, i) => `<option value="${i + 1}">${i + 1}-sinf</option>`).join("");
function uFields() { const r = $("uRole").value; $("uCls").hidden = r !== "student"; $("uChild").hidden = r !== "parent"; $("uSubj").hidden = r !== "teacher"; }
$("uRole").onchange = uFields; uFields();
async function loadUsers() {
  const us = await J("/api/users");
  $("uChild").innerHTML = us.filter(u => u.role === "student").map(u => `<option value="${u.id}">${esc(u.name)} (${u.cls}-sinf)</option>`).join("");
  $("uList").innerHTML = us.map(u => `<div class="wrapper11"><span><b>${esc(u.name)}</b> <small>${RL[u.role]}${u.cls ? ", " + u.cls + "-sinf" : ""}${u.subject ? ", " + esc(u.subject) : ""}${u.childName ? ", farzandi: " + esc(u.childName) : ""}<br>login: ${esc(u.login)}</small></span>
    <span><button class="cls" data-up="${u.id}">Parolni almashtirish</button> <button class="cls" data-ud="${u.id}">O‘chirish</button></span></div>`).join("") || '<p class="text3">Hisob yo‘q.</p>';
}
$("uForm").onsubmit = async e => {
  e.preventDefault();
  const body = { role: $("uRole").value, name: $("uName").value, login: $("uLogin").value, password: $("uPass").value, cls: $("uCls").value, child: $("uChild").value, subject: $("uSubj").value };
  try {
    await J("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    $("uMsg").textContent = "Hisob yaratildi. Loginni va parolni egasiga bering."; $("uForm").reset(); uFields(); loadUsers();
  } catch (x) { $("uMsg").textContent = x.message; }
};
$("uList").onclick = async e => {
  try {
    if (e.target.dataset.up) {
      const p = prompt("Yangi parol (kamida 6 belgi):"); if (!p) return;
      await J("/api/users/" + e.target.dataset.up + "/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: p }) });
      $("uMsg").textContent = "Parol almashtirildi.";
    }
    if (e.target.dataset.ud && confirm("Hisob o‘chirilsinmi? (O‘quvchi bo‘lsa, baholari va ota-ona hisobi ham o‘chadi)")) {
      await J("/api/users/" + e.target.dataset.ud, { method: "DELETE" }); loadUsers();
    }
  } catch (x) { $("uMsg").textContent = x.message; }
};
