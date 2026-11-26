"use strict";
/* DEDICATED PAGES
   Cart → checkout → saved receipt.
   Feedback checks for a placed order belonging to the signed-in customer. */
function formValue(form, name) {
  return form.elements.namedItem(name)?.value?.trim() || "";
}
function validateTextFields(form, names) {
  let valid = true;
  for (const name of names) {
    const input = form.elements.namedItem(name);
    const blank = !input.value.trim();
    input.setCustomValidity?.(blank ? "Enter a value containing more than spaces." : "");
    if (blank) valid = false;
  }
  return valid;
}
const deliveryAddressFields = ["houseNumber", "street", "barangay", "city", "province", "postalCode"];
function defaultAddressFields(user) {
  const fields = Object.fromEntries(deliveryAddressFields.map(name => [name,
    typeof user.defaultAddress?.[name] === "string" ? user.defaultAddress[name] : ""]));
  if (user.defaultAddress || typeof user.address !== "string" || !user.address) return fields;
  const parts = user.address.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length >= 4 && /^[0-9]{4,10}$/.test(parts.at(-1))) {
    fields.postalCode = parts.pop();
    fields.province = parts.pop();
    fields.city = parts.pop();
    if (parts.length >= 2) fields.barangay = parts.pop();
    if (parts.length === 2) [fields.houseNumber, fields.street] = parts;
    else {
      const first = /^(\S*\d\S*)\s+(.+)$/.exec(parts[0] || "");
      if (first) [, fields.houseNumber, fields.street] = first;
      else fields.street = parts[0] || "";
    }
  } else fields.street = user.address;
  return fields;
}
function checkoutState() {
  return { owner: PetalStore.owner(), cart: JSON.stringify(PetalStore.getCart()) };
}
let checkoutSnapshot = null;
function renderCartPage() {
  const container = document.getElementById("cart-page-items");
  if (!container) return;
  const items = PetalStore.getCart();
  container.closest(".cart-page-layout").classList.toggle("cart-empty", !items.length);
  container.innerHTML = items.map(function (line) {
    return '<article class="cart-line-card" data-line-id="' + escapeHTML(line.lineId) + '">' +
      '<div class="cart-product"><div class="cart-product-photo"><img src="' + escapeHTML(productPhotoURL(line.image)) + '" alt="' + escapeHTML(line.name) + '"></div>' +
      '<strong class="cart-product-name">' + escapeHTML(line.name) + '</strong>' +
      '<p class="cart-product-details">' + escapeHTML(line.details || "") + '</p>' +
      (!PetalStore.lineAvailable(line) ? '<p class="form-error">Currently unavailable. Remove this item before checkout.</p>' : '') +
      (findProduct(line.productId) || line.productId === "custom-bouquet" ? '<button type="button" class="text-button" data-edit-options="' + escapeHTML(line.lineId) + '">Edit options</button>' : '') + '</div>' +
      '<div class="cart-quantity"><button type="button" data-cart-adjust="-1" aria-label="Remove one ' + escapeHTML(line.name) + '">−</button>' +
      '<input type="number" min="1" max="99" step="1" value="' + line.quantity + '" data-line-quantity aria-label="Quantity for ' + escapeHTML(line.name) + '">' +
      '<button type="button" data-cart-adjust="1" aria-label="Add one ' + escapeHTML(line.name) + '">+</button></div>' +
      '<div class="cart-price-cell"><output data-line-total>₱' + money(line.unitPrice * line.quantity) + '</output></div>' +
      '<button type="button" class="cart-delete" data-delete-line="' + escapeHTML(line.lineId) + '" aria-label="Delete ' + escapeHTML(line.name) + '">×</button></article>';
  }).join("") || '<p class="empty-state">You do not have current saved<br>products in the cart</p>';
  updateCartPageTotal();
}
function updateCartPageTotal() {
  const items = PetalStore.getCart();
  const blocked =
    !items.length ||
    items.some(function (line) {
      return !PetalStore.lineAvailable(line);
    }) || Array.from(document.querySelectorAll("#cart-page-items input")).some(input => !input.checkValidity());
  document.getElementById("cart-page-total").textContent =
    "₱" + money(PetalStore.total(items));
  const proceed = document.getElementById("proceed-checkout");
  proceed.href = PetalStore.hasProfile() ? "checkout.html" : "Log-Sign/SignUp.html?next=checkout";
  proceed.setAttribute("aria-disabled", blocked);
  proceed.tabIndex = blocked ? -1 : 0;
  document.getElementById("cart-page-note").textContent = !items.length
    ? "Add items to continue."
    : blocked
      ? "Remove unavailable items to continue."
      : !PetalStore.hasProfile()
        ? "Create a profile or sign in before placing your order. Your cart will be saved."
        : "You can edit quantities and product options before checkout.";
  refreshCartUI();
}
function renderCheckoutPage(prefill = true) {
  const hasProfile = PetalStore.hasProfile();
  document.getElementById("checkout-account-note").hidden = hasProfile;
  document.getElementById("checkout-details").hidden = !hasProfile;
  document.getElementById("pay-button").disabled = true;
  checkoutSnapshot = checkoutState();
  if (!hasProfile) return;
  const items = PetalStore.getCart();
  document.getElementById("checkout-summary").innerHTML =
    items
      .map(function (line) {
        return (
          '<article class="checkout-summary-item"><img src="' + escapeHTML(productPhotoURL(line.image)) + '" alt=""><div><h3>' +
          escapeHTML(line.name) +
          '</h3><p>' + line.quantity + ' × ' + escapeHTML(line.details || line.name) +
          '</p><output>₱' + money(line.unitPrice * line.quantity) + '</output></div></article>'
        );
      })
      .join("") ||
    '<p>Your cart is empty. <a href="collections.html">Shop now.</a></p>';
  const charges = PetalStore.checkoutCharges(items);
  document.getElementById("checkout-subtotal").textContent = "₱" + money(charges.subtotal);
  document.getElementById("checkout-delivery-fee").textContent = "₱" + money(charges.deliveryFee);
  document.getElementById("delivery-option-fee").textContent = "₱" + money(SHOP_SETTINGS.deliveryFee);
  document.getElementById("checkout-total").textContent = "₱" + money(charges.total);
  document.getElementById("pay-button").disabled =
    !items.length ||
    items.some(function (line) {
      return !PetalStore.lineAvailable(line);
    });
  const user = PetalStore.session();
  const form = document.getElementById("checkout-form");
  if (user && prefill) {
    const parts = user.name.trim().split(/\s+/);
    form.elements.namedItem("firstName").value = parts.shift();
    form.elements.namedItem("lastName").value = parts.join(" ");
    form.elements.namedItem("email").value = user.email;
    form.elements.namedItem("phone").value = user.phone || "";
    const address = defaultAddressFields(user);
    for (const name of deliveryAddressFields) form.elements.namedItem(name).value = address[name];
  }
  updateOrderHours();
}
function updateOrderHours() {
  const panel = document.getElementById("order-hours");
  if (!panel || !PetalStore.hasProfile()) return;
  const hours = PetalStore.orderHours();
  panel.dataset.open = String(hours.open);
  panel.innerHTML = "<p>Manila time: <strong>" + escapeHTML(hours.time) +
    "</strong></p><p>Order hours: 8:00 AM–6:00 PM daily.</p><p>" +
    (hours.open ? "We are accepting orders." : "Ordering is closed. Please return at 8:00 AM.") + "</p>";
  const items = PetalStore.getCart();
  document.getElementById("pay-button").disabled = checkoutInProgress || !hours.open ||
    !items.length || items.some(line => !PetalStore.lineAvailable(line));
}
function refreshCheckoutSavedData() {
  if (page !== "checkout" || checkoutInProgress || !checkoutSnapshot) return false;
  const current = checkoutState();
  if (current.owner === checkoutSnapshot.owner && current.cart === checkoutSnapshot.cart) return false;
  const accountChanged = current.owner !== checkoutSnapshot.owner;
  if (accountChanged) {
    document.getElementById("checkout-form").reset();
    clearCheckoutCardDetails();
    updateCheckoutPayment();
  }
  renderCheckoutPage(accountChanged);
  refreshAccountUI();
  document.getElementById("checkout-error").textContent = accountChanged
    ? "Your sign-in changed. Review your delivery details before placing an order."
    : "Your cart changed. Review the updated total before placing your order.";
  return true;
}
let checkoutInProgress = false;
function submitCheckout(event) {
  event.preventDefault();
  if (checkoutInProgress) return;
  if (refreshCheckoutSavedData()) return;
  if (!PetalStore.hasProfile()) {
    renderCheckoutPage();
    return;
  }
  const form = event.target;
  const error = document.getElementById("checkout-error");
  error.textContent = "";
  if (!validateTextFields(form, ["firstName", "lastName", ...deliveryAddressFields])) {
    error.textContent = "Complete all delivery details. Fields cannot contain only spaces.";
    form.reportValidity();
    return;
  }
  if (!isValidPhone(formValue(form, "phone"))) {
    error.textContent = "Enter a valid phone number with 7 to 15 digits.";
    return;
  }
  if (!validateCheckoutPayment()) {
    form.reportValidity();
    return;
  }
  if (typeof form.reportValidity === "function" && !form.reportValidity()) return;
  const customer = {};
  for (const name of [
    "email",
    "phone",
    "city",
    "province",
    "postalCode",
  ])
    customer[name] = formValue(form, name);
  customer.name = [formValue(form, "firstName"), formValue(form, "lastName")].join(" ").trim();
  customer.address = [formValue(form, "houseNumber"), formValue(form, "street"), formValue(form, "barangay")].join(", ");
  const payment = checkoutPaymentDetails();
  if (payment.method === "e-wallet" && !payment.provider) {
    document.getElementById("checkout-error").textContent =
      "Choose an e-wallet.";
    return;
  }
  try {
    checkoutInProgress = true;
    document.getElementById("pay-button").disabled = true;
    const order = PetalStore.placeOrder(customer, payment);
    clearCheckoutCardDetails();
    refreshCartUI();
    const receiptLink =
      "receipt.html?reference=" + encodeURIComponent(order.reference);
    location.href = receiptLink + "&placed=1";
  } catch (error) {
    checkoutInProgress = false;
    document.getElementById("pay-button").disabled = !PetalStore.hasProfile();
    updateOrderHours();
    document.getElementById("checkout-error").textContent = error.message;
  }
}
function receiptMarkup(order) {
  const cashOnDelivery = order.payment.method === "cash-on-delivery";
  const totalLabel = cashOnDelivery ? "Due on delivery" : "Total";
  let paymentDescription;
  if (order.payment.method === "credit-card") {
    paymentDescription = "Credit / debit card" + (order.payment.provider ? " — " + escapeHTML(order.payment.provider) : "") +
      (order.payment.last4 ? " · " + escapeHTML(order.payment.brand || "Card") + " ending in " + escapeHTML(order.payment.last4) : "");
  } else {
    paymentDescription = cashOnDelivery ? "Cash on delivery" : "E-wallet — " + escapeHTML(order.payment.provider);
  }
  const address = [
    order.customer.address,
    order.customer.city,
    order.customer.province,
    order.customer.postalCode,
  ].join(", ");
  return (
    '<article class="receipt-sheet"><header><h2>The Petal Haus</h2><p>ORDER RECEIPT</p><strong>' +
    escapeHTML(order.reference) +
    "</strong><p>" +
    escapeHTML(new Date(order.date).toLocaleString("en-PH")) +
    '</p></header><div class="receipt-customer"><h3>Deliver to</h3><p>' +
    escapeHTML(order.customer.name) +
    "<br>" +
    escapeHTML(address) +
    "<br>" +
    escapeHTML(order.customer.phone) +
    "<br>" +
    escapeHTML(order.customer.email) +
    "</p><p>Status: <strong>" +
    escapeHTML(order.status) +
    "</strong></p><p>Payment: " +
    paymentDescription +
    (order.payment.mode === "demo" ? " · <strong>Unpaid</strong>" : "") +
    "</p></div><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>" +
    order.items
      .map(function (line) {
        return (
          "<tr><td><strong>" +
          escapeHTML(line.name) +
          "</strong><small>" +
          escapeHTML(line.details || "") +
          "</small></td><td>" +
          line.quantity +
          "</td><td>₱" +
          money(line.unitPrice) +
          "</td><td>₱" +
          money(line.quantity * line.unitPrice) +
          "</td></tr>"
        );
      })
      .join("") +
    '</tbody></table><dl class="receipt-charges"><div><dt>Subtotal</dt><dd>₱' +
    money(Number.isFinite(order.subtotal) ? order.subtotal : PetalStore.total(order.items)) +
    '</dd></div><div><dt>Delivery fee</dt><dd>₱' + money(order.delivery?.fee || 0) +
    '</dd></div></dl><p class="receipt-grand-total">' + totalLabel + ": ₱" +
    money(order.total) +
    "</p></article>"
  );
}
function currentReceiptOrder() {
  const reference = new URLSearchParams(location.search).get("reference");
  return reference ? PetalStore.getOrder(reference) : PetalStore.orders()[0];
}
function renderReceiptPage() {
  const order = currentReceiptOrder();
  const container = document.getElementById("receipt-content");
  if (!order) {
    container.innerHTML =
      '<p>No receipt was found for your account. <a href="cart.html">Return to your cart.</a></p><div class="receipt-actions"><a class="pill green" href="index.html" data-receipt-home>Back to home</a></div>';
    return;
  }
  container.innerHTML =
    receiptMarkup(order) +
    '<div class="receipt-actions"><button class="pill" type="button" data-print-receipt>Print / save as PDF</button><button class="pill green" type="button" data-download-receipt>Download receipt</button><a class="pill" href="feedback.html">Write a review</a><a class="pill green" href="index.html" data-receipt-home>Back to home</a></div>';
  const url = new URL(location.href);
  if (url.searchParams.get("placed") === "1" && url.searchParams.get("reference") === order.reference) {
    url.searchParams.delete("placed");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    showSuccess("Successfully placed your order! Thank you!", "#receipt-content", "VIEW RECEIPT");
    celebrateOrder();
  }
}
function downloadReceipt() {
  const order = currentReceiptOrder();
  if (!order) return;
  const html =
    '<!DOCTYPE html><html lang="en"><meta charset="UTF-8"><title>' +
    escapeHTML(order.reference) +
    "</title><style>body{font:16px/1.5 Georgia,serif;max-width:900px;margin:30px auto;padding:20px;color:#344a25}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:12px;text-align:left}small{display:block}.receipt-grand-total{font-size:24px;font-weight:bold}.receipt-charges>div{display:flex;justify-content:space-between;gap:16px}.receipt-charges dd{margin:0}</style><body>" +
    receiptMarkup(order) +
    "</body></html>";
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = order.reference + ".html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}
function renderNotificationsPage() {
  const notes = PetalStore.notifications();
  document.getElementById("notification-list").innerHTML =
    notes
      .map(function (note) {
        let link = "";
        if (note.kind === "order" && note.reference)
          link =
            '<a href="receipt.html?reference=' +
            encodeURIComponent(note.reference) +
            '">View order</a>';
        else if (note.kind === "stock")
          link = '<a href="cart.html">Open cart</a>';
        else if (note.kind === "new")
          link =
            '<a href="collections.html?section=new-arrival">See new arrivals</a>';
        else if (note.kind === "inquiry")
          link = '<a href="contact.html">View inquiry</a>';
        return (
          '<article class="notification-card"><p>' +
          escapeHTML(note.message) +
          "</p><small>" +
          escapeHTML(new Date(note.date).toLocaleString("en-PH")) +
          "</small>" +
          link +
          "</article>"
        );
      })
      .join("") || '<p class="empty-state">You do not have current notifications</p>';
  try { PetalStore.readNotifications(); } catch {}
  refreshCartUI();
}
function renderCustomerInquiries() {
  const list = PetalStore.inquiries().filter(function (inquiry) {
    return inquiry.owner === PetalStore.owner();
  });
  document.querySelector(".saved-inquiries").hidden = !list.length;
  document.getElementById("customer-inquiries").innerHTML =
    list
      .map(function (inquiry) {
        return (
          '<article class="notification-card"><h3>' +
          escapeHTML(inquiry.subject) +
          "</h3><p>" +
          escapeHTML(inquiry.message) +
          "</p><small>" +
          escapeHTML(inquiry.id) +
          " · " +
          escapeHTML(inquiry.status) +
          "</small>" +
          (inquiry.reply
            ? "<p><strong>Reply to " +
              escapeHTML(inquiry.email) +
              ":</strong><br>" +
              escapeHTML(inquiry.reply) +
              "</p>"
            : "") +
          "</article>"
        );
      })
      .join("") || "<p>You have no saved inquiries.</p>";
}
function submitInquiry(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById("contact-status");
  if (!validateTextFields(form, ["firstName", "lastName", "message"])) {
    status.textContent = "Enter your first name, last name and message. Fields cannot contain only spaces.";
    form.reportValidity();
    return;
  }
  if (!/^[0-9]{11}$/.test(formValue(form, "phone"))) {
    status.textContent = "Enter exactly 11 digits for your mobile number.";
    return;
  }
  if (typeof form.reportValidity === "function" && !form.reportValidity()) return;
  const details = {};
  for (const name of ["email", "phone", "type", "subject", "message"]) details[name] = formValue(form, name);
  details.name = [formValue(form, "firstName"), formValue(form, "lastName")].join(" ");
  try {
    const inquiry = PetalStore.saveInquiry(details);
    status.textContent = "Your inquiry " + inquiry.id + " has been saved.";
    form.reset();
    renderCustomerInquiries();
    showSuccess("Successfully submitted your inquiry!", "#contact-details", "Contact details");
  } catch (error) { status.textContent = error.message; }
}
let editingReviewReference = "";
function resetReviewForm() {
  const form = document.getElementById("review-form");
  editingReviewReference = "";
  form.reset();
  const user = PetalStore.session();
  if (user) {
    form.elements.namedItem("reviewName").value = user.name;
    form.elements.namedItem("reviewEmail").value = user.email;
  }
  updateReviewEligibility();
  updateReviewPresentation();
}
function beginReviewEdit(reference) {
  const review = PetalStore.editableReview(reference);
  const status = document.getElementById("review-status");
  if (!review) { status.textContent = "Log in to edit your own review for an active order."; return; }
  const form = document.getElementById("review-form");
  editingReviewReference = reference;
  form.elements.namedItem("reviewName").value = (review.anonymous ?? review.name === "Anonymous Person") ? PetalStore.session().name : review.name;
  form.elements.namedItem("reviewEmail").value = PetalStore.session().email;
  form.elements.namedItem("message").value = review.message;
  form.elements.namedItem("anonymous").checked = review.anonymous ?? review.name === "Anonymous Person";
  for (const input of form.querySelectorAll('[name="rating"]')) input.checked = Number(input.value) === review.rating;
  status.textContent = "";
  updateReviewEligibility();
  updateReviewPresentation();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.namedItem("message").focus({ preventScroll: true });
}
function updateReviewEligibility() {
  const orderSelect = document.getElementById("review-order");
  const submit = document.getElementById("review-submit");
  const cancel = document.getElementById("review-cancel-edit");
  if (editingReviewReference) {
    const review = PetalStore.editableReview(editingReviewReference);
    orderSelect.innerHTML = '<option value="' + escapeHTML(editingReviewReference) + '">' + escapeHTML(editingReviewReference) + '</option>';
    orderSelect.value = editingReviewReference;
    orderSelect.closest("label").hidden = false;
    orderSelect.disabled = true;
    orderSelect.required = false;
    submit.textContent = "Save changes";
    cancel.hidden = false;
    document.getElementById("review-account-actions").hidden = PetalStore.hasProfile();
    document.getElementById("review-eligibility").textContent = review
      ? "Editing your review for order " + review.reference + "."
      : "This review can no longer be edited. Log in to its account or cancel editing.";
    return review ? [PetalStore.getOrder(review.reference)] : [];
  }
  submit.textContent = "Submit review";
  cancel.hidden = true;
  const eligible = PetalStore.eligibleOrders();
  const selectedReference = orderSelect.value;
  orderSelect.innerHTML =
    '<option value="">Choose an order</option>' +
    eligible.map(function (order) {
      return '<option value="' + escapeHTML(order.reference) + '">' +
        escapeHTML(order.reference) + " — " +
        escapeHTML(order.items.map(function (item) { return item.name; }).join(", ")) +
        "</option>";
    }).join("");
  orderSelect.closest("label").hidden = eligible.length <= 1;
  orderSelect.disabled = !eligible.length;
  orderSelect.required = eligible.length > 1;
  if (eligible.length === 1) orderSelect.value = eligible[0].reference;
  else if (eligible.some(function (order) { return order.reference === selectedReference; }))
    orderSelect.value = selectedReference;
  document.getElementById("review-submit").disabled = false;
  const hasProfile = PetalStore.hasProfile();
  document.getElementById("review-account-actions").hidden = hasProfile;
  document.getElementById("review-eligibility").textContent = !hasProfile
    ? "Log in or create a profile, then place an order to submit feedback."
    : eligible.length
      ? (eligible.length === 1 ? "Your order is selected." : "Choose an order.") + " One review per order."
      : PetalStore.orders().some(function (order) { return order.status !== "Cancelled"; })
        ? "You have already reviewed your orders. You can edit your reviews below."
        : "Place an order before submitting feedback. You can choose a rating and write your review now.";
  return eligible;
}
function submitBuyerReview(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById("review-status");
  const eligible = updateReviewEligibility();
  if (!PetalStore.hasProfile() || !eligible.length) {
    status.textContent = document.getElementById("review-eligibility").textContent;
    return;
  }
  updateReviewPresentation();
  const rating = Number(form.querySelector('[name="rating"]:checked')?.value || 0);
  if (!rating) {
    status.textContent = "Choose a star rating before submitting your review.";
    form.querySelector('[name="rating"]').focus();
    return;
  }
  if (typeof form.reportValidity === "function" && !form.reportValidity()) {
    status.textContent = "Complete the required fields and enter a valid email address.";
    return;
  }
  try {
    const editing = !!editingReviewReference;
    const saveReview = editing ? PetalStore.updateReview : PetalStore.submitReview;
    saveReview(
      editingReviewReference || formValue(form, "reference"), rating, formValue(form, "message"),
      { name: formValue(form, "reviewName"), anonymous: form.elements.namedItem("anonymous").checked },
    );
    status.textContent = editing ? "Your review changes are now displayed below." : "Your review is now displayed below.";
    resetReviewForm();
    renderPublicReviews();
    refreshCartUI();
    showSuccess(editing ? "Successfully updated your review!" : "Successfully submitted your review!", "#published-reviews", "VIEW REVIEWS");
  } catch (error) {
    status.textContent = error.message;
  }
}
function initializePages() {
  if (page === "cart") renderCartPage();
  if (page === "checkout") {
    initializeCheckoutPayment();
    renderCheckoutPage();
    setInterval(updateOrderHours, 15000);
    window.addEventListener("focus", updateOrderHours);
    document.addEventListener("visibilitychange", updateOrderHours);
  }
  if (page === "receipt") renderReceiptPage();
  if (page === "notifications") renderNotificationsPage();
  if (page === "contact") renderCustomerInquiries();
  if (page === "feedback") {
    updateReviewEligibility();
    const user = PetalStore.session();
    const form = document.getElementById("review-form");
    if (user) {
      form.elements.namedItem("reviewName").value = user.name;
      form.elements.namedItem("reviewEmail").value = user.email;
    }
    updateReviewPresentation();
  }
  if (page === "profile") {
    initializeProfile();
    const securityForm = document.getElementById("profile-security-form");
    initializeSecurityQuestions(securityForm, PetalStore.session()?.recoveryQuestions);
  }
  if (page === "search") {
    const query = new URLSearchParams(location.search).get("q") || "";
    document.getElementById("page-search-input").value = query;
    searchProducts("page-search-input", "page-search-results");
  }
  renderRecentSearches();
}
document.addEventListener("click", function (event) {
  const button = event.target.closest("button,a");
  if (!button) return;
  if (button.hasAttribute("data-edit-review")) {
    beginReviewEdit(button.dataset.editReview);
  } else if (button.hasAttribute("data-cancel-review-edit")) {
    resetReviewForm();
    document.getElementById("review-status").textContent = "Review editing cancelled.";
  } else if (button.hasAttribute("data-cart-adjust")) {
    const input = button.closest("[data-line-id]").querySelector("[data-line-quantity]");
    input.value = boundedQuantity(Number(input.value) + Number(button.dataset.cartAdjust), 1, 99);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (button.dataset.deleteLine) {
    try { PetalStore.removeLine(button.dataset.deleteLine); renderCartPage(); }
    catch (error) { document.getElementById("cart-page-note").textContent = error.message; }
  } else if (
    button.id === "proceed-checkout" &&
    button.getAttribute("aria-disabled") === "true"
  )
    event.preventDefault();
  else if (button.hasAttribute("data-print-receipt")) window.print();
  else if (button.hasAttribute("data-download-receipt")) downloadReceipt();
  else if (button.dataset.galleryPhoto) {
    const img = document.getElementById("full-gallery-photo");
    img.src = button.dataset.galleryPhoto;
    img.alt = button.querySelector("img").alt;
    openDialog("photo-dialog");
  }
});
document.addEventListener("input", function (event) {
  const input = event.target;
  if (input.closest("#contact-form") && input.name === "phone")
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 11);
  if (input.hasAttribute("data-line-quantity")) {
    const row = input.closest("[data-line-id]");
    const value = Number(input.value);
    const valid = Number.isInteger(value) && value >= 1 && value <= 99;
    if (!valid) {
      document.getElementById("cart-page-note").textContent =
        "Enter a whole quantity from 1 to 99.";
      const proceed = document.getElementById("proceed-checkout");
      proceed.setAttribute("aria-disabled", "true");
      proceed.tabIndex = -1;
      return;
    }
    try { PetalStore.updateLine(row.dataset.lineId, { quantity: value }); }
    catch (error) {
      renderCartPage();
      document.getElementById("cart-page-note").textContent = error.message;
      return;
    }
    const item = PetalStore.getCart().find(function (line) {
      return line.lineId === row.dataset.lineId;
    });
    if (!item) { renderCartPage(); return; }
    row.querySelector("[data-line-total]").textContent =
      "₱" + money(item.quantity * item.unitPrice);
    updateCartPageTotal();
  }
});
document.addEventListener("submit", function (event) {
  if (event.target.id === "checkout-form") submitCheckout(event);
  if (event.target.id === "contact-form") submitInquiry(event);
  if (event.target.id === "review-form") submitBuyerReview(event);
});

document.addEventListener("click", function (event) {
  if (!event.target.closest("[data-clear-recent-searches]")) return;
  try { PetalStore.write("petal-recent-searches:" + PetalStore.owner(), []); renderRecentSearches(); }
  catch (error) { toast(error.message); }
});
// Search suggestions and recent searches are shared by the page and popup.
function renderRecentSearches() {
  const stored = PetalStore.read("petal-recent-searches:" + PetalStore.owner(), []);
  const queries = Array.isArray(stored) ? stored.filter(query => typeof query === "string").slice(0, 6) : [];
  for (const container of document.querySelectorAll("[data-recent-searches]"))
    container.innerHTML = queries.length
      ? queries.map(query => '<button type="button" data-search-query="' + escapeHTML(query) + '">' + escapeHTML(query) + '</button>').join("") +
        '<button type="button" class="clear-recent-searches" data-clear-recent-searches>CLEAR ALL</button>'
      : '<p>No recent searches yet.</p>';
}
function rememberSearch(value) {
  const query = value.trim().slice(0, 80);
  if (!query) return;
  const key = "petal-recent-searches:" + PetalStore.owner();
  const stored = PetalStore.read(key, []);
  const queries = Array.isArray(stored) ? stored : [];
  PetalStore.write(key, [query, ...queries.filter(item => typeof item === "string" && item.toLowerCase() !== query.toLowerCase())].slice(0, 6));
  renderRecentSearches();
}
function updateReviewPresentation() {
  const form = document.getElementById("review-form");
  if (!form) return;
  const message = form.elements.namedItem("message").value;
  document.getElementById("review-character-count").textContent = message.length + "/1000 characters";
  const rating = Number(form.querySelector('[name="rating"]:checked')?.value || 0);
  for (const star of form.querySelectorAll(".rating-star")) {
    const radio = star.querySelector("input");
    star.classList.toggle("selected", Number(radio.value) <= rating);
  }
  document.getElementById("review-rating-value").textContent = rating
    ? rating + " out of 5 stars"
    : "Choose a star rating";
  const anonymous = form.elements.namedItem("anonymous").checked;
  const nameInput = form.elements.namedItem("reviewName");
  nameInput.required = !anonymous;
  nameInput.disabled = anonymous;
  nameInput.closest("label").hidden = anonymous;
  form.classList.toggle("anonymous-review", anonymous);
}
function initializeProfile() {
  const user = PetalStore.session();
  document.getElementById("profile-layout").hidden = !user;
  document.getElementById("profile-signin-note").hidden = !!user;
  if (!user) return;
  refreshAccountUI();
  for (const name of document.querySelectorAll("[data-profile-name]")) name.textContent = user.name;
  for (const email of document.querySelectorAll("[data-profile-email]")) email.textContent = user.email;
  document.getElementById("profile-bio").textContent = user.bio || "Your Bio";
  document.getElementById("profile-phone").textContent = user.phone || "—";
  document.getElementById("profile-address").textContent = user.address || "—";
  const orders = PetalStore.orders();
  const joined = user.createdAt || orders.at(-1)?.date;
  document.getElementById("profile-member-since").textContent = joined
    ? new Date(joined).toLocaleDateString("en-PH", { month: "long", year: "numeric" }) : "—";
  document.getElementById("profile-orders").textContent = String(orders.length);
  const form = document.getElementById("profile-edit-form");
  for (const field of ["name", "bio", "phone"]) form.elements.namedItem(field).value = user[field] || "";
  const address = defaultAddressFields(user);
  for (const field of deliveryAddressFields) form.elements.namedItem(field).value = address[field];
}
function saveProfile(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById("profile-status");
  if (!validateTextFields(form, ["name"])) {
    status.textContent = "Enter your name. It cannot contain only spaces.";
    form.reportValidity();
    return;
  }
  const phone = formValue(form, "phone");
  if (phone && !isValidPhone(phone)) {
    status.textContent = "Enter a valid phone number with 7 to 15 digits.";
    return;
  }
  if (!form.reportValidity()) return;
  const current = PetalStore.session();
  if (!current) return;
  const user = { ...current };
  for (const field of ["name", "bio", "phone"]) user[field] = formValue(form, field);
  user.defaultAddress = Object.fromEntries(deliveryAddressFields.map(field => [field, formValue(form, field)]));
  user.address = [
    [user.defaultAddress.houseNumber, user.defaultAddress.street].filter(Boolean).join(" "),
    ...["barangay", "city", "province", "postalCode"].map(field => user.defaultAddress[field]),
  ].filter(Boolean).join(", ");
  const profiles = PetalStore.read("petal-profiles", []);
  const index = profiles.findIndex(profile => profile.id === user.id);
  if (index >= 0) profiles[index] = user;
  else profiles.push(user);
  try {
    PetalStore.writeMany({ "petal-profiles": profiles, "petal-session": user });
    form.hidden = true;
    document.getElementById("edit-profile").setAttribute("aria-expanded", "false");
    initializeProfile();
    status.textContent = "Profile saved.";
  } catch (error) { status.textContent = error.message; }
}

let profilePhotoSaving = false;
function persistProfilePhoto(photo, userId) {
  const current = PetalStore.session();
  if (!current || current.id !== userId) throw new Error("Please sign in again to change your photo.");
  const user = { ...current, photo };
  const profiles = PetalStore.read("petal-profiles", []).map(profile => profile.id === userId ? user : profile);
  if (!profiles.some(profile => profile.id === userId)) profiles.push(user);
  try {
    PetalStore.writeMany({ "petal-profiles": profiles, "petal-session": user });
  } catch (error) {
    throw new Error("There is not enough browser storage to save this photo. Please choose a smaller photo.");
  }
  refreshAccountUI();
}

async function changeProfilePhoto(file) {
  const user = PetalStore.session();
  if (!file || !user || profilePhotoSaving) return;
  const status = document.getElementById("profile-photo-status");
  const input = document.getElementById("profile-photo-input");
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    status.textContent = "Choose a JPG, PNG, WebP, or GIF photo.";
    input.value = "";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    status.textContent = "Please choose a photo smaller than 10 MB.";
    input.value = "";
    return;
  }
  profilePhotoSaving = true;
  const buttons = document.querySelectorAll("#change-profile-photo,#remove-profile-photo");
  for (const button of buttons) button.disabled = true;
  status.textContent = "Saving your photo…";
  try {
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read that photo. Please choose another image."));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("That image could not be opened. Please choose another photo."));
      image.src = source;
    });
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    persistProfilePhoto(canvas.toDataURL("image/jpeg", 0.85), user.id);
    status.textContent = "Profile photo saved.";
  } catch (error) {
    status.textContent = error.message || "Could not save that photo. Please try again.";
  } finally {
    profilePhotoSaving = false;
    input.value = "";
    for (const button of buttons) button.disabled = false;
  }
}

