const CATS = ["Tül", "Fon", "Stor", "Zebra", "Jalüzi", "Plise", "Dikey", "Bambu / Ahşap", "Fransız / Balon", "Korniş / Rustik", "Diğer"];
const STATS = ["Ölçü alındı", "Teklif verildi", "Sipariş", "Montaj bekliyor", "Teslim edildi"];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const src = (file) => "pv://photo/" + encodeURIComponent(file);

let photos = [], custs = [], dataDir = "", cat = "", lbList = [], lbI = 0, lbMode = "g";
let editId = null, cPhotos = [], cRemoved = [], cAdded = [], edId = null;

function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2200); }
function fmtDate(d) { if (!d) return ""; const [y, m, dd] = d.split("-"); return dd + "." + m + "." + y; }
function fmtNum(n) { return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 }); }

function apply(snap) {
  photos = snap.photos.slice().sort((a, b) => b.createdAt - a.createdAt);
  custs = snap.customers.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt);
  dataDir = snap.dataDir;
  $("#dirPath").textContent = dataDir;
  showBackup(snap.backup);
  renderGallery(); renderCusts();
}
async function reload() { try { apply(await window.api.load()); } catch (e) { toast("Veriler okunamadı"); } }

/* tabs */
function showTab(t) {
  document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  $("#view-g").hidden = t !== "g"; $("#view-m").hidden = t !== "m";
  $("#addBtn").hidden = t !== "g";
  try { localStorage.setItem("pv-tab", t); } catch (e) {}
}
document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

/* gallery */
function renderChips() {
  const counts = {}; photos.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
  if (cat && !counts[cat]) cat = "";
  const list = [["", "Tümü", photos.length], ...CATS.filter((c) => counts[c]).map((c) => [c, c, counts[c]])];
  $("#chips").innerHTML = list.map(([v, l, n]) => `<button class="chip" data-c="${esc(v)}" aria-pressed="${v === cat}">${esc(l)}<span class="n">${n}</span></button>`).join("");
  $("#chips").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { cat = b.dataset.c; renderGallery(); }));
}
const visible = () => (cat ? photos.filter((p) => p.cat === cat) : photos);
function renderGallery() {
  renderChips();
  const v = visible();
  if (!photos.length) {
    $("#gstate").innerHTML = `<div class="empty"><h3>Henüz örnek iş yok</h3><p>Sağ üstteki <b>Fotoğraf ekle</b> ile yapılmış işlerin fotoğraflarını yükle.</p></div>`;
    $("#grid").innerHTML = ""; return;
  }
  $("#gstate").innerHTML = "";
  $("#grid").innerHTML = v.map((p, i) => `<button class="tile" data-i="${i}"><img loading="lazy" src="${src(p.file)}" alt="${esc(p.cat + " " + (p.note || ""))}"><span class="cap"><span class="cat">${esc(p.cat)}</span>${p.note ? `<br>${esc(p.note)}` : ""}</span></button>`).join("");
  $("#grid").querySelectorAll(".tile").forEach((b) => (b.onclick = () => openLb(v.map((p) => ({ ...p, url: src(p.file) })), +b.dataset.i, "g")));
}

