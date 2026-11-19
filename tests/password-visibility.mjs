import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Window } from 'npm:happy-dom@20.0.11';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const filename of ['SignUp.html','LoginPage.html']){
 const window=new Window({url:'https://flowers.test/Log-Sign/'+filename,settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
 try{
  const document=window.document;document.write(fs.readFileSync(path.join(root,'Log-Sign',filename),'utf8'));
  await window.happyDOM.waitUntilComplete();
  const records=new Map();const errors=[];
  window.addEventListener('error',event=>errors.push(event.error||event.message));
  const context=vm.createContext({document,URLSearchParams,location:{search:'',href:'https://flowers.test/Log-Sign/'+filename},console,
   localStorage:{getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)}});
  const run=source=>vm.runInContext(source,context);
  for(const script of ['settings','products','store','account'])run(fs.readFileSync(path.join(root,script+'.js'),'utf8'));
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const form=document.querySelector('form');let submissions=0;
  form.addEventListener('submit',event=>{submissions++;event.preventDefault();});
  const buttons=Array.from(form.querySelectorAll('[data-password-toggle]'));
  assert.equal(buttons.length,filename==='SignUp.html'?2:1);
  const inputs=buttons.map(button=>document.getElementById(button.dataset.passwordToggle));
  inputs.forEach(input=>input.value='Garden2026!');
  for(const [index,button]of buttons.entries()){
   assert.equal(button.type,'button');assert.equal(inputs[index].type,'password');
   button.click();assert.equal(inputs[index].type,'text');
   assert.equal(button.getAttribute('aria-label'),'Hide password');assert.equal(button.getAttribute('aria-pressed'),'true');
   assert.equal(inputs[index].value,'Garden2026!');
   assert.ok(inputs.every((input,i)=>i===index||input.type==='password'));
   button.click();assert.equal(inputs[index].type,'password');
   assert.equal(button.getAttribute('aria-label'),'Show password');assert.equal(button.getAttribute('aria-pressed'),'false');
  }
  if(filename==='SignUp.html'){
   inputs[1].value='Different!';inputs[1].dispatchEvent(new window.Event('input',{bubbles:true}));
   const before=document.getElementById('password-confirm-error').textContent;
   assert.match(before,/Passwords do not match/);
   buttons[1].click();assert.equal(document.getElementById('password-confirm-error').textContent,before);
   assert.equal(inputs[0].getAttribute('minlength'),'8');assert.ok(inputs[0].hasAttribute('pattern'));
  }
  assert.equal(submissions,0);assert.equal(run('PetalStore.read("petal-profiles",[]).length'),0);
  assert.deepEqual(errors,[]);
 }finally{await window.happyDOM.close();}
}
console.log('PASS Signup/login eye buttons independently show/hide passwords without changing their values, submitting the form, or weakening password confirmation rules.');
