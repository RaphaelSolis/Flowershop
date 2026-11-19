/*
THE PETAL HAUS — PRODUCT INFORMATION

This file is the price list used by the cart, search, and customization form.
The visible page headings and photos are in the HTML files.

HOW TO READ ONE PRODUCT:
  id      = the product code used by its Add to Cart button
  name    = the name shown in the cart and search
  price   = price in Philippine pesos (a number, without PHP or commas)
  image   = the picture file used in the cart
  section = the product category
  group   = which shop page the product belongs to

Example: changing price: 120 to price: 150 changes the cart price.
Some supplied product pictures already have prices printed inside the image.
Changing this file cannot change words printed inside an image.

Keep the id the same unless you also change the matching data-add in the HTML.
Read group-guide.html for a step-by-step explanation.
*/

// SHOP PRODUCTS — collections first, then occasions
const allProducts = [
  // FLOWER
  {
    id: "flower-1",
    name: "Tulip",
    price: 120,
    image: "assets/collections/flo-1.png",
    section: "flower",
    group: "collections",
  },
  {
    id: "flower-2",
    name: "Daisy",
    price: 80,
    image: "assets/collections/flo-2.png",
    section: "flower",
    group: "collections",
  },
  {
    id: "flower-3",
    name: "Sunflower",
    price: 100,
    image: "assets/collections/flo-3.png",
    section: "flower",
    group: "collections",
  },
  {
    id: "flower-4",
    name: "Jasmine",
    price: 70,
    image: "assets/collections/flo-4.png",
    section: "flower",
    group: "collections",
  },
  {
    id: "flower-5",
    name: "Hibiscus",
    price: 60,
    image: "assets/collections/flo-5.png",
    section: "flower",
    group: "collections",
  },
  {
    id: "flower-6",
    name: "Lily",
    price: 150,
    image: "assets/collections/flo-6.png",
    section: "flower",
    group: "collections",
  },
  // BOUQUET
  {
    id: "bouquet-1",
    name: "Sweet Bouquet",
    price: 1499,
    image: "assets/collections/bou-1.png",
    section: "bouquet",
    group: "collections",
  },
  {
    id: "bouquet-2",
    name: "Love Lavender",
    price: 1599,
    image: "assets/collections/bou-2.png",
    section: "bouquet",
    group: "collections",
  },
  {
    id: "bouquet-3",
    name: "Summer Charm",
    price: 1399,
    image: "assets/collections/bou-3.png",
    section: "bouquet",
    group: "collections",
  },
  {
    id: "bouquet-4",
    name: "Romantic Bloom",
    price: 1599,
    image: "assets/collections/bou-4.png",
    section: "bouquet",
    group: "collections",
  },
  {
    id: "bouquet-5",
    name: "Coral Blush",
    price: 1499,
    image: "assets/collections/bou-5.png",
    section: "bouquet",
    group: "collections",
  },
  {
    id: "bouquet-6",
    name: "Elegant Roses",
    price: 1399,
    image: "assets/collections/bou-6.png",
    section: "bouquet",
    group: "collections",
  },
  // NEW ARRIVAL
  {
    id: "new-arrival-1",
    name: "Bougainvillea",
    price: 125,
    image: "assets/collections/new-1.png",
    section: "new-arrival",
    group: "collections",
  },
  {
    id: "new-arrival-2",
    name: "Orchid",
    price: 80,
    image: "assets/collections/new-2.png",
    section: "new-arrival",
    group: "collections",
  },
  {
    id: "new-arrival-3",
    name: "Chrysanthemum",
    price: 80,
    image: "assets/collections/new-3.png",
    section: "new-arrival",
    group: "collections",
  },
  {
    id: "new-arrival-4",
    name: "The Great Peonies",
    price: 1399,
    image: "assets/collections/new-4.png",
    section: "new-arrival",
    group: "collections",
  },
  {
    id: "new-arrival-5",
    name: "Iris",
    price: 100,
    image: "assets/collections/new-5.png",
    section: "new-arrival",
    group: "collections",
  },
  {
    id: "new-arrival-6",
    name: "Hyacinth",
    price: 100,
    image: "assets/collections/new-6.png",
    section: "new-arrival",
    group: "collections",
  },
  // BEST SELLERS
  {
    id: "best-sellers-1",
    name: "Sunflower",
    price: 100,
    image: "assets/collections/best-1.png",
    section: "best-sellers",
    group: "collections",
  },
  {
    id: "best-sellers-2",
    name: "Love Lavender",
    price: 699,
    image: "assets/collections/best-2.png",
    section: "best-sellers",
    group: "collections",
  },
  {
    id: "best-sellers-3",
    name: "Coral Blush",
    price: 1499,
    image: "assets/collections/best-3.png",
    section: "best-sellers",
    group: "collections",
  },
  {
    id: "best-sellers-4",
    name: "Chrysanthemum",
    price: 80,
    image: "assets/collections/best-4.png",
    section: "best-sellers",
    group: "collections",
  },
  {
    id: "best-sellers-5",
    name: "Dahlia",
    price: 1500,
    image: "assets/collections/best-5.png",
    section: "best-sellers",
    group: "collections",
  },
  {
    id: "best-sellers-6",
    name: "Tulip",
    price: 120,
    image: "assets/collections/best-6.png",
    section: "best-sellers",
    group: "collections",
  },
  // POTTED FLOWERS
  {
    id: "potted-flowers-1",
    name: "Dahlia",
    price: 1500,
    image: "assets/collections/pot-1.png",
    section: "potted-flowers",
    group: "collections",
  },
  {
    id: "potted-flowers-2",
    name: "White Chrysanthemums",
    price: 1500,
    image: "assets/collections/pot-2.png",
    section: "potted-flowers",
    group: "collections",
  },
  {
    id: "potted-flowers-3",
    name: "Lupine",
    price: 1500,
    image: "assets/collections/pot-3.png",
    section: "potted-flowers",
    group: "collections",
  },
  {
    id: "potted-flowers-4",
    name: "Tillandsia",
    price: 1500,
    image: "assets/collections/pot-4.png",
    section: "potted-flowers",
    group: "collections",
  },
  {
    id: "potted-flowers-5",
    name: "Petunai",
    price: 1500,
    image: "assets/collections/pot-5.png",
    section: "potted-flowers",
    group: "collections",
  },
  {
    id: "potted-flowers-6",
    name: "Begonia",
    price: 1500,
    image: "assets/collections/pot-6.png",
    section: "potted-flowers",
    group: "collections",
  },
  // GIFTS
  {
    id: "gifts-1",
    name: "Stuffed Toy",
    price: 700,
    image: "assets/collections/gift-1.png",
    section: "gifts",
    group: "collections",
  },
  {
    id: "gifts-2",
    name: "Ferrero",
    price: 200,
    image: "assets/collections/gift-2.png",
    section: "gifts",
    group: "collections",
  },
  {
    id: "gifts-3",
    name: "Greeting Card",
    price: 30,
    image: "assets/collections/gift-3.png",
    section: "gifts",
    group: "collections",
  },
  {
    id: "gifts-4",
    name: "Customized Letter",
    price: 150,
    image: "assets/collections/gift-4.png",
    section: "gifts",
    group: "collections",
  },
  {
    id: "gifts-5",
    name: "Scented Candle",
    price: 250,
    image: "assets/collections/gift-5.png",
    section: "gifts",
    group: "collections",
  },
  {
    id: "gifts-6",
    name: "Pepero",
    price: 150,
    image: "assets/collections/gift-6.png",
    section: "gifts",
    group: "collections",
  },
  // BIRTHDAY
  {
    id: "birthday-1",
    name: "Blushing Romance",
    price: 1499,
    image: "assets/occasions/birthday-1.png",
    section: "birthday",
    group: "occasions",
  },
  {
    id: "birthday-2",
    name: "Sweet Serenity",
    price: 1799,
    image: "assets/occasions/birthday-2.png",
    section: "birthday",
    group: "occasions",
  },
  {
    id: "birthday-3",
    name: "Garden Whisper",
    price: 2339,
    image: "assets/occasions/birthday-3.png",
    section: "birthday",
    group: "occasions",
  },
  {
    id: "birthday-4",
    name: "Peony Dreams",
    price: 2299,
    image: "assets/occasions/birthday-4.png",
    section: "birthday",
    group: "occasions",
  },
  {
    id: "birthday-5",
    name: "Stargazer Elegance",
    price: 2499,
    image: "assets/occasions/birthday-5.png",
    section: "birthday",
    group: "occasions",
  },
  {
    id: "birthday-6",
    name: "Pink Paradise",
    price: 3299,
    image: "assets/occasions/birthday-6.png",
    section: "birthday",
    group: "occasions",
  },
  // WEDDING
  {
    id: "wedding-1",
    name: "Pure Grace",
    price: 1299,
    image: "assets/occasions/wedding-1.png",
    section: "wedding",
    group: "occasions",
  },
  {
    id: "wedding-2",
    name: "Ivory Luxe",
    price: 2499,
    image: "assets/occasions/wedding-2.png",
    section: "wedding",
    group: "occasions",
  },
  {
    id: "wedding-3",
    name: "Lavender Blush",
    price: 2199,
    image: "assets/occasions/wedding-3.png",
    section: "wedding",
    group: "occasions",
  },
  {
    id: "wedding-4",
    name: "Heavenly Vows",
    price: 2799,
    image: "assets/occasions/wedding-4.png",
    section: "wedding",
    group: "occasions",
  },
  {
    id: "wedding-5",
    name: "Champagne Kiss",
    price: 2399,
    image: "assets/occasions/wedding-5.png",
    section: "wedding",
    group: "occasions",
  },
  {
    id: "wedding-6",
    name: "Snow Pearl",
    price: 1999,
    image: "assets/occasions/wedding-6.png",
    section: "wedding",
    group: "occasions",
  },
  // ANNIVERSARY
  {
    id: "anniversary-1",
    name: "Bright sunflowers",
    price: 1299,
    image: "assets/occasions/anniversary-1.png",
    section: "anniversary",
    group: "occasions",
  },
  {
    id: "anniversary-2",
    name: "Classic red roses",
    price: 1999,
    image: "assets/occasions/anniversary-2.png",
    section: "anniversary",
    group: "occasions",
  },
  {
    id: "anniversary-3",
    name: "Sweet Pink Blooms",
    price: 1499,
    image: "assets/occasions/anniversary-3.png",
    section: "anniversary",
    group: "occasions",
  },
  {
    id: "anniversary-4",
    name: "Soft pink flowers",
    price: 1799,
    image: "assets/occasions/anniversary-4.png",
    section: "anniversary",
    group: "occasions",
  },
  {
    id: "anniversary-5",
    name: "Rosy Romance",
    price: 2499,
    image: "assets/occasions/anniversary-5.png",
    section: "anniversary",
    group: "occasions",
  },
  {
    id: "anniversary-6",
    name: "Eternal Love",
    price: 2299,
    image: "assets/occasions/anniversary-6.png",
    section: "anniversary",
    group: "occasions",
  },
  // ACHIEVEMENT
  {
    id: "achievement-1",
    name: "Blossom of Success",
    price: 1399,
    image: "assets/occasions/achievement-1.png",
    section: "achievement",
    group: "occasions",
  },
  {
    id: "achievement-2",
    name: "New Beginnings",
    price: 1299,
    image: "assets/occasions/achievement-2.png",
    section: "achievement",
    group: "occasions",
  },
  {
    id: "achievement-3",
    name: "Dream Chaser",
    price: 1899,
    image: "assets/occasions/achievement-3.png",
    section: "achievement",
    group: "occasions",
  },
  {
    id: "achievement-4",
    name: "Milestone Moments",
    price: 2099,
    image: "assets/occasions/achievement-4.png",
    section: "achievement",
    group: "occasions",
  },
  {
    id: "achievement-5",
    name: "Triumph Bloom",
    price: 1799,
    image: "assets/occasions/achievement-5.png",
    section: "achievement",
    group: "occasions",
  },
  {
    id: "achievement-6",
    name: "Blue Horizon",
    price: 1999,
    image: "assets/occasions/achievement-6.png",
    section: "achievement",
    group: "occasions",
  },
  // SYMPATHY
  {
    id: "sympathy-1",
    name: "Eternal Remembrance Wreath",
    price: 3999,
    image: "assets/occasions/sympathy-1.png",
    section: "sympathy",
    group: "occasions",
  },
  {
    id: "sympathy-2",
    name: "Peaceful Tribute Stand",
    price: 3499,
    image: "assets/occasions/sympathy-2.png",
    section: "sympathy",
    group: "occasions",
  },
  {
    id: "sympathy-3",
    name: "Sacred Memories Stand",
    price: 4299,
    image: "assets/occasions/sympathy-3.png",
    section: "sympathy",
    group: "occasions",
  },
  {
    id: "sympathy-4",
    name: "Serenity",
    price: 2999,
    image: "assets/occasions/sympathy-4.png",
    section: "sympathy",
    group: "occasions",
  },
  {
    id: "sympathy-5",
    name: "Heavenly Grace",
    price: 3499,
    image: "assets/occasions/sympathy-5.png",
    section: "sympathy",
    group: "occasions",
  },
  {
    id: "sympathy-6",
    name: "Forever in Our Hearts",
    price: 3799,
    image: "assets/occasions/sympathy-6.png",
    section: "sympathy",
    group: "occasions",
  },
  // THANK YOU
  {
    id: "thank-you-1",
    name: "Grateful Heart Basket",
    price: 1499,
    image: "assets/occasions/thank-you-1.png",
    section: "thank-you",
    group: "occasions",
  },
  {
    id: "thank-you-2",
    name: "Appreciation Blooms Basket",
    price: 1899,
    image: "assets/occasions/thank-you-2.png",
    section: "thank-you",
    group: "occasions",
  },
  {
    id: "thank-you-3",
    name: "Sweet Gratitude Basket",
    price: 1699,
    image: "assets/occasions/thank-you-3.png",
    section: "thank-you",
    group: "occasions",
  },
  {
    id: "thank-you-4",
    name: "Thankful Wishes Basket",
    price: 1799,
    image: "assets/occasions/thank-you-4.png",
    section: "thank-you",
    group: "occasions",
  },
  {
    id: "thank-you-5",
    name: "Endless Appreciation Basket",
    price: 2099,
    image: "assets/occasions/thank-you-5.png",
    section: "thank-you",
    group: "occasions",
  },
  {
    id: "thank-you-6",
    name: "Blooming Thanks Basket",
    price: 1999,
    image: "assets/occasions/thank-you-6.png",
    section: "thank-you",
    group: "occasions",
  },
];

