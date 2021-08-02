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
  webview.loadURL(url).then(()=>{
    if (clearhistory) {
      webview.clearHistory();
    }
    update_navbuttons();
  });
}

function handle_omnibar_input_event(e) {
  if (e.keyCode === 13) {
    e.preventDefault();
    // special case searches eventually, for now we'll just navigate there
    let url = omnibar.value;
    if (!url.match(/^([A-Za-z][A-Za-z0-9+\-]*):\/\//)) {
      // append default scheme (in this case HTTPS, once we actually have gemini working, gemini)
      url = "https://"+url
    }
    navigate(url);
  }
}

window.onload = function() {
  webview = document.getElementsByTagName("webview")[0];
  omnibar = document.getElementsByName("omnibar")[0];
  webview.addEventListener("did-navigate",function(){
    setTimeout(function() {
      omnibar.value = webview.src;
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
}
