/* ValoriaSMP – site vitrine statique. Contenu dans data/content.json */
const CONFIG = {
  ip: "valoriasmp.minecraft.how",
  discord: "https://discord.gg/FPkRSKw5Y",
  version: "1.21.10",
  // SHA-256 du code admin (ici "1234"). Génère le tien : echo -n "moncode" | sha256sum
  adminHash: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4",
  contentPath: "data/content.json"
};
let S = null, authed = sessionStorage.getItem("va") === "1", tab = "staff", wikiSel = null, timer = null, remote = "";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => "i" + Math.random().toString(36).slice(2, 9);
const page = () => (location.hash || "#accueil").slice(1);
const roleColor = r => (S.roles.find(x => x.name === r) || {}).color || "#6b7280";
const cfgGet = () => { try { return JSON.parse(localStorage.getItem("valoria-gh") || "{}"); } catch { return {}; } };

function toast(msg, err) { const t = $("#toast"); t.textContent = msg; t.className = "on" + (err ? " err" : ""); clearTimeout(t._t); t._t = setTimeout(() => t.className = "", 2200); }
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
async function sha256(t) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }

/* ---------- Brouillon + publication ---------- */
function draft() { clearTimeout(timer); timer = setTimeout(() => { localStorage.setItem("valoria-draft", JSON.stringify(S)); toast("Brouillon enregistré ✓"); }, 400); }
function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
async function publish() {
  const c = cfgGet();
  if (!c.owner || !c.repo || !c.token) { tab = "settings"; render(); return toast("Renseigne d’abord les paramètres GitHub.", true); }
  const api = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${CONFIG.contentPath}`, br = c.branch || "main";
  const h = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" };
  try {
    const g = await fetch(`${api}?ref=${br}`, { headers: h }); const sha = g.ok ? (await g.json()).sha : undefined;
    const r = await fetch(api, { method: "PUT", headers: h, body: JSON.stringify({ message: "Mise à jour du contenu via le panel admin", content: b64(JSON.stringify(S, null, 2)), sha, branch: br }) });
    if (!r.ok) throw new Error((await r.json()).message || r.status);
    localStorage.removeItem("valoria-draft"); toast("Publié ✓ (en ligne dans ~1 min)");
  } catch (e) { toast("Échec : " + e.message, true); }
}
function exportJson() { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" })); a.download = "content.json"; a.click(); }
function resetDraft() { if (confirm("Annuler le brouillon et revenir à la version en ligne ?")) { localStorage.removeItem("valoria-draft"); S = JSON.parse(remote); render(); } }

/* ---------- Vues ---------- */
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
  staff: () => `<h2>L’équipe</h2><div class="grid">${S.staff.map(s => `<div class="card staff">
    <img class="av" src="https://mc-heads.net/avatar/${encodeURIComponent(s.name)}/128" alt="${esc(s.name)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;av&quot; style=&quot;background:${roleColor(s.role)}&quot;>${esc((s.name || "?").slice(0, 2).toUpperCase())}</div>'">
    <b>${esc(s.name)}</b><br><span class="badge" style="background:${roleColor(s.role)}">${esc(s.role)}</span></div>`).join("")}</div>`,
  admin: () => {
    if (!authed) return `<h2>Administration</h2><div class="card" style="max-width:360px"><label>Code d’accès</label><input id="code" type="password" inputmode="numeric" placeholder="••••" onkeydown="if(event.key==='Enter')login()"><p></p><button class="btn" onclick="login()">Entrer</button></div>`;
    const tabs = [["staff", "Staff"], ["rules", "Règlement"], ["wiki", "Wiki"], ["home", "Accueil"], ["settings", "⚙ GitHub"]];
    return `<h2>Panel admin</h2><div class="tabs">${tabs.map(t => `<button class="btn sm ${tab === t[0] ? "" : "alt"}" onclick="tab='${t[0]}';render()">${t[1]}</button>`).join("")}
      <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" onclick="publish()">🚀 Publier</button><button class="btn sm alt" onclick="exportJson()">Exporter</button><button class="btn sm alt" onclick="resetDraft()">Annuler</button><button class="btn sm alt" onclick="logout()">Quitter</button></span></div>${A[tab]()}`;
  }
};
const del = (arr, i) => `onclick="S.${arr}.splice(${i},1);draft();render()"`;
const A = {
  staff: () => S.staff.map((s, i) => `<div class="item two"><div><label>Pseudo Minecraft</label><input value="${esc(s.name)}" oninput="S.staff[${i}].name=this.value;draft()"></div>
    <div><label>Grade</label><select onchange="S.staff[${i}].role=this.value;draft()">${S.roles.map(r => `<option ${r.name === s.role ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
    <button class="btn del" ${del("staff", i)}>Retirer</button></div>`).join("") +
    `<button class="btn" onclick="S.staff.push({id:uid(),name:'Nouveau',role:S.roles[S.roles.length-1].name});draft();render()">+ Ajouter un staff</button>`,
  rules: () => S.rules.map((r, i) => `<div class="item"><div class="two"><div><label>Règle ${i + 1}</label><input value="${esc(r.t)}" oninput="S.rules[${i}].t=this.value;draft()"></div><span></span><button class="btn del" ${del("rules", i)}>Retirer</button></div>
    <label>Description</label><textarea style="min-height:70px" oninput="S.rules[${i}].d=this.value;draft()">${esc(r.d)}</textarea></div>`).join("") +
    `<button class="btn" onclick="S.rules.push({t:'Nouvelle règle',d:''});draft();render()">+ Ajouter une règle</button>`,
  wiki: () => `<p class="note">Mise en forme : <code>## Titre</code> · <code>- liste</code> · <code>**gras**</code></p>` + S.wiki.map((w, i) => `<div class="item"><div class="two"><div><label>Titre</label><input value="${esc(w.t)}" oninput="S.wiki[${i}].t=this.value;draft()"></div><span></span><button class="btn del" ${del("wiki", i)}>Retirer</button></div>
    <label>Contenu</label><textarea oninput="S.wiki[${i}].body=this.value;draft()">${esc(w.body)}</textarea></div>`).join("") +
    `<button class="btn" onclick="S.wiki.push({id:uid(),t:'Nouvelle page',body:'## Titre\\n'});draft();render()">+ Ajouter une page</button>`,
  home: () => `<div class="item"><label>Phrase d’accroche</label><textarea style="min-height:70px" oninput="S.home.tagline=this.value;draft()">${esc(S.home.tagline)}</textarea>
    <label>Texte de présentation</label><textarea style="min-height:200px" oninput="S.home.about=this.value;draft()">${esc(S.home.about)}</textarea></div>` +
    S.home.feats.map((f, i) => `<div class="item"><label>Bloc ${i + 1} – titre</label><input value="${esc(f.t)}" oninput="S.home.feats[${i}].t=this.value;draft()"><label>Description</label><input value="${esc(f.d)}" oninput="S.home.feats[${i}].d=this.value;draft()"></div>`).join(""),
  settings: () => { const c = cfgGet(); return `<div class="item"><p class="note">Pour publier en un clic, crée un <b>token fine-grained</b> GitHub limité à ce dépôt avec la permission <i>Contents : Read and write</i>. Il reste stocké uniquement dans ton navigateur.</p>
    <label>Utilisateur / organisation GitHub</label><input id="g1" value="${esc(c.owner)}"><label>Nom du dépôt</label><input id="g2" value="${esc(c.repo)}">
    <label>Branche</label><input id="g3" value="${esc(c.branch || "main")}"><label>Token</label><input id="g4" type="password" value="${esc(c.token)}"><p></p>
    <button class="btn" onclick="saveCfg()">Enregistrer</button></div>`; }
};
function saveCfg() { localStorage.setItem("valoria-gh", JSON.stringify({ owner: $("#g1").value.trim(), repo: $("#g2").value.trim(), branch: $("#g3").value.trim() || "main", token: $("#g4").value.trim() })); toast("Paramètres enregistrés ✓"); }
async function login() { if (await sha256($("#code").value) === CONFIG.adminHash) { authed = true; sessionStorage.setItem("va", "1"); render(); } else toast("Code incorrect.", true); }
function logout() { authed = false; sessionStorage.removeItem("va"); render(); }
function copyIp() {
  const ok = () => $("#cp").textContent = "Copié ✓";
  navigator.clipboard?.writeText(CONFIG.ip).then(ok, ok);
}
async function loadStatus() {
  const el = $("#status"); if (!el) return;
  try {
    const d = await (await fetch("https://api.mcsrvstat.us/3/" + CONFIG.ip)).json();
    el.innerHTML = d.online ? `<span class="dot on"></span> En ligne · ${d.players?.online ?? 0}/${d.players?.max ?? "?"} joueurs · ${CONFIG.version}` : `<span class="dot off"></span> Hors ligne`;
  } catch { /* on garde l’affichage par défaut */ }
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
  try { remote = await (await fetch(CONFIG.contentPath + "?v=" + Date.now())).text(); S = JSON.parse(remote); }
  catch { $("#app").innerHTML = "<p>Impossible de charger le contenu. Lance le site via un serveur (GitHub Pages ou <code>python -m http.server</code>).</p>"; return; }
  if (authed) { try { const d = localStorage.getItem("valoria-draft"); if (d) S = JSON.parse(d); } catch { } }
  window.addEventListener("hashchange", render); render();
}
init();
