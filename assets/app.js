const CONFIG = { ip: "91.197.6.134:29269", discord: "https://discord.gg/FPkRSKw5Y", version: "26.1.2", contentPath: "data/content.json" };
const C = window.VALORIA_CONFIG;               
const cfgProblem = !C ? "config.js introuvable ou non chargé (vérifie assets/config.js et index.html)"
  : !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(C.url || "") ? "url invalide dans config.js (attendu : https://xxxx.supabase.co, sans rien après)"
  : (!C.key || C.key.length < 20 || /COLLE_ICI/i.test(C.key)) ? "clé non remplacée dans config.js (mets la clé anon ou publishable)"
  : "";
const hasCfg = !cfgProblem;
let S = null, ready = false, tab = "staff", wikiSel = null, timer = null;
let code = sessionStorage.getItem("vc") || "", authed = !!code;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => "i" + Math.random().toString(36).slice(2, 9);
const page = () => (location.hash || "#accueil").slice(1);
const roleColor = r => (S.roles.find(x => x.name === r) || {}).color || "#6b7280";
const rank = r => S.roles.findIndex(x => x.name === r);

function api(path, body) {
  const h = { apikey: C.key, "Content-Type": "application/json" };
  if (C.key.startsWith("eyJ")) h.Authorization = "Bearer " + C.key;
  return fetch(C.url + "/rest/v1/" + path, body ? { method: "POST", headers: h, body: JSON.stringify(body) } : { headers: h })
    .then(async r => { const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.message || r.status); return j; });
}
function save() {
  if (!ready) return toast("Base non connectée : modification non enregistrée.", true);
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const r = await api("rpc/admin_save_content", { p_code: code, p_content: S });
      if (r.ok) toast("Enregistré ✓");
      else if (r.error === "locked") toast("Trop d’essais, réessaie dans 15 min.", true);
      else { toast("Session expirée, reconnecte-toi.", true); logout(); }
    } catch (e) { toast("Échec de l’enregistrement : " + e.message, true); }
  }, 700);
}
async function login() {
  if (!hasCfg) return toast("Config : " + cfgProblem, true);
  const c = $("#code").value;
  try {
    const r = await api("rpc/admin_login", { p_code: c });
    if (r.ok) { authed = true; code = c; sessionStorage.setItem("vc", c); render(); }
    else toast(r.error === "locked" ? "Trop d’essais. Réessaie dans 15 min." : "Code incorrect.", true);
  } catch (e) { toast("Erreur : " + e.message, true); }
}
function logout() { authed = false; code = ""; sessionStorage.removeItem("vc"); render(); }