document.addEventListener("click", function (event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-profile-tab")) {
    showProfileTab(button.dataset.profileTab);
  } else if (button.hasAttribute("data-search-query")) {
    const onPage = !!button.closest(".search-page");
    const inputId = onPage ? "page-search-input" : "search-input";
    const resultId = onPage ? "page-search-results" : "search-results";
    document.getElementById(inputId).value = button.dataset.searchQuery;
    searchProducts(inputId, resultId);
    rememberSearch(button.dataset.searchQuery);
    document.getElementById(inputId).focus();
  } else if (button.id === "edit-profile") {
    const form = document.getElementById("profile-edit-form");
    form.hidden = !form.hidden;
    button.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) form.elements.namedItem("name").focus();
  } else if (button.id === "password-help") {
    showProfileTab("password");
  } else if (button.id === "change-profile-photo") {
    document.getElementById("profile-photo-input").click();
  } else if (button.id === "remove-profile-photo") {
    const user = PetalStore.session();
    if (!user || profilePhotoSaving) return;
    const status = document.getElementById("profile-photo-status");
    try {
      persistProfilePhoto("", user.id);
      status.textContent = "Profile photo removed.";
    } catch (error) {
      status.textContent = error.message;
    }
  }
});
document.addEventListener("input", function (event) {
  if (event.target.closest("#review-form")) updateReviewPresentation();
});
document.addEventListener("change", function (event) {
  if (event.target.closest("#review-form")) updateReviewPresentation();
  if (event.target.id === "profile-photo-input") changeProfilePhoto(event.target.files[0]);
});
document.addEventListener("submit", function (event) {
  if (event.target.id === "profile-edit-form") saveProfile(event);
});

