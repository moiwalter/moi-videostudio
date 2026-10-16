// Content-bound dependency fingerprints for HTML/CSS and JS/TS/React.
import {existsSync,readFileSync,readdirSync,statSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,extname,join} from 'node:path';
import {createHash} from 'node:crypto';
export const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
export const stable=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(stable(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(stable(value[k]))])):value??null);
export function inputGraph(base,{roots=[],publicDir='public',assetBase=null,values=null}={}){
 const found=new Map(),seenDirs=new Set(),remote=new Set();const pub=resolve(base,publicDir);
 function localRef(ref,file,kind='media'){
  if(/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(ref)){if(/^https?:/.test(ref))remote.add(ref);return;}
  ref=decodeURIComponent(ref.split(/[?#]/)[0]);if(!ref)return;
  if(kind==='import'&&!ref.startsWith('.')&&!ref.startsWith('/')){
   if(ref.startsWith('@/')||ref.startsWith('~/'))throw Error(`Import alias sin resolver: ${ref}; declarar inputs explícitos o usar ruta relativa`);return;
  }
  let candidates=ref.startsWith('/')?[resolve(pub,'.'+ref)]:[resolve(dirname(file),ref)];
  if(assetBase&&kind==='media')candidates.push(resolve(assetBase,ref));
  for(const candidate of candidates){
   const options=kind==='import'?[candidate,...['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css'].map(e=>candidate+e),...['index.ts','index.tsx','index.js','index.jsx'].map(n=>join(candidate,n))]:[candidate];
   for(const p of options)if(existsSync(p)&&statSync(p).isFile()){visit(p);return;}
  }
  throw Error(`Input ausente: ${ref} (desde ${relative(base,file)})`);
 }
 function visit(file){file=resolve(file);if(found.has(file))return;if(!existsSync(file))throw Error(`Input ausente: ${file}`);
  if(statSync(file).isDirectory()){const real=realpathSync(file);if(seenDirs.has(real))return;seenDirs.add(real);for(const n of readdirSync(file).sort())if(!n.startsWith('.')&&n!=='node_modules')visit(join(file,n));return;}
  found.set(file,digest(file));const ext=extname(file).toLowerCase();if(!['.html','.css','.js','.mjs','.cjs','.jsx','.ts','.tsx'].includes(ext))return;
  const s=readFileSync(file,'utf8');
  if(ext==='.html'||ext==='.css'){
   for(const m of s.matchAll(/\b(?:src|href|poster|data-composition-src)\s*=\s*["']([^"']+)["']/g))localRef(m[1],file);
   for(const m of s.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g))localRef(m[1],file);
   for(const m of s.matchAll(/@import\s+["']([^"']+)["']/g))localRef(m[1],file,'import');
  }
  // Covers imports/re-exports, dynamic imports and require with literal arguments.
  if(ext!=='.css')for(const m of s.matchAll(/(?:\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?|\b(?:import|require)\s*\()\s*["']([^"']+)["']/g))localRef(m[1],file,'import');
  if(!['.html','.css'].includes(ext)){
   for(const m of s.matchAll(/\b(?:src|poster)\s*=\s*(?:\{\s*)?["']([^"']+)["']/g))localRef(m[1],file);
   if(/\bimport\s*\(\s*(?!['"\s])/.test(s))throw Error(`Dynamic import cannot be verified: ${file}; use literal imports`);
   for(const m of s.matchAll(/staticFile\(\s*(['"])(.*?)\1\s*\)/g))visit(resolve(pub,m[2]));
   // Dynamic asset names are conservatively covered by the public tree.
   if(/staticFile\(\s*(?!['"])/.test(s)){if(!existsSync(pub))throw Error(`Recursos dinámicos sin publicDir: ${file}`);visit(pub);}
   for(const m of s.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g))localRef(m[1],file,'media');
  }
 }
 for(const p of roots)visit(resolve(base,p));
 if(!found.size)throw Error('No hay inputs para verificar.');
 const entries=[...found].map(([f,h])=>[relative(base,f),h]).sort(([a],[b])=>a.localeCompare(b));
 return {sha256:createHash('sha256').update(stable({entries,values})).digest('hex'),inputs:entries.map(([f])=>f),remote:[...remote].sort()};
}
