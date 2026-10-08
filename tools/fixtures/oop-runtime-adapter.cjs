'use strict';
// Synthetic producer adapter only; not official documentation or installed support.
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join}=require('node:path');
const {createHash}=require('node:crypto');
const digest=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
function descriptor({supported_commands=['entry','interaction','pre-effect','post-effect','completion','recovery','delegate','probe','declare','load','worklog-append','worklog-read'],format='oop',policy={},fallback}={}){
 const placeholders={response:{source:'response',type:'json',required:true,encoding:'json'},message:{source:'response.payload.runtime_message',type:'string',required:false,absent:'',encoding:'text'},input:{source:'response',type:'json',required:true,encoding:'json'}};
 return {schema_version:1,host:'fixture-host',runtime_version:'fixture-version',documentation:[{source:'fixture:documented-interface',section:'commands'}],supported_commands:Object.fromEntries(supported_commands.map(e=>[e,{[e]:{...Object.fromEntries(['allow','deny','unknown','error'].map((d,i)=>[d,{stdout:format==='message'&&!['declare','load','worklog-append','worklog-read','diagnostics-read','diagnostics-ack','diagnostics-cleanup'].includes(e)?'{{message}}':'{{response}}',stderr:'',exitCode:[0,2,3,4][i]}])),...(fallback!==undefined?{_:fallback}:{})}}])),placeholders,rendering:policy};
}
function complete(template,options={}){
 const bodies={manifest:JSON.stringify(options.descriptor??descriptor(options)),decodeEvent:options.decode??'return {native_event:context.command,request:raw,session:raw.session || (raw.coordination && raw.coordination.session),resource:raw.resource,context_event:raw.context_event};'};
 // Complete editable regions consistently for LF and CRLF input scaffolds.
 let source=template.replace(/\r\n/g,'\n');
 for(const [id,body] of Object.entries(bodies))source=source.replace(new RegExp('(// OOP-EDIT-BEGIN '+id+'\\n)[\\s\\S]*?([ \\t]*// OOP-EDIT-END '+id+')'),(_,a,b)=>a+'    '+body+'\n'+b);
 return source;
}
function register(owned,template,options={}){
  mkdirSync(owned,{recursive:true});const path=join(owned,'oop-runtime-adapter.js'),source=complete(template,options);writeFileSync(path,source);
  return {path,identity:digest(Buffer.from(source)),template_identity:digest(template),host:'fixture-host',runtime_version:'fixture-version',required_events:options.supported_commands??['entry']};
}
module.exports={complete,register,digest,descriptor};
