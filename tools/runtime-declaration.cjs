'use strict';
// Pure generic contract. Host semantics are independently reviewed inputs.
function runtimeDeclaration() {
  const decisions=['allow','deny','unknown','error'];
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const own=(x,k)=>object(x)&&Object.hasOwn(x,k);
  const sources=/^(decision|response(?:\.[A-Za-z_][A-Za-z0-9_]*)*|additionalContext(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;
  const tokens=/\{\{\{\{|\}\}\}\}|\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;
  function names(template){
    if(typeof template!=='string'||!template.isWellFormed()||Buffer.byteLength(template)>1048576)throw Error('template_invalid');
    if(template.replace(tokens,'').includes('{{')||template.replace(tokens,'').includes('}}'))throw Error('template_delimiter_invalid');
    return [...template.matchAll(tokens)].filter(m=>m[1]).map(m=>m[1]);
  }
  const single=value=>typeof value==='string'&&value.length>0&&value.length<=512&&value.isWellFormed()&&value.trim()===value&&!/[|\x00-\x1f\x7f]/.test(value);
  function index(p,requirements={},fail=(code)=>{throw Error(code);}){
    const commands=new Map();
    for(const [command,groups] of Object.entries(object(p.supported_commands)?p.supported_commands:{})){
      const at='supported_commands.'+command,natives=new Map();commands.set(command,natives);
      if(!object(groups)||!Object.keys(groups).length){fail('native_groups_invalid',at,'Declare a nonempty object keyed by native event or literal | group.');continue;}
      for(const [label,block] of Object.entries(groups)){
        const location=at+'.'+label,events=label.split('|'),responses=new Map();
        if(events.some(e=>!single(e))||new Set(events).size!==events.length){fail('native_group_invalid',location,'Use distinct nonempty literal native event tokens without outer whitespace.');continue;}
        if(!object(block)){fail('native_block_invalid',location,'Declare four decision outcomes and optional static _.');continue;}
        for(const [key,value] of Object.entries(block)){
          if(key==='_')continue;
          const outcomes=key.split('|');
          if(outcomes.some(d=>!decisions.includes(d))||new Set(outcomes).size!==outcomes.length){fail('decision_group_invalid',location+'.'+key,'Use distinct allow, deny, unknown or error tokens; _ must stand alone.');continue;}
          for(const decision of outcomes){if(responses.has(decision))fail('decision_overlap',location+'.'+key,'Declare each decision exactly once.');else responses.set(decision,value);}
        }
        for(const decision of decisions)if(!responses.has(decision))fail('decision_case_missing',location+'.'+decision,'Declare '+decision+' independently of fallback.');
        for(const event of events){if(natives.has(event))fail('native_event_overlap',location,'Declare each native event exactly once within a command.');else natives.set(event,{responses,...(own(block,'_')?{fallback:block._}:{}),location});}
      }
      const expected=requirements.native_events?.[command];
      if(expected!==undefined&&!Array.isArray(expected))fail('native_requirements_invalid',at,'Use independently established native event requirements.');
      else for(const event of expected??[])if(!natives.has(event))fail('native_event_missing',at+'.'+event,'Declare the independently required native mechanism.');
    }
    for(const command of Object.keys(requirements.native_events??{}))if(!commands.has(command))fail('native_command_missing','supported_commands.'+command,'Declare the command required by the native configuration.');
    return commands;
  }
  function select(compiled,command,event){
    if(!single(event))throw Error('native_event_invalid');
    const selected=compiled.get(command)?.get(event);
    if(!selected)throw Error('native_event_unsupported');
    return selected;
  }
  function validate(p,requirements={}) {
    const diagnostics=[];
    const fail=(code,location,correction)=>diagnostics.push({code,location,correction});
    if(!object(p)||p.schema_version!==1)return {valid:false,diagnostics:[{code:'manifest_version',location:'manifest',correction:'Use schema_version 1.'}]};
    if(!['host','runtime_version'].every(k=>typeof p[k]==='string'&&p[k]))fail('identity_missing','manifest','Declare host and runtime_version.');
    if(Object.keys(p).some(k=>!['schema_version','host','runtime_version','documentation','supported_commands','placeholders','rendering'].includes(k)))fail('manifest_field_unknown','manifest','Use only declared version-1 fields.');
    if(!object(p.placeholders))fail('placeholders_missing','placeholders','Declare placeholder definitions, including an empty object when none apply.');
    if(!Array.isArray(p.documentation)||!p.documentation.length||p.documentation.some(d=>!object(d)||!d.source||!d.section))fail('documentation_missing','documentation','Supply applicable official source and section references.');
    const declared=p.supported_commands;
    if(!object(declared)||!Object.keys(declared).length)fail('supported_commands_invalid','supported_commands','Declare a nonempty object keyed by supported command.');
    const events=object(declared)?Object.keys(declared):[];
    for(const event of requirements.supported_commands??[])if(!events.includes(event))fail('event_missing','supported_commands.'+event,'Declare the independently required event.');
    const placeholders=object(p.placeholders)?p.placeholders:{};
    for(const [name,spec] of Object.entries(placeholders)){
      const at='placeholders.'+name;
      if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)||!object(spec)||!sources.test(spec.source??'')||spec.source.split('.').some(k=>['__proto__','prototype','constructor'].includes(k))||
        !['string','number','boolean','json'].includes(spec.type)||typeof spec.required!=='boolean'||!['text','json','json-string'].includes(spec.encoding)||
        (!spec.required&&typeof spec.absent!=='string')){fail('placeholder_definition_invalid',at,'Declare an allowed source, type, encoding, required flag and optional absent text.');continue;}
      if(spec.encoding==='json-string'&&spec.type!=='string')fail('encoding_type_mismatch',at,'Use a string source for json-string.');
      if(spec.mapping!==undefined&&(!object(spec.mapping)||spec.encoding!=='text'||Object.entries(spec.mapping).some(([a,b])=>[...a].length!==1||typeof b!=='string'||!b.isWellFormed())))fail('mapping_invalid',at,'Map single Unicode characters to well-formed text in one pass.');
    }
    const compiled=index(p,requirements,fail);
    for(const [command,natives] of compiled)for(const [event,selected] of natives){
      for(const [decision,c] of selected.responses){
        const at=selected.location+'.'+decision;
        if(!object(c)){fail('decision_case_invalid',at,'Declare an output object for '+decision+'.');continue;}
        if(Object.keys(c).some(k=>!['stdout','stderr','exitCode'].includes(k))||!Number.isInteger(c.exitCode)||c.exitCode<0||c.exitCode>255)fail('output_declaration_invalid',at,'Declare only string stdout/stderr and process-supported exitCode.');
        const used=new Set();
        for(const channel of ['stdout','stderr'])try{for(const n of names(c[channel])){used.add(n);if(!own(placeholders,n))fail('placeholder_unknown',at+'.'+channel,'Declare placeholder '+n+'.');}}catch(e){fail(e.message,at+'.'+channel,'Supply a valid literal template.');}
        for(const name of [...requirements.placeholders?.[command]??[],...requirements.native_placeholders?.[command]?.[event]??[]])if(!used.has(name)||placeholders[name]?.required!==true)fail('required_placeholder_missing',at,'Use independently required placeholder '+name+' with required true.');
      }
      if(own(selected,'fallback')){
        const c=selected.fallback,at=selected.location+'._';
        if(!object(c)||Object.keys(c).some(k=>!['stdout','stderr','exitCode'].includes(k))||typeof c.stdout!=='string'||typeof c.stderr!=='string'||!c.stdout.isWellFormed()||!c.stderr.isWellFormed()||!Number.isInteger(c.exitCode)||c.exitCode<0||c.exitCode>255)fail('fallback_invalid',at,'Declare static string stdout/stderr and bounded integer exitCode.');
      }
    }
    return {valid:diagnostics.length===0,diagnostics};
  }
  function render(p,event,input,compiled=index(p)){
    const c=select(compiled,event,input.event?.native_event).responses.get(input.decision);
    if(!c)throw Error('decision_case_missing');
    function value(name){
      const spec=p.placeholders[name];if(!spec)throw Error('placeholder_unknown');
      let v=input,exists=true;
      for(const key of spec.source.split('.')){if(!own(v,key)){exists=false;break;}v=v[key];}
      if(!exists){if(spec.required)throw Error('mandatory_value_missing');return spec.absent;}
      if(spec.type!=='json'&&(typeof v!==spec.type||v===null)||spec.type==='number'&&!Number.isFinite(v))throw Error('placeholder_type_invalid');
      let out=spec.encoding==='json'?JSON.stringify(v):spec.encoding==='json-string'?JSON.stringify(v).slice(1,-1):String(v);
      if(typeof out!=='string'||!out.isWellFormed())throw Error('encoding_invalid');
      if(spec.mapping){let mapped='',size=0;for(const ch of out){const replacement=Object.hasOwn(spec.mapping,ch)?spec.mapping[ch]:ch;size+=Buffer.byteLength(replacement);if(size>(p.rendering?.maxOutputBytes??1048576))throw Error('rendered_size_exceeded');mapped+=replacement;}out=mapped;}
      return out;
    }
    const expand=s=>{names(s);let size=Buffer.byteLength(s);return s.replace(tokens,(m,n)=>{const v=m==='{{{{'?'{{':m==='}}}}'?'}}':value(n);size+=Buffer.byteLength(v)-Buffer.byteLength(m);if(size>(p.rendering?.maxOutputBytes??1048576))throw Error('rendered_size_exceeded');return v;});};
    const out={stdout:expand(c.stdout),stderr:expand(c.stderr),exitCode:c.exitCode};
    return out;
  }
  return {validate,render,compile:index,select};
}
module.exports={runtimeDeclaration};
