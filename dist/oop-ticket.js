'use strict';
function ticketRules() {
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const text=x=>typeof x==='string'&&!!x.trim()&&x.length<=4096;
  function validate(ticket,{prior=null,creation=false,allocation=null}={}) {
    const errors=[];
    if(!object(ticket))return {valid:false,errors:['ticket_object_required']};
    const heading=typeof ticket.heading==='string'?/^TKT-(\d{4})-([^\x00-\x1f\x7f]+)$/.exec(ticket.heading):null;
    const number=heading?Number(heading[1]):0;
    if(!heading||number<1||!heading[2].trim()||ticket.heading.length>256)errors.push('heading_TKT_NNNN_subject_required');
    if(!heading||ticket.id!=='TKT-'+heading[1])errors.push('stable_ticket_identity_mismatch');
    if(!text(ticket.objective)||!text(ticket.scope))errors.push('semantic_objective_and_scope_required');
    if(prior!==null&&(!object(prior)||prior.id!==ticket.id))errors.push('stable_ticket_identity_changed');
    const previous=prior?.history??[],history=ticket.history??[];
    if(!Array.isArray(previous)||!Array.isArray(history)||history.length<previous.length||
      JSON.stringify(history.slice(0,previous.length))!==JSON.stringify(previous))errors.push('historical_progress_changed');
    else for(const event of history.slice(previous.length)){
      if(!object(event)||event.ticket_id!==ticket.id)errors.push('progress_belongs_to_another_or_unbound_ticket');
    }
    if(creation){
      if(prior!==null)errors.push('existing_ticket_not_creation');
      if(!object(allocation)||!text(allocation.namespace)||!text(allocation.expected_revision)||
        !Number.isSafeInteger(allocation.high_water_mark)||allocation.high_water_mark<0||allocation.high_water_mark>9999||
        allocation.number!==number||allocation.ticket_id!==ticket.id)errors.push('authoritative_allocation_context_required');
      else if(allocation.high_water_mark===9999)errors.push('ticket_sequence_exhausted');
      else if(number<=allocation.high_water_mark)errors.push('ticket_sequence_not_increasing');
    }
    return {valid:errors.length===0,errors:[...new Set(errors)],
      assurance:'Structural candidate only. Verify authoritative allocation, expected-revision publication, semantic pertinence, authority and canonical readback independently.'};
  }
  return {validate};
}
function runTicketCLI(args=process.argv.slice(2)) {
  const fs=process.getBuiltinModule('node:fs');
  // Each failure names its cause, the affected argument and the next action; the exit status stays 1.
  const remedies={arguments_prior_or_allocation_required:'Validate an update with <ticket.json> --prior <committed-ticket.json>, or a creation with <ticket.json> --allocation <allocation.json>.',
    arguments_invalid:'Use <ticket.json> followed by --prior <file> and/or --allocation <file>, each option at most once.',
    input_unreadable:'Supply an existing regular file that is not a link.',input_too_large:'Supply a JSON file of at most 262144 bytes.',input_json_invalid:'Supply one complete JSON object encoded as UTF-8.'};
  const fail=(code,argument)=>{const error=Error(code);error.argument=argument;throw error;};
  try{
    if(args.length===1)fail('arguments_prior_or_allocation_required','options');
    if(args.length<3||args.length%2!==1||args.slice(1).some((a,i)=>i%2===0&&!['--prior','--allocation'].includes(a))||
      new Set(args.filter((_,i)=>i%2===1)).size!==(args.length-1)/2)fail('arguments_invalid','options');
    const load=(file,argument)=>{
      let stat;try{stat=fs.lstatSync(file);}catch{fail('input_unreadable',argument);}
      if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('input_unreadable',argument);
      if(stat.size>262144)fail('input_too_large',argument);
      try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{fail('input_json_invalid',argument);}
    };
    const options={};for(let i=1;i<args.length;i+=2)options[args[i].slice(2)]=load(args[i+1],args[i].slice(2));
    const result=ticketRules().validate(load(args[0],'ticket'),{...options,creation:!!options.allocation});
    process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.valid?0:1;
  }catch(error){
    const code=Object.hasOwn(remedies,error?.message)?error.message:'input_unreadable';
    process.stdout.write(JSON.stringify({valid:false,errors:[code],argument:error?.argument??'ticket',remedy:remedies[code]})+'\n');process.exitCode=1;
  }
}
if(typeof module!=='undefined')module.exports={ticketRules,runTicketCLI};
if(typeof require==='undefined'||require.main===module)runTicketCLI();