function showProfileTab(tab) {
  for (const panel of document.querySelectorAll("[data-profile-panel]")) panel.hidden = panel.dataset.profilePanel !== tab;
  for (const control of document.querySelectorAll(".profile-nav button")) {
    control.classList.toggle("active", (control.dataset.profileTab || "password") === tab);
  }
  if (tab === "security") {
    const user = PetalStore.session();
    document.getElementById("security-account-note").textContent = !user?.passwordRecord
      ? "Set a password in Change Password first, then add your recovery questions here."
      : hasAccountRecovery(user)
        ? "Security questions are set. Enter your current password and two new answers to replace them. Recovery works in this browser on this website address."
        : "Add security questions now so you can reset a forgotten password in this browser on this website address.";
  }
  if (tab === "password") {
    const hasPassword = !!PetalStore.session()?.passwordRecord;
    const field = document.getElementById("current-password-field");
    field.hidden = !hasPassword;
    field.querySelector("input").required = hasPassword;
    document.getElementById("password-account-note").textContent = hasPassword ? "" : "Set a password for this saved account. Use at least 8 characters, one uppercase letter, and one special character.";
  }
}
async function saveProfilePassword(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById("password-status");
  if (form.querySelector('[type="submit"]').disabled) return;
  const password = form.elements.namedItem("newPassword").value;
  const confirm = form.elements.namedItem("confirmPassword").value;
  const passwordInput = form.elements.namedItem("newPassword");
  const strong = isStrongAccountPassword(password);
  passwordInput.setCustomValidity?.(strong ? "" : "Use at least 8 characters, one uppercase letter, and one special character.");
  if (!strong) {
    status.textContent = "Use at least 8 characters, one uppercase letter, and one special character.";
    form.reportValidity();
    return;
  }
  if (password !== confirm) { status.textContent = "The new passwords must match."; return; }
  if (!form.reportValidity()) return;
  const user = PetalStore.session();
  if (!user) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    if (user.passwordRecord && !(await verifyAccountPassword(form.elements.namedItem("currentPassword").value, user.passwordRecord))) {
      status.textContent = "Your current password is incorrect."; return;
    }
    const passwordRecord = await makeAccountPassword(password);
    commitAccountSecurity(user, { passwordRecord }, true);
    form.reset();
    status.textContent = "Password saved.";
    showProfileTab("password");
  } catch (error) { status.textContent = error.message || "Could not save the password. Please try again."; }
  finally { submit.disabled = false; }
}
document.addEventListener("submit", function (event) {
  if (event.target.id === "profile-password-form") saveProfilePassword(event);
});

