const {ipcRenderer, shell} = require('electron');
let backbutton = null;
let forwardbutton = null;
let omnibar = null;
let webview = null;

function update_navbuttons() {
  if (backbutton === null && document.getElementsByName("back").length>0) {
    backbutton = document.getElementsByName("back")[0];
  }
  if (backbutton === null) return;
  if (forwardbutton === null && document.getElementsByName("forward").length>0) {
    forwardbutton = document.getElementsByName("forward")[0];
  }
  if (forwardbutton === null) return;
  if (webview === null && document.getElementsByTagName("webview").length>0) {
    webview = document.getElementsByTagName("webview")[0];
  }
  if (webview === null) return;
  // if we've backed up as far as we can go, set disabled attribute, else, remove it
  // same in reverse
  if (!webview.canGoBack()) {
    // set disabled attribute on back button
    backbutton.setAttribute("disabled","");
  } else {
    // unset disabled attribute on back button
    backbutton.removeAttribute("disabled");
  }
  // now the same for the forward button
  if (!webview.canGoForward()) {
    // set disabled attribute on forward button
    forwardbutton.setAttribute("disabled","");
  } else {
    // unset disabled attribute on forward button
    forwardbutton.removeAttribute("disabled");
  }
}

function back() {
  // update nav buttons
  update_navbuttons();
  // if we've backed up as far as we can go, then null-op
  if (!webview.canGoBack()) return;
  // go back, using webview's history/cache/whatever
  webview.goBack();
  // update nav buttons again
  update_navbuttons();
}

function forward() {
  // same as back(), but in reverse
  update_navbuttons();
  if (!webview.canGoForward()) return;
  // go forward, using webview's history/cache/whatever
  webview.goForward();
  update_navbuttons();
}

function refresh() {
  if (webview === null && document.getElementsByTagName("webview").length>0) {
    webview = document.getElementsByTagName("webview")[0];
  }
  if (webview === null) return;
  webview.reloadIgnoringCache();
  update_navbuttons();
}

function navigate(url, clearhistory) {
  clearhistory = clearhistory || false;
  if (backbutton === null && document.getElementsByName("back").length>0) {
    backbutton = document.getElementsByName("back")[0];
  }
  if (backbutton === null) return;
  if (forwardbutton === null && document.getElementsByName("forward").length>0) {
    forwardbutton = document.getElementsByName("forward")[0];
  }
  if (forwardbutton === null) return;
  if (webview === null && document.getElementsByTagName("webview").length>0) {
    webview = document.getElementsByTagName("webview")[0];
  }
  if (webview === null) return;
  if (omnibar === null && document.getElementsByName("omnibar").length>0) {
    omnibar = document.getElementsByTagName("omnibar")[0];
  }
  if (webview === null) return;
  if (!url.match(/^(gemini|spartan):/)) {
    // Orion only claims to handle gemini and spartan
    // It *can* do HTTP(S), by virtue of being Electron, but it's not good at it
    // Plus, you should really use your web browser of choice for web links.
    shell.openExternal(url);
    omnibar.value = webview.src;
    return
  }
  last_navigated = url;
  webview.loadURL(url).then(()=>{
    if (clearhistory) {
      webview.clearHistory();
    }
    update_navbuttons();
  }).catch(function(err){
    return; // handle error in webview error handler
  });
}

function handle_omnibar_input_event(e) {
  if (e.keyCode === 13) {
    e.preventDefault();
    // special case searches eventually, for now we'll just navigate there
    let url = omnibar.value;
    if (!url.match(/^([A-Za-z][A-Za-z0-9+\-]*):\/\//)) {
      // append default scheme (gemini)
      url = "gemini://"+url
    }
    navigate(url);
  }
}

let last_navigated = null;

window.onload = function() {
  webview = document.getElementsByTagName("webview")[0];
  omnibar = document.getElementsByName("omnibar")[0];
  webview.addEventListener("will-navigate",function(ev){
    console.log("WILL-NAVIGATE");
    if (!ev.url.match(/^(gemini|spartan):/)) {
      // Orion only claims to handle gemini and spartan
      // It *can* do HTTP(S), by virtue of being Electron, but it's not good at it
      // Plus, you should really use your web browser of choice for web links.
      console.log("ATTEMPTING TO BLOCK NAVIGATION");
      webview.stop();
      shell.openExternal(ev.url);
      omnibar.value = webview.src;
    }
  });
  webview.addEventListener("did-navigate",function(){
    setTimeout(function() {
      omnibar.value = webview.src;
      last_navigated = webview.src;
      document.title = webview.getTitle()+" - Orion Browser";
      update_navbuttons();
    },100);
  });
  webview.addEventListener("did-navigate-in-page",function(){
    setTimeout(function() {
      omnibar.value = webview.src;
      update_navbuttons();
    },100);
  });
  webview.addEventListener("did-fail-load",function(ev){
    ipcRenderer.invoke("report-error",last_navigated,ev.errorDescription).then(()=>{back();});
  });
  ipcRenderer.on("navigate",function(ev,url) {
    omnibar.value = url;
    let fake_input_event = {};
    fake_input_event.keyCode=13;
    fake_input_event.preventDefault=function() {};
    handle_omnibar_input_event(fake_input_event);
  });
}
