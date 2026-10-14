/* Shared "result card" pop-up for MR Tracker: a coloured header with an icon, a short message, an optional
   4-step tracker, and clear buttons. Used for: request submitted, signed, declined, withdrawn, rejected, deleted,
   link replaced, PIN changed, invite to create an account...

   Notify.show({
     tone: "success" | "info" | "warn" | "danger",     header colour
     icon: "check" | "x" | "undo" | "trash" | "link" | "key" | "send" | "edit",
     title, sub,
     track: {done: 0-n, labels?: [...]},                optional progress tracker (default Manager → Procurement → Purchase → Received)
     html: "<p>…</p>",                                  optional custom block under the header
     tiles: [{icon, label}],                            optional icon tiles
     primary: {label, href | onClick}, secondary: {label, href | onClick},
     small: "text under the buttons",
     hideKey: "storage_key",                            adds a "Don't show again" tick box
     onClose: fn
   }) -> {close} */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const S = 'width="{n}" height="{n}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
    undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    track:'<circle cx="5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="19" cy="12" r="2.5"/><path d="M7.5 12h2M14.5 12h2"/>',
    form:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    price:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'
  };
  const icon = (name, n, c, wd) => `<svg ${S.replace(/\{n\}/g,n).replace("{c}",c).replace("{w}",wd||2)}>${P[name]||P.check}</svg>`;
  const GRAD = { success:"linear-gradient(160deg,#2f6fed 0%,#1e3a8a 100%)", info:"linear-gradient(160deg,#3b82f6 0%,#334155 100%)",
                 warn:"linear-gradient(160deg,#f59e0b 0%,#b45309 100%)", danger:"linear-gradient(160deg,#ef4444 0%,#991b1b 100%)" };

  const CSS = `
  .iv-back{ position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:16px; z-index:1300; font-family:inherit; }
  .iv{ width:100%; max-width:400px; max-height:94vh; overflow:auto; background:#fff; color:#1f2933; border-radius:22px; box-shadow:0 24px 60px rgba(0,0,0,.35); text-align:center; animation:ivIn .3s ease; }
  @keyframes ivIn{ from{ transform:translateY(14px) scale(.97); opacity:0; } to{ transform:none; opacity:1; } }
  .iv-hero{ color:#fff; padding:26px 22px 22px; }
  .iv-ico{ width:58px; height:58px; border-radius:50%; background:rgba(255,255,255,.18); display:flex; align-items:center; justify-content:center; margin:0 auto 10px; }
  .iv-hero h2{ margin:0; font-size:22px; letter-spacing:-.3px; } .iv-hero .s{ opacity:.88; font-size:13px; margin-top:4px; line-height:1.45; }
  .iv-track{ display:flex; align-items:center; justify-content:center; margin:18px auto 0; max-width:300px; }
  .iv-track .d{ width:14px; height:14px; border-radius:50%; background:rgba(255,255,255,.3); flex:none; }
  .iv-track .d.ok{ background:#4ade80; } .iv-track .d.now{ background:#fff; box-shadow:0 0 0 4px rgba(255,255,255,.3); }
  .iv-track .l{ flex:1; height:3px; background:rgba(255,255,255,.3); } .iv-track .l.ok{ background:#4ade80; }
  .iv-lbl{ display:flex; justify-content:space-between; max-width:330px; margin:6px auto 0; font-size:10px; opacity:.85; }
  .iv-body{ padding:18px 22px 20px; text-align:center; }
  .iv-html{ text-align:left; font-size:13px; line-height:1.55; color:#4b5563; margin-bottom:14px; }
  .iv-html p{ margin:0 0 8px; } .iv-html b{ color:#111827; }
  .iv-html .link-copy-box{ display:flex; gap:6px; margin:8px 0; } .iv-html .link-copy-box input{ flex:1; min-width:0; font-size:12px; padding:8px 10px; border:1px solid #d7dbe0; border-radius:8px; }
  .iv-html button{ font:inherit; font-size:12.5px; font-weight:700; padding:8px 12px; border-radius:8px; border:1px solid #d7dbe0; background:#fff; cursor:pointer; }
  .iv-html input[type=email], .iv-html input[type=text]{ font:inherit; font-size:12.5px; padding:8px 10px; border:1px solid #d7dbe0; border-radius:8px; }
  .iv-tiles{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:0 0 16px; }
  .iv-tile{ background:#f3f6fc; border-radius:12px; padding:12px 6px 10px; font-size:11.5px; font-weight:700; color:#1f2933; line-height:1.3; }
  .iv-tile svg{ display:block; margin:0 auto 6px; }
  .iv-btn{ display:block; width:100%; box-sizing:border-box; border:0; cursor:pointer; font:inherit; font-weight:800; font-size:14.5px; padding:13px; border-radius:12px; text-decoration:none; }
  .iv-btn.p{ background:#2f6fed; color:#fff; } .iv-btn.p:hover{ background:#2050bd; } .iv-btn.p.danger{ background:#dc2626; } .iv-btn.p.danger:hover{ background:#b91c1c; }
  .iv-btn.s{ background:none; color:#4b5563; font-weight:700; font-size:13px; padding:10px; margin-top:4px; }
  .iv-btn:focus{ outline:3px solid #93c5fd; outline-offset:2px; }
  .iv-small{ font-size:11.5px; color:#6b7280; margin-top:8px; }
  .iv-foot{ display:flex; justify-content:flex-start; align-items:center; margin-top:10px; font-size:12px; color:#6b7280; }
  .iv-foot label{ display:flex; gap:6px; align-items:center; cursor:pointer; }
  @media print{ .iv-back{ display:none!important; } }`;

  function show(o){
    o = o || {};
    try{ if(o.hideKey && localStorage.getItem(o.hideKey)==="1") return null; }catch(_){}
    if(!document.getElementById("ivCss")){ const st=document.createElement("style"); st.id="ivCss"; st.textContent=CSS; document.head.appendChild(st); }
    const old = document.getElementById("ivBack"); if(old) old.remove();
    const tone = GRAD[o.tone] ? o.tone : "success";
    const ico = o.icon || (tone==="danger" ? "x" : tone==="warn" ? "undo" : "check");
    let track = "";
    if(o.track){
      const labels = (o.track.labels && o.track.labels.length) ? o.track.labels : ["Manager","Procurement","Purchase","Received"], n = labels.length;
      const done = Math.max(0, Math.min(n, o.track.done|0));
      const dots = labels.map((_,k)=>`<span class="d ${k<done?"ok":k===done?"now":""}"></span>${k<n-1?`<span class="l ${k<done-1?"ok":""}"></span>`:""}`).join("");
      track = `<div class="iv-track">${dots}</div><div class="iv-lbl">${labels.map(l=>`<span>${esc(l)}</span>`).join("")}</div>`;
    }
    const tiles = (o.tiles||[]).length ? `<div class="iv-tiles">${o.tiles.map(t=>`<div class="iv-tile">${icon(t.icon,26,"#2f6fed")}${esc(t.label)}</div>`).join("")}</div>` : "";
    const btn = (b, cls) => !b ? "" : b.href ? `<a class="iv-btn ${cls}${o.tone==="danger"&&cls==="p"?" danger":""}" href="${esc(b.href)}" data-a="${cls}">${esc(b.label)}</a>`
                                              : `<button type="button" class="iv-btn ${cls}${o.tone==="danger"&&cls==="p"?" danger":""}" data-a="${cls}">${esc(b.label)}</button>`;
    const back = document.createElement("div"); back.className = "iv-back"; back.id = "ivBack";
    back.setAttribute("role","alertdialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label", o.title||"Done");
    back.innerHTML = `<div class="iv">
      <div class="iv-hero" style="background:${GRAD[tone]}"><div class="iv-ico">${icon(ico,30,"#fff",3)}</div><h2>${esc(o.title||"Done")}</h2>${o.sub?`<div class="s">${esc(o.sub)}</div>`:""}${track}</div>
      <div class="iv-body">${o.html?`<div class="iv-html">${o.html}</div>`:""}${tiles}${btn(o.primary,"p")}${btn(o.secondary,"s")}
        ${o.small?`<div class="iv-small">${esc(o.small)}</div>`:""}
        ${o.hideKey?`<div class="iv-foot"><label><input type="checkbox" id="ivHide"> Don't show again</label></div>`:""}</div></div>`;
    let closed = false;
    const close = ()=>{
      if(closed) return; closed = true;
      try{ const h = document.getElementById("ivHide"); if(h && h.checked && o.hideKey) localStorage.setItem(o.hideKey,"1"); }catch(_){}
      document.removeEventListener("keydown", onKey); back.remove(); if(o.onClose) o.onClose();
    };
    const onKey = e=>{ if(e.key==="Escape") close(); };
    back.addEventListener("click", e=>{
      if(e.target===back){ close(); return; }
      const el = e.target.closest && e.target.closest("[data-a]"); if(!el) return;
      const which = el.getAttribute("data-a"), b = which==="p" ? o.primary : o.secondary;
      if(b && b.onClick){ const keep = b.onClick(el, close); if(keep !== false && !b.keepOpen) close(); }
      else if(!b || !b.href) close();                 // links navigate by themselves
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    const f = back.querySelector(".iv-btn.p"); if(f) f.focus({preventScroll:true});
    return {close};
  }

  w.Notify = {show, icon};
})(window);
