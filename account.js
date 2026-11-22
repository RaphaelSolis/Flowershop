"use strict";
/* ACCOUNT FORMS — save the active browser profile and return to the home page. */
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  if (!form) return;
  const isSignup = !!form.elements.namedItem("fname");
  const isRecovery = form.id === "password-recovery-form";
  const returnToCheckout = new URLSearchParams(location.search).get("next") === "checkout";
  if (returnToCheckout) {
    if (!isRecovery) document.getElementById("account-status").textContent =
      "Create a profile or sign in to continue to checkout. Your cart is saved.";
    for (const link of document.querySelectorAll(".signup a, .account-switch a, .forgot, #recovery-login"))
      link.href = link.getAttribute("href") + "?next=checkout";
  }
  const passwordInput = form.elements.namedItem("password");
  const confirmationInput = form.elements.namedItem("confirmPassword");
  for (const button of form.querySelectorAll("[data-password-toggle]")) {
    button.addEventListener("click", function () {
      const input = document.getElementById(button.dataset.passwordToggle);
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-pressed", String(reveal));
      const label = reveal ? "Hide password" : "Show password";
      button.setAttribute("aria-label", label);
      button.title = label;
    });
  }
  if (isRecovery) { initializePasswordRecovery(form); return; }
  if (isSignup) initializeSecurityQuestions(form);
  function validateSignupPasswords() {
    if (!isSignup) return true;
    const password = passwordInput.value;
    const confirmation = confirmationInput.value;
    const strongPassword = isStrongAccountPassword(password);
    passwordInput.setCustomValidity(password && !strongPassword
      ? "Use at least 8 characters, one uppercase letter, and one special character."
      : "");
    const confirmationError = confirmation && confirmation !== password
      ? "Passwords do not match. Enter the same password in both fields."
      : "";
    confirmationInput.setCustomValidity(confirmationError);
    confirmationInput.setAttribute("aria-invalid", String(!!confirmationError));
    document.getElementById("password-confirm-error").textContent = confirmationError;
    return strongPassword && !!confirmation && confirmation === password;
  }
  if (isSignup) {
    passwordInput.addEventListener("input", validateSignupPasswords);
    confirmationInput.addEventListener("input", validateSignupPasswords);
  }
  let submitting = false;
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (submitting) return;
    const passwordsValid = validateSignupPasswords();
    const questions = isSignup ? readSecurityQuestions(form) : null;
    if (!form.reportValidity() || !passwordsValid || (isSignup && !questions)) return;
    const status = document.getElementById("account-status");
    const email = form.elements.namedItem("email").value.trim().toLowerCase();
    const password = form.elements.namedItem("password").value;
    const firstName = form.elements.namedItem("fname")?.value.trim();
    const lastName = form.elements.namedItem("lname")?.value.trim() || "";
    if (isSignup && (!firstName || !lastName)) {
      status.textContent = "Enter your first and last name.";
      return;
    }
    const mobile = form.elements.namedItem("mobile")?.value.trim();
    if (isSignup && !isValidPhone(mobile)) {
      status.textContent = "Enter a valid phone number with 7 to 15 digits.";
      return;
    }
    const name = firstName ? firstName + " " + lastName : email.split("@")[0];
    const profiles = PetalStore.read("petal-profiles", []);
    const existing = profiles.find(profile => profile.email === email);
    if (isSignup && existing) { status.textContent = "This email already has an account. Please sign in."; return; }
    if (!isSignup && !existing) { status.textContent = "No account found with that email. Please sign up first."; return; }
    status.textContent = isSignup ? "Creating your account…" : "Signing in…";
    submitting = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      if (existing && !existing.passwordRecord) {
        status.textContent = "This account needs a password reset. Please contact us for help accessing your account.";
        return;
      }
      if (existing && !(await verifyAccountPassword(password, existing.passwordRecord))) {
        status.textContent = "The password is incorrect.";
        return;
      }
      const record = existing?.passwordRecord || await makeAccountPassword(password);
      const recoveryQuestions = isSignup ? await makeAccountRecovery(questions) : null;
      if (isSignup && PetalStore.read("petal-profiles", []).some(profile => profile.email === email))
        throw new Error("This email already has an account. Please sign in.");
      if (!isSignup && accountSecuritySnapshot(PetalStore.read("petal-profiles", []).find(profile => profile.id === existing.id)) !== accountSecuritySnapshot(existing))
        throw new Error("Your account details changed. Please sign in again.");
      PetalStore.signIn(name.trim(), email, {
        passwordRecord: record, ...(isSignup ? { phone: mobile, recoveryQuestions } : {}),
      });
      location.href = returnToCheckout ? "../checkout.html" : "../index.html";
    } catch (error) {
      console.error("Account " + (isSignup ? "creation" : "sign-in") + " failed:", error);
      status.textContent = error.message || "Could not save your account. Please try again.";
    } finally {
      submitting = false;
      submit.disabled = false;
    }
  });
});
