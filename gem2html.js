const _ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
function _rand_n() {
  return Math.floor(Math.random()*(2**32));
}
function rand_id() {
  let n = _rand_n();
  let tmp = 0;
  let id = "";
  while (n>0) {
    tmp = Math.floor(n/36);
    id = _ALPHABET[n%36]+id;
    n = tmp;
  }
  return id;
}

function gem2html(gemtext,charset) {
  //console.log(gemtext, charset);
  charset = charset || "utf8";
  let text = gemtext.toString(charset);
  //console.log(text);
  let lines = text.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/);
  //console.log(lines.length,"line(s)");
  let pre = false;
  let pre_alt = false;
  let output = "<html><head><style>p, h1, h2, h3 {margin-top: 0; margin-bottom: 0;} blockquote {margin-inline-start: 1.5em; padding: .75em; border-inline-start: 2px solid #999;}</style></head><body>";
  let used_ids = new Array();
  for (let i=0;i<lines.length;i++) {
    let line = lines[i];
    if (pre) {
      if (line.slice(0,3)=="```") {
        output+="</pre>";
        pre = false;
        if (pre_alt) {
          output+="\n</figure>";
          pre_alt=false;
        }
      } else {
        output+=line.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      }
    } else {
      if (line.slice(0,3)=="```") {
        if (line.length>3) {
          let id = rand_id();
          while (used_ids.indexOf(id)!==-1) id = rand_id();
          output+="<figure role='img' aria-captioned-by='"+id+"'><figcaption id='"+id+"' style='clip: rect(0 0 0 0); clip-path: inset(50%); height: 1px; overflow: hidden; position: absolute; white-space: nowrap; width: 1px;'>"+line.slice(3)+"</figcaption>\n";
          pre_alt=true;
        }
        pre=true;
        output+="<pre>";
      } else if (line.slice(0,2)=="=>" && line.length>2) {
        let parts = line.slice(2).replace(/^\s+/,"").split(/\s+(.+)/,2);
        if (parts.length==1) {
          // just the path/url, so just use that
          output+="<p><a href='"+parts[0]+"'>"+parts[0].replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</a></p>";
        } else {
          // we have a link name
          output+="<p><a href='"+parts[0]+"'>"+parts[1].replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</a></p>";
        }
      } else if (line.slice(0,2)=="=:" && line.length>2) {
        // this is the spartan-specific input link
        // for right now we aren't even handling gemini input let alone spartan input
        // so just treat it as a link in its own right
        let parts = line.slice(2).replace(/^\s+/,"").split(/\s+(.+)/,2);
        let path, name;
        if (parts.length==1) {
          path = parts[0];
          name = "Submit input to path "+parts[0];
        } else {
          path = parts[0];
          name = parts[1];
        }
        output+="<form action=\""+path+"\" method=\"POST\" enctype=\"multipart/form-data\"><p>"+name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</p><p><label for='textinput'>Text input: </label><input type='text' name='textinput' /></p><p><label for='fileinput'>File input: </label><input type='file' name='fileinput' /></p><p><button type='submit'>Submit</button></p></form>";
      } else if (line[0]==">") {
        output+="<blockquote><p>"+line.slice(1).replace(/^\s+/,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</p></blockquote>";
      } else if (line[0]=="#") {
        let level = 1;
        if (line.slice(0,2)=="##") level=2;
        if (line.slice(0,3)=="###") level=3;
        output+="<h"+level+">"+line.slice(level).replace(/^\s+/,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</h"+level+">";
      } else if (line.slice(0,2)=="* ") {
        output+="<ul>\n<li>"+line.slice(2).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</li>\n</ul>"
      } else {
        if (line.length>0) {
          output+="<p>"+line.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")+"</p>";
        } else {
          output+="<p><br></p>";
        }
      }
    }
    output+="\n"
  }
  output+="</body></html>";
  output = output.replace(/<\/ul>\n<ul>\n/g,"");
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