/* presenter */
function openLb(list, i, mode) {
  lbMode = mode; lbList = list; lbI = i; $("#lb").hidden = false;
  $("#strip").innerHTML = list.map((p, j) => `<button data-j="${j}" aria-label="Fotoğraf ${j + 1}"><img loading="lazy" src="${p.url}" alt=""></button>`).join("");
  $("#strip").querySelectorAll("button").forEach((b) => (b.onclick = () => { lbI = +b.dataset.j; drawLb(); }));
  drawLb();
}
function drawLb() {
  const p = lbList[lbI]; if (!p) return closeLb();
  $("#lbImg").src = p.url; $("#lbCat").textContent = p.cat; $("#lbTitle").textContent = p.note || "";
  $("#lbCount").textContent = lbI + 1 + " / " + lbList.length;
  $("#lbDel").hidden = $("#lbEdit").hidden = lbMode !== "g"; $("#lbDelYes").hidden = true;
  $("#strip").querySelectorAll("button").forEach((b, j) => { b.classList.toggle("on", j === lbI); if (j === lbI) b.scrollIntoView({ block: "nearest", inline: "center" }); });
}
function step(d) { if (!lbList.length) return; lbI = (lbI + d + lbList.length) % lbList.length; drawLb(); }
function closeLb() { $("#lb").hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
$("#lbPrev").onclick = () => step(-1); $("#lbNext").onclick = () => step(1); $("#lbClose").onclick = closeLb;
$("#lbFull").onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else $("#lb").requestFullscreen().catch(() => {}); };
$("#lbDel").onclick = () => { $("#lbDel").hidden = true; $("#lbDelYes").hidden = false; };
$("#lbDelYes").onclick = async () => {
  const p = lbList[lbI];
  apply(await window.api.deletePhoto(p.id));
  lbList = lbList.filter((x) => x.id !== p.id); if (lbI >= lbList.length) lbI = 0;
  toast("Fotoğraf silindi"); lbList.length ? openLb(lbList, lbI, "g") : closeLb();
};
$("#lbEdit").onclick = () => {
  const p = lbList[lbI]; edId = p.id;
  $("#edImg").src = p.url; $("#edCat").value = p.cat; $("#edNote").value = p.note || "";
  $("#edSheet").hidden = false; $("#edNote").focus();
};
$("#edCat").innerHTML = CATS.map((c) => `<option>${c}</option>`).join("");
$("#edForm").onsubmit = async (e) => {
  e.preventDefault();
  const c = $("#edCat").value, n = $("#edNote").value.trim();
  apply(await window.api.updatePhoto(edId, c, n));
  lbList = lbList.map((x) => (x.id === edId ? { ...x, cat: c, note: n } : x));
  $("#edSheet").hidden = true; drawLb(); toast("Kaydedildi");
};
document.addEventListener("keydown", (e) => {
  if ($("#lb").hidden || !$("#edSheet").hidden) return;
  if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1);
  else if (e.key === "Escape" && !document.fullscreenElement) { e.stopImmediatePropagation(); closeLb(); }
}, true);

/* image shrink → bytes */
async function toBytes(file) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return { bytes: await blob.arrayBuffer(), ext: "jpg" };
  } catch (e) {
    return { bytes: await file.arrayBuffer(), ext: (file.name.split(".").pop() || "jpg").toLowerCase() };
  }
}

/* upload gallery photos */
$("#upCat").innerHTML = CATS.map((c) => `<option>${c}</option>`).join("");
$("#addBtn").onclick = () => { $("#upForm").reset(); if (cat) $("#upCat").value = cat; $("#upProg").textContent = ""; $("#upErr").textContent = ""; $("#upSheet").hidden = false; };
$("#upForm").onsubmit = async (e) => {
  e.preventDefault();
  const files = [...$("#upFiles").files]; if (!files.length) return;
  $("#upGo").disabled = true; $("#upErr").textContent = "";
  try {
    const items = [];
    for (let i = 0; i < files.length; i++) { $("#upProg").textContent = `Hazırlanıyor ${i + 1} / ${files.length}`; items.push(await toBytes(files[i])); }
    const c = $("#upCat").value;
    apply(await window.api.addPhotos(items, c, $("#upNote").value.trim()));
    cat = c; renderGallery(); $("#upSheet").hidden = true; toast(files.length + " fotoğraf eklendi");
  } catch (err) { $("#upErr").textContent = "Yüklenemedi: " + (err.message || err); }
  $("#upGo").disabled = false; $("#upProg").textContent = "";
};

/* customers */
$("#cStat").innerHTML = STATS.map((s) => `<option>${s}</option>`).join("");
$("#fstat").innerHTML += STATS.map((s) => `<option>${s}</option>`).join("");
function winRow(w = {}) {
  const d = document.createElement("div"); d.className = "win";
  d.innerHTML = `<label>Oda / pencere<input class="w-room" value="${esc(w.room)}" placeholder="Salon sağ"></label>
  <label>En (cm)<input class="w-en num" type="number" min="0" step="0.5" value="${esc(w.en || "")}"></label>
  <label>Boy (cm)<input class="w-boy num" type="number" min="0" step="0.5" value="${esc(w.boy || "")}"></label>
  <label>Ürün / model<input class="w-model" value="${esc(w.model)}" placeholder="Tül + fon"></label>
  <button type="button" class="x" aria-label="Pencereyi sil">✕</button>
  <label class="wnote">Not<input class="w-note" value="${esc(w.note)}" placeholder="Korniş, pile, montaj notu"></label>`;
  d.querySelector(".x").onclick = () => { d.remove(); sum(); };
  d.querySelectorAll("input").forEach((i) => (i.oninput = sum));
  return d;
}
function readWins() {
  return [...$("#wins").children].map((d) => ({
    room: d.querySelector(".w-room").value.trim(), en: parseFloat(d.querySelector(".w-en").value) || 0,
    boy: parseFloat(d.querySelector(".w-boy").value) || 0, model: d.querySelector(".w-model").value.trim(), note: d.querySelector(".w-note").value.trim(),
  })).filter((w) => w.room || w.en || w.boy || w.model || w.note);
}
const totEn = (ws) => ws.reduce((a, w) => a + (+w.en || 0), 0);
function sum() { const ws = readWins(); $("#cSum").textContent = ws.length ? `${ws.length} pencere · toplam en ${fmtNum(totEn(ws))} cm` : ""; }

