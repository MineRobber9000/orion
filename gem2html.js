function gem2html(gemtext,charset) {
  //console.log(gemtext, charset);
  charset = charset || "utf8";
  let text = gemtext.toString(charset);
  //console.log(text);
  let lines = text.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/);
  //console.log(lines.length,"line(s)");
  let pre = false;
  let pre_alt = "";
  let output = "<html><body>";
  for (let i=0;i<lines.length;i++) {
    output+="<p>"+lines[i].replace("&","&amp;").replace("<","&lt;")+"</p>";
  }
  output+="</body></html>";
  //console.log(output);
  return Buffer.from(output);
}

function mimeparse(mimetype) {
  let i = 0;
  let type = "";
  while (i<mimetype.length && mimetype[i]!=="/") {
    type+=mimetype[i++];
  }
  i++; // skip /
  let subtype = "";
  while (i<mimetype.length && mimetype[i]!==";") {
    subtype+=mimetype[i++];
  }
  i++; // skip the ; if it exists
  if (i>=mimetype.length) {
    return [type,subtype,{}]
  }
  let params = {};
  while (i<mimetype.length) {
    while (i<mimetype.length && mimetype[i].match(/\s/)) {
      i++;
    }
    let paramName = "";
    while (i<mimetype.length && !mimetype[i].match(/[;=]/)) {
      paramName+=mimetype[i++];
    }
    if (i>=mimetype.length || mimetype[i]===";") {
      params[paramName]=null;
    } else {
      i++; // skip the =
      let paramValue = "";
      if (mimetype[i]==="\"") {
        i++;
        let processing = true;
        while(processing) {
          while (i<mimetype.length && !mimetype[i].match(/[\\"]/)) {
            paramValue+=mimetype[i++];
          }
          if (i<mimetype.length) {
            let c = mimetype[i++];
            if (c==="\\") {
              if (i<mimetype.length) {
                paramValue+=mimetype[i++];
                // fall through to top of loop
              } else {
                paramValue+=c;
                processing=false;
              }
            } else {
              processing = false;
            }
          }
        }
        while (i<mimetype.length && mimetype[i]!==";") i++;
      } else {
        while (i<mimetype.length && mimetype[i]!==";") {
          paramValue+=mimetype[i++];
        }
      }
      params[paramName]=paramValue;
    }
  }
  return [type, subtype, params];
}

function getCharset(mimetype) {
  let parsed = mimeparse(mimetype);
  if (parsed[2].hasOwnProperty("charset")) {
    return parsed[2].charset;
  }
}

module.exports = {
  gem2html: gem2html,
  getCharset: getCharset
}
