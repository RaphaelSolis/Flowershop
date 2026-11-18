"use strict";
/* ACCOUNT FORMS — save the active browser profile and return to the home page. */
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector("form");
  const isSignup = !!form.elements.namedItem("fname");
  let submitting = false;
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const status = document.getElementById("account-status");
    const email = form.elements.namedItem("email").value.trim().toLowerCase();
    const password = form.elements.namedItem("password").value;
    const firstName = form.elements.namedItem("fname")?.value.trim();
    const lastName = form.elements.namedItem("lname")?.value.trim() || "";
    if (isSignup && (!firstName || !lastName)) {
      status.textContent = "Enter your first and last name.";
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
      if (existing?.passwordRecord && !(await verifyAccountPassword(password, existing.passwordRecord))) {
        status.textContent = "The password is incorrect.";
        return;
      }
      const record = existing?.passwordRecord || await makeAccountPassword(password);
      const user = PetalStore.signIn(name.trim(), email);
      user.passwordRecord = record;
      const mobile = form.elements.namedItem("mobile")?.value.trim();
      if (mobile) user.phone = mobile;
      const saved = PetalStore.read("petal-profiles", []);
      const index = saved.findIndex(profile => profile.id === user.id);
      if (index >= 0) saved[index] = user;
      else saved.push(user);
      PetalStore.write("petal-profiles", saved);
      PetalStore.write("petal-session", user);
      location.href = "../index.html";
    } catch (error) {
      console.error("Account " + (isSignup ? "creation" : "sign-in") + " failed:", error);
      status.textContent = "Could not " + (isSignup ? "create your account" : "sign in") + ". Please refresh the page and try again.";
    } finally {
      submitting = false;
      submit.disabled = false;
    }
  });
  document.querySelector(".forgot")?.addEventListener("click", function (event) {
    event.preventDefault();
    document.getElementById("account-status").textContent = "Please contact us for help accessing your account.";
  });
});
