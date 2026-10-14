/* Notifications helper for MR Tracker (browser / phone push + the "turn on notifications?" prompt).
   NotifySetup.pushState()                 -> "ok" | "ios-install" | "unsupported" | "blocked"
   NotifySetup.enablePush(client, vapid)   -> asks permission, subscribes this device, saves it
   NotifySetup.disablePush(client)         -> unsubscribes this device
   NotifySetup.thisEndpoint()              -> this device's push endpoint (or null)
   NotifySetup.afterSubmit(client)         -> after a form is sent: offers Settings → Notifications to people who never chose */
(function(w){
  "use strict";
  const ss = { get:k=>{ try{ return sessionStorage.getItem(k); }catch(_){ return null; } } };
  const idPin = () => ({p_person_id: ss.get("sl_person_id"), p_pin: ss.get("sl_pin")});

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => (w.matchMedia && w.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;

  function pushState(){
    if(isIOS && !standalone()) return "ios-install";                  // iPhone/iPad only allow push for apps added to the Home Screen
    if(!("serviceWorker" in navigator) || !("PushManager" in w) || !("Notification" in w)) return "unsupported";
    if(Notification.permission === "denied") return "blocked";
    return "ok";
  }
  const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deviceName = () => {
    const ua = navigator.userAgent, os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
    const br = /Edg\//.test(ua) ? "Edge" : /Firefox/.test(ua) ? "Firefox" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
    return standalone() ? os + " app" : os + " · " + br;
  };
  async function registration(){ return navigator.serviceWorker.register("sw.js").then(()=>navigator.serviceWorker.ready); }
  async function thisEndpoint(){
    try{ if(pushState()==="unsupported" || pushState()==="ios-install") return null; const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); return sub ? sub.endpoint : null; }catch(_){ return null; }
  }
  async function enablePush(client, vapid){
    const st = pushState(); if(st !== "ok") throw new Error(st);
    if(!vapid) throw new Error("not-configured");
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if(perm !== "granted") throw new Error("blocked");
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64(vapid)});
    const j = sub.toJSON();
    const {data, error} = await client.rpc("save_push_subscription", Object.assign(idPin(), {p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_label: deviceName()}));
    if(error || !data || !data.success) throw new Error((data && data.error) || (error && error.message) || "save-failed");
    return sub.endpoint;
  }
  async function disablePush(client, endpoint){
    const ep = endpoint || await thisEndpoint();
    try{ const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if(sub && (!endpoint || sub.endpoint === endpoint)) await sub.unsubscribe(); }catch(_){}
    if(ep) await client.rpc("remove_push_subscription", Object.assign(idPin(), {p_endpoint: ep}));
  }

  /* offered after someone sends out a form, once they have never chosen anything */
  async function afterSubmit(client){
    try{
      if(!ss.get("sl_person_id") || !w.Notify) return;
      if(localStorage.getItem("sl_notifyprompt_hide") === "1" || ss.get("sl_notifyprompt_snooze")) return;
      const {data} = await client.rpc("get_my_notify_prefs", idPin());
      if(!data || !data.success || data.prompted || data.telegram || data.email_on || (data.devices || []).length) return;
      w.Notify.show({
        tone:"info", icon:"send", title:"Get a ping when it moves?",
        sub:"Your request is on its way. Want to hear about it on your phone?",
        tiles:[{icon:"send",label:"Telegram or email"},{icon:"track",label:"Phone or browser alert"},{icon:"check",label:"You choose what"}],
        primary:{label:"Set up notifications", href:"settings.html?tab=notifications&from=prompt"},
        secondary:{label:"Not now", onClick:()=>{ sessionStorage.setItem("sl_notifyprompt_snooze","1"); }},
        small:"Takes under a minute. Change or turn off any time in Settings.",
        hideKey:"sl_notifyprompt_hide"
      });
    }catch(_){}
  }
  w.NotifySetup = {pushState, enablePush, disablePush, thisEndpoint, afterSubmit, deviceName};
})(window);
