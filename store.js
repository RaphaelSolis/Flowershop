"use strict";
/* SAVED SHOPPING DATA
   This file saves carts, orders, notifications, inquiries, and reviews.
   Customer carts are separated by the profile currently signed in. */
const PetalStore = (function () {
  const memory = {};
  const storageMessage = "Could not save your changes. Browser storage is full or unavailable. Free some space and try again.";
  function validProfile(user) {
    return user && typeof user.id === "string" && typeof user.name === "string" &&
      !!user.name.trim() && typeof user.email === "string";
  }
  function checkedData(key, value, fallback) {
    if (Array.isArray(fallback) && !Array.isArray(value)) return fallback;
    if (fallback && !Array.isArray(fallback) && typeof fallback === "object" &&
        (!value || typeof value !== "object" || Array.isArray(value))) return fallback;
    if (key === "petal-profiles") return value.filter(validProfile);
    if (key === "petal-orders") return value.filter(order => order && typeof order.reference === "string" &&
      typeof order.owner === "string" && order.customer && typeof order.customer === "object" &&
      Array.isArray(order.items) && order.items.every(item => item && typeof item.name === "string" &&
        Number.isFinite(item.unitPrice) && Number.isInteger(item.quantity)) &&
      order.payment && Number.isFinite(order.total) && typeof order.status === "string");
    if (key === "petal-reviews") return value.filter(review => review && typeof review.owner === "string" &&
      typeof review.reference === "string" && typeof review.name === "string" &&
      typeof review.message === "string" && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5);
    if (key === "petal-notifications" || key === "petal-inquiries")
      return value.filter(item => item && typeof item.owner === "string" && typeof item.message === "string");
    return value;
  }
  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? checkedData(key, JSON.parse(value), fallback) : fallback;
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memory, key)
        ? checkedData(key, JSON.parse(JSON.stringify(memory[key])), fallback) : fallback;
    }
  }
  function write(key, value) {
    writeMany({ [key]: value });
  }
  function writeMany(changes) {
    const previous = {};
    const written = [];
    try {
      for (const key of Object.keys(changes)) previous[key] = localStorage.getItem(key);
      for (const [key, value] of Object.entries(changes)) {
        localStorage.setItem(key, JSON.stringify(value));
        written.push(key);
      }
    } catch (error) {
      for (const key of written.reverse()) {
        try {
          if (previous[key] === null) localStorage.removeItem(key);
          else localStorage.setItem(key, previous[key]);
        } catch {}
      }
      throw new Error(storageMessage);
    }
    for (const [key, value] of Object.entries(changes)) memory[key] = JSON.parse(JSON.stringify(value));
  }
  function makeId(prefix) {
    const random =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().replaceAll("-", "").slice(0, 12)
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    return prefix + "-" + random.toUpperCase();
  }
  function session() {
    const user = read("petal-session", null);
    return validProfile(user) ? user : null;
  }
  function owner() {
    const user = session();
    if (user) return user.id;
    const guest = read("petal-guest", null);
    return typeof guest === "string" && guest
      ? guest : memory["petal-guest"] ||= makeId("GUEST");
  }
  function signIn(name, email, updates = {}) {
    const profiles = read("petal-profiles", []);
    const saved = profiles.find(item => item.email === email.toLowerCase());
    const profile = { ...(saved || {
      id: makeId("USER"), name, email: email.toLowerCase(), createdAt: new Date().toISOString(),
    }), ...updates };
    const index = profiles.findIndex(item => item.id === profile.id);
    if (index >= 0) profiles[index] = profile;
    else profiles.push(profile);
    const wasGuest = !session();
    const guestId = owner();
    const guestCart = wasGuest ? getCart() : [];
    const existing = read("petal-cart:" + profile.id, []).map(normalizeLine).filter(Boolean);
    for (const item of guestCart)
      if (!existing.some(line => line.lineId === item.lineId)) existing.push(item);
    const changes = {
      "petal-profiles": profiles, "petal-session": profile,
      ["petal-cart:" + profile.id]: existing, "petal-haus-cart": [],
    };
    if (wasGuest) {
      changes["petal-guest"] = guestId;
      changes["petal-cart:" + guestId] = [];
      for (const key of ["petal-orders", "petal-inquiries", "petal-notifications", "petal-reviews"]) {
        const records = read(key, []);
        for (const record of records) if (record.owner === guestId) record.owner = profile.id;
        changes[key] = records;
      }
    }
    writeMany(changes);
    return profile;
  }
  function logout() {
    write("petal-session", null);
  }
  function hasProfile() {
    const user = session();
    const profiles = read("petal-profiles", []);
    return !!user && Array.isArray(profiles) && profiles.some(profile => profile.id === user.id);
  }
  function round(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
  function quantity(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(1, Math.min(99, Math.round(number)))
      : 1;
  }
  function productPrice(product, options = {}) {
    if (product.name.toLowerCase().includes("ferrero")) {
      const pieces = options.pieces || 5;
      if (![3, 5, 8, 12].includes(pieces)) return NaN;
      return product.group === "addon" ? ferreroPrices[pieces] : round(product.price * pieces / 5);
    }
    if (product.name.toLowerCase().includes("letter")) {
      const count = Array.isArray(options.letters) ? options.letters.length : 1;
      if (count < 1 || count > 10) return NaN;
      return round(product.price * count);
    }
    return product.price;
  }
  function productOptions(product, values) {
    if (!values || typeof values !== "object" || Array.isArray(values)) return null;
    const name = product.name.toLowerCase();
    const options = {};
    const choice = (key, choices, defaultValue = choices[0]) => {
      if (values[key] !== undefined && !choices.includes(values[key])) return false;
      options[key] = values[key] || defaultValue;
      return true;
    };
    if (name.includes("ferrero")) {
      if (!choice("flavor", SHOP_SETTINGS.chocolateFlavors) || !choice("pieces", [3, 5, 8, 12], 5)) return null;
    } else if (name.includes("pepero")) {
      if (!choice("flavor", SHOP_SETTINGS.peperoFlavors)) return null;
    } else if (name.includes("candle")) {
      if (!choice("scent", SHOP_SETTINGS.candleScents)) return null;
    } else if (name.includes("letter")) {
      // Retain messages saved before multiple letters were supported.
      const letters = values.letters === undefined ? [values.letter] : values.letters;
      if (!Array.isArray(letters) || letters.length < 1 || letters.length > 10 ||
          letters.some(letter => typeof letter !== "string" || !letter.trim() || letter.length > 500)) return null;
      options.letters = letters.map(letter => letter.trim());
    } else if (product.group !== "addon" && product.group !== "gifts" && product.section !== "gifts") {
      const presentation = flowerPresentation(product);
      const colorNames = colors.map(color => color[0]);
      if (presentation === "wrapped" && !choice("color", colorNames)) return null;
      if (["wrapped", "basket"].includes(presentation) && !choice("ribbon", colorNames)) return null;
    }
    return options;
  }
  function optionDetails(options) {
    return [
      options.color && options.color + " wrapper",
      options.ribbon && options.ribbon + " ribbon",
      options.flavor && "Flavor: " + options.flavor,
      options.pieces && options.pieces + " pieces per pack",
      options.scent && "Scent: " + options.scent,
      options.letters && options.letters.map((letter, index) => "Letter " + (index + 1) + ": " + letter).join(" · "),
    ].filter(Boolean).join(" · ");
  }
  function normalizeProduct(item, isAddon = false) {
    if (!item || typeof item.productId !== "string" || !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 99) return null;
    const addonIndex = /^addon-([0-5])$/.exec(item.productId);
    const product = isAddon && addonIndex
      ? { ...addons[Number(addonIndex[1])], id: item.productId, group: "addon" }
      : !isAddon && allProducts.find(product => product.id === item.productId);
    if (!product) return null;
    const options = productOptions(product, item.options);
    if (!options) return null;
    return {
      productId: product.id, name: product.name, image: product.image,
      unitPrice: productPrice(product, options), quantity: item.quantity,
      options, details: optionDetails(options),
    };
  }
  function normalizeLine(item) {
    if (!item || typeof item.productId !== "string" || !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 99 || !item.options ||
        typeof item.options !== "object" || Array.isArray(item.options)) return null;
    let line;
    if (item.productId === "custom-bouquet") {
      const values = item.options;
      if (!Array.isArray(values.flowers) || !values.flowers.length || values.flowers.length > customFlowers.length ||
          !values.flowers.every(flower => flower && Number.isInteger(flower.index) &&
            flower.index >= 0 && flower.index < customFlowers.length && Number.isInteger(flower.quantity) &&
            flower.quantity >= 1 && flower.quantity <= 99) ||
          new Set(values.flowers.map(flower => flower.index)).size !== values.flowers.length) return null;
      const flowers = values.flowers.map(flower => ({
        index: flower.index, name: customFlowers[flower.index].name,
        quantity: flower.quantity, unitPrice: customFlowers[flower.index].price,
      })).sort((a, b) => a.index - b.index);
      const mode = values.wrappingMode || "style";
      const wrapperName = values.wrapping?.name;
      let wrapping;
      if (mode === "style") {
        const style = wrapperName === undefined ? wrappings[0] : wrappings.find(wrapper => wrapper.name === wrapperName);
        if (style) wrapping = { name: style.name, price: style.price };
      } else if (mode === "color" && colors.some(color => color[0] + " plain wrapping" === wrapperName)) {
        wrapping = { name: wrapperName, price: SHOP_SETTINGS.plainWrappingPrice };
      }
      const ribbon = values.ribbon || "Pink";
      if (!colors.some(color => color[0] === ribbon) || !wrapping ||
          (values.addons !== undefined && !Array.isArray(values.addons))) return null;
      const extras = (values.addons || []).map(addon => normalizeProduct(addon, true));
      if (extras.some(addon => !addon) || new Set(extras.map(addon => addon.productId)).size !== extras.length) return null;
      const unitPrice = round(flowers.reduce((sum, flower) => sum + flower.quantity * flower.unitPrice, 0) +
        wrapping.price + extras.reduce((sum, addon) => sum + addon.quantity * addon.unitPrice, 0));
      line = {
        productId: "custom-bouquet", name: "Customize Flowers", image: customFlowers[flowers[0].index].image,
        unitPrice, quantity: item.quantity, options: { flowers, wrappingMode: mode, wrapping, ribbon, addons: extras },
        details: flowers.map(flower => flower.quantity + " " + flower.name + " stems").join(" · ") +
          " · " + wrapping.name + " · " + ribbon + " ribbon" + extras.map(addon => " · " + addon.quantity + " " + addon.name + " (" + addon.details + ")").join(""),
      };
    } else line = normalizeProduct(item);
    return line ? { ...line, ...(typeof item.lineId === "string" && item.lineId ? { lineId: item.lineId } : {}) } : null;
  }
  function getCart() {
    const key = "petal-cart:" + owner();
    const saved = read(key, null);
    if (saved !== null) return Array.isArray(saved)
      ? saved.filter(item => item && typeof item.lineId === "string").map(normalizeLine).filter(Boolean) : [];
    const old = read("petal-haus-cart", []);
    if (!old.length) return [];
    const cacheKey = "legacy:" + key;
    memory[cacheKey] ||= old.map(item => item && ({
      lineId: makeId("LINE"), productId: item.id, quantity: quantity(item.quantity), options: item.options || {},
    })).map(normalizeLine).filter(Boolean);
    return JSON.parse(JSON.stringify(memory[cacheKey]));
  }
  function saveCart(items) {
    const lines = items.map(normalizeLine);
    if (lines.some(line => !line || !line.lineId)) throw new Error("Some cart items are invalid. Please select them again.");
    const changes = { ["petal-cart:" + owner()]: lines, "petal-haus-cart": [] };
    if (!session()) changes["petal-guest"] = owner();
    writeMany(changes);
  }
  function addLine(item, replaceId) {
    const normalized = normalizeLine(item);
    if (!normalized) throw new Error("Complete the item options before adding it to your cart.");
    const lines = getCart().filter(line => line.lineId !== replaceId);
    let remaining = normalized.quantity;
    for (const line of lines) {
      if (line.productId === normalized.productId && JSON.stringify(line.options) === JSON.stringify(normalized.options)) {
        const added = Math.min(99 - line.quantity, remaining);
        line.quantity += added;
        remaining -= added;
      }
    }
    if (remaining) lines.push({ ...normalized, quantity: remaining, lineId: replaceId || makeId("LINE") });
    saveCart(lines);
    return lines;
  }
  function updateLine(lineId, changes) {
    const lines = getCart();
    const line = lines.find(function (item) {
      return item.lineId === lineId;
    });
    if (!line) return;
    if (changes.quantity !== undefined)
      line.quantity = quantity(changes.quantity);
    saveCart(lines);
  }
  function removeLine(lineId) {
    saveCart(
      getCart().filter(function (line) {
        return line.lineId !== lineId;
      }),
    );
  }
  function total(items) {
    return round(
      items.reduce(function (sum, item) {
        return sum + item.unitPrice * item.quantity;
      }, 0),
    );
  }
  function available(productId) {
    const stock = read("petal-stock", {});
    if (Object.prototype.hasOwnProperty.call(stock, productId)) return stock[productId] === true;
    const product = allProducts.find(item => item.id === productId);
    const flowerIndex = /^flower-([1-8])$/.exec(productId);
    return product ? product.available !== false
      : /^addon-[0-5]$/.test(productId) || !!flowerIndex || productId === "custom-bouquet";
  }
  function addonAvailable(productId) {
    const counterparts = ["gifts-2", "gifts-1", "gifts-5", "gifts-6", "gifts-4", "gifts-3"];
    const match = /^addon-([0-5])$/.exec(productId);
    return !!match && available(productId) && available(counterparts[Number(match[1])]);
  }
  function lineAvailable(line) {
    const checked = normalizeLine(line);
    if (!checked) return false;
    if (checked.productId === "custom-bouquet") return available(checked.productId) &&
      checked.options.flowers.every(flower => available(customFlowers[flower.index].stockId || "flower-" + (flower.index + 1))) &&
      checked.options.addons.every(addon => addonAvailable(addon.productId));
    return available(checked.productId);
  }
  function notify(message, kind, reference, recipient, uniqueId) {
    const list = read("petal-notifications", []);
    const recipientId = recipient || owner();
    if (
      uniqueId &&
      list.some(function (item) {
        return item.id === uniqueId && item.owner === recipientId;
      })
    )
      return;
    list.unshift({
      id: uniqueId || makeId("NOTE"),
      owner: recipientId,
      message: message,
      kind: kind,
      reference: reference || "",
      date: new Date().toISOString(),
      read: false,
    });
    writeMany({ "petal-notifications": list, ...(!session() ? { "petal-guest": owner() } : {}) });
  }
  function notifications() {
    return read("petal-notifications", []).filter(function (item) {
      return item.owner === owner();
    });
  }
  function readNotifications() {
    const list = read("petal-notifications", []);
    for (const note of list) {
      if (note.owner === owner()) note.read = true;
    }
    write("petal-notifications", list);
  }
  function syncNotifications() {
    notify(
      "New arrivals: " +
        allProducts
          .filter(function (product) {
            return product.section === "new-arrival";
          })
          .map(function (product) {
            return product.name;
          })
          .join(", ") +
        ".",
      "new",
      "",
      null,
      "new-arrivals-v1",
    );
    for (const line of getCart()) {
      if (!lineAvailable(line))
        notify(
          line.name + " is currently unavailable in your cart.",
          "stock",
          "",
          null,
          "unavailable-" + line.lineId,
        );
    }
  }
  function setStock(productId, isAvailable) {
    const stock = read("petal-stock", {});
    stock[productId] = Boolean(isAvailable);
    write("petal-stock", stock);
    syncNotifications();
  }
  function allOrders() {
    return read("petal-orders", []);
  }
  function orders() {
    return allOrders().filter(function (order) {
      return order.owner === owner();
    });
  }
  function getOrder(reference) {
    return orders().find(function (order) {
      return order.reference === reference;
    });
  }
  function checkoutCharges(items = getCart()) {
    const subtotal = total(items);
    const configuredFee = SHOP_SETTINGS.deliveryFee;
    if (!Number.isFinite(configuredFee) || configuredFee < 0)
      throw new Error("The delivery fee is unavailable. Please contact us before ordering.");
    const deliveryFee = items.length ? round(configuredFee) : 0;
    return { subtotal, deliveryFee, total: round(subtotal + deliveryFee) };
  }
  // Store hours always use Manila time, regardless of the customer's timezone.
  function orderHours(now = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
    const hour = Number(parts.hour);
    return { open: hour >= 8 && hour < 18,
      time: new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }).format(now) };
  }
  function placeOrder(customer, payment) {
    if (!hasProfile())
      throw new Error("Create a profile or sign in before placing an order.");
    if (!orderHours().open)
      throw new Error("Orders are accepted from 8:00 AM to 6:00 PM (Manila time). Please return at 8:00 AM.");
    for (const field of [
      "name",
      "email",
      "phone",
      "address",
      "city",
      "province",
      "postalCode",
    ]) {
      if (typeof customer[field] !== "string" || !customer[field].trim())
        throw new Error("Complete all delivery details.");
    }
    if (!/[\p{L}\p{N}]/u.test(customer.address))
      throw new Error("Enter a valid delivery address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      throw new Error("Enter a valid email address.");
    if (!isValidPhone(customer.phone))
      throw new Error("Enter a valid phone number.");
    if (!/^[0-9]{4,10}$/.test(customer.postalCode))
      throw new Error("Enter a valid postal code.");
    if (
      payment.method === "e-wallet" &&
      !["GCash", "Maya"].includes(payment.provider)
    )
      throw new Error("Choose an e-wallet.");
    const items = getCart();
    if (!items.length) throw new Error("Your cart is empty.");
    if (
      items.some(function (line) {
        return !lineAvailable(line);
      })
    )
      throw new Error("Remove unavailable items before checkout.");
    if (!["credit-card", "e-wallet"].includes(payment.method))
      throw new Error("Please choose a cashless payment method.");
    if (payment.method === "credit-card" &&
        (payment.mode !== "demo" || !["Visa / Mastercard", "BPI"].includes(payment.provider) ||
         !["Visa", "Mastercard"].includes(payment.brand) || !/^[0-9]{4}$/.test(payment.last4 || "")))
      throw new Error("Complete your card details before placing an order.");
    const list = allOrders();
    let reference;
    do {
      reference = makeId(
        "PH-" + new Date().toISOString().slice(0, 10).replaceAll("-", ""),
      );
    } while (
      list.some(function (order) {
        return order.reference === reference;
      })
    );
    const charges = checkoutCharges(items);
    const order = {
      reference: reference,
      owner: owner(),
      date: new Date().toISOString(),
      status: "Placed",
      customer: customer,
      payment: {
        method: payment.method,
        provider: payment.provider || "",
        mode: "demo",
        status: "Demo — no charge",
        ...(payment.method === "credit-card" ? { brand: payment.brand, last4: payment.last4 } : {}),
      },
      items: JSON.parse(JSON.stringify(items)),
      subtotal: charges.subtotal,
      delivery: { type: "Same-day delivery", fee: charges.deliveryFee },
      total: charges.total,
    };
    list.unshift(order);
    writeMany({ "petal-orders": list, ["petal-cart:" + owner()]: [], "petal-haus-cart": [] });
    try { notify("Your order " + reference + " has been placed.", "order", reference); } catch {}
    return order;
  }
  function setOrderStatus(reference, status) {
    const nextStatus = {
      Placed: ["Confirmed", "Cancelled"],
      Confirmed: ["Dispatched", "Cancelled"],
      Dispatched: ["Delivered"],
      Delivered: [],
      Cancelled: [],
    };
    const list = allOrders();
    const order = list.find(function (item) {
      return item.reference === reference;
    });
    if (!order || !nextStatus[order.status]?.includes(status))
      throw new Error("That order status change is not allowed.");
    order.status = status;
    write("petal-orders", list);
    notify(
      "Order " + reference + " is now " + status.toLowerCase() + ".",
      "order",
      reference,
      order.owner,
    );
  }
  function reviews() {
    const list = read("petal-reviews", []);
    return list.filter(function (review) {
      const order = allOrders().find(function (item) {
        return item.reference === review.reference;
      });
      return (
        order && order.status !== "Cancelled" && order.owner === review.owner
      );
    });
  }
  function eligibleOrders() {
    const existing = reviews();
    return orders().filter(function (order) {
      return (
        hasProfile() && order.status !== "Cancelled" &&
        !existing.some(function (review) {
          return review.reference === order.reference;
        })
      );
    });
  }
  function validateReview(rating, message) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 ||
        typeof message !== "string" || !message.trim() || message.length > 1000)
      throw new Error("Choose a rating and write your review.");
  }
  function editableReview(reference) {
    if (!hasProfile()) return null;
    return reviews().find(review => review.reference === reference && review.owner === owner()) || null;
  }
  function updateReview(reference, rating, message, display = {}) {
    const review = editableReview(reference);
    if (!review) throw new Error("Log in to edit your own review for an active order.");
    validateReview(rating, message);
    const list = read("petal-reviews", []);
    const index = list.findIndex(item => item.reference === reference && item.owner === owner());
    const anonymous = display.anonymous === undefined
      ? (review.anonymous ?? review.name === "Anonymous Person") : !!display.anonymous;
    list[index] = {
      ...list[index],
      name: anonymous ? "Anonymous Person" : String(display.name || review.name).trim().slice(0, 100),
      anonymous,
      rating,
      message: message.trim(),
      updatedAt: new Date().toISOString(),
    };
    write("petal-reviews", list);
    return list[index];
  }
  function submitReview(reference, rating, message, display = {}) {
    const order = eligibleOrders().find(function (item) {
      return item.reference === reference;
    });
    if (!order)
      throw new Error(
        "Place an order before submitting feedback. Each order can be reviewed once.",
      );
    validateReview(rating, message);
    const list = read("petal-reviews", []);
    list.unshift({
      id: makeId("REVIEW"),
      owner: owner(),
      reference: reference,
      name: display.anonymous ? "Anonymous Person" : String(display.name || order.customer.name).trim().slice(0, 100),
      anonymous: !!display.anonymous,
      rating: rating,
      message: message.trim(),
      date: new Date().toISOString(),
    });
    write("petal-reviews", list);
    try { notify("Thank you! Your review was published.", "review", reference); } catch {}
  }
  function inquiries() {
    return read("petal-inquiries", []);
  }
  function saveInquiry(details) {
    if (!/^[0-9]{11}$/.test(details.phone || ""))
      throw new Error("Enter exactly 11 digits for your mobile number.");
    const list = inquiries();
    const inquiry = {
      ...details,
      id: makeId("INQUIRY"),
      owner: owner(),
      date: new Date().toISOString(),
      status: "Pending",
    };
    list.unshift(inquiry);
    write("petal-inquiries", list);
    return inquiry;
  }
  return {
    read,
    write,
    writeMany,
    productPrice,
    addonAvailable,
    makeId,
    session,
    owner,
    signIn,
    logout,
    hasProfile,
    round,
    quantity,
    getCart,
    saveCart,
    addLine,
    updateLine,
    removeLine,
    total,
    available,
    lineAvailable,
    notify,
    notifications,
    readNotifications,
    syncNotifications,
    setStock,
    allOrders,
    orders,
    getOrder,
    placeOrder,
    checkoutCharges,
    orderHours,
    setOrderStatus,
    reviews,
    eligibleOrders,
    submitReview,
    editableReview,
    updateReview,
    inquiries,
    saveInquiry,
  };
})();

