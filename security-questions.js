"use strict";
/* Shared security-question controls for signup and existing profiles. */
const accountQuestionChoices = [
  "What was the name of your first pet?",
  "What was the name of your first school?",
  "What was your childhood nickname?",
  "In what city did your parents first meet?",
  "What is the title of your favorite childhood book?",
];
function initializeSecurityQuestions(form, saved = []) {
  for (const [index, group] of Array.from(form.querySelectorAll("[data-security-question]")).entries()) {
    const choice = group.querySelector("select");
    const customField = group.querySelector("[data-custom-question-field]");
    const custom = customField.querySelector("input");
    choice.replaceChildren();
    for (const [value, label] of [["", "Choose a question"], ...accountQuestionChoices.map(question => [question, question]), ["custom", "Write my own question"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      choice.append(option);
    }
    function updateCustom() {
      const ownQuestion = choice.value === "custom";
      customField.hidden = !ownQuestion;
      custom.disabled = !ownQuestion;
      custom.required = ownQuestion;
      custom.setCustomValidity("");
    }
    if (saved[index]?.question) {
      const question = saved[index].question;
      choice.value = accountQuestionChoices.includes(question) ? question : "custom";
      if (choice.value === "custom") custom.value = question;
    }
    choice.addEventListener("change", function () { updateCustom(); clearErrors(); });
    updateCustom();
  }
  function clearErrors() {
    for (const input of form.querySelectorAll("[data-security-question] input, [data-security-question] select")) {
      input.setCustomValidity("");
      input.removeAttribute("aria-invalid");
    }
    form.querySelector("[data-security-error]").textContent = "";
  }
  for (const input of form.querySelectorAll("[data-security-question] input")) input.addEventListener("input", clearErrors);
}
function readSecurityQuestions(form) {
  const groups = Array.from(form.querySelectorAll("[data-security-question]"));
  const entries = groups.map(group => {
    const choice = group.querySelector("select");
    return { question: choice.value === "custom" ? group.querySelector("[data-custom-question-field] input").value : choice.value,
      answer: group.querySelector("[data-security-answer]").value };
  });
  const error = form.querySelector("[data-security-error]");
  try {
    const valid = validateAccountRecovery(entries);
    error.textContent = "";
    return valid;
  } catch (failure) {
    error.textContent = failure.message;
    return null;
  }
}
function initializePasswordRecovery(form) {
  const status = document.getElementById("account-status");
  const email = form.elements.namedItem("email");
  const fields = document.getElementById("recovery-fields");
  const submit = form.querySelector('[type="submit"]');
  const changeEmail = document.getElementById("recovery-change-email");
  const success = document.getElementById("recovery-success");
  const password = form.elements.namedItem("password");
  const confirmation = form.elements.namedItem("confirmPassword");
  let profile = null;
  let saving = false;
  function validatePasswords() {
    const strong = isStrongAccountPassword(password.value);
    password.setCustomValidity(password.value && !strong ? "Use at least 8 characters, one uppercase letter, and one special character." : "");
    const message = confirmation.value && confirmation.value !== password.value ? "Passwords do not match. Enter the same password in both fields." : "";
    confirmation.setCustomValidity(message);
    confirmation.setAttribute("aria-invalid", String(!!message));
    document.getElementById("password-confirm-error").textContent = message;
    return strong && !!confirmation.value && confirmation.value === password.value;
  }
  password.addEventListener("input", validatePasswords);
  confirmation.addEventListener("input", validatePasswords);
  changeEmail.addEventListener("click", function () {
    if (saving) return;
    form.reset();
    profile = null;
    fields.hidden = true;
    fields.disabled = true;
    changeEmail.hidden = true;
    email.readOnly = false;
    submit.textContent = "CONTINUE";
    status.textContent = "";
    for (const input of form.querySelectorAll("input")) { input.setCustomValidity(""); input.removeAttribute("aria-invalid"); }
    for (const button of form.querySelectorAll("[data-password-toggle]")) {
      document.getElementById(button.dataset.passwordToggle).type = "password";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Show password");
      button.title = "Show password";
    }
    document.getElementById("password-confirm-error").textContent = "";
    email.focus();
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (saving) return;
    const passwordsValid = !profile || validatePasswords();
    if (!form.reportValidity() || !passwordsValid) return;
    if (!profile) {
      const found = PetalStore.read("petal-profiles", []).find(item => item.email.toLowerCase() === email.value.trim().toLowerCase());
      if (!found) { status.textContent = "No account found in this browser. Use the browser and website address where you created your account."; return; }
      if (!hasAccountRecovery(found)) {
        status.textContent = "This account has no security questions yet. If you know your password, sign in and open Profile → Security Questions to set them up. Questions cannot be added from this reset page.";
        return;
      }
      profile = found;
      for (const [index, question] of profile.recoveryQuestions.entries()) document.getElementById("recovery-question-" + (index + 1)).textContent = question.question;
      fields.disabled = false;
      fields.hidden = false;
      changeEmail.hidden = false;
      email.readOnly = true;
      submit.textContent = "RESET PASSWORD";
      status.textContent = "";
      form.elements.namedItem("answer1").focus();
      return;
    }
    const answers = ["answer1", "answer2"].map(name => form.elements.namedItem(name).value);
    if (answers.some(answer => !normalizeSecurityAnswer(answer))) { status.textContent = "Answer both security questions."; return; }
    saving = true;
    submit.disabled = true;
    changeEmail.disabled = true;
    status.textContent = "Checking your answers…";
    try {
      await resetAccountPassword(profile, answers, password.value);
      form.reset();
      form.hidden = true;
      success.hidden = false;
      status.textContent = "Your password has been reset. Sign in with your new password.";
      document.getElementById("recovery-login").focus();
    } catch (error) {
      status.textContent = error.message || "Could not reset your password. Please try again.";
    } finally {
      saving = false;
      submit.disabled = false;
      changeEmail.disabled = false;
    }
  });
}
