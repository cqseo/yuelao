import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('.',import.meta.url));
const expected='4535335f0898a431ccd4c0deba8d4d625ec23a7598ea8fd9b18ad30ec911810a';
const avatarPath=resolve(root,'public/models/yuexia-ara-wanderer.glb');
const parts=Array.from({length:8},(_,i)=>resolve(root,'model-source',`part-${String(i).padStart(2,'0')}.bin`));

// GitHub stores the binary as eight verified objects to keep API uploads bounded.
// Assemble automatically for an independent preview build. Never download
// unpinned assets dynamically from third-party servers during deployment.
if(!existsSync(avatarPath)){
  if(!parts.every(p=>existsSync(p)))
    throw new Error('Ara model missing: run bash generate_ara_character.sh or restore all model-source/part-*.bin');
  mkdirSync(resolve(root,'public/models'),{recursive:true});
  writeFileSync(avatarPath,Buffer.concat(parts.map(p=>readFileSync(p))));
}
const actual=createHash('sha256').update(readFileSync(avatarPath)).digest('hex');
if(actual!==expected)throw new Error(`Ara model SHA-256 mismatch: ${actual}`);

export default defineConfig({
 root,
 base:'./',
 build:{
  rollupOptions:{
   input:{
    index:resolve(root,'index.html'),
    avatar:resolve(root,'avatar.html')
   }
  }
 }
});
