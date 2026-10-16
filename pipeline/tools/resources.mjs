import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {inputGraph} from './input-graph.mjs';
export function checkResources(base,entry,{assetBase=dirname(entry),allowPlaceholders=false}={}){try{const text=readFileSync(entry,'utf8');const placeholders=[...text.matchAll(/data-asset\s*=\s*["']([^"']*)["']/g)].map(m=>m[1]);if(placeholders.length&&!allowPlaceholders)return {ok:false,error:'Recursos pendientes: '+placeholders.join(', ')};const fp=inputGraph(base,{roots:[entry],assetBase});const external=fp.remote;if(external.length)return {ok:false,error:'Congelar recursos remotos localmente: '+external.join(', ')};return {ok:true,inputs:fp.inputs,draft:!!placeholders.length};}catch(e){return {ok:false,error:e.message};}}
