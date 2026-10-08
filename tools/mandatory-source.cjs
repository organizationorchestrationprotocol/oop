'use strict';
// Producer-only extraction. Consumers receive the bound texts in the distribution.
function extractMandatorySource(document) {
  const normalized=document.replace(/\r\n/g,'\n'),texts={};
  const runtime=normalized.indexOf('# Rules for the runtime\n'),maintainer=normalized.indexOf('# Rules for the maintainer\n');
  if(runtime<0||maintainer<=runtime)throw Error('Mandatory source role boundary unavailable');
  const source=normalized.slice(runtime,maintainer);
  for(const key of ['oop','profiles']){
    const begin='<!-- OOP mandatory source: '+key+' begin -->\n',end='\n<!-- OOP mandatory source: '+key+' end -->';
    if(source.split(begin).length!==2||source.split(end).length!==2)throw Error('Missing or duplicate mandatory source: '+key);
    const text=source.split(begin)[1].split(end)[0];
    if(!text.trim()||text!==text.trim())throw Error('Invalid complete mandatory source: '+key);
    texts[key]=text;
  }
  const begin='<!-- OOP upgrade guidance: begin -->',end='<!-- OOP upgrade guidance: end -->';
  if(source.split(begin).length!==2||source.split(end).length!==2)throw Error('Missing or duplicate upgrade guidance');
  const upgrade=source.split(begin)[1].split(end)[0];
  if(!upgrade.trim()||upgrade!==upgrade.trim())throw Error('Invalid upgrade guidance');
  texts.upgrade=upgrade;
  return texts;
}
module.exports={extractMandatorySource};
