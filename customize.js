"use strict";
/* CUSTOM BOUQUET: choose several flowers, with a separate stem quantity for each.
   Exactly one wrapping mode is selected: a style OR a plain color.
   Add-ons keep their own quantity, pack size, flavor, scent, or letter. */
const customization = {
  replaceId: "",
  quantity: 1,
  flowers: { 2: 6 },
  wrappingMode: "style",
  wrapping: 0,
  color: 0,
  ribbon: "",
  addons: {
    0: {
      productId: "addon-0",
      name: addons[0].name,
      image: addons[0].image,
      unitPrice: 250,
      quantity: 1,
      options: { flavor: SHOP_SETTINGS.chocolateFlavors[0], pieces: 5 },
      details: "Flavor: " + SHOP_SETTINGS.chocolateFlavors[0] + " · 5 pieces per pack",
    },
  },
};
function selectedFlowerItems() {
  return Object.entries(customization.flowers).map(function ([index, quantity]) {
    const flower = customFlowers[Number(index)];
    return { index: Number(index), name: flower.name, quantity: quantity, unitPrice: flower.price };
  });
}
function selectedWrapping() {
  if (customization.wrappingMode === "style")
    return {
      name: wrappings[customization.wrapping].name,
      price: wrappings[customization.wrapping].price,
    };
  return {
    name: colors[customization.color][0] + " plain wrapping",
    price: SHOP_SETTINGS.plainWrappingPrice,
  };
}
function customBouquetTotal() {
  const flowers = selectedFlowerItems().reduce(function (sum, flower) {
    return sum + flower.quantity * flower.unitPrice;
  }, 0);
  const extras = Object.values(customization.addons).reduce(function (sum, addon) {
    return sum + addon.quantity * addon.unitPrice;
  }, 0);
  return PetalStore.round(flowers + selectedWrapping().price + extras);
}
function setCustomizationAddon(index, line) {
  customization.addons[index] = line;
  updateCustomization();
}
function updateCustomization() {
  if (page !== "customize") return;
  document.getElementById("builder-ribbon").value = customization.ribbon;
  for (const swatch of document.querySelectorAll("[data-ribbon]"))
    swatch.setAttribute("aria-pressed", swatch.dataset.ribbon === customization.ribbon);
  document.getElementById("ribbon-choice-note").textContent = customization.ribbon
    ? "Selected: " + customization.ribbon + " ribbon."
    : "Choose a ribbon color to continue (required).";
  for (const button of document.querySelectorAll('[data-choice="flower"]'))
    button.setAttribute("aria-pressed", Object.hasOwn(customization.flowers, button.dataset.index));
  for (const button of document.querySelectorAll('[data-choice="wrapping"]'))
    button.setAttribute(
      "aria-pressed",
      customization.wrappingMode === "style" &&
        Number(button.dataset.index) === customization.wrapping,
    );
  for (const button of document.querySelectorAll("[data-color]"))
    button.setAttribute(
      "aria-pressed",
      customization.wrappingMode === "color" &&
        Number(button.dataset.color) === customization.color,
    );
  for (const button of document.querySelectorAll('[data-choice="addon"]'))
    button.setAttribute("aria-pressed", Object.hasOwn(customization.addons, button.dataset.index));
  for (const input of document.querySelectorAll(".stem-quantity input")) input.value = customization.flowers[input.dataset.flowerQuantity] || "";
  const flowers = selectedFlowerItems();
  document.getElementById("selected-flowers").innerHTML =
    flowers
      .map(function (flower) {
        return (
          '<div class="selected-flower-row"><strong>' +
          flower.name +
          '</strong><div class="small-quantity"><button type="button" data-flower-adjust="-1" data-flower-index="' +
          flower.index +
          '" aria-label="Remove one ' +
          flower.name +
          ' stem">−</button><label class="sr-only" for="flower-quantity-' +
          flower.index +
          '">' +
          flower.name +
          ' stem quantity</label><input id="flower-quantity-' +
          flower.index +
          '" data-flower-quantity="' +
          flower.index +
          '" type="number" min="1" max="99" value="' +
          flower.quantity +
          '"><button type="button" data-flower-adjust="1" data-flower-index="' +
          flower.index +
          '" aria-label="Add one ' +
          flower.name +
          ' stem">+</button></div><span>₱' +
          money(flower.unitPrice * flower.quantity) +
          "</span></div>"
        );
      })
      .join("") || "<p>Choose one or more flowers above.</p>";
  document.getElementById("selected-addons").innerHTML =
    Object.entries(customization.addons)
      .map(function ([index, addon]) {
        return (
          '<div class="selected-addon-row"><div><strong>' +
          addon.quantity +
          " × " +
          addon.name +
          "</strong><p>" +
          escapeHTML(addon.details) +
          "</p></div><span>₱" +
          money(addon.unitPrice * addon.quantity) +
          '</span><div class="selected-addon-actions"><button type="button" data-edit-addon="' +
          index + '">EDIT</button><button type="button" data-remove-addon="' +
          index +
          '">REMOVE</button></div></div>'
        );
      })
      .join("") || "<p>No add-ons selected.</p>";
  const wrapping = selectedWrapping();
  document.getElementById("wrapping-choice-note").textContent =
    "Selected: " + wrapping.name + ". Choosing the other mode replaces this selection.";
  let rows = flowers
    .map(function (flower) {
      return (
        "<tr><td>" +
        flower.name +
        "</td><td>" +
        flower.quantity +
        " stems</td><td>₱" +
        money(flower.quantity * flower.unitPrice) +
        "</td></tr>"
      );
    })
    .join("");
  rows +=
    "<tr><td>Wrapping</td><td>" +
    wrapping.name +
    "</td><td>₱" +
    money(wrapping.price) +
    "</td></tr>";
  rows += "<tr><td>Ribbon</td><td>" + customization.ribbon + "</td><td>Included</td></tr>";
  for (const addon of Object.values(customization.addons))
    rows +=
      "<tr><td>" +
      addon.name +
      "</td><td>" +
      addon.quantity +
      " × " +
      escapeHTML(addon.details) +
      "</td><td>₱" +
      money(addon.quantity * addon.unitPrice) +
      "</td></tr>";
  document.getElementById("custom-summary-rows").innerHTML = rows;
  document.getElementById("summary-total").textContent = "₱" + money(customBouquetTotal());
  document.querySelector("[data-add-custom]").disabled = !flowers.length;
}
function addCustomizedBouquet() {
  const flowers = selectedFlowerItems();
  if (!flowers.length) {
    toast("Choose at least one flower.");
    return;
  }
  if (!colors.some(color => color[0] === customization.ribbon)) {
    toast("Choose a ribbon color in Step 4 before continuing.");
    document.getElementById("select-ribbon").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const wrapping = selectedWrapping();
  const extras = Object.values(customization.addons);
  const options = {
    flowers: flowers,
    wrappingMode: customization.wrappingMode,
    wrapping: wrapping,
    ribbon: customization.ribbon,
    addons: extras,
  };
  const details =
    flowers
      .map(function (flower) {
        return flower.quantity + " " + flower.name + " stems";
      })
      .join(" · ") +
    " · " +
    wrapping.name + " · " + customization.ribbon + " ribbon" +
    extras
      .map(function (addon) {
        return " · " + addon.quantity + " " + addon.name + " (" + addon.details + ")";
      })
      .join("");
  const line = {
    productId: "custom-bouquet",
    name: "Customize Flowers",
    image: customFlowers[flowers[0].index].image,
    unitPrice: customBouquetTotal(),
    quantity: customization.quantity,
    options: options,
    details: details,
  };
  if (!PetalStore.lineAvailable(line)) {
    toast("One of your selected flowers or add-ons is unavailable.");
    return;
  }
  try { PetalStore.addLine(line, customization.replaceId); }
  catch (error) { toast(error.message); return; }
  refreshCartUI();
  showSuccess(customization.replaceId ? "Successfully updated your flowers!" : "Successfully added to cart!", "cart.html", "MY CART");
  customization.replaceId = "";
  customization.quantity = 1;
  document.querySelector("[data-add-custom]").textContent = "ADD TO CART";
  history.replaceState(null, "", "customize.html");
}
function initializeCustomization() {
  if (page !== "customize") return;
  const editId = new URLSearchParams(location.search).get("edit");
  const line = editId && PetalStore.getCart().find(item => item.lineId === editId && item.productId === "custom-bouquet");
  if (line) {
    customization.replaceId = line.lineId;
    customization.quantity = line.quantity;
    customization.flowers = Object.fromEntries(line.options.flowers.map(flower => [flower.index, flower.quantity]));
    customization.wrappingMode = line.options.wrappingMode;
    customization.ribbon = line.options.ribbon || "Pink";
    if (customization.wrappingMode === "style") customization.wrapping = wrappings.findIndex(wrapper => wrapper.name === line.options.wrapping.name);
    else customization.color = colors.findIndex(color => color[0] + " plain wrapping" === line.options.wrapping.name);
    customization.addons = Object.fromEntries(line.options.addons.map(addon => [Number(addon.productId.split("-")[1]), addon]));
    document.querySelector("[data-add-custom]").textContent = "SAVE CHANGES";
  }
  updateCustomization();
}
document.addEventListener("click", function (event) {
  if (page !== "customize") return;
  const button = event.target.closest("button");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.choice === "flower") {
    if (Object.hasOwn(customization.flowers, index)) delete customization.flowers[index];
    else customization.flowers[index] = 1;
    updateCustomization();
  } else if (button.dataset.choice === "wrapping") {
    customization.wrappingMode = "style";
    customization.wrapping = index;
    updateCustomization();
  } else if (button.hasAttribute("data-color")) {
    customization.wrappingMode = "color";
    customization.color = Number(button.dataset.color);
    updateCustomization();
  } else if (button.dataset.ribbon) {
    customization.ribbon = button.dataset.ribbon;
    updateCustomization();
  } else if (button.dataset.choice === "addon") {
    const product = { ...addons[index], id: "addon-" + index, addonIndex: index, group: "addon" };
    if (productKind(product) === "letter" && customization.addons[index]) {
      const existing = customization.addons[index];
      const letters = existing.options.letters || [existing.options.letter];
      if (letters.length >= 10) { toast("You can add up to 10 letters. Use EDIT to change your messages."); return; }
      openProductOptions(product, "addon", { ...existing, options: { ...existing.options, letters: [...letters, ""] } });
      const input = document.querySelector(".letter-field:last-child textarea");
      input.focus();
    } else openProductOptions(product, "addon", customization.addons[index]);
  } else if (button.hasAttribute("data-flower-adjust")) {
    const flowerIndex = Number(button.dataset.flowerIndex);
    customization.flowers[flowerIndex] = boundedQuantity(
      (customization.flowers[flowerIndex] || 0) + Number(button.dataset.flowerAdjust),
      0,
      99,
    );
    if (!customization.flowers[flowerIndex]) delete customization.flowers[flowerIndex];
    updateCustomization();
  } else if (button.hasAttribute("data-edit-addon")) {
    const addonIndex = Number(button.dataset.editAddon);
    openProductOptions({ ...addons[addonIndex], id: "addon-" + addonIndex, addonIndex, group: "addon" }, "addon", customization.addons[addonIndex]);
  } else if (button.hasAttribute("data-remove-addon")) {
    delete customization.addons[button.dataset.removeAddon];
    updateCustomization();
  } else if (button.hasAttribute("data-add-custom")) addCustomizedBouquet();
});
document.addEventListener("change", function (event) {
  if (page !== "customize") return;
  if (event.target.id === "builder-ribbon") {
    customization.ribbon = event.target.value;
    updateCustomization();
  } else if (event.target.hasAttribute("data-flower-quantity")) {
    customization.flowers[event.target.dataset.flowerQuantity] = boundedQuantity(
      event.target.value,
      0,
      99,
    );
    if (!customization.flowers[event.target.dataset.flowerQuantity]) delete customization.flowers[event.target.dataset.flowerQuantity];
    updateCustomization();
  }
});
