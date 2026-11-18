"use strict";
/* SAVED SHOPPING DATA
   This file saves carts, orders, notifications, inquiries, and reviews.
   Customer carts are separated by the profile currently signed in. */
const PetalStore = (function () {
  const memory = {};
  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return Object.prototype.hasOwnProperty.call(memory, key)
        ? memory[key]
        : fallback;
    }
  }
  function write(key, value) {
    memory[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* Keep this page working in memory. */
    }
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
    return user &&
      typeof user.id === "string" &&
      typeof user.name === "string" &&
      typeof user.email === "string"
      ? user
      : null;
  }
  function owner() {
    const user = session();
    if (user && user.id) return user.id;
    let guest = read("petal-guest", null);
    if (!guest) {
      guest = makeId("GUEST");
      write("petal-guest", guest);
    }
    return guest;
  }
  function signIn(name, email) {
    const profiles = read("petal-profiles", []);
    let profile = profiles.find(function (item) {
      return item.email === email.toLowerCase();
    });
    if (!profile) {
      profile = { id: makeId("USER"), name: name, email: email.toLowerCase(), createdAt: new Date().toISOString() };
      profiles.push(profile);
      write("petal-profiles", profiles);
    }
    // Move a guest's shopping selections to their profile at sign-in.
    const guestId = owner();
    const wasGuest = !session();
    const guestCart = wasGuest ? getCart() : [];
    write("petal-session", profile);
    const existing = getCart();
    for (const item of guestCart) {
      if (
        !existing.some(function (line) {
          return line.lineId === item.lineId;
        })
      )
        existing.push(item);
    }
    write("petal-cart:" + owner(), existing);
    if (guestCart.length) write("petal-cart:" + guestId, []);
    if (wasGuest) {
      for (const key of [
        "petal-orders",
        "petal-inquiries",
        "petal-notifications",
        "petal-reviews",
      ]) {
        const records = read(key, []);
        for (const record of records)
          if (record.owner === guestId) record.owner = profile.id;
        write(key, records);
      }
    }
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
  function validLine(item) {
    return (
      item &&
      typeof item.lineId === "string" &&
      typeof item.name === "string" &&
      typeof item.productId === "string" &&
      item.options &&
      typeof item.options === "object" &&
      typeof item.image === "string" &&
      item.image.startsWith("assets/") &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice > 0 &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 99
    );
  }
  function getCart() {
    const key = "petal-cart:" + owner();
    let items = read(key, null);
    if (!items) {
      // Preserve the cart from the earlier version of the website once.
      const old = read("petal-haus-cart", []);
      items = Array.isArray(old)
        ? old
            .filter(function (item) {
              return item && item.price > 0 && typeof item.name === "string";
            })
            .map(function (item) {
              return {
                lineId: makeId("LINE"),
                productId: item.id,
                name: item.name,
                image: item.image,
                unitPrice: round(item.price),
                quantity: quantity(item.quantity),
                options: {},
                details: item.details || "",
              };
            })
        : [];
      write(key, items);
      write("petal-haus-cart", []);
    }
    return Array.isArray(items) ? items.filter(validLine).map(function (item) {
      return item.productId.startsWith("custom-")
        ? { ...item, name: "Customize Flowers" }
        : item;
    }) : [];
  }
  function saveCart(items) {
    write("petal-cart:" + owner(), items.filter(validLine));
  }
  function addLine(item, replaceId) {
    const lines = getCart().filter(function (line) {
      return line.lineId !== replaceId;
    });
    const matching = lines.find(function (line) {
      return (
        line.productId === item.productId &&
        line.unitPrice === item.unitPrice &&
        JSON.stringify(line.options) === JSON.stringify(item.options) &&
        line.details === item.details
      );
    });
    if (matching)
      matching.quantity = quantity(matching.quantity + item.quantity);
    else
      lines.push({
        ...item,
        lineId: replaceId || makeId("LINE"),
        quantity: quantity(item.quantity),
      });
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
    if (Object.prototype.hasOwnProperty.call(stock, productId))
      return stock[productId];
    const product = allProducts.find(function (item) {
      return item.id === productId;
    });
    return product
      ? product.available !== false
      : productId.startsWith("custom-");
  }
  function lineAvailable(line) {
    if (line.productId.startsWith("custom-")) {
      return (
        !line.options.flowers ||
        line.options.flowers.every(function (flower) {
          return available("flower-" + (flower.index + 1)) || flower.index >= 6;
        })
      );
    }
    return available(line.productId);
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
    write("petal-notifications", list);
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
  function placeOrder(customer, payment) {
    if (!hasProfile())
      throw new Error("Create a profile or sign in before placing an order.");
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      throw new Error("Enter a valid email address.");
    if (!/^[+0-9() -]{7,20}$/.test(customer.phone))
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
    const order = {
      reference: reference,
      owner: owner(),
      date: new Date().toISOString(),
      status: "Placed",
      customer: customer,
      payment: {
        method: payment.method,
        provider: payment.provider || "",
        status: "Selected",
      },
      items: JSON.parse(JSON.stringify(items)),
      total: total(items),
    };
    list.unshift(order);
    write("petal-orders", list);
    saveCart([]);
    notify("Your order " + reference + " has been placed.", "order", reference);
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
    if (!order || !nextStatus[order.status].includes(status))
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
        order && order.status === "Delivered" && order.owner === review.owner
      );
    });
  }
  function eligibleOrders() {
    const existing = reviews();
    return orders().filter(function (order) {
      return (
        order.status === "Delivered" &&
        !existing.some(function (review) {
          return review.reference === order.reference;
        })
      );
    });
  }
  function submitReview(reference, rating, message, display = {}) {
    const order = eligibleOrders().find(function (item) {
      return item.reference === reference;
    });
    if (!order)
      throw new Error(
        "You can review an order only after delivery, once per order.",
      );
    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !message.trim() ||
      message.length > 1000
    )
      throw new Error("Choose a rating and write your review.");
    const list = read("petal-reviews", []);
    list.unshift({
      id: makeId("REVIEW"),
      owner: owner(),
      reference: reference,
      name: display.anonymous ? "Anonymous Person" : String(display.name || order.customer.name).trim().slice(0, 100),
      rating: rating,
      message: message.trim(),
      date: new Date().toISOString(),
    });
    write("petal-reviews", list);
    notify("Thank you! Your review was published.", "review", reference);
  }
  function inquiries() {
    return read("petal-inquiries", []);
  }
  function saveInquiry(details) {
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
    setOrderStatus,
    reviews,
    eligibleOrders,
    submitReview,
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
    // HTTP demo addresses such as [::] and local IPs do not expose crypto.subtle.
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
