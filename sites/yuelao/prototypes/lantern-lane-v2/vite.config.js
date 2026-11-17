import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('.',import.meta.url));
const expected='e488dccc0ee120afe0b133271d257131e24e94df3b80e21eab9790cbdfdd29f8';
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
