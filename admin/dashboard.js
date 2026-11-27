"use strict";

const orderList = document.getElementById("order-list");
const orderFilter = document.getElementById("order-filter");
const stockList = document.getElementById("stock-list");
const productFilter = document.getElementById("product-filter");
const stockFilter = document.getElementById("stock-filter");
const editor = document.getElementById("product-editor");
const editorForm = document.getElementById("product-editor-form");
const categoryInput = editorForm.elements.namedItem("section");
const imageInput = editorForm.elements.namedItem("image");
const addProductButton = document.getElementById("add-product");
let editedProduct = null;
const inquiryList = document.getElementById("inquiry-list");
const feedbackList = document.getElementById("feedback-list");
const replyEditor = document.getElementById("reply-editor");
const replyForm = document.getElementById("reply-form");
let replyTarget = null;
const statusMessage = document.getElementById("dashboard-status");
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

const inventory = new Map(allProducts.map(product => [
  product.id, { ...product, category: displayCategory(product.section) },
]));
inventory.set("custom-bouquet", { id: "custom-bouquet", name: "Custom bouquet", category: "Customization" });
customFlowers.forEach((flower, index) => {
  const id = flower.stockId || "flower-" + (index + 1);
  if (!inventory.has(id)) inventory.set(id, { ...flower, id, category: "Custom bouquet stems" });
});
addons.forEach((addon, index) => {
  const id = "addon-" + index;
  inventory.set(id, { ...addon, id, category: "Custom bouquet add-ons" });
});

function displayCategory(section) {
  return section.replaceAll("-", " ").replace(/^./, first => first.toUpperCase());
}
categoryInput.add(new Option("Choose a category", ""));
for (const section of new Set(allProducts.map(product => product.section)))
  categoryInput.add(new Option(displayCategory(section), section));

