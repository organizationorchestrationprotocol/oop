import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url),{ticketRules}=require('./ticket-rules.cjs'),rules=ticketRules();
const ticket=()=>({id:'TKT-0042',heading:'TKT-0042-frontend-panel',objective:'Repair panel display',scope:'Frontend rendering only',history:[{ticket_id:'TKT-0042',state:'proposed'}]});
const allocation=()=>({namespace:'operations:project',expected_revision:'revision-1',high_water_mark:41,number:42,ticket_id:'TKT-0042'});
const observe=(n,name,fn)=>test('REL-TKT-'+String(n).padStart(3,'0')+': '+name,fn);
observe(1,'heading requires four digits, nonzero sequence and a subject',()=>{
 assert.equal(rules.validate(ticket()).valid,true);
 for(const heading of ['TKT-42-panel','TKT-0000-panel','TKT-0042-','TKT-0042-   ','TKT-0042-panel\nExtra','TKT-10000-panel'])assert.equal(rules.validate({...ticket(),heading}).valid,false);
});
observe(2,'creation needs a scoped revision-bound increasing allocation',()=>{
 assert.equal(rules.validate(ticket(),{creation:true,allocation:allocation()}).valid,true);
 for(const patch of [{namespace:''},{expected_revision:''},{high_water_mark:42},{number:43},{ticket_id:'TKT-0041'}])assert.equal(rules.validate(ticket(),{creation:true,allocation:{...allocation(),...patch}}).valid,false);
 assert.equal(rules.validate(ticket(),{creation:true}).valid,false);
});
observe(3,'exhaustion cannot wrap or reuse deleted identities',()=>{
 const result=rules.validate(ticket(),{creation:true,allocation:{...allocation(),high_water_mark:9999}});assert.ok(result.errors.includes('ticket_sequence_exhausted'));
 assert.equal(rules.validate(ticket(),{creation:true,allocation:{...allocation(),high_water_mark:50}}).valid,false);
});
observe(4,'subject edits preserve numeric identity and historical progress',()=>{
 const prior=ticket(),next={...prior,heading:'TKT-0042-panel-accessibility',history:[...prior.history,{ticket_id:prior.id,state:'planned'}]};
 assert.equal(rules.validate(next,{prior}).valid,true);
 assert.equal(rules.validate({...next,id:'TKT-0043',heading:'TKT-0043-panel'},{prior}).valid,false);
 assert.equal(rules.validate({...next,history:[{ticket_id:prior.id,state:'closed'}]},{prior}).valid,false);
});
observe(5,'frontend progress cannot be appended under a finance identity',()=>{
 const finance={...ticket(),id:'TKT-0041',heading:'TKT-0041-finance',objective:'Review financial forecast',scope:'Finance',history:[]};
 assert.equal(rules.validate({...finance,history:ticket().history}).valid,false);
 assert.equal(rules.validate({...finance,dependencies:['TKT-0042']}).valid,true);
});
observe(6,'semantic scope is mandatory but shape does not prove meaning',()=>{
 for(const patch of [{objective:''},{scope:undefined}])assert.equal(rules.validate({...ticket(),...patch}).valid,false);
 assert.match(rules.validate(ticket()).assurance,/semantic pertinence/);
});
observe(7,'distributed validator rejects malformed and unsafe candidate input',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'oop-ticket-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'ticket.json');fs.writeFileSync(file,JSON.stringify(ticket()));
 const allocationFile=path.join(root,'allocation.json');fs.writeFileSync(allocationFile,JSON.stringify(allocation()));
 const call=args=>spawnSync(process.execPath,['dist/oop-ticket.js',...args],{encoding:'utf8'});
 assert.equal(call([file,'--allocation',allocationFile]).status,0);
 const failure=args=>{const run=call(args);assert.equal(run.status,1);return JSON.parse(run.stdout);};
 assert.deepEqual(failure([file]).errors,['arguments_prior_or_allocation_required']);
 assert.match(failure([file]).remedy,/--prior/);
 assert.deepEqual(failure([file,'--unknown',file]).errors,['arguments_invalid']);
 assert.deepEqual(failure([path.join(root,'absent.json'),'--prior',file]).errors,['input_unreadable']);
 fs.writeFileSync(allocationFile,'x'.repeat(262145));assert.deepEqual(failure([file,'--allocation',allocationFile]),{valid:false,errors:['input_too_large'],argument:'allocation',remedy:'Supply a JSON file of at most 262144 bytes.'});
 fs.writeFileSync(file,'not json');assert.deepEqual(failure([file,'--prior',file]).errors,['input_json_invalid']);
});
observe(8,'routing and mandatory ticket procedure carry opening and semantic ownership',()=>{
 const controller=require('../dist/oop-enforce.js'),output=controller.response({status:'bootstrap_or_inactive',state:'intake',history:[]}).delivery.message;
 assert.match(output.procedure.tickets.rule,/immediately/i);assert.match(output.procedure.tickets.rule,/separate/);
 assert.ok(output.routing.base.some(m=>m.id==='core'));assert.ok(output.routing.routes.intake.reachable.length);
 assert.ok(output.routing.index.entries.join('\n').includes('tickets'));
});
