/* Onboarding for MR Tracker:
   Tour.start()      step-by-step guide for new users (also from the name menu -> "Quick tour")
   Tour.afterSign()  friendly pop-up shown to someone who just signed a PDF without an account */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const CSS = `
  .tr-back{ position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; padding:18px; z-index:1200; font-family:inherit; }
  .tr-box{ background:#fff; color:#1f2933; border-radius:18px; max-width:480px; width:100%; max-height:92vh; overflow:auto; box-shadow:0 24px 60px rgba(0,0,0,.35); }
  .tr-top{ background:linear-gradient(135deg,#2f6fed,#1e3a8a); color:#fff; padding:22px 26px 18px; border-radius:18px 18px 0 0; }
  .tr-top .tr-k{ font-size:11px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; opacity:.85; }
  .tr-top h2{ margin:6px 0 0; font-size:21px; letter-spacing:-.3px; }
  .tr-body{ padding:18px 26px 6px; font-size:14px; line-height:1.6; color:#374151; }
  .tr-body ul{ margin:8px 0 0; padding-left:18px; } .tr-body li{ margin:5px 0; }
  .tr-body b{ color:#111827; }
  .tr-dots{ display:flex; justify-content:center; gap:6px; padding:10px 0 2px; }
  .tr-dots i{ width:7px; height:7px; border-radius:50%; background:#d1d5db; } .tr-dots i.on{ background:#2f6fed; width:20px; border-radius:99px; }
  .tr-foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:14px 26px 20px; flex-wrap:wrap; }
  .tr-foot .tr-r{ display:flex; gap:8px; margin-left:auto; }
  .tr-foot button, .tr-foot a.tr-btn{ font:inherit; font-size:13px; font-weight:700; padding:10px 18px; border-radius:9px; border:1px solid #d7dbe0; background:#fff; color:#1f2933; cursor:pointer; text-decoration:none; display:inline-block; }
  .tr-foot .go, .tr-foot a.tr-btn.go{ background:#2f6fed; border-color:#2f6fed; color:#fff; } .tr-foot .go:hover, .tr-foot a.tr-btn.go:hover{ background:#2050bd; }
  .tr-skip{ border:0!important; background:none!important; color:#6b7280!important; font-weight:600!important; padding-left:0!important; }
  .tr-chk{ display:flex; align-items:center; gap:7px; font-size:12.5px; color:#6b7280; }
  @media print{ .tr-back{ display:none!important; } }`;

  function css(){ if(document.getElementById("trCss")) return; const st=document.createElement("style"); st.id="trCss"; st.textContent=CSS; document.head.appendChild(st); }

  /* ---------------- step-by-step guide ---------------- */
  const STEPS = [
    {k:"Welcome", t:"Welcome to MR Tracker", h:`<p>MR Tracker is where SPACElogic <b>requests, approves and tracks purchases</b> of materials — from the first request to the day the items arrive.</p>
      <p>This 1-minute guide shows you around. You can open it again any time from your name menu → <b>Quick tour</b>.</p>`},
    {k:"Step 1", t:"Create a requisition", h:`<ul>
      <li>Press <b>+ New requisition</b> on the Dashboard.</li>
      <li>Pick your <b>project</b> from the list (or save a new one), then add each item: name, quantity and price. Click the Item box to reuse something we bought before.</li>
      <li>Price in another currency? Use the <b>Currency converter</b>.</li>
      <li>Not ready? Press <b>Save Draft</b> and finish later.</li></ul>`},
    {k:"Step 2", t:"Get it signed", h:`<ul>
      <li>At the bottom choose <b>PIN Sign</b> (each approver types their PIN) or <b>PDF Sign</b> (each approver draws their signature on the PDF form).</li>
      <li>You get <b>one link</b> for the whole chain. Send it to the Team Manager; after each signature it opens on the next person's turn.</li>
      <li>Order: <b>Manager → Procurement → Purchase → Received</b>.</li></ul>`},
    {k:"Step 3", t:"Track the progress", h:`<ul>
      <li>The <b>Dashboard</b> shows every requisition by stage. Switch between <b>List</b> and <b>Cards</b>.</li>
      <li>Point at a row to preview its items and who has signed; click it to open the full form.</li>
      <li><b>Needs action</b> shows what is waiting on you.</li></ul>`},
    {k:"Step 4", t:"If something is declined", h:`<ul>
      <li>The reason shows right on the dashboard.</li>
      <li>Open it, press <b>Fix &amp; Resubmit in form</b>, change what was flagged and resubmit. Approval starts again from the Team Manager.</li>
      <li>You can also <b>Withdraw</b> a requisition until it is purchased.</li></ul>`},
    {k:"Step 5", t:"Find things and get help", h:`<ul>
      <li><b>Purchase History</b> — what we bought before, the supplier and the price.</li>
      <li><b>Projects</b> and <b>Analytics</b> — the shared project list and your spending.</li>
      <li>The blue <b>Ask</b> button answers questions like “where is REQ-00031?” or “how do I withdraw?”.</li>
      <li>Your name menu has <b>My Profile</b>, <b>Change PIN</b>, <b>Manual</b> and <b>FAQ</b>.</li></ul>`},
    {k:"Done", t:"You're ready", h:`<p>That's all you need to start. Press <b>+ New requisition</b> when you have something to buy, or open the <b>Manual</b> any time for details.</p>`}
  ];

  function start(opts){
    opts = opts || {}; css();
    if(document.getElementById("trBack")) return;
    let i = 0;
    const back = document.createElement("div"); back.className = "tr-back"; back.id = "trBack";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","Quick tour");
    const close = ()=>{ document.removeEventListener("keydown", onKey); back.remove(); if(opts.onClose) opts.onClose(); };
    const onKey = e=>{ if(e.key==="Escape") close(); else if(e.key==="ArrowRight") go(1); else if(e.key==="ArrowLeft") go(-1); };
    function draw(){
      const s = STEPS[i], last = i===STEPS.length-1;
      back.innerHTML = `<div class="tr-box"><div class="tr-top"><div class="tr-k">${esc(s.k)} · ${i+1} of ${STEPS.length}</div><h2>${esc(s.t)}</h2></div>
        <div class="tr-body">${s.h}</div>
        <div class="tr-dots">${STEPS.map((_,k)=>`<i class="${k===i?"on":""}"></i>`).join("")}</div>
        <div class="tr-foot">${last?"":'<button type="button" class="tr-skip" data-a="skip">Skip tour</button>'}
          <div class="tr-r">${i>0?'<button type="button" data-a="back">Back</button>':""}<button type="button" class="go" data-a="${last?"done":"next"}">${last?"Get started":"Next"}</button></div></div></div>`;
      const g = back.querySelector(".go"); if(g) g.focus();
    }
    function go(d){ const n = i + d; if(n<0) return; if(n>=STEPS.length){ close(); return; } i = n; draw(); }
    back.addEventListener("click", e=>{
      const a = e.target.getAttribute && e.target.getAttribute("data-a");
      if(a==="next") go(1); else if(a==="back") go(-1); else if(a==="skip"||a==="done") close();
    });
    document.addEventListener("keydown", onKey);
    draw(); document.body.appendChild(back);
  }

  /* ---------------- after a PDF signature, for people without an account ---------------- */
  function afterSign(){
    try{ if(sessionStorage.getItem("sl_person_id")) return; if(localStorage.getItem("sl_aftersign_hide")==="1") return; }catch(_){}
    css();
    if(document.getElementById("trBack")) return;
    const back = document.createElement("div"); back.className = "tr-back"; back.id = "trBack";
    back.setAttribute("role","dialog"); back.setAttribute("aria-modal","true"); back.setAttribute("aria-label","Thank you");
    back.innerHTML = `<div class="tr-box"><div class="tr-top"><div class="tr-k">Signature saved</div><h2>Thank you — you're signed</h2></div>
      <div class="tr-body"><p>Your signature is now recorded on this requisition. You can download the signed PDF from this page.</p>
      <p><b>MR Tracker</b> is SPACElogic's system for requesting, approving and tracking materials purchases. With a free account you can:</p>
      <ul><li><b>Track progress</b> — see where every requisition you sign or submit is, step by step.</li>
        <li><b>Raise your own requests</b> with the Materials Requisition Form: pick a project, add items and prices, then send <b>one link</b> to your approvers.</li>
        <li>Reuse what we bought before (supplier and price), save drafts, and get reminders when something is stuck.</li>
        <li>Ask the built-in assistant “where is my order?” any time.</li></ul>
      <p style="font-size:12.5px;color:#6b7280">It takes a minute: your company email and a 4-digit PIN.</p></div>
      <div class="tr-foot"><label class="tr-chk"><input type="checkbox" id="trHide"> Don't show this again</label>
        <div class="tr-r"><button type="button" data-a="later">Maybe later</button><a class="tr-btn go" href="login.html?signup=1&redirect=dashboard.html" data-a="signup">Create an account</a></div></div></div>`;
    const close = ()=>{ try{ if(document.getElementById("trHide").checked) localStorage.setItem("sl_aftersign_hide","1"); }catch(_){} document.removeEventListener("keydown", onKey); back.remove(); };
    const onKey = e=>{ if(e.key==="Escape") close(); };
    back.addEventListener("click", e=>{ const a = e.target.getAttribute && e.target.getAttribute("data-a"); if(a==="later" || e.target===back) close(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(back);
  }

  w.Tour = {start, afterSign};
})(window);
