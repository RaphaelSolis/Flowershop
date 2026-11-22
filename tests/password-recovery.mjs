import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { Window } from 'npm:happy-dom@20.0.11';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oldPassword = 'Garden2026!';
const newPassword = 'NewFlowers2026!';
async function load(filename, records = new Map(), search = '') {
  const window = new Window({url:'https://flowers.test/'+filename+search,settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
  const document = window.document;
  document.write(fs.readFileSync(path.join(root,filename),'utf8'));
  await window.happyDOM.waitUntilComplete();
  // Happy DOM evaluates HTML patterns without the browser's Unicode v flag.
  // The shared JavaScript validator still enforces the actual Unicode password rule.
  for(const input of document.querySelectorAll('input[pattern]'))
    if(input.getAttribute('pattern').includes('\\p{Lu}'))input.removeAttribute('pattern');
  const errors = [];
  window.addEventListener('error',event=>errors.push(event.error || event.message));
  const location = {href:'https://flowers.test/'+filename+search,search,hash:''};
  let failKey = null;
  const context = vm.createContext({document,window,location,URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
    requestAnimationFrame:cb=>{cb();return 1;},setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},
    localStorage:{getItem:key=>records.get(key)??null,setItem:(key,value)=>{if(key===failKey)throw new Error('Storage full');records.set(key,value);},removeItem:key=>records.delete(key)}});
  const run = code=>vm.runInContext(code,context);
  const scripts = filename==='profile.html' ? ['settings','products','store','app','shop','customize','security-questions','pages'] : ['settings','products','store','security-questions','account'];
  for(const script of scripts) run(fs.readFileSync(path.join(root,script+'.js'),'utf8'));
  if(filename==='profile.html') {
    document.querySelector('.site-header').getBoundingClientRect=()=>({left:0,top:0});
    Array.from(document.querySelectorAll('.nav-link,[data-cart]')).forEach((tab,index)=>tab.getBoundingClientRect=()=>({left:index*100,bottom:90,width:80}));
  }
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const form = document.querySelector(filename==='profile.html'?'#profile-security-form':'form');
  // Match browsers: descendants of a disabled fieldset do not participate in validation.
  const nativeValidity = form.reportValidity.bind(form);
  form.reportValidity = () => {
    const inheritedDisabled = Array.from(form.querySelectorAll('fieldset[disabled] input, fieldset[disabled] select, fieldset[disabled] button')).filter(input=>!input.disabled);
    for(const input of inheritedDisabled)input.disabled=true;
    try{return nativeValidity();}finally{for(const input of inheritedDisabled)input.disabled=false;}
  };
  const field = (name,value)=>{const input=form.elements.namedItem(name);assert.ok(input,'Missing '+name);input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));};
  async function submit() {
    form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
    for(let attempt=0;form.querySelector('[type="submit"]').disabled && attempt<300;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(form.querySelector('[type="submit"]').disabled,false,'Submission completes');
  }
  const status = ()=>document.getElementById(filename==='profile.html'?'security-status':'account-status').textContent;
  const json = code=>JSON.parse(run('JSON.stringify('+code+')'));
  return {window,document,form,field,submit,status,json,run,location,records,setFailure:key=>{failKey=key;},
    close:async()=>{assert.deepEqual(errors,[],'Uncaught errors');await window.happyDOM.close();}};
}
function fillSignup(p,email) {
  for(const [name,value] of Object.entries({fname:'Garden',lname:'Shopper',email,password:oldPassword,confirmPassword:oldPassword,mobile:'+639123456789'}))p.field(name,value);
}
function fillQuestions(p,custom=false) {
  p.field('securityQuestion1','What was the name of your first pet?');
  p.field('securityAnswer1','  Fluffy   Cat  ');
  p.field('securityQuestion2',custom?'custom':'What was the name of your first school?');
  if(custom)p.field('customQuestion2','What is my private garden phrase?');
  p.field('securityAnswer2','Café garden');
}
function fillReset(p,password=newPassword) {
  p.field('answer1','FLUFFY CAT');p.field('answer2','  CAFÉ   GARDEN  ');
  p.field('password',password);p.field('confirmPassword',password);
}