document.addEventListener("input", function (event) {
  if (event.target.matches("input,textarea")) event.target.setCustomValidity?.("");
});
window.addEventListener("storage", function (event) {
  if (event.key !== null && !event.key?.startsWith("petal-")) return;
  if (page === "checkout") refreshCheckoutSavedData();
  if (page === "cart") renderCartPage();
  refreshAccountUI();
  refreshCartUI();
  if (event.key === null || ["petal-reviews", "petal-orders", "petal-session", "petal-profiles"].includes(event.key)) {
    renderPublicReviews();
    if (page === "feedback") updateReviewEligibility();
  }
  if (event.key === "petal-stock") {
    initializeShop();
    if (page === "search") searchProducts("page-search-input", "page-search-results");
    if (document.getElementById("search-dialog")?.open) searchProducts();
  }
});
window.addEventListener("focus", function () { refreshCheckoutSavedData(); });
window.addEventListener("pageshow", function () { refreshCheckoutSavedData(); });

async function submitProfileSecurity(event) {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('[type="submit"]');
  if (submit.disabled) return;
  const questions = readSecurityQuestions(form);
  if (!form.reportValidity() || !questions) return;
  const status = document.getElementById("security-status");
  submit.disabled = true;
  status.textContent = "Saving your security questions…";
  try {
    await saveAccountRecovery(questions, form.elements.namedItem("currentPassword").value);
    form.elements.namedItem("currentPassword").value = "";
    for (const answer of form.querySelectorAll("[data-security-answer]")) answer.value = "";
    status.textContent = "Security questions saved. You can now reset a forgotten password from the login page.";
    showProfileTab("security");
  } catch (error) {
    status.textContent = error.message || "Could not save your security questions. Please try again.";
  } finally { submit.disabled = false; }
}
document.addEventListener("submit", function (event) {
  if (event.target.id === "profile-security-form") submitProfileSecurity(event);
});
