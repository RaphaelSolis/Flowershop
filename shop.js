"use strict";
/* PRODUCT OPTIONS: the same form is used by shop products, cart edits, and add-ons.
   It calculates the unit price first, then multiplies by the selected quantity. */
let productSelection = null;
function productKind(product) {
  const name = product.name.toLowerCase();
  if (name.includes("ferrero")) return "chocolate";
  if (name.includes("pepero")) return "pepero";
  if (name.includes("candle")) return "candle";
  if (name.includes("card")) return "card";
  if (name.includes("letter")) return "letter";
  return product.group === "gifts" || product.section === "gifts" || product.group === "addon"
    ? "gift"
    : "flower";
}
function optionSelect(label, name, choices, selected) {
  return (
    "<label>" +
    label +
    '<select name="' +
    name +
    '">' +
    choices
      .map(function (choice) {
        return (
          '<option value="' +
          escapeHTML(choice) +
          '"' +
          (String(choice) === String(selected) ? " selected" : "") +
          ">" +
          escapeHTML(choice) +
          "</option>"
        );
      })
      .join("") +
    "</select></label>"
  );
}
function openProductOptions(product, context, existing) {
  const kind = productKind(product);
  const options = existing?.options || {};
  productSelection = {
    product,
    context: context || "shop",
    replaceId: existing?.lineId || "",
    kind,
  };
  const form = document.getElementById("product-options-form");
  let fields = "";
  if (kind === "flower" && product.section !== "potted-flowers")
    fields += optionSelect(
      "Wrapper color",
      "color",
      colors.map(function (color) {
        return color[0];
      }),
      options.color || "Pink",
    );
  if (kind === "flower" && product.section !== "potted-flowers")
    fields +=
      '<div class="option-color-row" role="group" aria-label="Wrapper color swatches">' +
      colors
        .map(function (color) {
          return (
            '<button type="button" data-option-color="' +
            color[0] +
            '" style="--swatch:' +
            color[1] +
            '" aria-label="' +
            color[0] +
            '" aria-pressed="' +
            (color[0] === (options.color || "Pink")) +
            '"></button>'
          );
        })
        .join("") +
      "</div>";
  if (kind === "chocolate" || kind === "pepero") {
    fields += optionSelect(
      "Flavor",
      "flavor",
      kind === "chocolate" ? SHOP_SETTINGS.chocolateFlavors : SHOP_SETTINGS.peperoFlavors,
      options.flavor,
    );
  }
  if (kind === "chocolate") {
    fields += optionSelect(
      "Pieces per pack",
      "pieces",
      [3, 5, 8, 12],
      options.pieces || 5,
    );
  }
  if (kind === "candle")
    fields += optionSelect("Candle scent", "scent", SHOP_SETTINGS.candleScents, options.scent);
  if (kind === "letter")
    fields +=
      '<label>Personal letter / message<textarea name="letter" maxlength="500" required>' +
      escapeHTML(options.letter || "") +
      "</textarea></label>";
  document.getElementById("product-options-dialog").dataset.kind = kind === "flower" ? "flower" : "gift";
  document.getElementById("product-options-title").textContent = product.name;
  form.innerHTML =
    '<div class="product-option-layout"><div class="product-option-photo"><img src="' +
    product.image +
    '" alt="' +
    escapeHTML(product.name) +
    '"></div><div class="option-fields">' +
    fields +
    '<label for="product-option-quantity">Quantity</label><div class="product-quantity">' +
    '<button type="button" data-product-adjust="-1" aria-label="Decrease quantity">−</button>' +
    '<input id="product-option-quantity" name="quantity" type="number" min="1" max="99" step="1" value="' +
    (existing?.quantity || 1) +
    '" required><button type="button" data-product-adjust="1" aria-label="Increase quantity">+</button></div>' +
    '<div class="option-total">Price: <output id="product-options-price"></output></div><p id="product-options-error" class="form-error" role="alert"></p>' +
    '<button class="pill" type="submit">' +
    (context === "addon" ? "Select add-on" : existing ? "Save changes" : "Add to Cart") +
    "</button></div></div>";
  updateProductOptionPrice();
  openDialog("product-options-dialog");
}
function readProductOptionForm() {
  const form = document.getElementById("product-options-form");
  const value = function (name) {
    return form.querySelector('[name="' + name + '"]')?.value || "";
  };
  const options = {};
  for (const name of ["color", "flavor", "scent", "letter"])
    if (value(name)) options[name] = value(name).trim();
  if (value("pieces")) options.pieces = Number(value("pieces"));
  return { options: options, quantity: boundedQuantity(value("quantity"), 1, 99) };
}
function productUnitPrice(product, options) {
  return PetalStore.productPrice(product, options);
}
function optionDetails(options) {
  const parts = [];
  if (options.color) parts.push(options.color + " wrapper");
  if (options.flavor) parts.push("Flavor: " + options.flavor);
  if (options.pieces) parts.push(options.pieces + " pieces per pack");
  if (options.scent) parts.push("Scent: " + options.scent);
  if (options.letter) parts.push("Letter: " + options.letter);
  return parts.join(" · ");
}
function updateProductOptionPrice() {
  if (!productSelection) return;
  const values = readProductOptionForm();
  for (const swatch of document.querySelectorAll("[data-option-color]"))
    swatch.setAttribute("aria-pressed", swatch.dataset.optionColor === values.options.color);
  document.getElementById("product-options-price").textContent =
    "PHP " + money(productUnitPrice(productSelection.product, values.options) * values.quantity);
}
function submitProductOptions(event) {
  event.preventDefault();
  const form = event.target;
  if (typeof form.reportValidity === "function" && !form.reportValidity()) return;
  const selection = productSelection;
  const values = readProductOptionForm();
  if (
    !selection ||
    (selection.context === "addon" ? !PetalStore.addonAvailable(selection.product.id) : !PetalStore.available(selection.product.id))
  ) {
    document.getElementById("product-options-error").textContent =
      "This item is currently unavailable.";
    return;
  }
  const unitPrice = productUnitPrice(selection.product, values.options);
  if (
    !Number.isFinite(unitPrice) ||
    unitPrice <= 0 ||
    (selection.kind === "letter" && !values.options.letter)
  ) {
    document.getElementById("product-options-error").textContent =
      "Complete the item options before continuing.";
    return;
  }
  const line = {
    productId: selection.product.id,
    name: selection.product.name,
    image: selection.product.image,
    unitPrice: productUnitPrice(selection.product, values.options),
    quantity: values.quantity,
    options: values.options,
    details: optionDetails(values.options),
  };
  try {
    if (selection.context === "addon") setCustomizationAddon(selection.product.addonIndex, line);
    else PetalStore.addLine(line, selection.replaceId);
  } catch (error) {
    document.getElementById("product-options-error").textContent = error.message;
    return;
  }
  closeDialog(document.getElementById("product-options-dialog"));
  refreshCartUI();
  if (page === "cart") renderCartPage();
  if (selection.context !== "addon")
    showSuccess("successfully added to cart", "cart.html", "MY CART");
}
function filterShopSection(sectionId) {
  for (const section of document.querySelectorAll(".product-section"))
    section.hidden = sectionId && section.id !== sectionId;
  const back = document.getElementById("show-all-sections");
  if (back) back.hidden = !sectionId;
  const target = document.getElementById(sectionId);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
  const url = new URL(location.href);
  if (sectionId) url.searchParams.set("section", sectionId);
  else url.searchParams.delete("section");
  if (typeof history !== "undefined")
    history.replaceState(null, "", url.pathname + url.search + url.hash);
}
function scrollProductsRight(sectionId) {
  const row = document.querySelector("#" + sectionId + " .product-grid");
  const distance = row.firstElementChild?.getBoundingClientRect().width || 160;
  if (typeof row.scrollBy === "function") row.scrollBy({ left: distance + 16, behavior: "smooth" });
  else row.scrollLeft += distance + 16;
}
function searchProducts(inputId = "search-input", resultsId = "search-results") {
  const query = document.getElementById(inputId).value.trim();
  const results = document.getElementById(resultsId);
  if (!query) {
    results.innerHTML = "<p>Search for a flower, gift, or occasion.</p>";
    return;
  }
  const matches = allProducts.filter(function (product) {
    return (product.name + " " + product.section).toLowerCase().includes(query.toLowerCase());
  });
  results.innerHTML = matches
    .map(function (product) {
      const available = PetalStore.available(product.id);
      return (
        '<article class="search-result"><img src="' +
        product.image +
        '" alt=""><div><h3>' +
        escapeHTML(product.name) +
        "</h3><p>PHP " +
        money(product.price) +
        '</p></div><button class="pill" type="button" data-configure="' +
        product.id +
        '"' + (available ? "" : " disabled") + '>' + (available ? "Select" : "Unavailable") + '</button></article>'
      );
    })
    .join("");
  if (!matches.length)
    results.innerHTML = "<p>No products found for “" + escapeHTML(query) + "”.</p>";
}
function initializeShop() {
  const parameters = new URLSearchParams(location.search);
  const section = parameters.get("section");
  if (section && document.getElementById(section)?.classList.contains("product-section"))
    filterShopSection(section);
  for (const row of document.querySelectorAll(".product-grid")) {
    const next = row.parentElement.querySelector("[data-next]");
    if (next)
      row.addEventListener("scroll", function () {
        if (row.clientWidth > 0)
          next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
      });
  }
  for (const card of document.querySelectorAll("[data-product]")) {
    const product = findProduct(card.dataset.product);
    const title = card.querySelector(".photo-caption h3");
    const price = card.querySelector(".photo-caption p");
    if (title && product) title.textContent = product.name;
    if (price && product) price.textContent = money(product.price) + " PHP";
    const available = PetalStore.available(card.dataset.product);
    card.classList.toggle("out-of-stock", !available);
    for (const button of card.querySelectorAll("[data-add],[data-configure]"))
      button.disabled = !available;
  }
}
document.addEventListener("click", function (event) {
  const button = event.target.closest("button,a");
  if (!button) return;
  if (button.hasAttribute("data-product-adjust")) {
    const input = document.getElementById("product-option-quantity");
    input.value = boundedQuantity(Number(input.value) + Number(button.dataset.productAdjust), 1, 99);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (button.dataset.optionColor) {
    const form = document.getElementById("product-options-form");
    form.querySelector('[name="color"]').value = button.dataset.optionColor;
    for (const swatch of form.querySelectorAll("[data-option-color]"))
      swatch.setAttribute("aria-pressed", swatch === button);
    updateProductOptionPrice();
  } else if (button.dataset.add || button.dataset.configure) {
    event.preventDefault();
    const product = findProduct(button.dataset.add || button.dataset.configure);
    if (product) {
      const searchDialog = document.getElementById("search-dialog");
      if (searchDialog?.open) closeDialog(searchDialog);
      openProductOptions(product);
    }
  } else if (button.dataset.section) filterShopSection(button.dataset.section);
  else if (button.hasAttribute("data-show-all")) filterShopSection("");
  else if (button.dataset.next) scrollProductsRight(button.dataset.next);
  else if (button.dataset.editOptions) {
    const line = PetalStore.getCart().find(function (item) {
      return item.lineId === button.dataset.editOptions;
    });
    const product = line && findProduct(line.productId);
    if (product) openProductOptions(product, "cart", line);
  }
});
document.addEventListener("input", function (event) {
  if (event.target.closest("#product-options-form")) updateProductOptionPrice();
  if (event.target.id === "search-input") searchProducts();
  if (event.target.id === "page-search-input") searchProducts("page-search-input", "page-search-results");
});
document.addEventListener("change", function (event) {
  if (event.target.closest("#product-options-form")) updateProductOptionPrice();
});
document.addEventListener("submit", function (event) {
  if (event.target.id === "product-options-form") submitProductOptions(event);
  if (event.target.id === "search-form") {
    event.preventDefault();
    searchProducts();
    rememberSearch(document.getElementById("search-input").value);
  }
  if (event.target.id === "page-search-form") {
    event.preventDefault();
    searchProducts("page-search-input", "page-search-results");
    const query = document.getElementById("page-search-input").value;
    rememberSearch(query);
    const url = new URL(location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    history.replaceState(null, "", url.pathname + url.search);
  }
});