const records = new Map();
{
  const p=await load('Log-Sign/SignUp.html',records,'?next=checkout');
  fillSignup(p,'garden@example.com');
  await p.submit();assert.equal(p.json('PetalStore.read("petal-profiles",[])').length,0);
  fillQuestions(p);
  p.field('securityQuestion2','What was the name of your first pet?');
  await p.submit();assert.match(p.document.querySelector('[data-security-error]').textContent,/different/);
  assert.equal(p.json('PetalStore.read("petal-profiles",[])').length,0);
  p.field('securityQuestion2','custom');p.field('customQuestion2','short');
  await p.submit();assert.match(p.document.querySelector('[data-security-error]').textContent,/10 to 160/);
  p.field('customQuestion2','What is my private garden phrase?');p.field('securityAnswer2','   ');
  await p.submit();assert.match(p.document.querySelector('[data-security-error]').textContent,/Answer both/);
  fillQuestions(p);
  await p.submit();
  assert.equal(p.location.href,'../checkout.html',p.status()+' '+JSON.stringify(Array.from(p.form.elements).filter(el=>el.willValidate&&!el.checkValidity()).map(el=>({name:el.name,message:el.validationMessage}))));
  const profile=p.json('PetalStore.session()');
  assert.equal(profile.recoveryQuestions.length,2);
  assert.notEqual(profile.recoveryQuestions[0].answerRecord.salt,profile.recoveryQuestions[1].answerRecord.salt);
  for(const question of profile.recoveryQuestions){assert.match(question.answerRecord.digest,/^[a-f0-9]{64}$/);assert.equal(question.answer,undefined);}
  assert.ok(!records.get('petal-profiles').toLowerCase().includes('fluffy'));
  p.run('PetalStore.logout()');
  await p.close();
}
console.log('PASS Signup requires distinct questions and nonblank answers, allows presets/custom questions, hashes answers with independent salts, and keeps checkout navigation.');
{
  const p=await load('Log-Sign/SignUp.html',records);
  fillSignup(p,'custom@example.com');fillQuestions(p,true);await p.submit();
  assert.equal(p.json('PetalStore.session()').recoveryQuestions[1].question,'What is my private garden phrase?');
  p.run('PetalStore.logout()');await p.close();
  const q=await load('Log-Sign/SignUp.html',records);
  fillSignup(q,'garden@example.com');fillQuestions(q);await q.submit();
  assert.match(q.status(),/already has an account/);assert.equal(q.json('PetalStore.read("petal-profiles",[])').length,2);
  await q.close();
}
const original=JSON.parse(records.get('petal-profiles')).find(profile=>profile.email==='garden@example.com');
original.photo='data:image/png;base64,test';original.bio='My garden';original.address='12 Garden St';
records.set('petal-profiles',JSON.stringify(JSON.parse(records.get('petal-profiles')).map(profile=>profile.id===original.id?original:profile)));
records.set('petal-cart:'+original.id,JSON.stringify([{saved:'cart'}]));
records.set('petal-orders',JSON.stringify([{reference:'TEST',owner:original.id,customer:{},items:[],payment:{},total:100,status:'Placed'}]));
const savedCart=records.get('petal-cart:'+original.id), savedOrders=records.get('petal-orders');
{
  const p=await load('Log-Sign/ForgotPassword.html',records,'?next=checkout');
  assert.equal(p.document.getElementById('recovery-fields').disabled,true);
  p.field('email','missing@example.com');await p.submit();assert.match(p.status(),/No account found/);
  p.field('email','GARDEN@example.com');await p.submit();
  assert.equal(p.form.elements.namedItem('email').readOnly,true);
  assert.equal(p.document.getElementById('recovery-fields').hidden,false);
  assert.equal(p.document.getElementById('recovery-question-1').textContent,original.recoveryQuestions[0].question);
  const eyeButtons=Array.from(p.form.querySelectorAll('[data-password-toggle]'));
  for(const button of eyeButtons){
    const input=p.document.getElementById(button.dataset.passwordToggle);
    button.click();assert.equal(input.type,'text');assert.equal(button.getAttribute('aria-label'),'Hide password');
    button.click();assert.equal(input.type,'password');assert.equal(button.getAttribute('aria-label'),'Show password');
  }
  fillReset(p,'weak');await p.submit();assert.deepEqual(p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.id===original.id).passwordRecord,original.passwordRecord);
  fillReset(p);p.field('confirmPassword','Mismatch2026!');await p.submit();assert.match(p.document.getElementById('password-confirm-error').textContent,/do not match/);
  p.field('confirmPassword',newPassword);p.field('answer2','wrong answer');await p.submit();
  assert.match(p.status(),/answers do not match/);assert.equal(p.json('PetalStore.session()'),null);
  assert.deepEqual(p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.id===original.id).passwordRecord,original.passwordRecord);
  p.field('answer2','CAFÉ GARDEN');p.setFailure('petal-profiles');await p.submit();assert.match(p.status(),/storage/i);
  assert.deepEqual(p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.id===original.id).passwordRecord,original.passwordRecord);
  p.setFailure(null);await p.submit();assert.match(p.status(),/has been reset/);
  assert.equal(p.form.hidden,true);assert.equal(p.document.getElementById('recovery-success').hidden,false);
  assert.equal(p.document.getElementById('recovery-login').getAttribute('href'),'LoginPage.html?next=checkout');
  assert.equal(p.json('PetalStore.session()'),null);
  const reset=p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.id===original.id);
  assert.deepEqual({...reset,passwordRecord:original.passwordRecord},original);
  assert.equal(records.get('petal-cart:'+original.id),savedCart);assert.equal(records.get('petal-orders'),savedOrders);
  assert.equal(await p.run(`verifyAccountPassword(${JSON.stringify(oldPassword)},${JSON.stringify(reset.passwordRecord)})`),false);
  assert.equal(await p.run(`verifyAccountPassword(${JSON.stringify(newPassword)},${JSON.stringify(reset.passwordRecord)})`),true);
  await p.close();
}
console.log('PASS Recovery rejects incorrect answers, weak or mismatched passwords, and storage failures; successful reset accepts normalized answers and preserves account data without signing in.');
{
  const p=await load('Log-Sign/LoginPage.html',records,'?next=checkout');
  assert.equal(p.document.querySelector('.forgot').getAttribute('href'),'ForgotPassword.html?next=checkout');
  p.field('email','garden@example.com');p.field('password',oldPassword);await p.submit();assert.match(p.status(),/incorrect/);
  p.field('password',newPassword);await p.submit();assert.equal(p.location.href,'../checkout.html');
  assert.equal(p.json('PetalStore.session()').id,original.id);
  await p.close();
}
{
  const p=await load('Log-Sign/ForgotPassword.html',records);
  p.field('email','garden@example.com');await p.submit();fillReset(p,'SecondGarden2026!');
  const profileBefore=p.json('PetalStore.session()');const profilesBefore=records.get('petal-profiles');const sessionBefore=records.get('petal-session');
  p.setFailure('petal-session');await p.submit();assert.match(p.status(),/storage/i);
  assert.equal(records.get('petal-profiles'),profilesBefore);assert.equal(records.get('petal-session'),sessionBefore);
  p.setFailure(null);await p.submit();assert.match(p.status(),/has been reset/);
  const profileAfter=p.json('PetalStore.session()');assert.equal(profileAfter.id,profileBefore.id);
  assert.deepEqual(profileAfter.passwordRecord,p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.id===original.id).passwordRecord);
  await p.close();
}
console.log('PASS Old password fails after reset, new password signs into the original account, matching sessions update, and partial writes roll back.');
{
  const p=await load('Log-Sign/ForgotPassword.html',records);
  p.field('email','custom@example.com');await p.submit();
  assert.equal(p.document.getElementById('recovery-question-2').textContent,'What is my private garden phrase?');
  fillReset(p);p.document.querySelector('[data-password-toggle]').click();p.document.getElementById('recovery-change-email').click();
  assert.equal(p.document.getElementById('recovery-fields').disabled,true);assert.equal(p.form.elements.namedItem('email').readOnly,false);
  assert.equal(p.form.elements.namedItem('answer1').value,'');assert.equal(p.form.elements.namedItem('password').type,'password');
  p.field('email','garden@example.com');await p.submit();
  assert.equal(p.document.getElementById('recovery-question-2').textContent,'What was the name of your first school?');
  await p.close();
}
{
  const p=await load('Log-Sign/ForgotPassword.html',records);
  p.run('PetalStore.signIn("Legacy Shopper","legacy@example.com")');
  p.field('email','legacy@example.com');await p.submit();assert.match(p.status(),/no security questions/);
  assert.equal(p.document.getElementById('recovery-fields').hidden,true);
  await p.close();
}
console.log('PASS Custom questions appear during recovery, changing email clears verification fields, and unconfigured accounts cannot reset without verification.');
{
  const p=await load('profile.html',records);
  p.run('showProfileTab("security")');assert.match(p.document.getElementById('security-account-note').textContent,/Set a password/);
  fillQuestions(p,true);p.field('currentPassword','anything');await p.submit();assert.match(p.status(),/Set a password/);
  const passwordRecord=await p.run(`makeAccountPassword(${JSON.stringify(oldPassword)})`);
  p.run(`commitAccountSecurity(PetalStore.session(),{passwordRecord:${JSON.stringify(passwordRecord)}},true);showProfileTab("security")`);
  p.field('currentPassword','wrong');await p.submit();assert.match(p.status(),/incorrect/);
  assert.equal(p.json('PetalStore.session()').recoveryQuestions,undefined);
  p.field('currentPassword',oldPassword);await p.submit();assert.match(p.status(),/Security questions saved/);
  assert.equal(p.form.elements.namedItem('securityAnswer1').value,'');assert.equal(p.form.elements.namedItem('currentPassword').value,'');
  assert.equal(p.json('PetalStore.session()').recoveryQuestions[1].question,'What is my private garden phrase?');
  // Existing authenticated password changes retain recovery questions.
  const passwordForm=p.document.getElementById('profile-password-form');
  for(const [name,value] of Object.entries({currentPassword:oldPassword,newPassword:'LegacyFlowers2026!',confirmPassword:'LegacyFlowers2026!'}))passwordForm.elements.namedItem(name).value=value;
  await p.run('saveProfilePassword({preventDefault(){},target:document.getElementById("profile-password-form")})');
  assert.match(p.document.getElementById('password-status').textContent,/Password saved/);
  assert.equal(p.json('PetalStore.session()').recoveryQuestions.length,2);
  // Updates merge unrelated profile fields, reject changed credentials and changed sign-in.
  const snapshot=p.json('PetalStore.session()');
  p.run('const changed=PetalStore.read("petal-profiles",[]);changed.find(item=>item.id===PetalStore.session().id).bio="Edited in another tab";PetalStore.write("petal-profiles",changed)');
  p.run(`commitAccountSecurity(${JSON.stringify(snapshot)}, {}, true)`);
  assert.equal(p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.id===snapshot.id).bio,'Edited in another tab');
  p.run('PetalStore.logout()');
  assert.throws(()=>p.run(`commitAccountSecurity(${JSON.stringify(snapshot)}, {}, true)`),/sign-in changed/);
  await p.close();
}
console.log('PASS Existing profiles require their current password to configure recovery; password changes retain questions and account updates protect sign-in changes.');
{
  const p=await load('Log-Sign/ForgotPassword.html',records);
  p.field('email','legacy@example.com');await p.submit();fillReset(p,'RecoveredLegacy2026!');await p.submit();assert.match(p.status(),/has been reset/);
  const snapshot=p.json('PetalStore.read("petal-profiles",[])').find(profile=>profile.email==='legacy@example.com');
  p.run('const latest=PetalStore.read("petal-profiles",[]);latest.find(item=>item.email==="legacy@example.com").recoveryQuestions[0].question="What is my revised secret question?";PetalStore.write("petal-profiles",latest)');
  assert.throws(()=>p.run(`commitAccountSecurity(${JSON.stringify(snapshot)}, {passwordRecord:${JSON.stringify(snapshot.passwordRecord)}})`),/details changed/);
  await p.close();
}
console.log('PASS Accounts configured through Profile recover successfully; stale security details cannot overwrite updated credentials.');

{
  const isolated=new Map(records);
  const p=await load('Log-Sign/ForgotPassword.html',isolated);
  p.run('PetalStore.signIn("Custom Shopper","custom@example.com")');
  const otherAccount=p.json('PetalStore.session()');
  p.field('email','garden@example.com');await p.submit();fillReset(p,'AnotherGarden2026!');await p.submit();
  assert.match(p.status(),/has been reset/);
  assert.deepEqual(p.json('PetalStore.session()'),otherAccount);
  await p.close();
}
console.log('PASS Recovering another saved account preserves the currently signed-in account.');
