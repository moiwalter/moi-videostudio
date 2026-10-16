#!/usr/bin/env node
import {isMain} from './project.mjs';
// Measurement only: never normalizes or overwrites audio.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function measureLoudness(file){
 const probe=spawnSync('ffprobe',['-v','error','-show_streams','-of','json',file],{encoding:'utf8'});if(probe.status!==0)throw Error(probe.stderr||'ffprobe failed');const streams=JSON.parse(probe.stdout).streams.filter(s=>s.codec_type==='audio');if(!streams.length)return {state:'N/A',note:'No audio stream'};
 const r=spawnSync('ffmpeg',['-hide_banner','-nostdin','-i',file,'-map','0:a:0','-af','loudnorm=print_format=json','-f','null','-'],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000});if(r.status!==0)throw Error(r.stderr||'Audio measurement failed');const json=r.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];if(!json)throw Error('No loudness measurement returned');const d=JSON.parse(json);return {state:'MEASURED',streamCount:streams.length,sampleRate:Number(streams[0].sample_rate),channels:streams[0].channels,integratedLUFS:Number(d.input_i),truePeakDbTP:Number(d.input_tp),loudnessRangeLU:Number(d.input_lra)};
}
if(isMain(import.meta.url)){try{if(!process.argv[2])throw Error('Uso: loudness.mjs archivo');const r=measureLoudness(resolve(process.argv[2]));console.log(JSON.stringify(r,null,2));}catch(e){console.error(e.message);process.exitCode=2;}}