// Account passwords are saved as a salted digest, never as plain text.
let accountPasswordModules;
async function makeAccountPassword(password, existingSalt) {
  if (existingSalt !== undefined && !/^[a-f0-9]{32}$/i.test(existingSalt))
    throw new Error("The saved password is invalid. Please contact us for account help.");
  const salt = existingSalt
    ? Uint8Array.from(existingSalt.match(/.{2}/g), byte => parseInt(byte, 16))
    : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const passwordBytes = new TextEncoder().encode(password);
  let digest;
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveBits"]);
    digest = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256));
  } else {
    // HTTP addresses such as [::] and local IPs do not expose crypto.subtle.
    // These local browser modules produce the same PBKDF2-SHA256 password record.
    accountPasswordModules ||= Promise.all([
      import("./assets/vendor/noble-hashes/pbkdf2.js"),
      import("./assets/vendor/noble-hashes/sha2.js"),
    ]);
    const [{ pbkdf2Async }, { sha256 }] = await accountPasswordModules;
    digest = await pbkdf2Async(sha256, passwordBytes, salt, { c: 100000, dkLen: 32 });
  }
  const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return { salt: hex(salt), digest: hex(digest) };
}
async function verifyAccountPassword(password, record) {
  if (!record || !/^[a-f0-9]{32}$/i.test(record.salt) || !/^[a-f0-9]{64}$/i.test(record.digest)) return false;
  return (await makeAccountPassword(password, record.salt)).digest === record.digest;
}

