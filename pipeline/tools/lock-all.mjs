#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {join,basename} from 'node:path';
import {resolveProject,ROOT} from './project.mjs';
import {scenes,approvalState,outputState} from './scene-state.mjs';
try{const [needle,...args]=process.argv.slice(2);const base=resolveProject(needle),rows=scenes(base,'KIT').map(sc=>({sc,approval:approvalState(base,sc),output:outputState(base,sc)}));if(!rows.length)throw Error('No hay escenas KIT');let failed=false;
for(const {sc,approval,output} of rows){if(!approval.ok){console.log(`PENDING ${sc.id}: ${approval.state}`);failed=true;continue;}if(sc.data.type==='footage'){console.log(`N/A ${sc.id}: footage directo`);continue;}if(output.ok&&!args.includes('--forzar')){console.log(`CURRENT ${sc.id}`);continue;}console.log(`RENDER ${sc.id}`);if(args.includes('--lista'))continue;const cmd=sc.data.type==='full'?'final.sh':'alpha.sh';const r=spawnSync('bash',[join(ROOT,'pipeline/tools',cmd),base,sc.id],{stdio:'inherit'});if(r.status!==0)failed=true;}
process.exitCode=failed?2:0;
}catch(e){console.error(e.message);process.exitCode=1;}