// CUSTOMIZATION — flower prices per stem
const customFlowers = [
  {
    name: "Tulip",
    price: 120,
    image: "assets/customize/cost-1.png",
  },
  {
    name: "Daisy",
    price: 80,
    image: "assets/customize/cost-2.png",
  },
  {
    name: "Sunflower",
    price: 100,
    image: "assets/customize/cost-3.png",
  },
  {
    name: "Jasmine",
    price: 70,
    image: "assets/customize/cost-4.png",
  },
  {
    name: "Hibiscus",
    price: 60,
    image: "assets/customize/cost-5.png",
  },
  {
    name: "Lily",
    price: 150,
    image: "assets/customize/cost-6.png",
  },
  {
    name: "Peony",
    price: 150,
    image: "assets/customize/cost-7.png",
  },
  {
    name: "Rose",
    price: 150,
    image: "assets/customize/cost-8.png",
  },
];

// CUSTOMIZATION — wrapping choices
const wrappings = [
  {
    name: "Kraft Paper Wrapping",
    price: 60,
    image: "assets/customize/wrap-1.webp",
  },
  {
    name: "Newspaper",
    price: 60,
    image: "assets/customize/wrap-2.webp",
  },
  {
    name: "Fabric",
    price: 60,
    image: "assets/customize/wrap-3.webp",
  },
  {
    name: "Cellophane",
    price: 60,
    image: "assets/customize/wrap-4.webp",
  },
];

