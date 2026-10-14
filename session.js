/* "Keep me signed in on this device": the sign-in lives in sessionStorage (one tab). If the person chose to be remembered,
   a copy is kept in localStorage for 30 days and restored into any new tab (for example when a link is opened from a chat app).
   Logging out clears both. */
(function(w){
  var KEY = "sl_remember", DAYS = 30;
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY) || "null"); }catch(_){ return null; } }
  function restore(){
    try{
      if(sessionStorage.getItem("sl_person_id")) return;
      var r = read(); if(!r) return;
      if(!r.exp || r.exp < Date.now()){ localStorage.removeItem(KEY); return; }
      sessionStorage.setItem("sl_person_id", r.id); sessionStorage.setItem("sl_person_name", r.name); sessionStorage.setItem("sl_pin", r.pin);
      if(r.admin != null) sessionStorage.setItem("sl_is_admin", r.admin ? "1" : "0");
    }catch(_){}
  }
  restore();
  w.Session = {
    remember: function(id, name, pin, admin){ try{ localStorage.setItem(KEY, JSON.stringify({id:id, name:name, pin:pin, admin:!!admin, exp: Date.now() + DAYS*86400000})); }catch(_){} },
    forget: function(){ try{ localStorage.removeItem(KEY); }catch(_){} },
    // keep the remembered copy in step with changes made while signed in (new PIN, new name, admin flag)
    sync: function(){
      try{
        var r = read(); if(!r) return;
        r.id = sessionStorage.getItem("sl_person_id") || r.id; r.name = sessionStorage.getItem("sl_person_name") || r.name; r.pin = sessionStorage.getItem("sl_pin") || r.pin;
        var a = sessionStorage.getItem("sl_is_admin"); if(a !== null) r.admin = a === "1";
        localStorage.setItem(KEY, JSON.stringify(r));
      }catch(_){}
    }
  };
})(window);

/* Simple phone view: on a phone (screen 720px or narrower) only the everyday features show — anything marked
   data-full is hidden, and desktop-only pages offer "Use full version". The choice is kept per device. */
(function(w, d){
  var KEY = "sl_ui_mode";
  function isPhone(){ return !!(w.matchMedia && w.matchMedia("(max-width:720px)").matches); }
  function wantsFull(){ try{ return localStorage.getItem(KEY) === "full"; }catch(_){ return false; } }
  function simple(){ return isPhone() && !wantsFull(); }
  function apply(){ d.documentElement.classList.toggle("ui-simple", simple()); }
  var st = d.createElement("style");
  st.textContent = "html.ui-simple [data-full]{display:none !important}";
  (d.head || d.documentElement).appendChild(st);
  apply();
  try{ w.matchMedia("(max-width:720px)").addEventListener("change", apply); }catch(_){}
  w.UIMode = {
    isPhone: isPhone, simple: simple, wantsFull: wantsFull,
    set: function(mode){ try{ if(mode === "full") localStorage.setItem(KEY, "full"); else localStorage.removeItem(KEY); }catch(_){} apply(); }
  };
})(window, document);
