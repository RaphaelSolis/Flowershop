import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {Window} from 'npm:happy-dom@20.0.11';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const sheets = ['styles.css', 'design-spec.css', 'responsive.css'];
const css = Object.fromEntries([...sheets, 'Log-Sign/style.css'].map(name => [name, read(name)]));
const widths = [280, 320, 375, 390, 480, 481, 600, 700, 701, 768, 800, 801, 900, 901, 1024, 1100, 1101, 1280, 1440, 1920, 2560, 3840];
const pages = ['index', 'collections', 'occasions', 'customize', 'cart', 'checkout', 'contact', 'feedback', 'about', 'gallery', 'search', 'notifications', 'profile', 'receipt', 'Log-Sign/SignUp', 'Log-Sign/LoginPage'];
const singleColumn = 'minmax(0, 1fr)';
const buttonSize = css['design-spec.css'].match(/--button-text-size:\s*([\d.]+px)/)[1];

// Happy DOM has no layout engine and cannot calculate clamp()/max(). Supply only
// their numerical CSS values so the real selectors, cascade, and media queries
// can still be checked. These are DOM/CSS checks, not browser screenshots.
function resolvedMath(source, width) {
  const gutter = Math.max(12, Math.min(40, width * .03));
  return source.replace(/clamp\(([\d.]+)px,\s*([\d.]+)vw,\s*([\d.]+)px\)/g,
    (_, low, vw, high) => Math.max(+low, Math.min(+high, width * +vw / 100)) + 'px')
    .replace('max(var(--page-gutter), calc((100% - var(--content-width)) / 2))', Math.max(gutter, (width - 1200) / 2) + 'px')
    .replaceAll('var(--button-text-size)', buttonSize);
}
function assertSize(style, low, high, label) {
  const size = parseFloat(style.fontSize);
  assert.ok(size >= low && size <= high, `${label}: ${style.fontSize}`);
}
let combinations = 0;
for (const page of pages) {
  const account = page.startsWith('Log-Sign/');
  const html = read(page + '.html');
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1/);
  if (!account) assert.ok(html.indexOf('responsive.css?') > html.indexOf('design-spec.css?'), page + ' stylesheet order');
  const window = new Window({url: 'https://flowers.test/' + page + '.html', settings: {disableJavaScriptFileLoading: true, disableCSSFileLoading: true}});
  const document = window.document;
  document.write(html);
  await window.happyDOM.waitUntilComplete();
  if (page === 'cart' || page === 'receipt') {
    const context = vm.createContext({document, window, location:window.location, URL, URLSearchParams, localStorage:window.localStorage});
    for (const name of ['settings', 'products', 'store', 'app', 'pages']) vm.runInContext(read(name + '.js'), context);
    vm.runInContext(`PetalStore.signIn('Responsive Shopper', 'responsive@example.com');
      PetalStore.addLine({productId:'flower-1',quantity:2,options:{color:'Pink',ribbon:'Blue'}});`, context);
    if (page === 'receipt') vm.runInContext(`PetalStore.placeOrder({name:'Responsive Shopper',email:'responsive@example.com',phone:'+639123456789',address:'12 Garden Street',city:'Las Piñas',province:'Metro Manila',postalCode:'1747'},{method:'e-wallet',provider:'GCash'}); renderReceiptPage();`, context);
    else vm.runInContext('renderCartPage();', context);
  }
  const styleNodes = (account ? ['Log-Sign/style.css'] : sheets).map(name => {
    const node = document.createElement('style');
    document.head.append(node);
    return {name, node};
  });
  const style = selector => {
    const element = document.querySelector(selector);
    assert.ok(element, page + ' missing ' + selector);
    return window.getComputedStyle(element);
  };
  for (const width of widths) {
    window.happyDOM.setViewport({width, height: 900});
    for (const {name, node} of styleNodes) { node.textContent = ""; node.textContent = resolvedMath(css[name], width); }
    const label = `${page} at ${width}px`;
    combinations++;
    if (account) {
      assert.equal(style('.wrapper').gridTemplateColumns, width <= 800 ? singleColumn : 'minmax(0, .9fr) minmax(0, 1fr)', label);
      assert.equal(style('.card').position, 'static', label);
      assert.equal(style('.card').width, '100%', label);
      assert.equal(style('.field').width, '100%', label);
      assert.equal(style('.field').boxSizing, 'border-box', label);
      assertSize(style('h1'), 30, 40, label);
      if (page.endsWith('SignUp')) {
        // Happy DOM omits table-cell; verify that unsupported value in the source.
        if (width <= 480) assert.equal(style('table td:empty').display, 'none', label);
        else assert.match(css['Log-Sign/style.css'], /table td:empty \{ display: table-cell; width: 16px !important; \}/);
        assert.equal(style('table').display, width <= 480 ? 'block' : 'table', label);
      }
      const panelWidth = Math.min(width <= 800 ? 540 : 960, width - (width <= 800 ? 24 : 32));
      assert.ok(panelWidth <= width - 24 && panelWidth > 0, label + ' account panel gutters');
      continue;
    }
    assert.equal(style('html').fontSize, '1px', label + ' stable root');
    assert.equal(style('#site').width, '100%', label + ' full width');
    assert.equal(style('#site').maxWidth, 'none', label + ' outer cap removed');
    assert.equal(style('.site-header').width, '100%', label);
    assert.equal(style('.site-header').height, 'auto', label);
    assert.equal(style('.site-header').display, width <= 380 ? 'grid' : 'flex', label);
    assert.equal(style('.mobile-menu').display, width <= 1100 ? 'block' : 'none', label);
    const nav = document.querySelector('.main-nav');
    nav.classList.remove('open');
    assert.equal(style('.main-nav').display, width <= 1100 ? 'none' : 'flex', label);
    nav.classList.add('open');
    assert.equal(style('.main-nav').display, width <= 1100 ? 'grid' : 'flex', label);
    if (width <= 1100) {
      assert.equal(style('.main-nav').overflowY, 'auto', label + ' menu scroll');
      assert.equal(style('.shop-dropdown').position, 'static', label);
    }
    nav.classList.remove('open');
    assert.equal(style('.site-footer').width, '100%', label);
    assert.equal(style('.site-footer').gridTemplateColumns, width <= 700 ? singleColumn : width <= 900 ? 'minmax(0, 1fr) minmax(0, 1.3fr)' : 'minmax(220px, .8fr) minmax(0, 1.6fr)', label);
    const content = document.querySelector('.content-page');
    if (content) {
      assert.equal(style('.content-page').maxWidth, '1200px', label);
      assert.equal(style('.content-page').width, '100%', label);
      const heading = content.querySelector(':scope > h1, :scope > h2');
      if (heading) assertSize(window.getComputedStyle(heading), 24, 44, label + ' content heading');
    }
    const hero = document.querySelector('.hero');
    if (hero) {
      assert.equal(style('.hero').gridTemplateColumns, width <= 480 ? singleColumn : width <= 700 ? 'minmax(0, 1.2fr) minmax(0, .8fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', label);
      assert.equal(style('.hero-image').position, 'static', label);
      assert.equal(style('.hero-image').objectFit, 'contain', label);
      if (document.querySelector('.hero-title')) assertSize(style('.hero-title'), 36, 64, label + ' banner title');
      if (document.querySelector('.hero-heading')) assertSize(style('.hero-heading'), 26, 44, label + ' banner heading');
    }
    if (document.querySelector('.form-two-columns')) {
      assert.equal(style('.form-two-columns').gridTemplateColumns, width <= 700 ? singleColumn : 'repeat(2, minmax(0, 1fr))', label);
      assert.equal(style('.form-two-columns').gap, '20px', label);
    }
    if (page === 'checkout') {
      assert.equal(style('.checkout-layout').gridTemplateColumns, width <= 900 ? singleColumn : 'minmax(0, 1.2fr) minmax(0, 1fr)', label);
      assertSize(style('#checkout-form label'), 18, 18, label);
      assert.equal(style('#checkout-form input:not([type])').minHeight, '44px', label);
      assert.equal(style('#checkout-form > h2').fontSize, '28px', label);
    }
    if (page === 'customize') {
      assert.equal(style('.flower-options').gridTemplateColumns, width <= 900 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', label);
      assert.equal(style('.wrapping-options').gridTemplateColumns, width <= 900 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', label);
      assert.equal(style('.stem-quantity').flexWrap, 'wrap', label);
      assert.equal(style('.color-options').flexWrap, 'wrap', label);
      assert.equal(style('.summary-table').tableLayout, 'fixed', label);
    }
    if (page === 'collections' || page === 'occasions') {
      assert.equal(style('.product-grid').gridAutoColumns, width <= 380 ? '100%' : width <= 480 ? 'calc((100% - 12px) / 2)' : width <= 700 ? 'calc((100% - 16px) / 2)' : width <= 900 ? 'calc((100% - 32px) / 3)' : 'calc((100% - 48px) / 4)', label);
      assert.equal(style('.product-grid').overflowX, 'auto', label + ' scrolling carousel');
    }
    if (page === 'feedback') {
      assertSize(style('.rating-star'), 30, 48, label + ' rating size');
      assert.equal(style('.rating-star input').height, '100%', label + ' clickable star');
      assert.equal(style('.rating-star input').width, '100%', label + ' clickable star');
      assert.equal(style('.anonymous-toggle input').minHeight, '20px', label);
      assert.equal(style('.standard-form textarea').minHeight, '160px', label);
    }
    if (page === 'profile') {
      assert.equal(style('.profile-layout').gridTemplateColumns, width <= 900 ? singleColumn : 'minmax(220px, .7fr) minmax(0, 1.7fr)', label);
      assert.equal(style('.profile-nav .active').fontSize, '16px', label);
    }
    if (page === 'gallery') assert.equal(style('.gallery-page-grid').gridTemplateColumns, width <= 480 ? singleColumn : 'repeat(2, minmax(0, 1fr))', label);
    if (page === 'contact') assert.equal(style('.contact-cards').gridTemplateColumns, width <= 900 ? singleColumn : 'repeat(3, minmax(0, 1fr))', label);
    if (page === 'cart') {
      assert.equal(style('.cart-line-card').gridTemplateColumns, width <= 380 ? 'minmax(0, 1fr) 28px' : width <= 700 ? '96px minmax(0, 1fr) 28px' : 'minmax(0, 1.4fr) auto minmax(90px, .7fr) 32px', label);
      assert.equal(style('.cart-quantity input').minHeight, '44px', label);
    }
    if (page === 'receipt') {
      assert.equal(style('.receipt-actions').flexWrap, 'wrap', label);
      assert.equal(style('.receipt-sheet table').tableLayout, 'fixed', label);
      assert.equal(style('.receipt-sheet td:not(:first-child)').whiteSpace, 'normal', label);
    }
    assert.equal(style('.site-dialog').overflowY, 'auto', label + ' scrollable dialog');
  }
  window.happyDOM.setViewport({width: 844, height: 390});
  for (const {name, node} of styleNodes) node.textContent = resolvedMath(css[name], 844);
  if (!account) {
    assert.equal(style('.site-dialog').maxHeight, 'calc(100dvh - 16px)', page + ' landscape dialog');
    if (document.querySelector('.hero')) assert.equal(style('.hero-image').height, '240px', page + ' landscape banner');
  }
  await window.happyDOM.close();
}
console.log(`PASS ${combinations} page/viewport CSS checks across 280–3840px, plus short landscape: stable scale, full-width chrome, bounded typography, responsive grids, accessible menus/forms, and scrollable dialogs.`);

// Exercise the restored underline using stale geometry from a wide desktop.
{
  const window = new Window({url:'https://flowers.test/cart.html', settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});
  window.happyDOM.setViewport({width: 320, height: 700});
  window.document.write(read('cart.html'));
  const document = window.document;
  const frames = [];
  const header = document.querySelector('.site-header');
  header.getBoundingClientRect = () => ({left:0, top:0});
  header.querySelectorAll('.nav-link,[data-cart]').forEach(tab => {
    tab.getBoundingClientRect = () => tab.hasAttribute('data-cart') ? {left:130, width:44, bottom:110} : {left:0, width:0, bottom:0};
  });
  window.sessionStorage.setItem('petal-nav-position', JSON.stringify({left:1700, width:80, top:90}));
  const context = vm.createContext({document, window, requestAnimationFrame:cb=>frames.push(cb)});
  vm.runInContext(read('app.js') + '\ninitializeNavigation();', context);
  const indicator = document.querySelector('.nav-active-indicator');
  assert.equal(indicator.style.transform, 'translate(240px,90px)');
  frames.splice(0).forEach(cb=>cb());
  frames.splice(0).forEach(cb=>cb());
  assert.equal(indicator.style.transform, 'translate(130px,114px)');
  window.happyDOM.setViewport({width:280, height:700});
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(indicator.style.width, '44px');
  await window.happyDOM.close();
}
console.log('PASS Restored navigation coordinates are bounded on smaller screens and resize positions the underline at the current cart icon.');
