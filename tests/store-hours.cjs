const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
let instant = '2026-11-22T00:00:00Z';
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return new Date(instant).getTime(); }
}
const records = new Map();
const context = vm.createContext({Date: TestDate, localStorage: {
  getItem: key => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, value),
  removeItem: key => records.delete(key),
}});
for (const name of ['settings','products','store'])
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../'+name+'.js'), 'utf8'), context);
const store = vm.runInContext('PetalStore', context);
const customer = {name:'Garden Shopper',email:'garden@example.com',phone:'09123456789',address:'12 Garden Street',city:'Las Piñas',province:'Metro Manila',postalCode:'1747'};
const payment = {method:'e-wallet',provider:'GCash'};
store.signIn(customer.name, customer.email);
for (const [time, open] of [
  ['2026-11-21T23:59:59Z',false], ['2026-11-22T00:00:00Z',true],
  ['2026-11-22T09:59:59Z',true], ['2026-11-22T10:00:00Z',false],
  ['2026-11-22T23:59:59Z',false], ['2026-11-23T00:00:00Z',true],
]) {
  instant=time;
  assert.equal(store.orderHours().open,open,time);
  store.addLine({productId:'flower-1',quantity:1,options:{}});
  const cart=JSON.stringify(store.getCart());
  const count=store.orders().length;
  if (open) {
    store.placeOrder(customer,payment);
    assert.equal(store.orders().length,count+1);
    assert.equal(store.getCart().length,0);
  } else {
    assert.throws(()=>store.placeOrder(customer,payment),/8:00 AM to 6:00 PM.*Manila/);
    assert.equal(JSON.stringify(store.getCart()),cart);
    assert.equal(store.orders().length,count);
  }
}
for (const phone of ['1234567890','123456789012','+639123456789','abc'])
  assert.throws(()=>store.saveInquiry({...customer,phone,message:'Hello'}),/exactly 11 digits/);
assert.ok(store.saveInquiry({...customer,message:'Hello'}).id);
console.log('PASS Manila opening/closing boundaries, next-day reopening, blocked orders preserve carts, and inquiries require exactly 11 digits.');
