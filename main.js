const electron = require("electron");
const url = require("url");
const path = require("path");
const tls = require("tls");
const net = require("net");
const gem2html = require("./gem2html");
const GEMINI_ERR_TO_HTTP = {
  // x0 codes don't really map to HTTP status codes, so just fall back on 200
  "40": 200,
  "50": 200,
  // 41 - SERVER UNAVAILABLE (cf. HTTP 503)
  "41": 503,
  // 42 - CGI ERROR (no cf given, using 502 Bad Gateway because that's usually the error returned when a CGI script errors out)
  "42": 502,
  // 43 - PROXY ERROR (cf. HTTP 502)
  "43": 502,
  // 44 - SLOW DOWN (cf. HTTP 429)
  "44": 429,
  // 51 - NOT FOUND (cf. HTTP 404)
  "51": 404,
  // 52 - GONE (cf. HTTP 410)
  "52": 410,
  // 53 - PROXY REQUEST REFUSED (no cf given, using HTTP 403 because the server is deliberately not doing what you're asking of it)
  "53": 403,
  // 59 - BAD REQUEST (cf. HTTP 400)
  "59": 400
};
const GEMINI_ERR_TO_STR = {
  "40": "Temporary Error (Generic)",
  "50": "Permanent Error (Generic)",
  // 41 - SERVER UNAVAILABLE (cf. HTTP 503)
  "41": "41 Server Unavailable",
  // 42 - CGI ERROR (no cf given, using 502 Bad Gateway because that's usually the error returned when a CGI script errors out)
  "42": "42 CGI Error",
  // 43 - PROXY ERROR (cf. HTTP 502)
  "43": "43 Proxy Error",
  // 44 - SLOW DOWN (cf. HTTP 429)
  "44": "44 Slow Down",
  // 51 - NOT FOUND (cf. HTTP 404)
  "51": "51 Not Found",
  // 52 - GONE (cf. HTTP 410)
  "52": "52 Gone",
  // 53 - PROXY REQUEST REFUSED (no cf given, using HTTP 403 because the server is deliberately not doing what you're asking of it)
  "53": "53 Proxy Request Refused",
  // 59 - BAD REQUEST (cf. HTTP 400)
  "59": "59 Bad Request"
};

function createWindow() {
  const mainWindow = new electron.BrowserWindow({width: 800, height: 600, webPreferences: {nodeIntegration:true,webviewTag:true,contextIsolation:false}, title: "Orion Browser", backgroundColor: "#fff"});
  // TODO: implement the menu The Right Way(tm)
  mainWindow.setMenu(null);
  //mainWindow.openDevTools();
  mainWindow.loadFile("chrome/browser.html");
}

electron.protocol.registerSchemesAsPrivileged([
  {scheme:"gemini", privileges:{ standard: true, secure: true }},
  {scheme:"spartan", privileges:{ standard: true }}
]);

function handle_gemini(req,cb) {
  let requrl = url.parse(req.url);
  if (requrl.auth !== null) {
    // remove auth/userinfo component
    requrl.auth == null;
    cb({statusCode: 307,headers:{"Location":requrl.format()},data:Buffer.alloc(0)});
    return;
  }
  if (requrl.host === '') {
    // INVALID_URL
    cb({error: -300});
  }
  let host = requrl.hostname;
  let port = parseInt(requrl.port) || 1965;
  const socket = tls.connect({host: host, port: port, rejectUnauthorized: false, servername: host}, function() {
    socket.write(requrl.format()+"\r\n");
  });
  socket.on("error",(err)=>{
    console.log(err);
    cb({error: -104}); // connection failed;
  });
  socket.setTimeout(5000);
  socket.on("timeout",()=>{ socket.end(); });
  let chunks = new Array();
  socket.on("data",function(newdata){
    chunks.push(newdata);
  });
  socket.on("end",function(){
    let rawdata = Buffer.concat(chunks);
    let i=0;
    while(rawdata.slice(i,i+2).compare(Buffer.from("\r\n"))!==0 && rawdata.slice(i,i+2).length==2) i++;
    if (rawdata.slice(i,i+2).length<2) {
      // RESPONSE_HEADERS_TOO_BIG
      // that is, the response headers are so big that they don't even end in our data
      cb({error: -325});
      return;
    }
    let header = rawdata.slice(0,i).toString();
    let data = rawdata.slice(i+2);
    let parts = header.split(/\s(.+)/,2);
    let resp = {};
    if (parts[0].length !== 2) {
      cb({error:320}); //INVALID_RESPONSE
      return;
    }
    if (parts[0][0] === "2") {
      if (parts[1].match(/^text\/gemini/)) {
        // TODO: handle text/gemini in a standard fashion as opposed to just treating it as plaintext
        resp.data = gem2html.gem2html(data,gem2html.getCharset(parts[1]));
        resp.headers = {"Content-Type":"text/html; charset=utf-8","Content-Length":resp.data.length.toString()};
      } else {
        resp.headers = {"Content-Type":parts[1],"Content-Length":data.length.toString()};
        resp.data = data;
      }
    } else if (parts[0][0] === "3") {
      resp.statusCode = 307; // Temporary Redirect
      resp.headers = {"Location":url.resolve(requrl,parts[1])};
      resp.data = Buffer.alloc(0);
    } else if (parts[0][0] === "4" || parts[0][0] == "5") {
      resp.statusCode = GEMINI_ERR_TO_HTTP[parts[0]];
      resp_str = "<title>"+header+"</title><h1>";
      resp_str+= GEMINI_ERR_TO_STR[parts[0]];
      resp_str+= "</h1><p>";
      if (parts[0]=="44") {
        resp_str+="You should retry in "+parts[1]+" seconds.";
      } else {
        resp_str+="Server says: \""+parts[1]+"\"";
      }
      resp_str+="</p>"
      resp.data = Buffer.from(resp_str);
      resp.headers = {"Content-Type":"text/html; charset=utf-8","Content-Length":resp.data.length.toString()};
    } else if (parts[0][0] === "6") {
      resp.data = Buffer.from("<title>"+header+"</title><h1>Certificate Error</h1><p>The capsule in question wants a client certificate. At this time, Orion does not handle client certificates.</p>");
    } else {
      resp.error = -320; // INVALID_RESPONSE
    }
    cb(resp);
  });
  // after 15 seconds total, force the socket to shut
  setTimeout(function() {socket.end();},15000);
}

