
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function shoppingStore() {
  const state = { records: new Map(), fail: false, failAt: 0 };
  const context = vm.createContext({
    localStorage: {
      getItem: key => state.records.get(key) ?? null,
      setItem(key, value) {
        if (state.fail || (state.failAt > 0 && --state.failAt === 0)) throw new Error("QuotaExceededError");
        state.records.set(key, value);
      },
      removeItem: key => state.records.delete(key),
    },
  });
  for (const name of ["settings", "products", "store"])
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../" + name + ".js"), "utf8"), context);
  return { store: vm.runInContext("PetalStore", context), run: source => vm.runInContext(source, context), state };
}
const tulip = { productId: "flower-1", quantity: 99, options: { color: "Pink" } };
const customer = { name: "Garden Shopper", email: "garden@example.com", phone: "+639123456789", address: "12 Garden Street", city: "Las Piñas", province: "Metro Manila", postalCode: "1747" };
const payment = { method: "e-wallet", provider: "GCash" };

{
  const { store } = shoppingStore();
  store.addLine(tulip);
  store.addLine({ ...tulip, options: { color: "Red" } });
  const red = store.getCart()[1];
  store.addLine({ ...red, options: { color: "Pink" } }, red.lineId);
  assert.equal(store.getCart().reduce((sum, line) => sum + line.quantity, 0), 198);
  assert.equal(store.getCart().length, 2);
  store.addLine({ ...tulip, quantity: 1 });
  assert.equal(store.getCart().reduce((sum, line) => sum + line.quantity, 0), 199);
  assert.ok(store.getCart().every(line => line.quantity <= 99));
}
console.log("PASS Cart merging and adding at the quantity cap preserve all units.");

{
  const { store } = shoppingStore();
  store.signIn(customer.name, customer.email);
  store.addLine({ ...tulip, quantity: 2 });
  const altered = store.getCart();
  altered[0].unitPrice = 0.001;
  altered[0].image = "assets/fake.png";
  altered[0].name = "Altered product";
  store.write("petal-cart:" + store.owner(), altered);
  const order = store.placeOrder(customer, payment);
  assert.equal(order.subtotal, 240);
  assert.equal(order.delivery.fee, 100);
  assert.equal(order.total, 340);
  assert.equal(order.items[0].name, "Tulip");
  assert.equal(order.items[0].image, "assets/collections/flo-1.png");

  store.addLine({
    productId: "custom-bouquet", quantity: 2, unitPrice: 1, options: {
      flowers: [{ index: 2, quantity: 6, unitPrice: 1 }],
      wrapping: { name: "Kraft Paper Wrapping", price: 1 }, wrappingMode: "style",
      addons: [{ productId: "addon-0", quantity: 1, unitPrice: 1, options: { pieces: 5, flavor: "Classic Hazelnut" } }],
    },
  });
  assert.equal(store.getCart()[0].unitPrice, 910);
  assert.equal(store.placeOrder(customer, payment).total, 1920);
}
console.log("PASS Standalone and custom bouquet prices, names and images come from the catalog.");

{
  const { store } = shoppingStore();
  const custom = { productId: "custom-bouquet", quantity: 1, options: { flowers: [{ index: 6, quantity: 1 }] } };
  store.signIn(customer.name, customer.email);
  store.addLine(custom);
  store.setStock("flower-7", false);
  assert.equal(store.lineAvailable(store.getCart()[0]), false);
  assert.throws(() => store.placeOrder(customer, payment), /unavailable/);
  store.setStock("flower-7", true);
  store.removeLine(store.getCart()[0].lineId);
  store.addLine({ ...custom, options: { flowers: [{ index: 0, quantity: 1 }], addons: [{ productId: "addon-3", quantity: 1, options: { flavor: "Chocolate" } }] } });
  store.setStock("gifts-6", false);
  assert.equal(store.addonAvailable("addon-3"), false);
  assert.throws(() => store.placeOrder(customer, payment), /unavailable/);
}
console.log("PASS Custom stems and add-ons respect inventory, including shared gift stock.");

{
  const { store, state } = shoppingStore();
  store.write("petal-cart:" + store.owner(), [{ lineId: "BAD", productId: "custom-bouquet", quantity: 1, options: { flowers: "invalid" } }]);
  assert.equal(store.getCart().length, 0);
  store.write("petal-profiles", { broken: true });
  assert.equal(store.hasProfile(), false);
  assert.doesNotThrow(() => store.signIn(customer.name, customer.email));
  store.write("petal-orders", [null, { broken: true }]);
  store.write("petal-reviews", [{ rating: 99 }, null]);
  assert.equal(store.allOrders().length, 0);
  assert.equal(store.reviews().length, 0);
  state.records.set("petal-cart:" + store.owner(), "{broken json");
  assert.doesNotThrow(() => store.getCart());
}
console.log("PASS Malformed saved arrays, records and JSON do not crash shopping.");

{
  const { store, state } = shoppingStore();
  state.fail = true;
  assert.throws(() => store.addLine({ ...tulip, quantity: 1 }), /storage/);
  assert.equal(store.getCart().length, 0);
  state.fail = false;
  store.signIn(customer.name, customer.email);
  store.addLine({ ...tulip, quantity: 1 });
  state.fail = true;
  assert.throws(() => store.placeOrder(customer, payment), /storage/);
  assert.equal(store.orders().length, 0);
  assert.equal(store.getCart().length, 1);
  state.fail = false;
  state.failAt = 2;
  assert.throws(() => store.placeOrder(customer, payment), /storage/);
  assert.equal(store.orders().length, 0);
  assert.equal(store.getCart().length, 1);
  assert.throws(() => store.placeOrder({ ...customer, address: ", , " }, payment), /address/);
  const previous = JSON.stringify(Array.from(state.records));
  state.failAt = 2;
  assert.throws(() => store.writeMany({ "petal-session": { ...store.session(), name: "Changed" }, "petal-profiles": [] }), /storage/);
  assert.equal(JSON.stringify(Array.from(state.records)), previous);
  assert.equal(store.session().name, customer.name);
}
console.log("PASS Failed writes retain carts and orders; partial account writes are rolled back.");

{
  const { run } = shoppingStore();
  for (const phone of ["abc", "-------", "+++++++", "123", "1234567890123456", "+63+9123456789"])
    assert.equal(run("isValidPhone(" + JSON.stringify(phone) + ")"), false, phone);
  for (const phone of ["09123456789", "+639123456789", "(02) 8123-4567"])
    assert.equal(run("isValidPhone(" + JSON.stringify(phone) + ")"), true, phone);
  for (const password of ["Abcde!7", "abcdefg!", "Abcdefgh", "Abcdefg "])
    assert.equal(run("isStrongAccountPassword(" + JSON.stringify(password) + ")"), false);
  for (const password of ["ABCDEFG!", "Ábcdefg!", "Garden2026!"])
    assert.equal(run("isStrongAccountPassword(" + JSON.stringify(password) + ")"), true);
}
console.log("PASS Shared phone and password validation rejects invalid values.");
