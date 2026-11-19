const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function shoppingStore() {
  const records = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: key => records.get(key) ?? null,
      setItem: (key, value) => records.set(key, value),
    },
  });
  for (const name of ["settings", "products", "store"])
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../" + name + ".js"), "utf8"), context);
  return vm.runInContext("PetalStore", context);
}

const flower = {
  productId: "flower-1", name: "Tulip", image: "assets/collections/flo-1.png",
  unitPrice: 120, quantity: 2, options: { color: "Pink" }, details: "Pink wrapper",
};
const customer = {
  name: "Garden Shopper", email: "garden@example.com", phone: "+639123456789",
  address: "12 Garden Street", city: "Las Piñas", province: "Metro Manila", postalCode: "1747",
};
const payment = { method: "e-wallet", provider: "GCash" };

{
  const store = shoppingStore();
  store.addLine(flower);
  assert.equal(store.hasProfile(), false);
  assert.throws(() => store.placeOrder(customer, payment), /Create a profile or sign in/);
  assert.equal(store.allOrders().length, 0);
  assert.equal(store.getCart().length, 1);
  store.write("petal-session", { id: "unregistered", name: customer.name, email: customer.email });
  assert.equal(store.hasProfile(), false);
  assert.throws(() => store.placeOrder(customer, payment), /Create a profile or sign in/);
}
console.log("PASS Guests and unregistered sessions cannot order or clear their cart.");

{
  const store = shoppingStore();
  store.addLine(flower);
  const line = store.getCart()[0];
  store.updateLine(line.lineId, { quantity: 3, unitPrice: 1 });
  assert.equal(store.getCart()[0].quantity, 3);
  assert.equal(store.getCart()[0].unitPrice, 120);
  store.updateLine(line.lineId, { unitPrice: 9999 });
  assert.equal(store.total(store.getCart()), 360);
}
console.log("PASS Quantity updates preserve the product price and calculate the correct total.");

{
  const store = shoppingStore();
  store.addLine(flower);
  store.addLine({
    productId: "custom-bouquet", name: "Your Custom Bouquet", image: "assets/customize/cost-1.png",
    unitPrice: 300, quantity: 1, options: { flowers: [{ index: 0, quantity: 2 }] }, details: "2 Tulip stems · Kraft wrapping",
  });
  const guestLines = store.getCart().map(line => line.lineId);
  const profile = store.signIn(customer.name, customer.email);
  assert.equal(store.hasProfile(), true);
  assert.deepEqual(Array.from(store.getCart(), line => line.lineId), Array.from(guestLines));
  assert.equal(store.getCart().length, 2);
  assert.equal(store.getCart().find(line => line.productId === "custom-bouquet").name, "Customize Flowers");
  assert.equal(store.getCart().find(line => line.productId === "flower-1").name, "Tulip");
  const order = store.placeOrder(customer, payment);
  assert.equal(order.owner, profile.id);
  assert.equal(order.subtotal, 540);
  assert.equal(order.delivery.fee, 100);
  assert.equal(order.total, 640);
  assert.equal(order.items.length, 2);
  assert.equal(order.items[1].name, "Customize Flowers");
  assert.equal(store.getCart().length, 0);
  assert.equal(store.orders().length, 1);
  store.logout();
  assert.equal(store.hasProfile(), false);
  assert.throws(() => store.placeOrder(customer, payment), /Create a profile or sign in/);
}
console.log("PASS Signing in preserves guest selections, distinguishes customized flowers, and assigns the order to the profile.");

{
  const store = shoppingStore();
  store.addLine(flower);
  store.signIn(customer.name, customer.email);
  store.setStock("flower-1", false);
  assert.throws(() => store.placeOrder(customer, payment), /Remove unavailable items/);
  assert.equal(store.getCart().length, 1);
  assert.equal(store.orders().length, 0);
}
console.log("PASS Registered customers still cannot order unavailable products.");