function inventoryPhoto(element, product) {
  element.src = "/" + product.image;
  if (product.imageId) PetalStore.attachMedia(element, product.imageId);
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function record(title, subtitle) {
  const details = element("details");
  const summary = element("summary");
  summary.append(element("strong", title), element("span", subtitle));
  const body = element("div");
  body.className = "record-body";
  details.append(summary, body);
  return { details, body };
}

function showEmpty(list, message) {
  const empty = element("p", message);
  empty.className = "empty";
  list.append(empty);
}

function renderOrders() {
  const orders = PetalStore.allOrders();
  const open = orders.filter(order => !["Delivered", "Cancelled"].includes(order.status));
  document.getElementById("open-order-count").textContent = open.length;
  const expanded = new Set(Array.from(orderList.querySelectorAll("details[open]"), row => row.dataset.reference));
  const filtered = orders.filter(order => !orderFilter.value || order.status === orderFilter.value);
  orderList.replaceChildren();
  if (!filtered.length) {
    showEmpty(orderList, orders.length ? "No orders match this status." : "No orders have been placed in this browser.");
    return;
  }
  for (const order of filtered) {
    const { details, body } = record(order.reference, [order.status, money.format(order.total), displayDate(order.date)].filter(Boolean).join(" · "));
    const customer = order.customer;
    details.dataset.reference = order.reference;
    details.open = expanded.has(order.reference);
    const address = [customer.address, customer.city, customer.province, customer.postalCode].filter(Boolean).join(", ");
    const contact = [customer.name, customer.email, customer.phone].filter(Boolean).join(" · ");
    if (contact) body.append(element("p", contact));
    if (address) body.append(element("p", address));
    const items = element("ul");
    for (const item of order.items) {
      const text = item.quantity + " × " + item.name;
      items.append(element("li", item.details ? text + " · " + item.details : text));
    }
    const method = {
      "cash-on-delivery": "Cash on delivery",
      "credit-card": "Credit card",
      "e-wallet": "E-wallet",
    }[order.payment.method] || "Payment method unavailable";
    body.append(items, element("p", [method, order.payment.provider].filter(Boolean).join(" · ")));
    const actions = element("div");
    actions.className = "order-actions";
    for (const next of PetalStore.nextOrderStatuses(order.status)) {
      const button = element("button", next === "Cancelled" ? "Cancel order" : "Mark " + next.toLowerCase());
      button.type = "button";
      button.dataset.nextStatus = next;
      if (next === "Cancelled") button.className = "cancel";
      actions.append(button);
    }
    if (actions.childElementCount) body.append(actions);
    orderList.append(details);
  }
}

function renderInventory() {
  for (const [id, product] of inventory) if (product.imageId) inventory.delete(id);
  for (const product of PetalStore.addedProducts())
    inventory.set(product.id, { ...product, category: displayCategory(product.section) });
  const query = productFilter.value.trim().toLowerCase();
  let productCount = 0;
  let outOfStock = 0;
  stockList.replaceChildren();
  for (const product of inventory.values()) {
    if (PetalStore.isProductDeleted(product.id)) continue;
    productCount++;
    const display = PetalStore.productDetails(product);
    const stock = PetalStore.stockLeft(product.id);
    if (!stock) outOfStock++;
    if ((stockFilter.value === "out" && stock) ||
        !(display.name + " " + product.category + " " + product.id).toLowerCase().includes(query)) continue;
    const row = element("tr");
    const name = element("th");
    name.scope = "row";
    const identity = element("span");
    identity.className = "product-identity";
    if (product.image) {
      const photo = element("img");
      inventoryPhoto(photo, product);
      photo.alt = "";
      photo.loading = "lazy";
      identity.append(photo);
    }
    const text = element("span");
    text.append(element("strong", display.name), element("small", product.category));
    identity.append(text);
    name.append(identity);
    const stockCell = element("td");
    const badge = element("span", stock ? String(stock) : "Out of stock");
    badge.className = "stock-badge" + (stock === 0 ? " depleted" : stock <= 5 ? " low" : "");
    stockCell.append(badge);
    const actions = element("td");
    const buttons = element("div");
    buttons.className = "product-actions";
    const edit = element("button", "Edit");
    edit.type = "button";
    edit.className = "edit-button";
    edit.dataset.editProduct = product.id;
    edit.setAttribute("aria-label", "Edit " + display.name);
    buttons.append(edit);
    if (product.section) {
      const remove = element("button", "Delete");
      remove.type = "button";
      remove.className = "delete-button";
      remove.dataset.deleteProduct = product.id;
      remove.setAttribute("aria-label", "Delete " + display.name);
      buttons.append(remove);
    }
    actions.append(buttons);
    row.append(name, element("td", display.price === undefined ? "Varies" : money.format(display.price)), stockCell, actions);
    stockList.append(row);
  }
  document.getElementById("out-of-stock-count").textContent = outOfStock;
  document.getElementById("product-count").textContent = productCount;
  document.getElementById("stock-empty").hidden = !!stockList.childElementCount;
}

function renderInquiries() {
  const inquiries = PetalStore.inquiries();
  document.getElementById("inquiry-count").textContent = inquiries.length;
  updatePendingCount("pending-inquiry-count", inquiries);
  const expanded = new Set(Array.from(inquiryList.querySelectorAll("details[open]"), row => row.dataset.inquiryId));
  inquiryList.replaceChildren();
  if (!inquiries.length) showEmpty(inquiryList, "No inquiries have been saved in this browser.");
  for (const inquiry of inquiries) {
    const { details, body } = record(inquiry.subject || inquiry.type || "Customer inquiry", displayDate(inquiry.date));
    details.dataset.inquiryId = inquiry.id || "";
    details.open = expanded.has(details.dataset.inquiryId);
    const contact = [inquiry.name, inquiry.email, inquiry.phone].filter(Boolean).join(" · ");
    if (contact) body.append(element("p", contact));
    const message = element("p", inquiry.message);
    message.className = "record-message";
    body.append(message);
    replyControls(body, inquiry, "inquiry", inquiry.id);
    inquiryList.append(details);
  }
}

function updatePendingCount(id, records) {
  const count = records.filter(record => !record.reply).length;
  const badge = document.getElementById(id);
  badge.textContent = count;
  badge.hidden = !count;
}
function replyControls(body, item, kind, reference) {
  if (item.reply) {
    const reply = element("div");
    reply.className = "record-reply";
    reply.append(element("strong", "Shop reply"), element("p", item.reply));
    body.append(reply);
  }
  if (!reference) return;
  const button = element("button", item.reply ? "Edit reply" : "Write a reply");
  button.type = "button";
  button.dataset.replyKind = kind;
  button.dataset.replyReference = reference;
  body.append(button);
}
function renderFeedback() {
  const reviews = PetalStore.reviews();
  updatePendingCount("pending-feedback-count", reviews);
  const expanded = new Set(Array.from(feedbackList.querySelectorAll("details[open]"), row => row.dataset.reference));
  feedbackList.replaceChildren();
  if (!reviews.length) showEmpty(feedbackList, "No customer feedback has been submitted in this browser.");
  for (const review of reviews) {
    const { details, body } = record(review.name, [review.rating + "/5 stars", displayDate(review.date)].filter(Boolean).join(" · "));
    details.dataset.reference = review.reference;
    details.open = expanded.has(review.reference);
    body.append(element("p", "Order " + review.reference));
    const message = element("p", review.message);
    message.className = "record-message";
    body.append(message);
    const media = PetalStore.reviewMedia(review.attachment);
    if (media) body.append(media);
    replyControls(body, review, "review", review.reference);
    feedbackList.append(details);
  }
}
function renderDashboard() {
  renderOrders();
  renderInventory();
  renderInquiries();
  renderFeedback();
}

function announce(message, failed = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", failed);
}

async function verifySession() {
  const response = await fetch("/admin/session", { cache: "no-store" });
  if (response.ok) return true;
  location.replace("/admin/");
  return false;
}

orderFilter.addEventListener("change", renderOrders);
productFilter.addEventListener("input", renderInventory);
stockFilter.addEventListener("change", renderInventory);
document.getElementById("view-out-of-stock").addEventListener("click", () => {
  stockFilter.value = "out";
  productFilter.value = "";
  renderInventory();
});

const sections = new Map(Array.from(document.querySelectorAll(".dashboard > section"), section => [section.id, section]));
function showSection() {
  const requested = location.hash.slice(1);
  const active = sections.has(requested) ? requested : "inventory";
  for (const [id, section] of sections) section.hidden = id !== active;
  for (const link of document.querySelectorAll(".sections a")) {
    if (link.dataset.section === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", showSection);
showSection();

orderList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-next-status]");
  if (!button) return;
  const details = button.closest("details");
  const reference = details.dataset.reference;
  const status = button.dataset.nextStatus;
  button.disabled = true;
  try {
    if (!await verifySession()) return;
    await PetalStore.withInventoryLock(() => PetalStore.setOrderStatus(reference, status));
    announce(reference + " is now " + status.toLowerCase() + ".");
  } catch (error) {
    announce(error.message, true);
  } finally {
    renderOrders();
    renderInventory();
    const updated = Array.from(orderList.querySelectorAll("details")).find(row => row.dataset.reference === reference);
    (updated?.querySelector("summary") || orderFilter).focus();
  }
});

function openEditor(product) {
  editorForm.reset();
  const details = product ? PetalStore.productDetails(product) : { name: "", price: "" };
  editedProduct = product ? { product, ...details, stock: PetalStore.productStock(product.id) } : null;
  editorForm.elements.namedItem("name").value = details.name;
  const price = editorForm.elements.namedItem("price");
  price.disabled = details.price === undefined;
  price.value = details.price ?? "";
  document.getElementById("editor-price-field").hidden = price.disabled;
  editorForm.elements.namedItem("stock").value = editedProduct?.stock ?? "";
  document.getElementById("editor-title").textContent = product ? "Edit product" : "Add product";
  document.getElementById("save-product").textContent = product ? "Save changes" : "Add product";
  document.getElementById("editor-category").textContent = product?.category || "";
  categoryInput.disabled = imageInput.disabled = !!product;
  document.getElementById("editor-section-field").hidden = !!product;
  document.getElementById("editor-image-field").hidden = !!product;
  const photo = document.getElementById("editor-photo");
  photo.hidden = !product?.image;
  if (product?.image) inventoryPhoto(photo, product);
  document.getElementById("editor-error").textContent = "";
  editor.showModal();
}
stockList.addEventListener("click", async event => {
  const button = event.target.closest("button");
  const id = button?.dataset.deleteProduct || button?.dataset.editProduct;
  const product = inventory.get(id);
  if (!product) return;
  if (!button.dataset.deleteProduct) {
    openEditor(product);
    return;
  }
  const { name } = PetalStore.productDetails(product);
  if (!window.confirm('Delete "' + name + '" from the storefront?')) return;
  button.disabled = true;
  try {
    if (!await verifySession()) return;
    await PetalStore.withInventoryLock(() => PetalStore.deleteProduct(id));
    renderInventory();
    productFilter.focus();
    announce(name + " deleted from the storefront.");
  } catch (error) {
    announce(error.message, true);
  } finally {
    button.disabled = false;
  }
});
addProductButton.addEventListener("click", () => openEditor(null));
document.getElementById("close-editor").addEventListener("click", () => editor.close());
editorForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = editorForm.querySelector('button[type="submit"]');
  if (submit.disabled) return;
  const original = editedProduct;
  const product = original?.product;
  const fields = {
    name: editorForm.elements.namedItem("name").value.trim(),
    stock: editorForm.elements.namedItem("stock").valueAsNumber,
  };
  if (!product || original.price !== undefined) fields.price = editorForm.elements.namedItem("price").valueAsNumber;
  const section = categoryInput.value;
  const file = imageInput.files[0];
  let uploaded;
  submit.disabled = true;
  try {
    if (!await verifySession()) return;
    if (!product) uploaded = await PetalStore.saveMedia(file, true);
    const productId = await PetalStore.withInventoryLock(() => {
      if (!product) return PetalStore.addProduct({ ...fields, section, imageId: uploaded.id });
      const edits = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== original[key]));
      const current = { ...PetalStore.productDetails(product), stock: PetalStore.productStock(product.id) };
      if (Object.keys(edits).some(key => current[key] !== original[key]))
        throw new Error("This product changed while you were editing it. Reopen the editor and try again.");
      PetalStore.updateProduct(product.id, edits);
      return product.id;
    });
    uploaded = null;
    editor.close();
    renderInventory();
    const rowButton = Array.from(stockList.querySelectorAll("[data-edit-product]")).find(button => button.dataset.editProduct === productId);
    (rowButton || addProductButton).focus();
    announce(fields.name + (product ? " updated." : " added to the catalog."));
  } catch (error) {
    if (uploaded) PetalStore.deleteMedia(uploaded.id).catch(() => {});
    document.getElementById("editor-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

function openReply(event) {
  const button = event.target.closest("[data-reply-kind]");
  if (!button) return;
  const kind = button.dataset.replyKind;
  const reference = button.dataset.replyReference;
  const item = kind === "inquiry" ? PetalStore.inquiries().find(inquiry => inquiry.id === reference)
    : PetalStore.reviews().find(review => review.reference === reference);
  if (!item) return;
  replyTarget = { kind, reference };
  document.getElementById("reply-subject").textContent = kind === "inquiry" ? item.subject || "Contact Us" : item.name;
  document.getElementById("reply-error").textContent = "";
  replyForm.elements.namedItem("message").value = item.reply || "";
  replyEditor.showModal();
}
inquiryList.addEventListener("click", openReply);
feedbackList.addEventListener("click", openReply);
document.getElementById("close-reply").addEventListener("click", () => replyEditor.close());
replyForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = replyForm.querySelector('button[type="submit"]');
  if (submit.disabled || !replyTarget) return;
  const { kind, reference } = replyTarget;
  const message = replyForm.elements.namedItem("message").value;
  submit.disabled = true;
  try {
    if (!await verifySession()) return;
    const saved = await PetalStore.withInventoryLock(() => PetalStore.saveReply(kind, reference, message));
    replyEditor.close();
    if (kind === "inquiry") renderInquiries();
    else renderFeedback();
    const list = kind === "inquiry" ? inquiryList : feedbackList;
    const updated = [...list.querySelectorAll("[data-reply-reference]")].find(button => button.dataset.replyReference === reference);
    updated?.focus();
    announce(saved ? "Reply saved and the customer was notified." : "This reply is already saved.");
  } catch (error) {
    document.getElementById("reply-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

window.addEventListener("storage", event => {
  if (event.key === null || ["petal-orders", "petal-inquiries", "petal-reviews", "petal-stock", "petal-product-edits", "petal-catalog"].includes(event.key))
    renderDashboard();
});
window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  verifySession().then(active => { if (active) renderDashboard(); }).catch(error => announce(error.message, true));
});
renderDashboard();
