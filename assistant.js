/* MR Tracker help assistant.
   1) Rules first: requisition look-ups, "what needs me", summaries, spend, and a built-in FAQ. Free, instant, always exact.
   2) Only if no rule can answer: a small AI model through the "assistant-ai" function, with hard daily/monthly limits
      enforced on the server (see supabase/functions/assistant-ai and the ai_settings table). */
(function(w){
  "use strict";
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = n => "$ " + Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const dmy = d => { if(!d) return ""; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d); };
  const ss = { get(k){ try{ return sessionStorage.getItem(k); }catch(_){ return null; } } };

  /* ---------------- built-in answers (keep short; same facts as the Manual & FAQ) ---------------- */
  const FAQ = [
    {k:"withdraw cancel stop requisition remove", a:"Open the requisition (click it on the dashboard) and press <b>Withdraw</b>. The requester or an admin can do this until it has been <b>Purchased</b>. You will be asked to confirm twice."},
    {k:"declined rejected fix resubmit revise edit again", a:"A declined requisition shows the reason on the dashboard. Open it and press <b>Fix &amp; Resubmit in form</b>, change what was flagged and resubmit. Approval restarts from the Team Manager."},
    {k:"edit change modify submitted after", a:"A submitted requisition can't be edited by the requester unless it is declined. Ask an approver to decline it with a reason, then use <b>Fix &amp; Resubmit in form</b>. Admins can use <b>Edit in form</b>."},
    {k:"sign approve link send forward next approver", a:"After you submit (PIN Sign or PDF Sign) you get <b>one link</b> that works for every step. Send it to the Team Manager first; after each signature it opens on the next person's turn, so keep forwarding the same link."},
    {k:"lost link regenerate new link old link", a:"Open the requisition and press <b>Regenerate link</b>. The old link stops working straight away, so the app asks you to confirm twice."},
    {k:"pin sign pdf sign difference which", a:"<b>PIN Sign</b>: each approver types their PIN. <b>PDF Sign</b>: each approver draws their signature on the PDF form. Both save the requisition in the system and both give one link."},
    {k:"forgot pin reset password", a:"PINs can't be looked up. Ask an admin to delete your account in <b>Admin Settings</b> and sign you up again with a new PIN. You keep your name on past requisitions."},
    {k:"change pin profile account email", a:"Click your name at the top right, then <b>My Profile</b> (details) or <b>Change PIN</b>."},
    {k:"project add save new list shared", a:"Anyone can add a project: use the <b>Projects</b> page, or press <b>Save this project for everyone</b> under PM Incharge on the form. Admins can edit or archive projects."},
    {k:"item history bought before price supplier purchase history cheapest", a:"Open <b>Purchase History</b> to search what we bought, from which supplier and at what price. On the form, click the Item box to pick a past item and its price fills in."},
    {k:"currency convert exchange rate foreign usd", a:"On the form press <b>Currency converter</b> above the materials table. It fetches a live rate; if it can't, type a rate yourself."},
    {k:"draft save later unfinished", a:"Press <b>Save Draft</b> on the form. Open your drafts with <b>My Drafts</b> from any device."},
    {k:"export pdf csv print download", a:"Open the requisition's full form, then use <b>Print</b> or <b>Export PDF</b>. The form page also has Export PDF and Export CSV."},
    {k:"cards list layout view change dashboard group", a:"On the dashboard use the <b>List / Cards</b> buttons. In List you can group by status, stage, project, requester or month. In Cards, click a stage title to fold the column."},
    {k:"reminder overdue notification email remind", a:"Click your name, then <b>Reminder Settings</b> to set how long a stage may sit before it is flagged as overdue."},
    {k:"admin become make access", a:"An existing admin can grant admin access in <b>Admin Settings</b>. There must always be at least one admin."},
    {k:"stages stage workflow flow order approval process", a:"Every requisition goes <b>Submitted → Manager Approved → Procurement Approved → Purchased → Received</b>. It can also end as Declined or Withdrawn."},
    {k:"reject delete admin", a:"Admins can open a requisition and press <b>Reject</b> (with a reason; the requester can fix and resubmit), <b>Withdraw</b>, or <b>Delete</b> (permanent). Each asks you to confirm twice."},
    {k:"analytics chart spending report", a:"Open <b>Analytics</b> for spending, approval speed and price insights. You see your own requisitions; admins see everyone's."},
    {k:"version update new what's whatsnew", a:"The version is shown under <b>Log out</b> in the name menu. Click it to read what's new."}
  ];
  const STOP = new Set("the a an is are to of in on for my me i how do does can what when where why who which it this that and or with be have has was were will would should please tell show about there their your you our we".split(" "));
  const toks = s => String(s||"").toLowerCase().replace(/[^a-z0-9一-鿿\s'-]/g," ").split(/\s+/).filter(t=>t && !STOP.has(t) && (t.length>2 || /[一-鿿]/.test(t)));

  function faqAnswer(q){
    const qt = new Set(toks(q)); if(!qt.size) return null;
    let best = null, bestScore = 0;
    FAQ.forEach(f=>{
      const kt = toks(f.k); let sc = 0;
      kt.forEach(t=>{ if(qt.has(t)) sc += 2; else { for(const x of qt){ if(x.length>3 && (t.startsWith(x)||x.startsWith(t))) { sc += 1; break; } } } });
      if(sc > bestScore){ bestScore = sc; best = f; }
    });
    return bestScore >= 2 ? best.a : null;
  }

  /* ---------------- live data (the signed-in person's own requisitions) ---------------- */
  let cache = {at:0, data:null};
  async function loadReqs(client){
    if(cache.data && Date.now()-cache.at < 45000) return cache.data;
    const id = ss.get("sl_person_id"), pin = ss.get("sl_pin");
    if(!id || !pin) return null;
    const {data, error} = await client.rpc("list_my_requisitions", {p_person_id:id, p_pin:pin});
    if(error || !data || !data.success) return null;
    cache = {at:Date.now(), data:data}; return data;
  }
  const link = r => `<a href="view.html?id=${esc(r.id)}">${esc(r.tracking_no||"-")}</a>`;
  const stepsOf = r => (r.approval_steps||[]).slice().sort((a,b)=>a.step_order-b.step_order);
  const nextStep = r => stepsOf(r).find(s=>s.status!=="Signed");
  function describe(r){
    const bits = [`${link(r)} — <b>${esc(r.project_name||"-")}</b>${r.project_location?" ("+esc(r.project_location)+")":""}`, `Status: <b>${esc(r.status)}</b> · ${money(r.grand_total)} · ${esc(r.request_by||"")} · ${dmy(r.form_date)}`];
    if(r.status==="Declined"){
      const st = stepsOf(r).find(s=>s.status==="Declined");
      bits.push(`Declined${r.declined_by?" by "+esc(r.declined_by):""}: “${esc(r.decline_reason||st?.decline_reason||"no reason given")}”`);
    } else if(r.status==="Withdrawn"){ bits.push("This requisition was withdrawn."); }
    else {
      const n = nextStep(r);
      if(!n) bits.push("All sign-offs are done.");
      else bits.push(`Waiting for: <b>${esc(n.stage_name)}</b>${n.assigned_person_name?" — "+esc(n.assigned_person_name):""}`);
      const done = stepsOf(r).filter(s=>s.status==="Signed").length;
      bits.push(`${done} of ${stepsOf(r).length} sign-offs done.`);
    }
    return bits.join("<br>");
  }
  const listOf = (rs, max) => rs.slice(0,max||6).map(r=>`• ${link(r)} ${esc(r.project_name||"-")} — ${esc(r.status)}, ${money(r.grand_total)}`).join("<br>") + (rs.length>(max||6) ? `<br>…and ${rs.length-(max||6)} more on the dashboard.` : "");
  const byDateDesc = rs => rs.slice().sort((a,b)=>String(b.form_date||"").localeCompare(String(a.form_date||"")) || String(b.tracking_no).localeCompare(String(a.tracking_no)));

  async function rules(q, client){
    const text = q.trim(), low = text.toLowerCase();
    const isHow = /^(how|what happens|can i|can we|where do|where can|why can|is it possible|who can|what is|what are)\b/.test(low);

    // a REQ number
    const m = low.match(/req[-\s#]*0*(\d{1,6})/) || low.match(/(?:number|no\.?|#)\s*0*(\d{1,6})\b/);
    const data = await loadReqs(client);
    const reqs = data ? byDateDesc(data.requisitions||[]) : null;
    if(m && reqs){
      const n = parseInt(m[1],10);
      const r = reqs.find(x=>parseInt(String(x.tracking_no||"").replace(/\D/g,""),10)===n);
      return r ? describe(r) : `I can't find REQ-${String(n).padStart(5,"0")} among the requisitions you can see.`;
    }

    if(isHow){ const f = faqAnswer(text); if(f) return f; }

    if(reqs){
      const me = (ss.get("sl_person_name")||"").toLowerCase();
      if(/(need|needs|waiting|wait|pending|action|to sign|my turn|on me|for me)/.test(low) && /(me|my|i |sign|action|need)/.test(low) && !/declin|reject/.test(low)){
        const mine = reqs.filter(r=>{
          if(["Declined","Withdrawn","Received"].includes(r.status)) return r.status==="Declined" && r.requester_person_id===ss.get("sl_person_id");
          const n = nextStep(r); return n && (n.assigned_person_name||"").toLowerCase()===me;
        });
        return mine.length ? `These need your attention:<br>${listOf(mine)}` : "Nothing is waiting on you right now.";
      }
      if(/declin|reject/.test(low) && !isHow){
        const d = reqs.filter(r=>r.status==="Declined");
        return d.length ? `Declined requisitions:<br>${d.slice(0,6).map(r=>`• ${link(r)} ${esc(r.project_name||"-")} — “${esc(r.decline_reason||"no reason given")}”`).join("<br>")}<br>Open one and press <b>Fix &amp; Resubmit in form</b>.` : "You have no declined requisitions.";
      }
      if(/(summary|overview|how many|count|breakdown|status of (all|my|everything))/.test(low)){
        const c = {}; reqs.forEach(r=>c[r.status]=(c[r.status]||0)+1);
        return `You can see <b>${reqs.length}</b> requisitions:<br>` + Object.keys(c).map(k=>`• ${esc(k)}: ${c[k]}`).join("<br>");
      }
      if(/(spent|spend|total (cost|amount|value)|how much|worth)/.test(low)){
        const sum = f => reqs.filter(f).reduce((a,r)=>a+Number(r.grand_total||0),0);
        return `Purchased or received: <b>${money(sum(r=>["Purchased","Received"].includes(r.status)))}</b><br>Still in approval: ${money(sum(r=>["Submitted","Manager Approved","Procurement Approved"].includes(r.status)))}<br>Declined or withdrawn: ${money(sum(r=>["Declined","Withdrawn"].includes(r.status)))}`;
      }
      if(/(latest|recent|last|newest)/.test(low) && !isHow){
        return reqs.length ? `Most recent:<br>${listOf(reqs,5)}` : "There are no requisitions yet.";
      }
      // keyword search over project / location / requester / items
      const qt = toks(text);
      if(qt.length){
        const scored = reqs.map(r=>{
          const hay = [r.project_name, r.project_location, r.request_by, r.tracking_no, ...(r.requisition_items||[]).map(i=>i.name)].join(" ").toLowerCase();
          let sc = 0; qt.forEach(t=>{ if(hay.includes(t)) sc++; });
          return {r, sc};
        }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc);
        const need = Math.max(1, Math.ceil(qt.length/2));
        const hits = scored.filter(x=>x.sc>=need).map(x=>x.r);
        if(hits.length === 1 && !faqAnswer(text)) return describe(hits[0]);
        if(hits.length && !faqAnswer(text)) return `I found ${hits.length} match${hits.length>1?"es":""}:<br>${listOf(hits)}`;
      }
    }
    const f = faqAnswer(text); if(f) return f;
    return null;
  }

  /* ---------------- AI fallback ---------------- */
  async function askAI(q, client){
    const id = ss.get("sl_person_id"), pin = ss.get("sl_pin");
    try{
      const {data, error} = await client.functions.invoke("assistant-ai", {body:{person_id:id, pin:pin, question:q}});
      if(error || !data) return {text:"I couldn't reach the AI helper just now. Try rephrasing with a REQ number or a keyword, or ask an admin."};
      if(data.ok) return {text:esc(data.answer).replace(/\n/g,"<br>"), ai:true, left:data.questions_left};
      const msg = {
        not_configured:"I couldn't find that in the system or the Manual. Try a REQ number (for example REQ-00031), a project name, or ask an admin.",
        off:"I couldn't find that in the system or the Manual. Try a REQ number or a project name, or ask an admin.",
        budget:"The AI helper has reached its monthly limit, so I can only answer from the built-in help and your requisitions. Try a REQ number or a project name.",
        daily:`You've used today's ${data.limit||""} AI questions. I can still answer from your requisitions and the built-in help.`,
        auth:"Please sign in again to use the assistant."
      }[data.reason];
      return {text: msg || "I'm not sure about that. Try a REQ number or ask an admin."};
    }catch(_){ return {text:"I couldn't reach the AI helper just now. Try a REQ number or ask an admin."}; }
  }

  /* ---------------- chat window ---------------- */
  const CSS = `
  .as-fab{ position:fixed; right:18px; bottom:18px; z-index:900; border:0; border-radius:999px; background:#2f6fed; color:#fff; font:inherit; font-size:13px; font-weight:700; padding:11px 18px; box-shadow:0 8px 24px rgba(15,23,42,.3); cursor:pointer; }
  .as-fab:hover{ background:#2050bd; }
  .as-panel{ position:fixed; right:18px; bottom:18px; z-index:901; width:360px; max-width:calc(100vw - 24px); height:520px; max-height:calc(100vh - 36px); background:var(--surface,#fff); color:var(--ink,#1f2933); border:1px solid var(--line,#d7dbe0); border-radius:16px; box-shadow:0 20px 60px rgba(15,23,42,.35); display:none; flex-direction:column; overflow:hidden; font-family:inherit; }
  .as-panel.open{ display:flex; }
  .as-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--line,#d7dbe0); }
  .as-head b{ font-size:14px; } .as-head span{ display:block; font-size:11px; color:var(--muted,#6b7280); font-weight:500; }
  .as-x{ border:0; background:none; font-size:20px; line-height:1; cursor:pointer; color:var(--muted,#6b7280); }
  .as-log{ flex:1; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
  .as-m{ max-width:92%; padding:9px 12px; border-radius:12px; font-size:13px; line-height:1.5; word-wrap:break-word; }
  .as-m.bot{ background:#f1f4f9; align-self:flex-start; } .as-m.me{ background:#2f6fed; color:#fff; align-self:flex-end; }
  .as-m a{ color:#2050bd; font-weight:700; } .as-m.me a{ color:#fff; }
  .as-tag{ display:block; font-size:10.5px; color:var(--muted,#6b7280); margin-top:5px; }
  .as-chips{ display:flex; flex-wrap:wrap; gap:6px; padding:0 14px 8px; }
  .as-chips button{ font:inherit; font-size:12px; border:1px solid var(--line,#d7dbe0); background:var(--surface,#fff); color:var(--ink,#1f2933); border-radius:999px; padding:5px 11px; cursor:pointer; }
  .as-chips button:hover{ background:#eaf0fb; }
  .as-form{ display:flex; gap:8px; padding:10px 12px; border-top:1px solid var(--line,#d7dbe0); }
  .as-form input{ flex:1; border:1px solid var(--line,#d7dbe0); border-radius:10px; padding:9px 12px; font:inherit; font-size:13px; background:var(--surface,#fff); color:var(--ink,#1f2933); }
  .as-form button{ border:0; background:#2f6fed; color:#fff; border-radius:10px; font:inherit; font-weight:700; font-size:13px; padding:0 14px; cursor:pointer; }
  .as-form button:disabled{ opacity:.5; cursor:default; }
  @media print{ .as-fab,.as-panel{ display:none!important; } }`;

  function mount(client){
    if(document.getElementById("asFab") || !client) return;
    if(!ss.get("sl_person_id") || !ss.get("sl_pin")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    const fab = document.createElement("button"); fab.id="asFab"; fab.className="as-fab"; fab.type="button"; fab.textContent="Ask"; fab.title="Ask about the system or your requisitions";
    const panel = document.createElement("div"); panel.className="as-panel"; panel.id="asPanel"; panel.setAttribute("role","dialog"); panel.setAttribute("aria-label","Assistant");
    panel.innerHTML = `<div class="as-head"><div><b>Ask MR Tracker</b><span>Answers about the system and your requisitions</span></div><button class="as-x" type="button" aria-label="Close">×</button></div>
      <div class="as-log" id="asLog"></div>
      <div class="as-chips" id="asChips"></div>
      <form class="as-form" id="asForm"><input id="asIn" maxlength="300" autocomplete="off" placeholder="e.g. where is REQ-00031?"><button type="submit" id="asGo">Send</button></form>`;
    document.body.appendChild(fab); document.body.appendChild(panel);
    const log = panel.querySelector("#asLog"), input = panel.querySelector("#asIn"), go = panel.querySelector("#asGo");
    const add = (html, who, tag)=>{ const d=document.createElement("div"); d.className="as-m "+who; d.innerHTML = html + (tag?`<span class="as-tag">${esc(tag)}</span>`:""); log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    let started = false;
    const open = ()=>{
      panel.classList.add("open"); fab.style.display="none";
      if(!started){ started = true;
        add("Hi! Ask me where a requisition is, what needs your signature, or how to do something in the system.", "bot");
        const chips = panel.querySelector("#asChips");
        ["What needs my action?","Show my declined requisitions","Give me a summary","How do I withdraw a requisition?"].forEach(t=>{
          const b=document.createElement("button"); b.type="button"; b.textContent=t; b.onclick=()=>send(t); chips.appendChild(b); });
      }
      setTimeout(()=>input.focus(),50);
    };
    const close = ()=>{ panel.classList.remove("open"); fab.style.display=""; };
    fab.onclick = open; panel.querySelector(".as-x").onclick = close;
    panel.addEventListener("keydown", e=>{ if(e.key==="Escape") close(); });
    async function send(q){
      q = (q||"").trim(); if(!q) return;
      panel.querySelector("#asChips").style.display = "none";
      add(esc(q), "me"); input.value = ""; go.disabled = true;
      const wait = add("…", "bot");
      try{
        let ans = await rules(q, client);
        if(ans){ wait.innerHTML = ans; }
        else { wait.innerHTML = "Let me think…"; const r = await askAI(q, client); wait.innerHTML = r.text + (r.ai?`<span class="as-tag">AI answer — double-check important details${typeof r.left==="number"?" · "+r.left+" AI questions left today":""}</span>`:""); }
      }catch(_){ wait.innerHTML = "Sorry, something went wrong. Please try again."; }
      go.disabled = false; log.scrollTop = log.scrollHeight; input.focus();
    }
    panel.querySelector("#asForm").addEventListener("submit", e=>{ e.preventDefault(); send(input.value); });
  }
  w.Assistant = {mount, _rules:rules, _faq:faqAnswer};
})(window);
