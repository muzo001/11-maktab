/* ===== NAMUNA MA'LUMOTLAR — haqiqiylariga almashtiring ===== */
const teachers = [
  { name: "Ism Familiya", subject: "Matematika", role: "Fan o‘qituvchisi", exp: "10 yil" },
  { name: "Ism Familiya", subject: "Ona tili va adabiyot", role: "Metodik birlashma rahbari", exp: "15 yil" },
  { name: "Ism Familiya", subject: "Ingliz tili", role: "Fan o‘qituvchisi", exp: "7 yil" },
  { name: "Ism Familiya", subject: "Informatika", role: "Fan o‘qituvchisi", exp: "5 yil" },
  { name: "Ism Familiya", subject: "Fizika", role: "Direktor o‘rinbosari", exp: "18 yil" },
  { name: "Ism Familiya", subject: "Jismoniy tarbiya", role: "Fan o‘qituvchisi", exp: "12 yil" }
];
const gallery = ["Tadbir", "Sinfxona", "Sport", "Bayram", "Kutubxona", "Laboratoriya"];
const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const subjects = ["Matematika", "Ona tili", "Ingliz tili", "Informatika", "Fizika", "Tarix", "Biologiya", "Jismoniy tarbiya"];

/* ===== Yordamchi: haqiqiy rasm bo'lmasa namuna rasm yasaydi ===== */
function placeholder(text, i = 0) {
  const colors = ["#0f3a9e", "#0a2466", "#1d4ed8", "#c9a227", "#2f5fd0", "#173a8a"];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${colors[i % 6]}"/><text x="400" y="310" font-size="34" fill="#fff" text-anchor="middle" font-family="sans-serif">${text}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
function fillPlaceholders(root = document) {
  root.querySelectorAll("img[data-ph]").forEach((img, i) => {
    if (!img.getAttribute("src")) img.src = placeholder(img.dataset.ph, i);
  });
}

/* ===== Sahifalar (menyu) ===== */
const pages = document.querySelectorAll(".page");
const links = document.querySelectorAll("#menu a");
function show() {
  const id = (location.hash || "#home").slice(1);
  const target = document.getElementById(id) ? id : "home";
  pages.forEach(p => p.classList.toggle("on", p.id === target));
  links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + (target === "newsdetail" ? "news" : target)));
  document.getElementById("menu").classList.remove("open");
  window.scrollTo(0, 0);
  if (target === "about") runCounters();
}
window.addEventListener("hashchange", show);
document.getElementById("burger").onclick = () => document.getElementById("menu").classList.toggle("open");

/* ===== Statistika animatsiyasi ===== */
function runCounters() {
  document.querySelectorAll(".count").forEach(el => {
    const to = +el.dataset.to; let n = 0;
    const t = setInterval(() => {
      n += Math.ceil(to / 40);
      if (n >= to) { n = to; clearInterval(t); }
      el.textContent = n;
    }, 30);
  });
}

/* ===== O'qituvchilar ===== */
document.getElementById("teacherList").innerHTML = teachers.map((t, i) => `
  <div class="wrapper11">
    <img data-ph="Rasm (namuna)" alt="${t.name}">
    <h3 class="text5">${t.name}</h3>
    <p class="text3">Fan: ${t.subject}</p>
    <p class="text3">Lavozimi: ${t.role}</p>
    <p class="text3">Tajribasi: ${t.exp}</p>
    <span class="text6">NAMUNA</span>
  </div>`).join("");

/* ===== Galereya + kattalashtirish ===== */
document.getElementById("galleryList").innerHTML = gallery.map((g, i) =>
  `<img data-ph="${g} (namuna)" alt="${g}" style="aspect-ratio:${i % 2 ? "4/3" : "3/4"};object-fit:cover">`).join("");
const box = document.getElementById("lightbox");
document.getElementById("galleryList").addEventListener("click", e => {
  if (e.target.tagName !== "IMG") return;
  box.querySelector("img").src = e.target.src;
  box.classList.add("on");
});
box.onclick = () => box.classList.remove("on");
document.addEventListener("keydown", e => { if (e.key === "Escape") box.classList.remove("on"); });

document.getElementById("subjects").innerHTML = subjects.map(s => `<li>${s}</li>`).join("");

/* ===== Bo'limlar (tab) ===== */
document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tab,.tabbox").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  document.getElementById(b.dataset.tab).classList.add("on");
});

/* ===== Uy vazifalari (brauzerda saqlanadi) ===== */
let hw = [];
try { hw = JSON.parse(localStorage.getItem("hw11") || "[]"); } catch (e) {}
function renderHw() {
  document.getElementById("hwList").innerHTML = hw.length
    ? hw.map((h, i) => `<li><span><b>${h.s}:</b> ${h.t}</span><button data-d="${i}" aria-label="O‘chirish">✕</button></li>`).join("")
    : `<li>Hozircha vazifa yo‘q. Yuqoridan qo‘shing.</li>`;
  try { localStorage.setItem("hw11", JSON.stringify(hw)); } catch (e) {}
}
document.getElementById("hwAdd").onclick = () => {
  const s = document.getElementById("hwSubject"), t = document.getElementById("hwText");
  if (!s.value.trim() || !t.value.trim()) return;
  hw.push({ s: s.value.trim(), t: t.value.trim() });
  s.value = t.value = ""; renderHw();
};
document.getElementById("hwList").addEventListener("click", e => {
  if (e.target.dataset.d !== undefined) { hw.splice(+e.target.dataset.d, 1); renderHw(); }
});
renderHw();

