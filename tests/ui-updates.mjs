import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { Window } from 'npm:happy-dom@20.0.11';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const customer = {name:'Garden Shopper',email:'garden@example.com',phone:'+639123456789',address:'12 Garden Street',city:'Las Piñas',province:'Metro Manila',postalCode:'1747'};
const payment = {method:'e-wallet',provider:'GCash'};
const registered = 'PetalStore.signIn("Garden Shopper", "garden@example.com");';
const placed = registered + `PetalStore.addLine({productId:'flower-1',quantity:1,options:{}}); const testOrder=PetalStore.placeOrder(${JSON.stringify(customer)},${JSON.stringify(payment)});`;
async function loadPage(name, seed = '', search = '', queueFrames = false) {
  const window = new Window({url:'https://flowers.test/'+name+'.html'+search,settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
  const document=window.document;
  document.write(fs.readFileSync(path.join(root,name+'.html'),'utf8'));
  await window.happyDOM.waitUntilComplete();
  const records=new Map(), timers=new Map(), errors=[];
  window.addEventListener('error',event=>errors.push(event.error || event.message));
  let timerId=0; let frames=[];
  const location={href:'https://flowers.test/'+name+'.html'+search,search,hash:''};
  const history={replaceState(_state,_title,url){location.href=new URL(url,location.href).href;location.search=new URL(location.href).search;}};
  const context=vm.createContext({document,window,location,history,Event:window.Event,KeyboardEvent:window.KeyboardEvent,
    URL,URLSearchParams,TextEncoder,crypto:webcrypto,console,
    requestAnimationFrame:cb=>{if(queueFrames)frames.push(cb);else cb();return 1;},
    setTimeout:cb=>{timers.set(++timerId,cb);return timerId;}, clearTimeout:id=>timers.delete(id),
    setInterval:()=>++timerId,clearInterval:()=>{},
    localStorage:{getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)}});
  const run=code=>vm.runInContext(code,context);
  for(const script of ['settings','products','store','app','shop','customize','pages']) run(fs.readFileSync(path.join(root,script+'.js'),'utf8'));
  for(const sheet of ['styles.css','design-spec.css']){const style=document.createElement('style');style.textContent=fs.readFileSync(path.join(root,sheet),'utf8');document.head.append(style);}
  if(seed) run(seed);
  const header=document.querySelector('.site-header');header.getBoundingClientRect=()=>({left:0,top:0});
  Array.from(header.querySelectorAll('.nav-link,[data-cart]')).forEach((tab,index)=>tab.getBoundingClientRect=()=>({left:20+index*100,bottom:90,width:80}));
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const click=selector=>{const el=typeof selector==='string'?document.querySelector(selector):selector;assert.ok(el,'Missing '+selector);el.dispatchEvent(new window.MouseEvent('click',{bubbles:true,cancelable:true}));};
  const change=(input,value)=>{input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));};
  const close=async()=>{assert.deepEqual(errors,[],'Uncaught page errors');await window.happyDOM.close();};
  return {window,document,run,click,change,close,records,timers,location,frame(){const next=frames;frames=[];next.forEach(cb=>cb());}};
}