function renderCPh() {
  const box = $("#cPh");
  box.innerHTML = cPhotos.map((f, i) => `<div class="ph"><button type="button" class="open" data-i="${i}" aria-label="Fotoğrafı büyüt"><img src="${src(f)}" alt="Ölçü fotoğrafı ${i + 1}"></button><button type="button" class="rm" data-i="${i}" aria-label="Fotoğrafı kaldır">✕</button></div>`).join("") +
    `<label class="addph">+ Fotoğraf ekle<span class="note">Ölçü kâğıdı, pencere</span><input id="cPhIn" type="file" accept="image/*" multiple></label>`;
  box.querySelectorAll(".open").forEach((b) => (b.onclick = () => openLb(cPhotos.map((f) => ({ url: src(f), cat: $("#cName").value || "Müşteri", note: "Ölçü fotoğrafı" })), +b.dataset.i, "c")));
  box.querySelectorAll(".rm").forEach((b) => (b.onclick = () => { const [f] = cPhotos.splice(+b.dataset.i, 1); if (f) cRemoved.push(f); renderCPh(); }));
  $("#cPhIn").onchange = async (e) => {
    const files = [...e.target.files];
    for (let i = 0; i < files.length; i++) {
      $("#cPhProg").textContent = `Yükleniyor ${i + 1} / ${files.length}`;
      try { const { bytes, ext } = await toBytes(files[i]); const f = await window.api.uploadFile(bytes, ext); cPhotos.push(f); cAdded.push(f); renderCPh(); }
      catch (err) { $("#cErr").textContent = `${files[i].name} yüklenemedi: ${err.message || err}`; }
    }
    $("#cPhProg").textContent = cPhotos.length ? cPhotos.length + " fotoğraf" : "";
  };
}
function openCust(c) {
  editId = c ? c.id : null; $("#cForm").reset();
  $("#cTitle").textContent = c ? c.name : "Yeni ölçü";
  $("#cName").value = c?.name || ""; $("#cPhone").value = c?.phone || ""; $("#cAddr").value = c?.addr || "";
  $("#cDate").value = c?.date || new Date().toISOString().slice(0, 10); $("#cStaff").value = c?.staff || "";
  $("#cStat").value = c?.status || STATS[0]; $("#cNote").value = c?.note || "";
  $("#wins").innerHTML = ""; (c?.windows?.length ? c.windows : [{}]).forEach((w) => $("#wins").appendChild(winRow(w)));
  cPhotos = [...(c?.photos || [])]; cRemoved = []; cAdded = []; $("#cPhProg").textContent = ""; renderCPh();
  $("#cDel").hidden = !c; $("#cDelConfirm").hidden = true; $("#cErr").textContent = ""; sum();
  $("#cSheet").hidden = false; $("#cName").focus();
}
function closeCust(saved) {
  // Photos uploaded but never saved are discarded.
  if (!saved) window.api.deleteFiles(cAdded);
  cAdded = []; $("#cSheet").hidden = true;
}
$("#newCust").onclick = () => openCust(null);
$("#addWin").onclick = () => { const r = winRow(); $("#wins").appendChild(r); r.querySelector(".w-room").focus(); };
$("#cForm").onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    id: editId || undefined, name: $("#cName").value.trim(), phone: $("#cPhone").value.trim(), addr: $("#cAddr").value.trim(),
    date: $("#cDate").value, staff: $("#cStaff").value.trim(), status: $("#cStat").value, note: $("#cNote").value.trim(),
    windows: readWins(), photos: cPhotos,
  };
  $("#cSave").disabled = true;
  try {
    apply(await window.api.saveCustomer(data));
    window.api.deleteFiles(cRemoved); cRemoved = [];
    closeCust(true); toast("Kaydedildi");
  } catch (err) { $("#cErr").textContent = "Kaydedilemedi: " + (err.message || err); }
  $("#cSave").disabled = false;
};
$("#cDel").onclick = () => { $("#cDel").hidden = true; $("#cDelConfirm").hidden = false; };
$("#cDelYes").onclick = async () => { apply(await window.api.deleteCustomer(editId)); window.api.deleteFiles(cAdded); cAdded = []; $("#cSheet").hidden = true; toast("Silindi"); };

