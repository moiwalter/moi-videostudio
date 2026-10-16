#!/usr/bin/env node
import {readFileSync,existsSync,readdirSync} from 'node:fs';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {ROOT,isMain} from './project.mjs';
export function loadStyle(id){const p=join(ROOT,'pipeline/styles',id,'style.json');if(!existsSync(p))throw Error(`Estilo desconocido: ${id}`);return JSON.parse(readFileSync(p,'utf8'));}
export function styleBrief(id){const s=loadStyle(id);return `EDITING STYLE: ${s.label} (${s.id}@${s.version})\nResource policy: ${s.resourcePolicy}\nReview: ${s.reviewMode}\n${s.principles.map(p=>' · '+p).join('\n')}\nBrand colors/fonts come from the client; episode choices come from the current brief.`;}
if(isMain(import.meta.url)){try{console.log(process.argv[2]?styleBrief(process.argv[2]):readdirSync(join(ROOT,'pipeline/styles')).join('\n'));}catch(e){console.error(e.message);process.exitCode=1;}}