{
 const p=await loadPage('collections');
 p.click('[data-add="flower-1"]');
 assert.equal(p.run('PetalStore.getCart().length'),1);
 assert.equal(p.document.getElementById('success-dialog').open,true);
 assert.equal(p.document.querySelector('[data-success-message]').textContent,'Successfully added to cart!');
 assert.equal(p.document.querySelector('#success-dialog h2'),null);
 p.click('#success-dialog button.pill');
 for(const [id,expected] of [['flower-1',['color','ribbon']],['best-sellers-5',[]],['potted-flowers-1',[]],['sympathy-1',[]],['bouquet-5',['ribbon']],['best-sellers-3',['ribbon']],['thank-you-1',['ribbon']]]){
  p.run(`openProductOptions(findProduct('${id}'));`);
  const names=Array.from(p.document.querySelectorAll('#product-options-form select'),el=>el.name);
  assert.deepEqual(names,expected,id+' presentation options');
  for(const select of p.document.querySelectorAll('#product-options-form select'))p.change(select,'Blue');
  p.document.querySelector('#product-options-form button[type=submit]').click();
  const line=JSON.parse(p.run(`JSON.stringify(PetalStore.getCart().find(item=>item.productId==='${id}' && (item.options.ribbon==='Blue'||!item.options.ribbon)))`));
  assert.ok(line,id+' was saved');
  assert.equal(line.unitPrice,p.run(`findProduct('${id}').price`));
  assert.deepEqual(Object.keys(line.options).sort(),expected.sort());
  p.run('closeDialog(document.getElementById("success-dialog"));');
 }
 p.run(`PetalStore.addLine({productId:'flower-1',quantity:20,options:{color:'Pink',ribbon:'Pink'}});refreshCartUI();`);
 assert.equal(p.document.querySelector('[data-cart-count]').textContent,'7');
 p.change(p.document.getElementById('search-input'),'Tulip');
 assert.equal(p.document.querySelectorAll('#search-results .search-result').length,1);
 p.click('#search-form [data-clear-search]');
 assert.equal(p.document.getElementById('search-input').value,'');
 assert.equal(p.document.querySelectorAll('#search-results .search-result').length,0);
 const row=p.document.querySelector('#flower .product-grid');
 Object.defineProperties(row,{clientWidth:{value:400},scrollWidth:{value:900}});
 row.scrollTo=({left})=>{row.scrollLeft=left;};
 p.click('#flower [data-next]');assert.equal(row.scrollLeft,176);
 row.scrollLeft=500;p.click('#flower [data-next]');assert.equal(row.scrollLeft,0);
 p.click('#flower [data-previous]');assert.equal(row.scrollLeft,500);
 p.click('#flower [data-previous]');assert.equal(row.scrollLeft,324);
 assert.ok(!p.document.querySelector('#flower [data-next]').disabled);
 await p.close();
}
console.log('PASS Immediate add notification, wrapper/ribbon rules, unique cart badge, deduplicated search, Clear Search, and both wrapping carousel arrows.');

{
 const p=await loadPage('customize');
 p.click('[data-choice="addon"][data-index="4"]');
 p.change(p.document.querySelector('[name="letters"]'),'For your birthday');
 p.click('[data-add-letter]');p.change(p.document.querySelectorAll('[name="letters"]')[1],'With love from the family');
 assert.match(p.document.getElementById('product-options-price').textContent,/300/);
 p.document.querySelector('#product-options-form button[type=submit]').click();
 assert.equal(p.run('customization.addons[4].options.letters.length'),2);
 p.click('[data-edit-addon="4"]');
 assert.equal(p.document.querySelectorAll('[name="letters"]').length,2);
 p.change(p.document.querySelectorAll('[name="letters"]')[1],'A corrected second message');
 p.document.querySelector('#product-options-form button[type=submit]').click();
 assert.equal(p.run('customization.addons[4].options.letters[1]'),'A corrected second message');
 p.click('[data-edit-addon="0"]');
 p.change(p.document.querySelector('[name="pieces"]'),'8');
 p.document.querySelector('#product-options-form button[type=submit]').click();
 assert.equal(p.run('customization.addons[0].unitPrice'),400);
 p.change(p.document.getElementById('builder-ribbon'),'Blue');
 p.click('[data-add-custom]');
 const saved=JSON.parse(p.run('JSON.stringify(PetalStore.getCart()[0])'));
 assert.equal(saved.name,'Customize Flowers');
 assert.equal(saved.options.ribbon,'Blue');
 assert.equal(saved.unitPrice,1360); // 600 flowers + 60 wrap + 400 chocolate + 300 letters.
 assert.equal(saved.options.addons.find(a=>a.productId==='addon-4').options.letters.length,2);
 assert.match(saved.details,/A corrected second message/);
 assert.equal(p.document.querySelector('[data-cart-count]').textContent,'1');
 await p.close();
 const q=await loadPage('customize',`PetalStore.saveCart(${JSON.stringify([saved])});`,'?edit='+encodeURIComponent(saved.lineId));
 assert.equal(q.document.querySelector('[data-add-custom]').textContent,'SAVE CHANGES');
 assert.equal(q.document.getElementById('builder-ribbon').value,'Blue');
 assert.equal(q.run('customization.addons[4].options.letters.length'),2);
 q.click('[data-edit-addon="4"]');
 q.click('[data-remove-letter]:not([hidden])');
 assert.equal(q.document.querySelectorAll('[name="letters"]').length,1);
 q.document.querySelector('#product-options-form button[type=submit]').click();
 q.click('[data-flower-adjust="1"][data-flower-index="2"]');
 q.click('[data-add-custom]');
 assert.equal(q.run('PetalStore.getCart().length'),1);
 assert.equal(q.run('PetalStore.getCart()[0].unitPrice'),1310);
 assert.equal(q.run('PetalStore.getCart()[0].options.addons.find(a=>a.productId==="addon-4").options.letters.length'),1);
 await q.close();
}
console.log('PASS Multiple letter messages, per-letter pricing, selected add-on edits/removal, and cart bouquet editing preserve selections and recalculate totals.');

