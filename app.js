"use strict";
/* COMMON PAGE BEHAVIOR
   products.js = prices; store.js = saved records; app.js = menus and the home gallery.
   shop.js handles product options. customize.js handles bouquet choices.
   pages.js handles cart, checkout, receipt, contact, feedback, and notifications. */
const page = document.body.dataset.page;

function money(value) {
  return Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}
function escapeHTML(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(value).replace(/[&<>"']/g, function (character) {
    return replacements[character];
  });
}
function productPhotoURL(source) {
  const path = String(source || "");
  return path.startsWith("assets/product-photos/")
    ? path.split("?")[0] + "?v=20261124-outputs" : path;
}
function boundedQuantity(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(minimum, Math.min(maximum, Math.round(number)))
    : minimum;
}
function findProduct(id) {
  return allProducts.find(function (product) {
    return product.id === id;
  });
}
function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}
function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}
function toast(message) {
  const box = document.getElementById("toast");
  if (!box) return;
  box.textContent = message;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () {
    box.textContent = "";
  }, 3500);
}
function showSuccess(message, link, linkText) {
  const dialog = document.getElementById("success-dialog");
  const text = String(message).trim().replace(/[.!]+$/, "");
  dialog.querySelector("[data-success-message]").textContent = text.charAt(0).toUpperCase() + text.slice(1) + "!";
  const action = dialog.querySelector("[data-success-link]");
  action.href = link || "cart.html";
  action.textContent = (linkText || "MY CART").toUpperCase();
  openDialog("success-dialog");
}
function refreshCartUI() {
  const quantity = new Set(PetalStore.getCart().map(line => line.productId)).size;
  for (const counter of document.querySelectorAll("[data-cart-count]"))
    counter.textContent = quantity || "";
  try { PetalStore.syncNotifications(); } catch {}
  const unread = PetalStore.notifications().filter(function (note) {
    return !note.read;
  }).length;
  for (const dot of document.querySelectorAll(".notification-dot")) {
    dot.hidden = unread === 0;
    dot.setAttribute("aria-label", unread + " unread notifications");
  }
}
function mapsLink() {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(SHOP_SETTINGS.address)
  );
}
function initializeContactLinks() {
  for (const link of document.querySelectorAll("[data-store-social]")) {
    link.href = SHOP_SETTINGS.socialLinks[link.dataset.storeSocial];
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open " + link.getAttribute("aria-label");
  }
  for (const link of document.querySelectorAll("[data-store-map]"))
    link.href = mapsLink();
  for (const link of document.querySelectorAll("[data-store-phone]")) {
    link.href = "tel:" + SHOP_SETTINGS.phone;
    link.textContent = SHOP_SETTINGS.phone;
  }
  for (const link of document.querySelectorAll("[data-store-email]")) {
    if (SHOP_SETTINGS.email) {
      link.href = "mailto:" + SHOP_SETTINGS.email;
      link.textContent = SHOP_SETTINGS.email;
    } else {
      link.removeAttribute("href");
      link.textContent = "Email contact currently unavailable";
    }
  }
}
const publicReviewTemplates = new WeakMap();
function renderPublicReviews() {
  const reviews = PetalStore.reviews();
  for (const container of document.querySelectorAll('body[data-page="feedback"] [data-public-reviews]')) {
    if (!publicReviewTemplates.has(container)) publicReviewTemplates.set(container, container.innerHTML);
    container.innerHTML = reviews
      .map(function (review) {
        return (
          '<article class="review-card" data-review-id="' + escapeHTML(review.id || review.reference) +
          '"><div class="review-stars" aria-label="' +
          review.rating +
          ' out of 5 stars">' +
          "★".repeat(review.rating) +
          "☆".repeat(5 - review.rating) +
          "</div><p>" +
          escapeHTML(review.message) +
          "</p><strong>" +
          escapeHTML(review.name) +
          "</strong><small>Verified order · " +
          escapeHTML(review.reference) +
          '</small><time datetime="' + escapeHTML(review.date) + '">Submitted ' +
          escapeHTML(new Date(review.date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" })) +
          "</time>" +
          (review.updatedAt ? '<time datetime="' + escapeHTML(review.updatedAt) + '">Updated ' +
            escapeHTML(new Date(review.updatedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" })) + '</time>' : '') +
          (PetalStore.hasProfile() && review.owner === PetalStore.owner()
            ? '<button type="button" class="text-button review-edit-button" data-edit-review="' + escapeHTML(review.reference) + '">Edit review</button>' : '') +
          "</article>"
        );
      })
      .join("") + publicReviewTemplates.get(container);
  }
}
function initializeAnimations() {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  if (typeof IntersectionObserver === "undefined") return;
  const observer = new IntersectionObserver(
    function (entries) {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-" + entry.target.dataset.animate);
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.1 },
  );
  for (const element of document.querySelectorAll("[data-animate]"))
    observer.observe(element);
}
function handleCommonClick(event) {
  const button = event.target.closest("button,a");
  if (!button) return;
  if (button.hasAttribute("data-confirm-logout") || button.hasAttribute("data-logout")) {
    event.preventDefault();
    PetalStore.logout();
    location.href = "Log-Sign/LoginPage.html";
  } else if (button.hasAttribute("data-shop-menu")) {
    button.setAttribute(
      "aria-expanded",
      button.closest(".shop-menu").classList.toggle("open"),
    );
  } else if (button.hasAttribute("data-mobile-menu")) {
    button.setAttribute(
      "aria-expanded",
      document.getElementById("main-nav").classList.toggle("open"),
    );
  } else if (button.hasAttribute("data-cart")) {
    event.preventDefault();
    location.href = "cart.html";
  } else if (button.hasAttribute("data-success-link") && button.getAttribute("href")?.startsWith("#")) {
    event.preventDefault();
    closeDialog(button.closest("dialog"));
    const target = document.getElementById(button.getAttribute("href").slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (button.hasAttribute("data-close"))
    closeDialog(button.closest("dialog"));
  else if (button.hasAttribute("data-search")) {
    location.href = "search.html";
  }
}
document.addEventListener("click", handleCommonClick);
document.addEventListener("click", function (event) {
  for (const menu of document.querySelectorAll(".shop-menu.open")) {
    if (!menu.contains(event.target) || event.target.closest(".shop-dropdown a")) {
      menu.classList.remove("open");
      menu.querySelector("[data-shop-menu]").setAttribute("aria-expanded", "false");
    }
  }
});
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const footerControl = document.activeElement?.closest(".footer-shop-menu")?.querySelector("[data-shop-menu]");
    for (const menu of document.querySelectorAll(".shop-menu")) menu.classList.remove("open");
    document.getElementById("main-nav")?.classList.remove("open");
    for (const button of document.querySelectorAll(
      "[data-shop-menu],[data-mobile-menu]",
    ))
      button.setAttribute("aria-expanded", "false");
    footerControl?.focus();
  }
});
function refreshAccountUI() {
  const user = PetalStore.session();
  const photo = typeof user?.photo === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(user.photo) ? user.photo : "";
  const names = user?.name.trim().split(/\s+/).filter(Boolean) || [];
  const initials = (names.length > 1 ? [names[0], names.at(-1)] : names)
    .map(name => Array.from(name)[0]).join("").toUpperCase() || "?";
  for (const link of document.querySelectorAll(".profile-link")) {
    link.href = user ? "profile.html" : "Log-Sign/LoginPage.html";
    link.setAttribute("aria-label", user ? "My profile" : "Log in");
    const image = link.querySelector("img");
    image.src = photo || "assets/home/profile.png";
    image.classList.toggle("profile-photo", !!photo);
  }
  for (const greeting of document.querySelectorAll(".hero-greeting"))
    greeting.textContent = "Hey there, " + (names[0] || "visitor") + "!";
  for (const avatar of document.querySelectorAll("[data-profile-avatar]")) {
    const image = avatar.querySelector("[data-profile-photo]");
    const placeholder = avatar.querySelector("[data-profile-initials]");
    placeholder.textContent = initials;
    placeholder.hidden = !!photo;
    image.hidden = !photo;
    if (photo) image.src = photo;
    else image.removeAttribute("src");
    avatar.setAttribute("aria-label", photo ? user.name + "'s profile photo" : "No profile photo for " + (user?.name || "visitor"));
  }
  const photoButton = document.getElementById("change-profile-photo");
  if (photoButton) photoButton.textContent = photo ? "Change photo" : "Add photo";
  const removeButton = document.getElementById("remove-profile-photo");
  if (removeButton) removeButton.hidden = !photo;
}

function startWebsite() {
  refreshCartUI();
  initializeContactLinks();
  renderPublicReviews();
  initializeAnimations();
  initializeGalleryMarquee();
  initializeShop();
  initializeCustomization();
  initializePages();
  refreshAccountUI();
  initializeNavigation();
  if (location.hash)
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
document.addEventListener("DOMContentLoaded", startWebsite);

// HOME PHOTO MARQUEE
function initializeGalleryMarquee() {
  const gallery = document.querySelector("[data-gallery-marquee]");
  if (!gallery || gallery.dataset.initialized) return;
  gallery.dataset.initialized = "true";
  const viewport = gallery.querySelector(".gallery-marquee-viewport");
  const track = gallery.querySelector(".gallery-marquee-track");
  const group = track.querySelector(".gallery-marquee-group");
  const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const repeatedGroup = group.cloneNode(true);
  repeatedGroup.setAttribute("aria-hidden", "true");
  repeatedGroup.setAttribute("inert", "");
  for (const image of repeatedGroup.querySelectorAll("img")) image.alt = "";
  track.appendChild(repeatedGroup);

  let paused = false;
  let visible = true;
  let loading = false;
  let ready = false;
  function updatePlayback() {
    const reducedMotion = !!motionPreference?.matches;
    gallery.classList.toggle("is-playing", ready && visible && !paused && !reducedMotion && !document.hidden);
    gallery.classList.toggle("is-paused", paused || reducedMotion);
  }
  function prepareImages() {
    if (loading) return;
    loading = true;
    const images = Array.from(gallery.querySelectorAll("img"));
    for (const image of images) image.loading = "eager";
    Promise.all(images.map(image => image.decode?.().catch(() => {}))).then(() => {
      ready = true;
      gallery.classList.add("is-ready");
      updatePlayback();
    });
  }
  function pause() {
    paused = true;
    updatePlayback();
  }
  viewport.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch" || event.pointerType === "pen") pause();
  });
  viewport.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    pause();
    const distance = group.querySelector("li").getBoundingClientRect().width + 16;
    viewport.scrollBy({ left: event.key === "ArrowRight" ? distance : -distance, behavior: "auto" });
  });
  viewport.addEventListener("pointerleave", () => { paused = false; viewport.scrollLeft = 0; updatePlayback(); });
  viewport.addEventListener("blur", () => { paused = false; viewport.scrollLeft = 0; updatePlayback(); });
  document.addEventListener("visibilitychange", updatePlayback);
  motionPreference?.addEventListener?.("change", updatePlayback);
  if (typeof window.IntersectionObserver === "function") {
    visible = false;
    const observer = new window.IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) prepareImages();
      updatePlayback();
    }, { rootMargin: "200px" });
    observer.observe(gallery);
  } else prepareImages();
  updatePlayback();
}

