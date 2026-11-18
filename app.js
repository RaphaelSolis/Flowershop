"use strict";
/* COMMON PAGE BEHAVIOR
   products.js = prices; store.js = saved records; app.js = menus and slideshow.
   shop.js handles product options. customize.js handles bouquet choices.
   pages.js handles cart, checkout, receipt, contact, feedback, and notifications. */
const page = document.body.dataset.page;
const GALLERY_SLIDE_DELAY = 3000;
const SWIPE_MIN_DISTANCE = 45;

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
  dialog.querySelector("[data-success-message]").textContent = message;
  const action = dialog.querySelector("[data-success-link]");
  action.href = link || "cart.html";
  action.textContent = linkText || "MY CART";
  openDialog("success-dialog");
}
function refreshCartUI() {
  const quantity = PetalStore.getCart().reduce(function (sum, line) {
    return sum + line.quantity;
  }, 0);
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
function renderPublicReviews() {
  const reviews = PetalStore.reviews();
  for (const container of document.querySelectorAll("[data-public-reviews]")) {
    container.innerHTML = reviews
      .map(function (review) {
        return (
          '<article class="review-card"><div class="review-stars" aria-label="' +
          review.rating +
          ' out of 5 stars">' +
          "★".repeat(review.rating) +
          "☆".repeat(5 - review.rating) +
          "</div><p>" +
          escapeHTML(review.message) +
          "</p><strong>" +
          escapeHTML(review.name) +
          "</strong><small>Verified delivered order · " +
          escapeHTML(review.reference) +
          "</small></article>"
        );
      })
      .join("");

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
  if (button.hasAttribute("data-confirm-logout")) {
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
  } else if (button.hasAttribute("data-logout")) {
    event.preventDefault();
    const header = button.closest(".site-header");
    if (!header) return;
    let popover = header.querySelector(".logout-popover");
    if (popover) { popover.remove(); button.setAttribute("aria-expanded", "false"); }
    else {
      popover = document.createElement("div");
      popover.className = "logout-popover";
      popover.innerHTML = '<button type="button" data-confirm-logout>Logout</button>';
      header.appendChild(popover);
      button.setAttribute("aria-expanded", "true");
      popover.querySelector("button").focus();
    }
  } else if (button.hasAttribute("data-close"))
    closeDialog(button.closest("dialog"));
  else if (button.hasAttribute("data-search")) {
    location.href = "search.html";
  }
}
document.addEventListener("click", handleCommonClick);
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    document.querySelector(".logout-popover")?.remove();
    document.querySelector(".shop-menu")?.classList.remove("open");
    document.getElementById("main-nav")?.classList.remove("open");
    for (const button of document.querySelectorAll(
      "[data-shop-menu],[data-mobile-menu],[data-logout]",
    ))
      button.setAttribute("aria-expanded", "false");
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
  initializeGallerySlideshow();
  initializeShop();
  initializeCustomization();
  initializePages();
  refreshAccountUI();
  if (location.hash)
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
document.addEventListener("DOMContentLoaded", startWebsite);

// ONE-PHOTO HOME SLIDESHOW
function initializeGallerySlideshow() {
  const gallery = document.querySelector(".gallery-slideshow");
  if (!gallery) {
    return; // Only the home page contains this slideshow.
  }

  const track = gallery.querySelector(".gallery-track");
  const slides = gallery.querySelectorAll(".gallery-slide");
  const dots = gallery.querySelectorAll(".gallery-dot");
  const playbackButton = gallery.querySelector("[data-gallery-playback]");
  let motionPreference = null;
  if (typeof window.matchMedia === "function") {
    motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  let currentSlide = 0;
  let isPlaying = motionPreference ? !motionPreference.matches : true;
  let slideshowTimer;
  let touchStartPosition = null;

  function showSlide(slideNumber) {
    currentSlide = slideNumber;
    // Going past the last photo returns to the first; going back returns to last.
    if (currentSlide >= slides.length) {
      currentSlide = 0;
    } else if (currentSlide < 0) {
      currentSlide = slides.length - 1;
    }

    // Each photo occupies 100% of the viewport's width.
    // Photo 1: move 0%. Photo 2: move -100%. Photo 3: move -200%.
    track.style.transform = "translateX(-" + currentSlide * 100 + "%)";
    for (let number = 0; number < slides.length; number++) {
      slides[number].setAttribute("aria-hidden", number !== currentSlide);
      dots[number].setAttribute("aria-current", number === currentSlide);
    }
  }

  function updatePlayback() {
    // Clear the previous timer so we never run two slideshow timers at once.
    clearInterval(slideshowTimer);
    playbackButton.textContent = isPlaying ? "Pause" : "Play";
    playbackButton.setAttribute(
      "aria-label",
      isPlaying ? "Pause slideshow" : "Play slideshow",
    );
    track.setAttribute("aria-live", isPlaying ? "off" : "polite");

    // Pause automatic movement while the browser tab is hidden.
    if (isPlaying && !document.hidden) {
      slideshowTimer = setInterval(function () {
        showSlide(currentSlide + 1);
      }, GALLERY_SLIDE_DELAY);
    }
  }

  function pauseSlideshow() {
    isPlaying = false;
    updatePlayback();
  }

  gallery.addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    if (button.hasAttribute("data-gallery-playback")) {
      isPlaying = !isPlaying;
      updatePlayback();
    } else if (button.hasAttribute("data-gallery-direction")) {
      pauseSlideshow();
      showSlide(currentSlide + Number(button.dataset.galleryDirection));
    } else if (button.hasAttribute("data-gallery-slide")) {
      pauseSlideshow();
      showSlide(Number(button.dataset.gallerySlide));
    }
  });

  gallery.addEventListener("focusin", function (event) {
    if (event.target !== playbackButton) {
      pauseSlideshow();
    }
  });

  // A visitor using a keyboard can navigate with the left and right arrow keys.
  gallery.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      pauseSlideshow();
      if (event.key === "ArrowRight") {
        showSlide(currentSlide + 1);
      } else {
        showSlide(currentSlide - 1);
      }
    }
  });

  // A phone swipe starts with remembering where the finger touched the screen.
  gallery.addEventListener(
    "touchstart",
    function (event) {
      const touch = event.touches[0];
      touchStartPosition = { x: touch.clientX, y: touch.clientY };
    },
    { passive: true },
  );

  gallery.addEventListener(
    "touchend",
    function (event) {
      if (!touchStartPosition) {
        return;
      }
      const touch = event.changedTouches[0];
      const horizontalDistance = touch.clientX - touchStartPosition.x;
      const verticalDistance = touch.clientY - touchStartPosition.y;
      // Ignore normal vertical scrolling and very short finger movements.
      if (
        Math.abs(horizontalDistance) > SWIPE_MIN_DISTANCE &&
        Math.abs(horizontalDistance) > Math.abs(verticalDistance)
      ) {
        pauseSlideshow();
        showSlide(currentSlide + (horizontalDistance < 0 ? 1 : -1));
      }
      touchStartPosition = null;
    },
    { passive: true },
  );

  gallery.addEventListener("touchcancel", function () {
    touchStartPosition = null;
  });
  document.addEventListener("visibilitychange", updatePlayback);
  if (
    motionPreference &&
    typeof motionPreference.addEventListener === "function"
  ) {
    motionPreference.addEventListener("change", function (event) {
      if (event.matches) {
        pauseSlideshow();
      }
    });
  }
  showSlide(0);
  updatePlayback();
}
