'use strict';
// Disposable producer fixture only. Never installed or exported as a consumer
// persistence backend. No automatic stale-lock stealing or durability guarantee
// beyond the tested local filesystem; real hosts choose an adequate mechanism.
const fs=require('node:fs');
const path=require('node:path');
const {transitionCheckpoint}=require('../runtime-checkpoint.cjs');
function fixtureStore(root,{mappingRevision='mapping-1',crashAt}={}) {
  const current=path.join(root,'current.json'),lock=path.join(root,'writer.lock');
  return {read:()=>fs.existsSync(current)?JSON.parse(fs.readFileSync(current,'utf8')):null,
    async transaction(body){
      try{fs.mkdirSync(lock);}catch(e){if(e.code==='EEXIST')return {state:'UNKNOWN',reason:'contested_writer'};throw e;}
      try{return await body({mappingRevision,read:()=>this.read(),commit:(_ref,value)=>{
        const stage=path.join(root,'next.json'),fd=fs.openSync(stage,'w');
        try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
        if(crashAt==='staged')process.exit(71);
        fs.renameSync(stage,current);
        if(crashAt==='committed')process.exit(72);
      }});}finally{fs.rmdirSync(lock);}
    }};
}
module.exports={fixtureStore};
if(require.main===module){
  const [root,expected,session,crashAt]=process.argv.slice(2);
  const owner=JSON.parse(fs.readFileSync(path.join(root,'owner.json'),'utf8'));
  transitionCheckpoint({resolve:()=>owner,store:fixtureStore(root,{crashAt}),expectedRevision:JSON.parse(expected),session,
    change:{failure:{id:session}}}).then(r=>process.stdout.write(JSON.stringify(r)));
}
