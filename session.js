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