/* ===== Aloqa formasi (hozircha faqat ko'rsatadi; serverga ulanmagan) ===== */
document.getElementById("contactForm").onsubmit = e => {
  e.preventDefault();
  document.getElementById("formNote").textContent = "Rahmat! Xabaringiz qabul qilindi. (Namuna: server ulanmagan)";
  e.target.reset();
};

fillPlaceholders();
show();

/* ===== Backend bilan ulanish: yangiliklar va dars jadvali ===== */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const CATS = ["Tadbirlar", "Olimpiadalar", "Sport", "Bayramlar", "Yutuqlar"];
const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const imgTag = n => n.image ? `<img src="${esc(n.image)}" alt="${esc(n.title)}">` : `<img data-ph="Rasm yo‘q" alt="">`;
const newsCard = n => `<div class="wrapper11">${imgTag(n)}<span class="text6">${esc(n.date)} · ${esc(n.category)}</span>
  <h3 class="text5">${esc(n.title)}</h3><p class="text3">${esc(n.summary)}</p>
  <a class="wrapper19" href="#newsdetail" data-id="${n.id}">Batafsil</a></div>`;

const newsCat = document.getElementById("newsCat"), newsSort = document.getElementById("newsSort");
newsCat.insertAdjacentHTML("beforeend", CATS.map(c => `<option>${c}</option>`).join(""));
async function loadNews() {
  const box = document.getElementById("newsList");
  try {
    const list = await api(`/api/news?category=${encodeURIComponent(newsCat.value)}&sort=${newsSort.value}`);
    box.innerHTML = list.map(newsCard).join("") || '<p class="text3">Yangilik topilmadi.</p>';
    fillPlaceholders(box);
  } catch { box.innerHTML = '<p class="text3">Yangiliklarni yuklab bo‘lmadi.</p>'; }
}
newsCat.onchange = newsSort.onchange = loadNews;
api("/api/news?sort=new&limit=3").then(l => {
  const b = document.getElementById("homeNews");
  b.innerHTML = l.map(newsCard).join("") || '<p class="text3">Hozircha yangilik yo‘q.</p>';
  fillPlaceholders(b);
}).catch(() => {});
loadNews();

document.addEventListener("click", async e => {
  const a = e.target.closest("[data-id]"); if (!a) return;
  const body = document.getElementById("newsBody");
  try {
    const n = await api("/api/news/" + a.dataset.id);
    body.innerHTML = `<a href="#news">← Yangiliklarga qaytish</a>
      <h2 class="text4" style="display:block;margin-top:16px">${esc(n.title)}</h2>
      <p class="text6">${esc(n.date)} · ${esc(n.category)}</p>
      <div style="margin:16px 0;max-width:640px">${imgTag(n)}</div>
      <p class="text3" style="white-space:pre-line">${esc(n.body || n.summary)}</p>`;
    fillPlaceholders(body);
  } catch { body.innerHTML = '<p class="text3">Yangilik topilmadi.</p>'; }
});

/* ===== Dars jadvali: 1–11-sinflar ===== */
const clsBox = document.getElementById("classBtns");
clsBox.innerHTML = Array.from({ length: 11 }, (_, i) => `<button class="cls" data-c="${i + 1}">${i + 1}-sinf</button>`).join("");
clsBox.onclick = e => { const b = e.target.closest("[data-c]"); if (b) loadSchedule(+b.dataset.c); };
async function loadSchedule(c) {
  clsBox.querySelectorAll(".cls").forEach(b => b.classList.toggle("on", +b.dataset.c === c));
  const box = document.getElementById("schedule");
  try {
    const r = await api("/api/schedule/" + c);
    const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const MO = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"], SH = ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan", "Yak"];
    const all = Object.values(r.data).flat(), last = Math.max(6, ...all.map(x => +x.n || 0));
    const head = SH.map((d, i) => { const t = new Date(mon); t.setDate(mon.getDate() + i); return `<th class="${i > 4 ? "wk" : ""}">${d}, ${t.getDate()} ${MO[t.getMonth()]}</th>`; }).join("");
    const cardOf = x => `<div class="lesson${x.g ? " g2" : ""}"><b>${esc(x.s)}</b><span>${esc(x.t)}</span><span>${esc(x.time)}</span><small>${esc(x.r)}</small></div>`;
    let body = "";
    for (let n = 1; n <= last; n++) {
      body += `<tr><th>${n}</th>` + DAYS.map(d => `<td>${(r.data[d] || []).filter(x => +x.n === n).map(cardOf).join("")}</td>`).join("") + "<td></td></tr>";
    }
    box.innerHTML = `<h3 class="text5">${c}-sinf dars jadvali</h3>` +
      (r.sample ? `<p class="text3">[NAMUNA] Bu jadval namunaviy. Haqiqiysini admin paneldan kiriting.</p>` : "") +
      `<div class="wrapper23"><table class="em"><tr><th></th>${head}</tr>${body}</table></div>`;
  } catch { box.innerHTML = '<p class="text3">Jadvalni yuklab bo‘lmadi.</p>'; }
}
document.getElementById("printBtn").onclick = () => window.print();
loadSchedule(8);