function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "on" + (err ? " err" : ""); clearTimeout(t._t); t._t = setTimeout(() => t.className = "", 2600); }
function md(s) {
  let out = "", ul = false;
  esc(s).split("\n").forEach(l => {
    l = l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    if (/^- /.test(l)) { if (!ul) { out += "<ul>"; ul = true; } out += "<li>" + l.slice(2) + "</li>"; return; }
    if (ul) { out += "</ul>"; ul = false; }
    if (/^## /.test(l)) out += "<h3>" + l.slice(3) + "</h3>"; else if (l.trim()) out += "<p>" + l + "</p>";
  });
  return out + (ul ? "</ul>" : "");
}


function skinIds(s) {
  const out = [], u = (s.namemc || "").trim();
  const uu = u.match(/namemc\.com\/profile\/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})(?![0-9a-f])/i);
  if (uu) out.push(uu[1].replace(/-/g, ""));
  else {
    const nm = u.match(/namemc\.com\/(?:profile\/|search\?q=)([A-Za-z0-9_]{1,16})/i);
    if (nm) out.push(nm[1]);
    else if (/^[A-Za-z0-9_]{1,16}$/.test(u)) out.push(u);   // pseudo collé seul
  }
  const n = (s.name || "").trim();
  if (n) out.push(n);
  return [...new Set(out)];
}
function skinSrcs(id) {
  const l = [`https://mc-heads.net/avatar/${id}/128`, `https://minotar.net/helm/${id}/128.png`, `https://api.mineatar.io/face/${id}?scale=8`];
  if (/^[0-9a-f]{32}$/i.test(id)) l.push(`https://crafatar.com/avatars/${id}?size=128&overlay`);
  return l;
}
function skinList(s) {
  const u = (s.namemc || "").trim(), l = [];
  const sk = u.match(/namemc\.com\/skin\/([0-9a-f]{16})(?![0-9a-f])/i) || u.match(/^([0-9a-f]{16})$/i);
  if (sk) l.push(`https://s.namemc.com/2d/skin/face.png?id=${sk[1]}&scale=4`);
  return l.concat(skinIds(s).flatMap(skinSrcs));
}
function skinHtml(s) {
  if (/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(s.head || "")) return `<img class="av" src="${s.head}" alt="${esc(s.name)}">`;
  const l = skinList(s), ini = esc((s.name || "?").slice(0, 2).toUpperCase()), col = roleColor(s.role);
  if (!l.length) return `<div class="av" style="background:${col}">${ini}</div>`;
  return `<img class="av" src="${esc(l[0])}" data-l="${esc(JSON.stringify(l))}" data-n="0" data-c="${col}" data-i="${ini}" alt="${esc(s.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="skinErr(this)">`;
}
function skinErr(img) {
  const l = JSON.parse(img.dataset.l), n = +img.dataset.n + 1;
  if (n < l.length) { img.dataset.n = n; img.src = l[n]; return; }
  const d = document.createElement("div"); d.className = "av"; d.style.background = img.dataset.c; d.textContent = img.dataset.i; img.replaceWith(d);
}
const profileUrl = s => /^https?:\/\/([a-z]{2}\.)?namemc\.com\//i.test(s.namemc || "") ? s.namemc : "https://namemc.com/profile/" + encodeURIComponent(s.name);
function uploadSkin(i, input) {
  const f = input.files[0]; if (!f) return;
  if (f.size > 300000) return toast("Fichier trop gros (max 300 Ko).", true);
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    URL.revokeObjectURL(url);
    if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) return toast("Skin invalide : il doit faire 64×64 (ou 64×32) pixels.", true);
    const a = document.createElement("canvas"); a.width = a.height = 8;
    const x = a.getContext("2d"); x.imageSmoothingEnabled = false;
    x.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);     // visage
    x.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);    // couche chapeau
    const b = document.createElement("canvas"); b.width = b.height = 64;
    const c = b.getContext("2d"); c.imageSmoothingEnabled = false;
    c.drawImage(a, 0, 0, 8, 8, 0, 0, 64, 64);
    S.staff[i].head = b.toDataURL("image/png");
    const top = window.scrollY; save(); render(); window.scrollTo(0, top);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Image illisible.", true); };
  img.src = url;
}

