const mimeparse = require('./mimeparse');
const fs = require('fs');

module.exports = function(headers, uploadData) {
  if (uploadData === undefined) {
    return {};
  }
  let parsed = mimeparse(headers["Content-Type"]);
  if (parsed[0] !== "multipart" || parsed[1] !== "form-data") {
    // we can't handle non-form-data
    return {};
  }
  let boundary = Buffer.from("--"+parsed[2].boundary,"ascii");
  // the return value
  let rv = {};
  // buf will eventually contain the full input
  let buf = Buffer.alloc(0);
  let i;
  for (i=0;i<uploadData.length;i++) {
    if (uploadData[i].type === "rawData") {
      buf = Buffer.concat([buf,uploadData[i].bytes]);
    }
    if (uploadData[i].type === "file") {
      let filecontents = fs.readFileSync(uploadData[i].filePath);
      if (uploadData[i].length>0) {
        filecontents = filecontents.slice(uploadData[i].offset+uploadData[i].length);
      }
      filecontents = filecontents.slice(uploadData[i].offset);
      buf = Buffer.concat([buf,filecontents]);
    }
  }
  // now that buf contains the theoretical input, let's start parsing
  i = buf.indexOf(boundary);
  while (i!==-1) {
    let pre = buf.slice(0,i);
    buf = buf.slice(i+boundary.length+2);
    if (pre.length>0) {
      let int_headers = {};
      let int_i = pre.indexOf("\r\n");
      let parsing = true;
      while (parsing && int_i!==-1) {
        console.log(int_i);
        let header = pre.slice(0,int_i).toString("ASCII");
        pre = pre.slice(int_i+2);
        if (header!=="") {
          console.log(header);
          let header_parsed = header.match(/([^:]+): (.+)/);
          int_headers[header_parsed[1]]=header_parsed[2];
        } else {
          // empty line means we're done with headers and moving on to body
          parsing = false;
        }
        int_i = pre.indexOf("\r\n");
      }
      // (ab)use mimeparse to handle parsing Content-Disposition
      // if a filename is given, then it's a file input, keep it as a buffer
      // if no filename is given, then it's text input, decode that shit
      let contdisp = mimeparse("nonsense/"+int_headers["Content-Disposition"]);
      rv[contdisp[2].name]=pre.slice(0,-2);
    }
    i = buf.indexOf(boundary);
  }
  return rv;
}
