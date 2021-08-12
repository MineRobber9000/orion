module.exports = function(mimetype) {
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