// Shared account and delivery validation.
function isValidPhone(value) {
  const digits = typeof value === "string" ? value.replace(/[^0-9]/g, "") : "";
  return digits.length >= 7 && digits.length <= 15 && /^\+?[0-9() -]{7,20}$/.test(value);
}
function isStrongAccountPassword(value) {
  return typeof value === "string" && /^(?=.*\p{Lu})(?=.*[^\p{L}\p{N}\s]).{8,128}$/u.test(value);
}

// Security answers use a separate, normalized input and independently salted hashes.
function normalizeSecurityAnswer(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase() : "";
}
function validateAccountRecovery(entries) {
  if (!Array.isArray(entries) || entries.length !== 2)
    throw new Error("Choose two different security questions and answer both.");
  const questions = entries.map(entry => {
    const question = typeof entry?.question === "string" ? entry.question.trim() : "";
    const answer = normalizeSecurityAnswer(entry?.answer);
    if (question.length < 10 || question.length > 160)
      throw new Error("Write a security question with 10 to 160 characters.");
    if (!answer || typeof entry.answer !== "string" || entry.answer.length > 128)
      throw new Error("Answer both security questions using 1 to 128 characters.");
    return { question, answer };
  });
  if (normalizeSecurityAnswer(questions[0].question) === normalizeSecurityAnswer(questions[1].question))
    throw new Error("Choose two different security questions.");
  return questions;
}
async function makeAccountRecovery(entries) {
  const questions = validateAccountRecovery(entries);
  return Promise.all(questions.map(async ({ question, answer }) => ({
    question, answerRecord: await makeAccountPassword("petal-security-answer:v1:" + answer),
  })));
}
function hasAccountRecovery(profile) {
  const questions = profile?.recoveryQuestions;
  return Array.isArray(questions) && questions.length === 2 && questions.every(item =>
    typeof item?.question === "string" && item.question.trim().length >= 10 && item.question.length <= 160 &&
    /^[a-f0-9]{32}$/i.test(item.answerRecord?.salt) && /^[a-f0-9]{64}$/i.test(item.answerRecord?.digest)) &&
    normalizeSecurityAnswer(questions[0].question) !== normalizeSecurityAnswer(questions[1].question);
}
async function verifyAccountRecovery(answers, profile) {
  if (!hasAccountRecovery(profile) || !Array.isArray(answers) || answers.length !== 2 ||
      answers.some(answer => typeof answer !== "string" || answer.length > 128 || !normalizeSecurityAnswer(answer))) return false;
  const results = await Promise.all(profile.recoveryQuestions.map((item, index) =>
    verifyAccountPassword("petal-security-answer:v1:" + normalizeSecurityAnswer(answers[index]), item.answerRecord)));
  return results.every(Boolean);
}
function accountSecuritySnapshot(profile) {
  return JSON.stringify([profile?.id, profile?.email, profile?.passwordRecord, profile?.recoveryQuestions]);
}
function commitAccountSecurity(original, updates, requireSignIn = false) {
  const profiles = PetalStore.read("petal-profiles", []);
  const index = profiles.findIndex(profile => profile.id === original.id);
  const current = profiles[index];
  const session = PetalStore.session();
  if (!current || accountSecuritySnapshot(current) !== accountSecuritySnapshot(original))
    throw new Error("Your account details changed. Please start again.");
  if (requireSignIn && session?.id !== original.id)
    throw new Error("Your sign-in changed. Please sign in and try again.");
  profiles[index] = { ...current, ...updates };
  const changes = { "petal-profiles": profiles };
  if (session?.id === original.id) changes["petal-session"] = { ...session, ...updates };
  PetalStore.writeMany(changes);
}
async function resetAccountPassword(profile, answers, password) {
  if (!isStrongAccountPassword(password))
    throw new Error("Use at least 8 characters, one uppercase letter, and one special character.");
  if (!(await verifyAccountRecovery(answers, profile)))
    throw new Error("The security answers do not match. Please check both answers and try again.");
  const passwordRecord = await makeAccountPassword(password);
  commitAccountSecurity(profile, { passwordRecord });
}
async function saveAccountRecovery(entries, currentPassword) {
  const session = PetalStore.session();
  const profile = PetalStore.read("petal-profiles", []).find(item => item.id === session?.id);
  if (!profile) throw new Error("Please sign in to set your security questions.");
  if (!profile.passwordRecord) throw new Error("Set a password in Change Password before adding security questions.");
  validateAccountRecovery(entries);
  if (!(await verifyAccountPassword(currentPassword, profile.passwordRecord)))
    throw new Error("Your current password is incorrect.");
  const recoveryQuestions = await makeAccountRecovery(entries);
  commitAccountSecurity(profile, { recoveryQuestions }, true);
}
