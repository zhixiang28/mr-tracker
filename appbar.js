// Shared header for every signed-in page, so the brand, links and your-name menu sit in the same place everywhere.
//   <div id="appbar"></div>  ...  AppBar.mount("appbar", {active:"items", client: supabaseClient})
// Also provides the matching "page heading" styles (.pagehead: title on the left, actions on the right).
(function(w){
  const CSS = `
  .appbar{ display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:0 0 22px; font-family:inherit; }
  .appbar *{ box-sizing:border-box; }
  .appbar .ab-brand{ font-weight:800; font-size:20px; letter-spacing:-.3px; color:var(--ink,#1f2933); text-decoration:none; }
  .appbar .ab-brand span{ font-weight:400; color:var(--muted,#6b7280); }
  .appbar .ab-nav{ display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
  .appbar .ab-nav a, .appbar .ab-nav button.ab-ico{ font:inherit; font-size:13px; font-weight:600; color:var(--muted,#6b7280); text-decoration:none; padding:8px 12px; border-radius:8px; border:0; background:none; cursor:pointer; }
  .appbar .ab-nav a:hover, .appbar .ab-nav button.ab-ico:hover{ background:var(--hover,#e6eaf1); color:var(--ink,#1f2933); }
  .appbar .ab-nav a.on{ color:#2050bd; background:#e3ecfd; }
  .appbar .ab-user{ position:relative; }
  .appbar .ab-userbtn{ display:flex; align-items:center; gap:8px; padding:6px 10px 6px 6px; border:1px solid var(--line,#d7dbe0); background:var(--surface,#fff); border-radius:999px; font:inherit; font-size:13px; font-weight:600; color:var(--ink,#1f2933); cursor:pointer; }
  .appbar .ab-userbtn:hover{ background:var(--hover,#f4f6fa); }
  .appbar .ab-avatar{ width:26px; height:26px; border-radius:50%; background:#2f6fed; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; }
  .appbar .ab-role{ font-size:10.5px; font-weight:800; color:#fff; background:#ea580c; border-radius:999px; padding:1px 7px; }
  .appbar .ab-menu{ position:absolute; right:0; top:calc(100% + 6px); min-width:200px; background:var(--surface,#fff); border:1px solid var(--line,#d7dbe0); border-radius:12px; box-shadow:0 12px 30px rgba(15,23,42,.14); padding:6px; display:none; z-index:100; }
  .appbar .ab-menu.open{ display:block; }
  .appbar .ab-menu button, .appbar .ab-menu a{ display:block; width:100%; text-align:left; border:0; background:none; padding:9px 12px; border-radius:8px; font:inherit; font-size:13px; font-weight:600; color:var(--ink,#1f2933); text-decoration:none; cursor:pointer; }
  .appbar .ab-menu button:hover, .appbar .ab-menu a:hover{ background:var(--hover,#f4f6fa); }
  .appbar .ab-menu hr{ border:0; border-top:1px solid var(--line,#d7dbe0); margin:6px 4px; }
  .appbar .ab-menu .ab-out{ color:#dc2626; }
  .appbar .ab-menu .ab-ver{ display:block; width:100%; border-width:1px 0 0; border-radius:0; text-align:center; font-size:11px; color:var(--muted,#6b7280); padding:7px 12px 3px; border-top:1px solid var(--line,#d7dbe0); margin-top:4px; background:none; }
  .appbar .ab-menu .ab-ver:hover{ color:var(--ink,#1f2933); background:none; }
  /* page heading: title left, actions right — same on every page */
  .pagehead{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; margin:0 0 16px; }
  .pagehead h1{ margin:0; font-size:24px; letter-spacing:-.4px; color:inherit; }
  .pagehead .sub{ color:var(--muted,#6b7280); font-size:13px; margin-top:3px; }
  .pagehead .btns{ display:flex; gap:8px; flex-wrap:wrap; }
  .pagehead .btns button, .pagehead .btns a.btn{ padding:10px 16px; }
  /* "what's new" notice */
  .wn-back{ position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; z-index:1000; font-family:inherit; }
  .wn-box{ background:var(--surface,#fff); color:var(--ink,#1f2933); border-radius:16px; max-width:520px; width:100%; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,.3); }
  .wn-head{ flex:none; padding:22px 26px 12px; border-bottom:1px solid var(--line,#d7dbe0); background:var(--surface,#fff); }
  .wn-ver{ font-size:11px; font-weight:700; color:var(--muted,#6b7280); border:1px solid var(--line,#d7dbe0); border-radius:999px; padding:2px 8px; vertical-align:middle; margin-left:6px; }
  .wn-body{ overflow:auto; padding:6px 26px 6px; }
  .wn-box h2{ margin:0 0 4px; font-size:20px; letter-spacing:-.3px; }
  .wn-box .wn-sub{ color:var(--muted,#6b7280); font-size:13px; }
  .wn-box ul{ list-style:none; margin:0 0 16px; padding:0; }
  .wn-box li{ display:flex; gap:12px; padding:9px 0; border-top:1px solid var(--line,#d7dbe0); font-size:13.5px; line-height:1.45; }
  .wn-box li:first-child{ border-top:0; }
  .wn-box li b{ display:block; font-size:13.5px; }
  .wn-box li span.t{ color:var(--muted,#6b7280); font-size:12.5px; }
  .wn-dot{ flex:none; width:8px; height:8px; border-radius:50%; background:#2f6fed; margin-top:6px; }
  .wn-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 26px 18px; border-top:1px solid var(--line,#d7dbe0); }
  .wn-foot label{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--ink,#1f2933); cursor:pointer; }
  .wn-foot button{ font:inherit; font-size:13px; font-weight:700; padding:10px 22px; border-radius:8px; border:1px solid #2f6fed; background:#2f6fed; color:#fff; cursor:pointer; }
  .wn-foot button:hover{ background:#2050bd; }
  @media print{ .appbar, .pagehead .btns, .wn-back{ display:none !important; } }
  `;
  const NAV = [
    {id:"dashboard", label:"Dashboard",        href:"dashboard.html"},
    {id:"items",     label:"Purchase History", href:"items.html"},
    {id:"analytics", label:"Analytics",        href:"analytics.html"},
    {id:"projects",  label:"Projects",         href:"projects.html"},
    {id:"admin",     label:"Admin Settings",   href:"admin.html", admin:true}
  ];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  let state = {opts:{}, isAdmin:false, root:null};

  function isAdminCached(){ try{ return sessionStorage.getItem("sl_is_admin")==="1"; }catch(_){ return false; } }
  function logout(){
    ["sl_person_id","sl_person_name","sl_pin","sl_is_admin"].forEach(k=>{ try{ sessionStorage.removeItem(k); }catch(_){} });
    const here = location.pathname.split("/").pop() || "dashboard.html";
    location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
  function go(page, newTab){ if(newTab) window.open(page, "_blank"); else location.href = page; }

  function render(){
    const o = state.opts, name = (function(){ try{ return sessionStorage.getItem("sl_person_name")||""; }catch(_){ return ""; } })();
    const links = NAV.filter(n=>!n.admin || state.isAdmin).map(n=>`<a href="${n.href}" class="${o.active===n.id?"on":""}">${esc(n.label)}</a>`).join("");
    state.root.innerHTML = `<div class="appbar">
      <a class="ab-brand" href="dashboard.html"${o.newTab?' target="_blank" rel="noopener"':""}>SPACE<span>logic</span> — MR Tracker</a>
      <div class="ab-nav">
        ${links}
        ${o.onRefresh ? `<button class="ab-ico" data-act="refresh" title="Reload" aria-label="Reload">↻</button>` : ""}
        <div class="ab-user">
          <button class="ab-userbtn" data-act="menu" aria-haspopup="true"><span class="ab-avatar">${esc((name||"?").trim().charAt(0).toUpperCase())}</span><span>${esc(name)}</span>${state.isAdmin?'<span class="ab-role">Admin</span>':""} ▾</button>
          <div class="ab-menu" id="abMenu">
            <button data-act="profile">My Profile</button>
            <button data-act="pin">Change PIN</button>
            <button data-act="reminders">Reminder Settings</button>
            <hr>
            <button data-act="tour">Quick tour</button>
            <a href="manual.html" target="_blank" rel="noopener">Manual</a>
            <a href="manual.html#faq" target="_blank" rel="noopener">FAQ</a>
            <hr>
            <button class="ab-out" data-act="logout">Log out</button>
            <button class="ab-ver" data-act="whatsnew" title="See what's new">Version ${esc(VERSION)}</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function mount(id, opts){
    state.opts = opts || {};
    state.root = typeof id==="string" ? document.getElementById(id) : id;
    if(!document.getElementById("appbar-css")){ const st = document.createElement("style"); st.id="appbar-css"; st.textContent = CSS; document.head.appendChild(st); }
    state.isAdmin = isAdminCached();
    render();
    if(state.opts.notice !== false){ if(!maybeTour()) showNotice(); }
    if(state.opts.client && state.opts.assistant !== false){
      const boot = ()=>{ try{ window.Assistant && window.Assistant.mount(state.opts.client); }catch(_){} };
      if(window.Assistant) boot();
      else { const sc = document.createElement("script"); sc.src = "assistant.js"; sc.onload = boot; document.head.appendChild(sc); }
    }
    state.root.addEventListener("click", e=>{
      const t = e.target.closest("[data-act]"); if(!t) return;
      const act = t.getAttribute("data-act"), o = state.opts;
      if(act==="menu"){ e.stopPropagation(); document.getElementById("abMenu").classList.toggle("open"); return; }
      document.getElementById("abMenu").classList.remove("open");
      if(act==="logout") logout();
      else if(act==="whatsnew") showNotice(true);
      else if(act==="tour") runTour();
      else if(act==="refresh" && o.onRefresh) o.onRefresh();
      else if(act==="profile") (o.onProfile || (()=>go("dashboard.html?open=profile", o.newTab)))();
      else if(act==="pin") (o.onPin || (()=>go("dashboard.html?open=pin", o.newTab)))();
      else if(act==="reminders") (o.onReminders || (()=>go("dashboard.html?open=reminders", o.newTab)))();
    });
    document.addEventListener("click", ()=>{ const m=document.getElementById("abMenu"); if(m) m.classList.remove("open"); });
    // not known yet on this browser tab: ask once, then remember
    if(!isAdminCached() && sessionStorage.getItem("sl_is_admin")===null && state.opts.client){
      const id = sessionStorage.getItem("sl_person_id"), pin = sessionStorage.getItem("sl_pin");
      if(id && pin) state.opts.client.rpc("verify_admin", {p_person_id:id, p_pin:pin}).then(r=>{ if(r && !r.error) setAdmin(r.data===true); });
    }
  }
  /* ---- one-time "What's new" notice (remembered per browser; bump the id to show a new one) ---- */
  const VERSION = "2026.10.14";
  const NOTICE_ID = "upgrade-2026-10f";
  const NOTICE = [
    ["One simple way to sign", "There is now just one button on the form: Submit for approval. You get one link; each approver opens it, taps their box and either draws a signature or declines with a reason."],
    ["Sign in with your email", "Use your company email and PIN — just type the first part, @spacelogic.com.sg is added for you. After 5 wrong PINs an account is locked for 15 minutes."],
    ["Signed in? Sign as yourself", "If you are signed in, signing asks for your PIN and links the signature to your account, so it shows on your Dashboard."],
    ["Clear result cards", "Submitting, signing, declining, withdrawing and other actions now end with a short card that tells you what happened and what's next."],
    ["Quick tour", "New here? Your name menu → Quick tour points at each part of the Dashboard."],
    ["Ask MR Tracker", "The blue Ask button answers questions like “where is REQ-00031?”, “did my screws arrive?” or “which supplier did we use for cable?”."],
    ["Your profile", "You can change your name in My Profile. Your email is your sign-in ID, so an admin changes it if needed."]
  ];
  function showNotice(force){
    if(!force){ try{ if(localStorage.getItem("sl_notice_seen")===NOTICE_ID) return; }catch(_){} }
    if(document.getElementById("wnBack")) return;
    const back = document.createElement("div"); back.className="wn-back"; back.id="wnBack";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","What's new");
    back.innerHTML = `<div class="wn-box">
      <div class="wn-head"><h2>The system has been upgraded <span class="wn-ver">${esc(VERSION)}</span></h2><div class="wn-sub">Here's what's new for you:</div></div>
      <div class="wn-body">
        <ul>${NOTICE.map(n=>`<li><span class="wn-dot"></span><div><b>${esc(n[0])}</b><span class="t">${esc(n[1])}</span></div></li>`).join("")}</ul>
      </div>
      <div class="wn-foot"><label><input type="checkbox" id="wnDont" checked> Don't show this again</label><button type="button" id="wnOk">Got it</button></div>
    </div>`;
    const close = ()=>{
      try{ if(document.getElementById("wnDont").checked) localStorage.setItem("sl_notice_seen", NOTICE_ID); }catch(_){}
      back.remove(); document.removeEventListener("keydown", onKey);
    };
    const onKey = e=>{ if(e.key==="Escape") close(); };
    back.addEventListener("click", e=>{ if(e.target===back) close(); });
    back.querySelector("#wnOk").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
    back.querySelector("#wnOk").focus({preventScroll:true});
  }

  /* ---- quick tour: shown once to a brand-new account (flag set at sign-up), or any time from the name menu ---- */
  function runTour(){
    // the tour points at Dashboard controls, so run it there
    if(state.opts.active !== "dashboard"){ location.href = "dashboard.html?tour=1"; return; }
    const go = ()=>{ setTimeout(()=>{ try{ window.Tour && window.Tour.start(); }catch(_){} }, 700); };
    if(window.Tour) go(); else { const sc = document.createElement("script"); sc.src = "tour.js"; sc.onload = go; document.head.appendChild(sc); }
  }
  function maybeTour(){
    try{
      const pid = sessionStorage.getItem("sl_person_id");
      if(state.opts.active === "dashboard" && new URLSearchParams(location.search).get("tour") === "1"){
        history.replaceState(null, "", location.pathname); runTour(); return true;
      }
      if(!pid || state.opts.active !== "dashboard" || localStorage.getItem("sl_tour_pending") !== pid) return false;
      localStorage.removeItem("sl_tour_pending");
      localStorage.setItem("sl_notice_seen", NOTICE_ID);   // a new account doesn't need the "what's new" list
      runTour(); return true;
    }catch(_){ return false; }
  }

  function setAdmin(v){
    try{ sessionStorage.setItem("sl_is_admin", v ? "1" : "0"); }catch(_){}
    if(state.root && state.isAdmin !== !!v){ state.isAdmin = !!v; render(); }
  }
  /* ---- two-step confirmation for risky actions: resolves true only after both steps ---- */
  function confirmTwice(o){
    return new Promise(resolve=>{
      if(!document.getElementById("cfCss")){ const st=document.createElement("style"); st.id="cfCss"; st.textContent=`
        .cf-back{ position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; padding:18px; z-index:1100; font-family:inherit; }
        .cf-box{ background:#fff; color:#1f2933; border-radius:14px; max-width:440px; width:100%; padding:22px 24px; box-shadow:0 24px 60px rgba(0,0,0,.3); }
        .cf-box h3{ margin:0 0 8px; font-size:17px; }
        .cf-box p{ margin:0 0 6px; font-size:13.5px; line-height:1.5; color:#475569; }
        .cf-box .cf-step{ font-size:11px; font-weight:800; letter-spacing:.4px; text-transform:uppercase; color:#6b7280; margin-bottom:6px; }
        .cf-box.cf-last{ border-top:4px solid #dc2626; }
        .cf-foot{ display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
        .cf-foot button{ font:inherit; font-size:13px; font-weight:700; padding:9px 16px; border-radius:8px; border:1px solid #d7dbe0; background:#fff; color:#1f2933; cursor:pointer; }
        .cf-foot button.go{ background:#2f6fed; border-color:#2f6fed; color:#fff; }
        .cf-foot button.danger{ background:#dc2626; border-color:#dc2626; color:#fff; }`; document.head.appendChild(st); }
      const back = document.createElement("div"); back.className="cf-back"; back.setAttribute("role","alertdialog"); back.setAttribute("aria-modal","true");
      const done = v=>{ document.removeEventListener("keydown", onKey); back.remove(); resolve(v); };
      const onKey = e=>{ if(e.key==="Escape") done(false); };
      const step1 = ()=>{
        back.innerHTML = `<div class="cf-box"><div class="cf-step">Step 1 of 2</div><h3>${esc(o.title)}</h3>${(o.lines||[]).map(l=>`<p>${esc(l)}</p>`).join("")}
          <div class="cf-foot"><button type="button" data-a="no">Cancel</button><button type="button" class="go" data-a="next">Continue</button></div></div>`;
        back.querySelector('[data-a="no"]').focus();
      };
      const step2 = ()=>{
        back.innerHTML = `<div class="cf-box cf-last"><div class="cf-step">Step 2 of 2 — last check</div><h3>${esc(o.finalTitle||"Are you sure?")}</h3><p>${esc(o.finalText||"This cannot be undone.")}</p>
          <div class="cf-foot"><button type="button" data-a="no">No, keep it</button><button type="button" class="danger" data-a="yes">${esc(o.confirmLabel||"Yes, do it")}</button></div></div>`;
        back.querySelector('[data-a="no"]').focus();
      };
      back.addEventListener("click", e=>{
        const a = e.target.getAttribute && e.target.getAttribute("data-a");
        if(e.target===back || a==="no") done(false);
        else if(a==="next") step2();
        else if(a==="yes") done(true);
      });
      document.addEventListener("keydown", onKey);
      step1(); document.body.appendChild(back);
      back.querySelector('[data-a="no"]').focus();
    });
  }
  const CONFIRM = {
    regen:{title:"Replace this signing link?", lines:["The link you already sent will stop working straight away.","Anyone using the old link will see an error until you send them the new one."], finalTitle:"Really replace the link?", finalText:"The original link will be disabled and cannot be brought back. Only continue if the old link was lost or sent to the wrong person.", confirmLabel:"Yes, replace the link"},
    withdraw:{title:"Withdraw this requisition?", lines:["This stops the approval chain. Nobody will be able to sign it any more.","Withdrawing is not the same as rejecting: the requester cannot fix and resubmit it."], finalTitle:"Really withdraw it?", finalText:"This cannot be undone.", confirmLabel:"Yes, withdraw it"},
    reject:{title:"Reject this requisition?", lines:["It goes back to the requester with your reason, and the approval chain stops.","The requester can then fix it and resubmit."], finalTitle:"Really reject it?", finalText:"The requester will be told and the signing links will stop working until they resubmit.", confirmLabel:"Yes, reject it"},
    del:{title:"Delete this requisition?", lines:["The requisition and all its items and signatures will be permanently removed.","Nobody will be able to open it again."], finalTitle:"Really delete it for good?", finalText:"This is permanent and cannot be undone. If you only want to stop it, use Withdraw instead.", confirmLabel:"Yes, delete it"}
  };
  w.AppBar = {mount, setAdmin, confirmTwice, CONFIRM};
})(window);