for(const seed of ['',registered,placed,placed+'PetalStore.setOrderStatus(testOrder.reference,"Cancelled");']){
 const p=await loadPage('feedback',seed);
 const form=p.document.getElementById('review-form');
 const toggle=form.querySelector('[name=anonymous]');
 assert.equal(toggle.closest('.review-email-field').querySelector('#review-email').name,'reviewEmail');
 form.querySelectorAll('[name=rating]')[3].click();
 assert.equal(form.querySelectorAll('.rating-star.selected').length,4);
 assert.ok(['#f8d548','rgb(248, 213, 72)'].includes(p.window.getComputedStyle(form.querySelector('.rating-star.selected')).color));
 p.change(form.querySelector('[name=message]'),'Fresh, beautiful flowers!');
 const input=form.querySelector('[name=reviewEmail]');p.change(input,'garden@example.com');
 const inputColor=p.window.getComputedStyle(input).color;
 assert.ok(['#577438','rgb(87, 116, 56)'].includes(inputColor),inputColor);
 toggle.click();assert.equal(form.querySelector('[name=reviewName]').required,false);
 form.querySelector('button[type=submit]').click();
 if(seed===placed){
  assert.equal(p.run('PetalStore.reviews().length'),1);
  assert.equal(p.run('PetalStore.reviews()[0].name'),'Anonymous Person');
  form.querySelector('button[type=submit]').click();
  assert.match(p.document.getElementById('review-status').textContent,/already reviewed/);
 }else assert.equal(p.run('PetalStore.reviews().length'),0);
 await p.close();
}
console.log('PASS Feedback stars and green typed text, Anonymous placement, placed-order requirement, cancelled/visitor rejection, and one review per order.');

