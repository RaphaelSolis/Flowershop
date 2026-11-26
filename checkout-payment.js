"use strict";
/* Demo card entry. Never pass full card details to the store or browser storage.
   Live payments require a payment gateway with hosted/tokenized card fields. */
function checkoutCardBrand(number) {
  if (/^4(?:[0-9]{12}|[0-9]{15}|[0-9]{18})$/.test(number)) return "Visa";
  const prefix = Number(number.slice(0, 4));
  if (number.length === 16 && (/^5[1-5]/.test(number) || (prefix >= 2221 && prefix <= 2720)))
    return "Mastercard";
  return "";
}
function checkoutCardChecksum(number) {
  let sum = 0;
  let double = false;
  for (let index = number.length - 1; index >= 0; index--) {
    let digit = Number(number[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum > 0 && sum % 10 === 0;
}
function checkoutCardIssue(input, now = new Date()) {
  const value = input.value.trim();
  if (input.name === "cardholderName")
    return value.length >= 2 && /\p{L}/u.test(value) ? "" : "Enter the name on the card.";
  if (input.name === "cardNumber") {
    const number = value.replace(/\s/g, "");
    return checkoutCardBrand(number) && checkoutCardChecksum(number)
      ? "" : "Enter a valid Visa or Mastercard number.";
  }
  if (input.name === "cardExpiry") {
    const expiry = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.exec(value);
    if (!expiry) return "Enter the expiry as MM/YY.";
    const year = 2000 + Number(expiry[2]);
    return year > now.getFullYear() || (year === now.getFullYear() && Number(expiry[1]) >= now.getMonth() + 1)
      ? "" : "This card has expired. Use a future expiry.";
  }
  if (input.name === "cardCvv") return /^[0-9]{3}$/.test(value) ? "" : "Enter the 3-digit CVV.";
  return "";
}
function validateCheckoutCardField(input) {
  const issue = input.matches(":disabled") ? "" : checkoutCardIssue(input);
  input.setCustomValidity(issue);
  input.setAttribute("aria-invalid", String(!!issue));
  document.getElementById(input.name + "-error").textContent = issue;
  return !issue;
}
function clearCheckoutCardDetails() {
  for (const input of document.querySelectorAll("[data-card-field]")) {
    input.value = "";
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
    document.getElementById(input.name + "-error").textContent = "";
  }
  document.getElementById("card-payment-summary").hidden = true;
  const dialog = document.getElementById("card-entry-dialog");
  if (dialog.open) closeDialog(dialog);
}
function updateCheckoutPayment() {
  const form = document.getElementById("checkout-form");
  const method = form.elements.namedItem("payment").value;
  const card = method === "credit-card";
  const wallet = method === "e-wallet";
  const details = document.getElementById("card-details");
  details.disabled = !card;
  const providers = document.querySelectorAll('[name="cardProvider"]');
  if (card && !form.elements.namedItem("cardProvider").value) providers[0].checked = true;
  for (const provider of providers) {
    provider.required = card;
    if (!card) provider.checked = false;
  }
  if (!card) clearCheckoutCardDetails();
  document.getElementById("wallet-provider-field").hidden = !wallet;
  const walletProvider = form.elements.namedItem("provider");
  walletProvider.disabled = !wallet;
  walletProvider.required = wallet;
  if (!wallet) walletProvider.value = "";
}
function openCheckoutCardDialog() {
  document.querySelector('[name="payment"][value="credit-card"]').checked = true;
  updateCheckoutPayment();
  const provider = document.getElementById("checkout-form").elements.namedItem("cardProvider").value;
  document.getElementById("card-entry-title").textContent = provider === "BPI" ? "BPI card details" : "Card details";
  openDialog("card-entry-dialog");
}
function validateCheckoutPayment() {
  const form = document.getElementById("checkout-form");
  if (form.elements.namedItem("payment").value !== "credit-card") return true;
  let valid = true;
  for (const input of document.querySelectorAll("[data-card-field]")) {
    if (!validateCheckoutCardField(input)) valid = false;
  }
  if (!valid) {
    openCheckoutCardDialog();
    document.getElementById("card-entry-form").reportValidity();
  }
  return valid;
}
function checkoutPaymentDetails() {
  const form = document.getElementById("checkout-form");
  const method = form.elements.namedItem("payment").value;
  if (method !== "credit-card")
    return { method, provider: form.elements.namedItem("provider").value, mode: "demo" };
  const cardForm = document.getElementById("card-entry-form");
  const number = cardForm.elements.namedItem("cardNumber").value.replace(/\s/g, "");
  return {
    method, provider: form.elements.namedItem("cardProvider").value, mode: "demo",
    brand: checkoutCardBrand(number), last4: number.slice(-4),
  };
}
function formatCheckoutCardInput(input) {
  if (!["cardNumber", "cardExpiry", "cardCvv"].includes(input.name)) return;
  const digitsBeforeCaret = input.value.slice(0, input.selectionStart).replace(/[^0-9]/g, "").length;
  const digits = input.value.replace(/[^0-9]/g, "");
  let formatted;
  if (input.name === "cardNumber") formatted = digits.slice(0, 19).replace(/(.{4})(?=.)/g, "$1 ");
  else if (input.name === "cardExpiry") {
    const expiry = digits.slice(0, 4);
    formatted = expiry.length > 2 ? expiry.slice(0, 2) + "/" + expiry.slice(2) : expiry;
  } else formatted = digits.slice(0, 3);
  input.value = formatted;
  let caret = 0;
  let counted = 0;
  while (caret < formatted.length && counted < digitsBeforeCaret) {
    if (/[0-9]/.test(formatted[caret])) counted++;
    caret++;
  }
  input.setSelectionRange(caret, caret);
}
function initializeCheckoutPayment() {
  updateCheckoutPayment();
  document.addEventListener("change", function (event) {
    if (event.target.name === "cardProvider") {
      document.querySelector('[name="payment"][value="credit-card"]').checked = true;
      updateCheckoutPayment();
      openCheckoutCardDialog();
    } else if (event.target.name === "payment") {
      updateCheckoutPayment();
      if (event.target.value === "credit-card") openCheckoutCardDialog();
    }
  });
  document.addEventListener("click", function (event) {
    if (event.target.name === "cardProvider" || event.target.closest("#edit-card-details"))
      openCheckoutCardDialog();
  });
  document.addEventListener("input", function (event) {
    const input = event.target;
    if (!input.matches("[data-card-field]")) return;
    formatCheckoutCardInput(input);
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
    document.getElementById(input.name + "-error").textContent = "";
    document.getElementById("card-payment-summary").hidden = true;
  });
  document.addEventListener("focusout", function (event) {
    if (event.target.matches("[data-card-field]")) validateCheckoutCardField(event.target);
  });
  document.addEventListener("invalid", function (event) {
    if (event.target.matches("[data-card-field]")) validateCheckoutCardField(event.target);
  }, true);
  document.getElementById("card-entry-form").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validateCheckoutPayment()) return;
    const payment = checkoutPaymentDetails();
    document.getElementById("card-payment-label").textContent = payment.brand + " ending in " + payment.last4;
    document.getElementById("card-payment-summary").hidden = false;
    closeDialog(document.getElementById("card-entry-dialog"));
  });
  // Also clear values kept in the browser's back/forward page cache.
  window.addEventListener("pagehide", clearCheckoutCardDetails);
  window.addEventListener("pageshow", updateCheckoutPayment);
}