// CUSTOMIZATION — optional extras
const addons = [
  {
    name: "Ferrero Rocher",
    price: 250,
    image: "assets/customize/add-1.png",
  },
  {
    name: "Stuffed Toy",
    price: 250,
    image: "assets/customize/add-2.png",
  },
  {
    name: "Scented Candle",
    price: 250,
    image: "assets/customize/add-3.png",
  },
  {
    name: "Pepero",
    price: 150,
    image: "assets/customize/add-4.png",
  },
  {
    name: "Customized Letter",
    price: 150,
    image: "assets/collections/gift-4.png",
  },
  {
    name: "Greeting Card",
    price: 30,
    image: "assets/collections/gift-3.png",
  },
];

// CUSTOMIZATION — wrapping colors
const colors = [
  ["Pink", "#ef6e99"],
  ["Red", "#ff0000"],
  ["Maroon", "#4c070f"],
  ["Black", "#000000"],
  ["Purple", "#cb6ce6"],
  ["Blue", "#5170ff"],
  ["White", "#ffffff"],
  ["Blush", "#d2a6a6"],
  ["Olive", "#76794d"],
];

// Ferrero Rocher price depends on the chosen number of pieces.
// The left number is the pack size; the right number is the price in pesos.
const ferreroPrices = {
  3: 150,
  5: 250,
  8: 400,
  12: 600,
};

// Presentation controls follow the arrangement shown in each product photo.
function flowerPresentation(product) {
  if (product.section === "potted-flowers" || product.id === "best-sellers-5") return "potted";
  if (product.section === "sympathy") return "sympathy";
  if (product.section === "thank-you" || ["bouquet-5", "best-sellers-3"].includes(product.id)) return "basket";
  return "wrapped";
}