{
 const p=await loadPage('checkout',registered+`PetalStore.addLine({productId:'flower-1',quantity:1,options:{}});`);
 const form=p.document.getElementById('checkout-form');
 // Verify the successful checkout handler, including failed-save and reduced-motion paths.
 p.run('celebrateOrder();');assert.equal(p.document.querySelectorAll('.falling-petal').length,42);
 for(const cb of p.timers.values())cb();assert.equal(p.document.querySelector('.petal-confetti'),null);
 p.window.matchMedia=()=>({matches:true});p.run('celebrateOrder();');assert.equal(p.document.querySelector('.petal-confetti'),null);
 p.window.matchMedia=()=>({matches:false});
 for(const [name,value] of Object.entries({firstName:'Garden',lastName:'Shopper',email:customer.email,phone:customer.phone,houseNumber:'12',street:'Garden Street',barangay:'Golden Gate',city:customer.city,province:customer.province,postalCode:customer.postalCode,provider:'GCash'})){
  const input=form.elements.namedItem(name);assert.ok(input,'Missing checkout '+name);p.change(input,value);
 }
 p.document.querySelector('[name=payment][value="e-wallet"]').click();
 form.dispatchEvent(new p.window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(p.run('PetalStore.orders().length'),1);
 assert.equal(p.document.querySelector('.petal-confetti'),null);
 assert.match(p.location.href,/receipt\.html\?reference=.+&placed=1$/);
 assert.equal(p.run('PetalStore.orders()[0].total'),220);
 assert.equal(p.document.getElementById('checkout-delivery-fee').textContent,'₱100');
 assert.equal(p.document.getElementById('delivery-option-fee').textContent,'₱100');
 assert.equal(p.document.getElementById('checkout-total').textContent,'₱220');
 await p.close();
}
console.log('PASS Checkout adds the configured delivery fee and redirects to the saved receipt; reduced-motion preferences and animation cleanup are respected.');

for(const page of ['index','contact','cart','search','about','gallery']){
 const p=await loadPage(page);
 assert.ok(Array.from(p.document.querySelectorAll('.faq')).every(el=>!el.open));
 const faq=p.document.querySelector('.faq');faq.open=true;assert.equal(faq.open,true);
 if(page==='contact'){
  assert.equal(p.document.getElementById('contact-form').nextElementSibling.className,'saved-inquiries');
  assert.match(p.document.querySelector('.contact-cards [data-store-phone]').href,/^tel:/);
  assert.match(p.document.querySelector('.contact-cards [data-store-map]').href,/google.com\/maps/);
 }
 if(page==='index'){
  assert.ok(p.document.querySelector('.nav-link[href="index.html"]').classList.contains('active'));
  p.click('.nav-link[href="contact.html"]');
  assert.match(p.document.querySelector('.nav-active-indicator').style.transform,/220px/);
 }
 if(page==='cart'){
  const cart=p.document.querySelector('.site-header [data-cart]');assert.ok(cart.classList.contains('active'));
  assert.equal(cart.getAttribute('aria-current'),'page');assert.match(p.document.querySelector('.nav-active-indicator').style.transform,/720px/);
 }
 if(page==='search'){
  p.change(p.document.getElementById('page-search-input'),'Chrysanthemum');const names=Array.from(p.document.querySelectorAll('.search-result h3'),node=>node.textContent);assert.equal(new Set(names).size,names.length);assert.equal(names.filter(name=>name==='Chrysanthemum').length,1);
  p.click('#page-search-form [data-clear-search]');assert.equal(p.document.getElementById('page-search-input').value,'');
 }
 if(page==='gallery')for(const image of p.document.querySelectorAll('.gallery-page-grid img')){
  assert.equal(image.loading,'lazy');assert.ok(image.width>0&&image.height>0);assert.match(image.src,/thumb\.webp/);assert.match(image.srcset,/large\.webp/);
 }
 await p.close();
}
console.log('PASS FAQs start closed, contact links and inquiry placement, active pink cart indicator, search clearing, and lazy responsive gallery markup.');

// Store integrity and backward compatibility are checked independently of the UI.
{
 const p=await loadPage('collections');
 p.run(`PetalStore.addLine({productId:'gifts-4',quantity:1,options:{letter:'Previously saved message'}});`);
 assert.equal(p.run('PetalStore.getCart()[0].options.letters[0]'),'Previously saved message');
 assert.throws(()=>p.run(`PetalStore.addLine({productId:'gifts-4',quantity:1,options:{letters:['Valid',' ']}});`));
 assert.throws(()=>p.run(`PetalStore.addLine({productId:'flower-1',quantity:1,options:{ribbon:'Invalid'}});`));
 await p.close();
}
console.log('PASS Old single-letter records migrate without loss; blank additional messages and invalid ribbon colors are rejected.');

{
 const p=await loadPage('cart',`window.sessionStorage.setItem('petal-nav-position',JSON.stringify({left:20,width:80,top:94}));Object.defineProperty(document,'fonts',{value:{ready:Promise.resolve()},configurable:true});`,'',true);
 const line=p.document.querySelector('.nav-active-indicator');
 assert.match(line.style.transform,/20px/);
 p.frame();assert.match(line.style.transform,/20px/);
 p.frame();assert.match(line.style.transform,/720px/);
 await p.close();
}
console.log('PASS Cached fonts preserve the starting underline position for a paint before it slides to the active tab.');

{
 const p=await loadPage('receipt',placed+`location.href='https://flowers.test/receipt.html?reference='+encodeURIComponent(testOrder.reference)+'&placed=1';location.search=new URL(location.href).search;`);
 assert.equal(p.document.getElementById('success-dialog').open,true);
 assert.equal(p.document.querySelector('[data-success-message]').textContent,'Successfully placed your order! Thank you!');
 assert.equal(p.document.querySelectorAll('.falling-petal').length,42);
 assert.equal(new URL(p.location.href).searchParams.has('placed'),false);
 assert.deepEqual(Array.from(p.document.querySelectorAll('.receipt-charges dd'),node=>node.textContent),['₱120','₱100']);
 assert.equal(p.document.querySelector('.receipt-grand-total').textContent,'Total: ₱220');
 p.click('[data-success-link]');assert.equal(p.document.getElementById('success-dialog').open,false);
 const snapshot=Array.from(p.records);const search=new URL(p.location.href).search;
 await p.close();
 const q=await loadPage('receipt',`for(const [key,value] of ${JSON.stringify(snapshot)})localStorage.setItem(key,value);`,search);
 assert.equal(q.document.getElementById('success-dialog').open,false);
 assert.equal(q.document.querySelector('.petal-confetti'),null);
 assert.equal(q.document.querySelector('.receipt-grand-total').textContent,'Total: ₱220');
 await q.close();
}
console.log('PASS Receipt shows the saved subtotal/fee/total and order confirmation once, closes from VIEW RECEIPT, and retains totals on reload.');

{
 const p=await loadPage('profile',registered);
 assert.equal(p.document.querySelector('#profile-flowers'),null);
 assert.equal(p.document.querySelector('.profile-activity img'),null);
 assert.equal(p.document.getElementById('profile-orders').textContent,'0');
 await p.close();
 const q=await loadPage('customize');
 q.click('[data-choice=flower][data-index="3"]');q.click('[data-add-custom]');
 const flower=JSON.parse(q.run('JSON.stringify(PetalStore.getCart()[0].options.flowers.find(flower=>flower.index===3))'));
 assert.equal(flower.name,'Blue Chrysanthemum');assert.equal(flower.unitPrice,80);
 assert.match(q.document.querySelector('[data-choice=flower][data-index="3"] img').src,/blue-chrysanthemum.webp/);
 q.run(`PetalStore.setStock('new-arrival-3',false);`);
 assert.equal(q.run('PetalStore.lineAvailable(PetalStore.getCart()[0])'),false);
 assert.equal(q.run('findProduct("flower-4").name'),'Jasmine');
 await q.close();
}
console.log('PASS Profile activity keeps only orders; Blue Chrysanthemum replaces builder Jasmine and uses its own stock and catalog price.');

{
 const p=await loadPage('feedback',placed);
 const form=p.document.getElementById('review-form');
 form.querySelector('[name=rating][value="5"]').click();p.change(form.querySelector('[name=message]'),'A new review visible immediately');
 form.querySelector('button[type=submit]').click();
 const container=p.document.querySelector('[data-public-reviews]');
 assert.equal(container.firstElementChild.querySelector('p').textContent,'A new review visible immediately');
 assert.equal(container.querySelectorAll('[data-review-id]').length,1);
 p.run('renderPublicReviews();renderPublicReviews();');
 assert.equal(container.querySelectorAll('[data-review-id]').length,1);
 const snapshot=Array.from(p.records);await p.close();
 const q=await loadPage('feedback',`for(const [key,value] of ${JSON.stringify(snapshot)})localStorage.setItem(key,value);`);
 assert.equal(q.document.querySelector('[data-public-reviews]').firstElementChild.querySelector('p').textContent,'A new review visible immediately');
 assert.equal(q.document.querySelectorAll('[data-review-id]').length,1);
 await q.close();
}
console.log('PASS Submitted reviews appear first immediately and after reload, without duplication.');

{
 const p=await loadPage('receipt',placed+`delete testOrder.delivery;delete testOrder.subtotal;testOrder.total=120;PetalStore.write('petal-orders',[testOrder]);`);
 assert.deepEqual(Array.from(p.document.querySelectorAll('.receipt-charges dd'),node=>node.textContent),['₱120','₱0']);
 assert.equal(p.document.querySelector('.receipt-grand-total').textContent,'Total: ₱120');
 await p.close();
}
console.log('PASS Historical orders preserve their original total and are not charged the new delivery fee.');