const statCls = (s) => (s === "Teslim edildi" ? "s2" : s === "Sipariş" || s === "Montaj bekliyor" ? "s1" : "");
function renderCusts() {
  const q = $("#q").value.toLocaleLowerCase("tr-TR").trim(), fs = $("#fstat").value;
  const v = custs.filter((c) => (!fs || c.status === fs) && (!q || [c.name, c.phone, c.addr].join(" ").toLocaleLowerCase("tr-TR").includes(q)));
  if (!custs.length) {
    $("#listWrap").hidden = true;
    $("#mstate").innerHTML = `<div class="empty"><h3>Henüz ölçü kaydı yok</h3><p>Müşteri adı, telefon, adres, pencere ölçüleri ve ölçü fotoğrafları burada tutulur.<br><b>Yeni ölçü</b> ile ilk kaydı oluştur.</p></div>`;
    return;
  }
  $("#mstate").innerHTML = v.length ? "" : `<p class="note">Aramaya uyan kayıt yok.</p>`; $("#listWrap").hidden = !v.length;
  $("#rows").innerHTML = v.map((c) => `<tr data-id="${esc(c.id)}"><td><div class="cname">${esc(c.name)}${c.photos?.length ? `<span class="camtag">${c.photos.length} foto</span>` : ""}</div><div class="note">${esc(c.addr)}</div></td><td class="num">${esc(c.phone)}</td><td class="num">${(c.windows || []).length}</td><td class="num">${fmtNum(totEn(c.windows || []))} cm</td><td>${esc(c.staff)}</td><td class="num">${fmtDate(c.date)}</td><td><span class="pill ${statCls(c.status)}">${esc(c.status)}</span></td></tr>`).join("");
  $("#rows").querySelectorAll("tr").forEach((r) => (r.onclick = () => openCust(custs.find((c) => c.id === r.dataset.id))));
}
$("#q").oninput = renderCusts; $("#fstat").onchange = renderCusts;

/* sheets */
function closeSheet(bg) { if (bg.id === "cSheet") closeCust(false); else bg.hidden = true; }
document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeSheet(b.closest(".sheet-bg"))));
document.querySelectorAll(".sheet-bg").forEach((bg) => bg.addEventListener("mousedown", (e) => { if (e.target === bg) closeSheet(bg); }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll(".sheet-bg:not([hidden])").forEach(closeSheet); });

/* settings */
$("#setBtn").onclick = () => ($("#setSheet").hidden = false);
$("#chooseDir").onclick = async () => { apply(await window.api.chooseDataDir()); toast("Veri klasörü güncellendi"); };
$("#openDir").onclick = () => window.api.openDataDir();

function showBackup(b) {
  if (!b) return;
  const ago = b.lastAt ? new Date(b.lastAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "";
  $("#bkPath").textContent = b.dir || "Yedek klasörü seçilmedi";
  $("#bkLast").textContent = b.dir ? (ago ? "Son yedek: " + ago : "Henüz yedek alınmadı") : "";
  $("#bkErr").textContent = b.error || "";
  const ok = b.dir && !b.error;
  $("#bkPill").textContent = ok ? "Açık" : b.error ? "Hata" : "Kapalı";
  $("#bkPill").className = "pill " + (ok ? "s2" : "");
  $("#bkDot").hidden = ok;
  $("#bkNow").disabled = $("#bkOpen").disabled = !b.dir;
}
$("#bkChoose").onclick = async () => { showBackup(await window.api.chooseBackupDir()); };
$("#bkNow").onclick = async () => { const b = await window.api.backupNow(); showBackup(b); toast(b.error ? "Yedek alınamadı" : "Yedek alındı"); };
$("#bkOpen").onclick = () => window.api.openBackupDir();
window.api.onBackup(showBackup);

/* boot */
let start = "g"; try { start = localStorage.getItem("pv-tab") || "g"; } catch (e) {}
showTab(start);
window.api.onChanged(() => { if ($("#cSheet").hidden) reload(); });
reload();
