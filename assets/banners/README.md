# Complete banner flower photos

These banner assets use complete flower photographs already supplied with the project. Their plain catalog backgrounds were removed, and transparent padding was added so petals, leaves, wrapping, and stems are visible. The original banner files remain the mobile and tablet fallback at widths up to 1024px; these complete variants are selected only at desktop widths of 1025px and above.

| New asset | Original project source | Desktop banner use |
| --- | --- | --- |
| lily-gold-complete.webp | shop by collections page elements/flower 6.png | Cart and Checkout; petals recolored warm yellow |
| bouquet-complete.webp | shop by collections page elements/bou flo 1.png | About |
| jasmine-complete.webp | shop by collections page elements/flower 4.png | Contact |
| peony-complete.webp | customize page elements/cost flo 7.png | Collections, All Products, Customize |
| rose-pink-complete.webp | customize page elements/cost flo 8.png | Feedback and Search; petals recolored pink |
| hibiscus-white-complete.webp | shop by collections page elements/flower 5.png | Gallery; petals recolored ivory |
| hibiscus-pink-complete.webp | shop by collections page elements/flower 5.png | Occasions; petals recolored pink |
| chrysanthemum-complete.webp | shop by collections page elements/best flo 4.png | Notifications and Profile |

Only the decorative banner photographs use these variants. Catalog photographs and product data retain their existing colors and files. Desktop banners display flowers with `object-fit: contain` in a separate grid column; their text column grows for longer headings. The Home banner and header/logo sizes retain their previous styles. Mobile and tablet banners use their previous image sources, image attributes, typography, and layout. Each responsive `<picture>` selects the complete desktop image at `min-width: 1025px`, and `display: contents` keeps its image in the existing layout.