const V = {
  accueil: () => `<section class="hero"><h1>ValoriaSMP</h1><p class="lead">${esc(S.home.tagline)}</p>
    <div class="ip"><span>${CONFIG.ip}</span><button class="btn" id="cp" onclick="copyIp()">Copier</button></div>
    <div class="row"><a class="btn" href="${CONFIG.discord}" target="_blank" rel="noopener">Rejoindre le Discord</a><a class="btn alt" href="#reglement">Règlement</a></div>
    <div class="status" id="status"><span class="dot"></span> Minecraft Java ${CONFIG.version}</div></section>
    <div class="grid">${S.home.feats.map(f => `<div class="card feat"><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p></div>`).join("")}</div>
    <div class="card md" style="margin-top:20px">${md(S.home.about)}</div>`,
  reglement: () => `<h2>Règlement</h2><div class="card">${S.rules.map((r, i) => `<div class="rule"><div class="num">${i + 1}</div><div><b>${esc(r.t)}</b><p>${esc(r.d)}</p></div></div>`).join("")}</div>
    <p class="note">Jouer sur ValoriaSMP implique d’accepter ce règlement, susceptible d’évoluer à tout moment.</p>`,
  wiki: () => {
    if (!S.wiki.some(w => w.id === wikiSel)) wikiSel = S.wiki[0]?.id;
    const cur = S.wiki.find(w => w.id === wikiSel);
    return `<h2>Wiki</h2><div class="wiki"><div class="side">${S.wiki.map(w => `<button class="${w.id === wikiSel ? "on" : ""}" onclick="wikiSel='${w.id}';render()">${esc(w.t)}</button>`).join("")}</div>
    <div class="card md">${cur ? `<h2 style="font-size:16px">${esc(cur.t)}</h2>${md(cur.body)}` : "<p>Aucune page.</p>"}</div></div>`;
  },
  staff: () => `<h2>L’équipe</h2><div class="grid">${[...S.staff].sort((a, b) => rank(b.role) - rank(a.role)).map(s => `
    <a class="card staff" href="${esc(profileUrl(s))}" target="_blank" rel="noopener">
    ${skinHtml(s)}
    <b>${esc(s.name)}</b><br><span class="badge" style="background:${roleColor(s.role)}">${esc(s.role)}</span></a>`).join("")}</div>`,
  admin: () => {
    if (!authed) return `<h2>Administration</h2><div class="card" style="max-width:360px"><label>Code d’accès</label><input id="code" type="password" placeholder="••••" onkeydown="if(event.key==='Enter')login()"><p></p><button class="btn" onclick="login()">Entrer</button></div>`;
    const tabs = [["staff", "Staff"], ["rules", "Règlement"], ["wiki", "Wiki"], ["home", "Accueil"]];
    return `<h2>Panel admin</h2><div class="tabs">${tabs.map(t => `<button class="btn sm ${tab === t[0] ? "" : "alt"}" onclick="tab='${t[0]}';render()">${t[1]}</button>`).join("")}
      <span class="note" style="margin-left:auto">${ready ? "🟢 Base de données connectée · enregistrement automatique" : "🔴 Base non connectée (config.js introuvable ou Supabase injoignable)"}</span><button class="btn sm alt" onclick="logout()">Quitter</button></div>${A[tab]()}`;
  }
};
const del = (arr, i) => `onclick="S.${arr}.splice(${i},1);save();render()"`;
const A = {
  staff: () => S.staff.map((s, i) => `<div class="item"><div class="two"><div><label>Pseudo Minecraft</label><input value="${esc(s.name)}" oninput="S.staff[${i}].name=this.value;save()"></div>
    <div><label>Grade</label><select onchange="S.staff[${i}].role=this.value;save()">${S.roles.map(r => `<option ${r.name === s.role ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
    <button class="btn del" ${del("staff", i)}>Retirer</button></div>
    <label>Skin complet (fichier .png 64×64) – seule la tête est gardée</label>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${s.head ? `<img class="av" style="margin:0;width:48px;height:48px" src="${esc(s.head)}" alt="">` : ""}<input type="file" accept="image/png" style="flex:1;min-width:200px" onchange="uploadSkin(${i},this)">${s.head ? `<button class="btn alt sm" onclick="S.staff[${i}].head='';save();render()">Retirer la tête</button>` : ""}</div>
    <label>Lien NameMC du skin (ex : https://namemc.com/skin/5d5eb6d84b57ea29) ou du profil</label>
    <input value="${esc(s.namemc)}" placeholder="https://namemc.com/skin/..." oninput="S.staff[${i}].namemc=this.value.trim();save()"></div>`).join("") +
    `<button class="btn" onclick="S.staff.push({id:uid(),name:'Nouveau',role:S.roles[0].name,namemc:''});save();render()">+ Ajouter un staff</button>`,
  rules: () => S.rules.map((r, i) => `<div class="item"><div class="two"><div><label>Règle ${i + 1}</label><input value="${esc(r.t)}" oninput="S.rules[${i}].t=this.value;save()"></div><span></span><button class="btn del" ${del("rules", i)}>Retirer</button></div>
    <label>Description</label><textarea style="min-height:70px" oninput="S.rules[${i}].d=this.value;save()">${esc(r.d)}</textarea></div>`).join("") +
    `<button class="btn" onclick="S.rules.push({t:'Nouvelle règle',d:''});save();render()">+ Ajouter une règle</button>`,
  wiki: () => `<p class="note">Mise en forme : <code>## Titre</code> · <code>- liste</code> · <code>**gras**</code></p>` + S.wiki.map((w, i) => `<div class="item"><div class="two"><div><label>Titre</label><input value="${esc(w.t)}" oninput="S.wiki[${i}].t=this.value;save()"></div><span></span><button class="btn del" ${del("wiki", i)}>Retirer</button></div>
    <label>Contenu</label><textarea oninput="S.wiki[${i}].body=this.value;save()">${esc(w.body)}</textarea></div>`).join("") +
    `<button class="btn" onclick="S.wiki.push({id:uid(),t:'Nouvelle page',body:'## Titre\\n'});save();render()">+ Ajouter une page</button>`,
  home: () => `<div class="item"><label>Phrase d’accroche</label><textarea style="min-height:70px" oninput="S.home.tagline=this.value;save()">${esc(S.home.tagline)}</textarea>
    <label>Texte de présentation</label><textarea style="min-height:200px" oninput="S.home.about=this.value;save()">${esc(S.home.about)}</textarea></div>` +
    S.home.feats.map((f, i) => `<div class="item"><label>Bloc ${i + 1} – titre</label><input value="${esc(f.t)}" oninput="S.home.feats[${i}].t=this.value;save()"><label>Description</label><input value="${esc(f.d)}" oninput="S.home.feats[${i}].d=this.value;save()"></div>`).join("")
};
function copyIp() { const ok = () => $("#cp").textContent = "Copié ✓"; navigator.clipboard?.writeText(CONFIG.ip).then(ok, ok); }
async function loadStatus() {
  const el = $("#status"); if (!el) return;
  try {
    const d = await (await fetch("https://api.mcsrvstat.us/3/" + CONFIG.ip)).json();
    el.innerHTML = d.online ? `<span class="dot on"></span> En ligne · ${d.players?.online ?? 0}/${d.players?.max ?? "?"} joueurs · ${CONFIG.version}` : `<span class="dot off"></span> Hors ligne`;
  } catch { }
}
function render() {
  let p = page(); if (!V[p]) p = "accueil";
  document.body.classList.remove("menu");
  $("#nav").innerHTML = [["accueil", "Accueil"], ["reglement", "Règlement"], ["wiki", "Wiki"], ["staff", "Staff"]].map(n => `<a href="#${n[0]}" class="${n[0] === p ? "on" : ""}">${n[1]}</a>`).join("");
  $("#app").innerHTML = V[p](); window.scrollTo(0, 0);
  if (p === "accueil") loadStatus();
}
async function init() {
  $("#year").textContent = new Date().getFullYear();
  let base;
  try { base = await (await fetch(CONFIG.contentPath + "?v=" + Date.now())).json(); }
  catch { $("#app").innerHTML = "<p>Impossible de charger le contenu. Lance le site via un serveur (GitHub Pages ou <code>python -m http.server</code>).</p>"; return; }
  let db = {};
  if (hasCfg) { try { const r = await api("site_content?select=content&id=eq.1"); db = r[0]?.content || {}; ready = true; } catch (e) { console.warn("Supabase :", e.message); } }
  S = { ...base, ...db };             
  window.addEventListener("hashchange", render); render();
}
init();