function handle_spartan(req,cb) {
  let requrl = url.parse(req.url);
  if (requrl.auth !== null) {
    // remove auth/userinfo component (not necessarily *banned* in the case of spartan, moreso just unused)
    requrl.auth == null;
    cb({statusCode: 307,headers:{"Location":requrl.format()},data:Buffer.alloc(0)});
    return;
  }
  if (requrl.host === '') {
    // INVALID_URL
    cb({error: -300});
  }
  let host = requrl.hostname;
  let port = parseInt(requrl.port) || 300;
  const socket = net.connect({host: host, port: port}, function() {
    let path = requrl.path || "/";
    // TODO: implement input
    socket.write([requrl.hostname,path,"0"].join(" ")+"\r\n");
  });
  socket.on("error",(err)=>{
    console.log(err);
    cb({error: -104}); // connection failed;
  });
  socket.setTimeout(5000);
  socket.on("timeout",()=>{ socket.end(); });
  let chunks = new Array();
  socket.on("data",function(newdata){
    chunks.push(newdata);
  });
  socket.on("end",function(){
    let rawdata = Buffer.concat(chunks);
    let i=0;
    while(rawdata.slice(i,i+2).compare(Buffer.from("\r\n"))!==0 && rawdata.slice(i,i+2).length==2) i++;
    if (rawdata.slice(i,i+2).length<2) {
      // RESPONSE_HEADERS_TOO_BIG
      // that is, the response headers are so big that they don't even end in our data
      cb({error: -325});
      return;
    }
    let header = rawdata.slice(0,i).toString();
    let data = rawdata.slice(i+2);
    let parts = header.split(/\s(.+)/,2);
    let resp = {};
    if (parts[0].length !== 1) {
      cb({error:320}); //INVALID_RESPONSE
      return;
    }
    if (parts[0] === "2") {
      if (parts[1].match(/^text\/gemini/)) {
        // TODO: handle text/gemini in a standard fashion as opposed to just treating it as plaintext
        resp.data = gem2html.gem2html(data,gem2html.getCharset(parts[1]));
        resp.headers = {"Content-Type":"text/html; charset=utf-8","Content-Length":resp.data.length.toString()};
      } else {
        resp.headers = {"Content-Type":parts[1],"Content-Length":data.length.toString()};
        resp.data = data;
      }
    } else if (parts[0] === "3") {
      resp.statusCode = 307; // Temporary Redirect
      requrl.path = parts[1]; // spartan redirects only use the path
      resp.headers = {"Location":requrl.format()};
      resp.data = Buffer.alloc(0);
    } else if (parts[0] === "4" || parts[0] === "5") {
      let resp_str = "<h1>";
      resp_str+=(parts[0]==="4") ? "Client Error" : "Server Error";
      resp_str+="</h1><p>The server says: \"";
      resp_str+=parts[1];
      resp_str+="\".</p>";
      resp.data = Buffer.from(resp_str);
      resp.headers={"Content-Type":"text/html; charset=utf-8","Content-Length":resp.data.length.toString()};
    } else {
      resp.error = -320; // INVALID_RESPONSE
    }
    cb(resp);
  });
  // after 15 seconds total, force the socket to shut
  setTimeout(function() {socket.end();},15000);
}

electron.ipcMain.handle("report-error",async (_,url,error_description) => {
  // un-dork-ify certain errors we expect to see.
  if (error_description=="ERR_TOO_MANY_REDIRECTS") {
    error_description = "The server attempted too many redirects.";
  } else if (error_description=="INVALID_URL") {
    error_description = "The URL was invalid.";
  } else if (error_description=="INVALID_RESPONSE") {
    error_description = "The server returned an invalid response.";
  } else if (error_description=="RESPONSE_HEADERS_TOO_BIG") {
    error_description = "The server either responded with a response header that was too big, or did not properly encode their response header.";
  } else if (error_description=="ERR_CONNECTION_FAILED") {
    error_description = "We couldn't contact the server. Are you sure you typed the domain correctly?";
  }
  await electron.dialog.showMessageBox({title:"Error",message:"Error loading "+url+": "+error_description,type:"error"});
  return;
});

electron.app.whenReady().then(() => {
  createWindow()

  electron.protocol.registerBufferProtocol("gemini",handle_gemini);
  electron.protocol.registerBufferProtocol("spartan",handle_spartan);

  electron.app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  })
})

// Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
electron.app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') electron.app.quit();
})