// A shared indicator slides to the selected navigation tab, including the cart.
function initializeNavigation() {
  for (const link of document.querySelectorAll(".footer-menu a")) {
    const current = (page === "home" ? "index" : page) + ".html";
    const active = link.getAttribute("href") === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const header = document.querySelector(".site-header");
  if (!header) return;
  const tabs = Array.from(header.querySelectorAll(".nav-link,.header-actions .icon-button"));
  const shopPages = ["all-products", "collections", "occasions", "customize"];
  for (const button of document.querySelectorAll(".footer-shop-toggle")) {
    const active = shopPages.includes(page);
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  for (const tab of tabs) {
    const isActive = tab.hasAttribute("data-cart") ? ["cart", "checkout", "receipt"].includes(page)
      : tab.hasAttribute("data-search") ? page === "search"
      : tab.hasAttribute("data-shop-menu") ? shopPages.includes(page)
      : tab.getAttribute("href") === (page === "home" ? "index" : page) + ".html";
    tab.classList.toggle("active", isActive);
    if (isActive) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
  const indicator = document.createElement("span");
  indicator.className = "nav-active-indicator";
  indicator.setAttribute("aria-hidden", "true");
  header.appendChild(indicator);
  function geometry(tab) {
    const base = header.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    return { left: box.left - base.left, width: box.width, top: box.bottom - base.top + 4 };
  }
  function move(position) {
    const available = header.clientWidth || window.innerWidth;
    const width = Math.max(0, Math.min(position.width, available));
    const left = Math.max(0, Math.min(position.left, available - width));
    indicator.hidden = width <= 0;
    indicator.style.width = width + "px";
    indicator.style.transform = "translate(" + left + "px," + position.top + "px)";
  }
  const active = tabs.find(tab => tab.classList.contains("active"));
  if (active) {
    let previous;
    try { previous = JSON.parse(window.sessionStorage.getItem("petal-nav-position")); } catch {}
    const current = geometry(active);
    if (previous && [previous.left, previous.width, previous.top].every(Number.isFinite)) {
      move(previous);
      requestAnimationFrame(() => requestAnimationFrame(() => move(current)));
    } else move(current);
  } else indicator.hidden = true;
  for (const tab of tabs) tab.addEventListener("click", () => {
    const previous = tabs.find(item => item.classList.contains("active"));
    try { if (previous) window.sessionStorage.setItem("petal-nav-position", JSON.stringify(geometry(previous))); } catch {}
    indicator.hidden = false;
    tabs.forEach(item => item.classList.toggle("active", item === tab));
    move(geometry(tab));
  });
  function reposition() {
    const tab = tabs.find(item => item.classList.contains("active"));
    if (tab) move(geometry(tab));
  }
  window.addEventListener("resize", reposition);
  header.querySelector("[data-mobile-menu]")?.addEventListener("click", () => requestAnimationFrame(reposition));
  document.fonts?.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(reposition)));
}
function celebrateOrder() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelector(".petal-confetti")?.remove();
  const shower = document.createElement("div");
  shower.className = "petal-confetti";
  shower.setAttribute("aria-hidden", "true");
  const palette = ["#ef6e99", "#f4aac3", "#fff8b8", "#e780a3"];
  for (let index = 0; index < 42; index++) {
    const petal = document.createElement("i");
    petal.className = "falling-petal";
    petal.style.cssText = "left:" + Math.random() * 100 + "%;background:" + palette[index % palette.length] +
      ";--drift:" + (Math.random() * 240 - 120) + "px;--spin:" + (Math.random() * 720 + 180) +
      "deg;--delay:" + Math.random() * 1.2 + "s;--duration:" + (3 + Math.random() * 2) + "s";
    shower.appendChild(petal);
  }
  document.body.appendChild(shower);
  setTimeout(() => shower.remove(), 6500);
}
