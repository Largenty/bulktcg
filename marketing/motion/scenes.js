/* Les plans du film : le décor de chaque plan, puis son mouvement.

   Le décor reprend les composants du site — la vignette gradée, les
   intercalaires, la recherche, le sélecteur de statut, la demande de
   recherche — dessinés à leur taille réelle puis agrandis : ce que le film
   montre est ce que le site affiche, pas une maquette inventée.

   Tous les textes portent les espaces insécables du français : NB devant
   « : » et dans les guillemets, FINE devant « ? », « ! » et « ; ». */

(function () {
  "use strict";

  const { Timeline, seeded, splitWords } = window.Motion;
  const CONFIG = window.FILM_CONFIG;

  const DURATION = 50;
  const NB = " ";
  const FINE = " ";

  const CHAPTERS = [
    { t: 0, label: "Le stock qui dort" },
    { t: 6, label: "Les impasses" },
    { t: 10.5, label: "La marque" },
    { t: 13.4, label: "Le site" },
    { t: 19.9, label: "Le dépôt" },
    { t: 25.8, label: "Le croisement" },
    { t: 30.3, label: "Vendu en un clic" },
    { t: 34.7, label: "Les boutiques" },
    { t: 37.7, label: "Ce que ça rapporte" },
    { t: 45.6, label: "Fin" },
  ];

  /* L'ordre et les libellés de src/types/game.ts et lib/labels.ts. */
  const GAMES = [
    { id: "pokemon", label: "Pokémon" },
    { id: "magic", label: "Magic" },
    { id: "onepiece", label: "One Piece" },
    { id: "lorcana", label: "Lorcana" },
    { id: "riftbound", label: "Riftbound" },
    { id: "yugioh", label: "Yu-Gi-Oh" },
    { id: "naruto", label: "Naruto" },
    { id: "other", label: "Autre" },
  ];
  const NAMED = GAMES.filter((game) => game.id !== "other");

  /* Le jeu d'icônes du site (src/components/ui/Icon.tsx), trait carré. */
  const ICONS = {
    search: "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm5.3-2.2L21 21",
    chevronDown: "M6 9l6 6 6-6",
    plus: "M12 5v14M5 12h14",
    camera: "M4 8h3l1.6-2.2h6.8L17 8h3v11H4zM12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
    sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    check: "M4.5 12.5l5 5 10-11",
    bell: "M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zm4 11a2.2 2.2 0 0 0 4 0",
    box: "M3.5 8.5 12 4l8.5 4.5v9L12 22l-8.5-4.5zM3.5 8.5 12 13l8.5-4.5M12 13v9",
    lock: "M6 11h12v9H6zm2.5 0V8a3.5 3.5 0 0 1 7 0v3",
    moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
    message: "M4 5h16v11H9l-5 4z",
    menu: "M4 7h16M4 12h16M4 17h16",
    alert: "M12 4 2.8 19.5h18.4zM12 10v4.5m0 2.7v.1",
  };
  const icon = (name, className = "") =>
    `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

  const euros = (cents, decimals = 0) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(cents / 100);
  const grouped = (value) => new Intl.NumberFormat("fr-FR").format(Math.round(value));

  /* ---------- les chiffres du comparatif, calculés depuis config.js ---------- */

  const LOT = CONFIG.lot;
  const KEEP = CONFIG.marketplaces.map((market) => {
    const feeCents = Math.round(LOT.priceCents * market.feeRate);
    return { ...market, feeCents, keepCents: LOT.priceCents - feeCents };
  });
  const feeText = (market) =>
    market.feeCents === 0
      ? euros(0)
      : `${euros(market.feeCents, 2)} (${grouped(market.feeRate * 100)}${NB}%)`;

  /* ---------- dessins ---------- */

  /* Le symbole de BulkTCG : la géométrie de src/lib/brand-mark.ts. */
  function markSvg({ outline = false } = {}) {
    const layerHeight = 13 / NAMED.length;
    const fronts = [];
    const sides = [];
    NAMED.forEach((game, index) => {
      const top = 13 + index * layerHeight;
      const height = layerHeight + 0.05;
      const bottom = top + height;
      fronts.push(`<rect x="3.5" y="${top}" width="15" height="${height}" fill="var(--${game.id})"/>`);
      sides.push(
        `<polygon points="18.5,${top} 28.5,${top - 7.5} 28.5,${bottom - 7.5} 18.5,${bottom}" style="fill: color-mix(in srgb, var(--${game.id}) 68%, var(--print-ink))"/>`,
      );
    });
    return `<svg viewBox="0 0 32 32" aria-hidden="true">
      <g class="mk-top" style="transform-box: view-box; transform-origin: 16px 13px">
        <polygon points="3.5,13 18.5,13 28.5,5.5 13.5,5.5" fill="var(--print-white)"/>
        <polygon points="7.4,12 17.6,12 24.6,6.6 14.4,6.6" fill="none" stroke="var(--print-ink)" stroke-opacity="0.28" stroke-width="0.9" stroke-linejoin="round"/>
      </g>
      <g class="mk-side" style="transform-box: view-box; transform-origin: 18.5px 19.5px">${sides.join("")}</g>
      <g class="mk-front">${fronts.join("")}</g>
      ${
        outline
          ? `<polygon class="mk-outline" points="3.5,13 13.5,5.5 28.5,5.5 28.5,18.5 18.5,26 3.5,26" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" pathLength="1" style="stroke-dasharray: 1"/>`
          : ""
      }
    </svg>`;
  }

  /* Une page de classeur : neuf pochettes, neuf cartes aux couleurs des jeux. */
  function binderSvg() {
    const colors = ["pokemon", "magic", "onepiece", "lorcana", "riftbound", "yugioh", "naruto", "pokemon", "magic"];
    const width = 62;
    const height = 90;
    const cards = [];
    const slots = [];
    const gloss = [];
    colors.forEach((color, index) => {
      const x = 116 + (index % 3) * (width + 10);
      const y = 52 + Math.floor(index / 3) * (height + 10);
      slots.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="none" stroke="var(--chalk-muted)" stroke-width="2"/>`);
      cards.push(`<g class="b-card" style="transform-box: fill-box; transform-origin: center">
        <rect x="${x + 5}" y="${y + 5}" width="${width - 10}" height="${height - 10}" rx="3" fill="var(--${color})"/>
        <rect x="${x + 10}" y="${y + 10}" width="${width - 20}" height="${(height - 20) * 0.55}" rx="1.5" fill="none" stroke="rgb(255 255 255 / 0.8)" stroke-width="2"/>
        <rect x="${x + 10}" y="${y + 10 + (height - 20) * 0.64}" width="${width - 20}" height="6" rx="1" fill="rgb(255 255 255 / 0.6)"/>
        <rect x="${x + 10}" y="${y + 10 + (height - 20) * 0.82}" width="${(width - 20) * 0.65}" height="5" rx="1" fill="rgb(255 255 255 / 0.42)"/>
      </g>`);
      gloss.push(`<path d="M${x} ${y + height * 0.3} L${x + width * 0.55} ${y} L${x + width * 0.78} ${y} L${x} ${y + height * 0.48} Z" fill="rgb(255 255 255 / 0.1)"/>`);
    });
    return `<svg viewBox="0 0 400 400" aria-hidden="true">
      <rect x="70" y="30" width="270" height="340" rx="10" fill="var(--slate-raised)" stroke="var(--chalk)" stroke-width="4"/>
      ${[100, 200, 300].map((y) => `<circle cx="93" cy="${y}" r="8" fill="var(--slate)" stroke="var(--chalk)" stroke-width="3"/>`).join("")}
      ${slots.join("")}${cards.join("")}${gloss.join("")}
    </svg>`;
  }

  /* Le carton de vrac, en perspective : une étiquette « 6 KG » sur la face. */
  function cartonSvg(prefix) {
    const weight = `${grouped(LOT.weightKg)}${NB}KG`;
    return `<svg viewBox="0 0 400 400" aria-hidden="true">
      <g class="carton" style="transform-box: fill-box; transform-origin: 50% 100%">
        <polygon points="70,170 230,215 230,345 70,300" fill="var(--kraft)"/>
        <polygon points="230,215 330,165 330,295 230,345" fill="var(--kraft-dark)"/>
        <polygon points="70,170 170,120 330,165 230,215" fill="var(--kraft-light)"/>
        <polygon points="110.2,149.9 129.8,140.1 289.8,185.1 270.2,194.9" fill="var(--tape)"/>
        <polygon points="270.2,194.9 289.8,185.1 289.8,315.1 270.2,324.9" fill="var(--tape)"/>
        <g transform="matrix(1 0.28125 0 1 70 170)">
          <rect x="22" y="38" width="104" height="58" rx="3" fill="var(--print-white)"/>
          <text x="74" y="78" text-anchor="middle" fill="var(--print-ink)" style="font-family: var(--font-display); font-weight: 800; font-size: 30px; font-variation-settings: 'wdth' 104; letter-spacing: 0.04em">${weight}</text>
        </g>
        <path d="M70 170 L170 120 L330 165 L330 295 L230 345 L70 300 Z M70 170 L230 215 L330 165 M230 215 L230 345" fill="none" stroke="var(--chalk)" stroke-width="3.5" stroke-linejoin="round"/>
      </g>
      <g class="dust" id="${prefix}-dust">
        ${[0, 1, 2, 3, 4, 5].map((index) => `<circle class="dust-${index}" cx="${150 + index * 22}" cy="${330 + (index % 2) * 8}" r="${5 + (index % 3)}" fill="var(--chalk-soft)"/>`).join("")}
      </g>
    </svg>`;
  }

  /* Un display scellé, film plastique compris. */
  function displaySvg(prefix) {
    return `<svg viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <clipPath id="${prefix}-clip"><polygon points="90,185 180,140 320,175 320,275 230,320 90,285"/></clipPath>
      </defs>
      <polygon points="90,185 230,220 230,320 90,285" fill="var(--onepiece)"/>
      <polygon points="230,220 320,175 320,275 230,320" style="fill: color-mix(in srgb, var(--onepiece) 62%, var(--print-ink))"/>
      <polygon points="90,185 180,140 320,175 230,220" style="fill: color-mix(in srgb, var(--onepiece) 78%, var(--print-white))"/>
      <polygon points="118,180 180,149 292,177 230,208" fill="none" stroke="rgb(255 255 255 / 0.55)" stroke-width="2.5"/>
      <g transform="matrix(1 0.25 0 1 90 185)">
        <text x="70" y="62" text-anchor="middle" fill="var(--print-white)" style="font-family: var(--font-display); font-weight: 800; font-size: 46px; font-variation-settings: 'wdth' 110">36</text>
        <text x="70" y="86" text-anchor="middle" fill="var(--print-white)" style="font-family: var(--font-display); font-weight: 700; font-size: 15px; font-variation-settings: 'wdth' 110; letter-spacing: 0.14em">BOOSTERS</text>
      </g>
      <g clip-path="url(#${prefix}-clip)">
        <g class="glint"><rect x="0" y="100" width="70" height="260" fill="rgb(255 255 255 / 0.32)" transform="skewX(-24)"/></g>
        <polygon points="90,185 180,140 196,144 106,189" fill="rgb(255 255 255 / 0.22)"/>
      </g>
      <path d="M90 185 L180 140 L320 175 L320 275 L230 320 L90 285 Z M90 185 L230 220 L320 175 M230 220 L230 320" fill="none" stroke="var(--chalk)" stroke-width="3.5" stroke-linejoin="round"/>
    </svg>`;
  }

  /* Le pointeur : une flèche blanche cernée d'encre. */
  const CURSOR_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 2 L2 26 L8.5 20 L13 29.5 L17.5 27.5 L13 18.5 L22 18.5 Z" fill="#ffffff" stroke="#0a0c10" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

  /* ---------- le décor ---------- */

  function stockScene() {
    const items = [
      { art: binderSvg(), eyebrow: "Classeur", line: "Un classeur qui dort." },
      { art: cartonSvg("stock"), eyebrow: "Vrac", line: `Un carton de ${grouped(LOT.weightKg)}${NB}kg.` },
      { art: displaySvg("stock-display"), eyebrow: "Scellé", line: "Un display jamais ouvert." },
    ];
    return `<section class="scene dark" id="s-stock">
      <div class="world">
        <div class="stock-grid">
          ${items
            .map(
              (item, index) => `<figure class="stock-item" id="stock-${index}">
                <div class="stock-art">${item.art}</div>
                <figcaption class="stock-caption">
                  <span class="eyebrow">${item.eyebrow}</span>
                  <span class="display stock-line">${item.line}</span>
                </figcaption>
              </figure>`,
            )
            .join("")}
        </div>
        <h2 class="display stock-question" id="stock-question">Et s’ils trouvaient preneur<br> près de chez vous${FINE}?</h2>
      </div>
    </section>`;
  }

  function deadScene(portrait) {
    const random = seeded(42);
    const count = portrait ? 56 : 60;
    const palette = GAMES.map((game) => game.id);
    const cards = Array.from({ length: count }, () => {
      const color = palette[Math.floor(random() * palette.length)];
      return `<i class="sort-card" style="--c: var(--${color})"></i>`;
    }).join("");
    const postage = CONFIG.postage;
    return `<section class="scene dark" id="s-dead">
      <div class="world">
        <div class="dead-panel" id="dead-a">
          <p class="eyebrow">À l’unité${FINE}?</p>
          <div class="dead-art">
            <div class="sort-grid">${cards}</div>
            <div class="sort-counter"><span class="mono count" id="sort-count">0${FINE}000</span><span class="mono of">/ ${grouped(LOT.cardCount)} cartes</span></div>
          </div>
          <h3 class="display dead-line" id="dead-a-line">Trier ${grouped(LOT.cardCount)} cartes, une par une.</h3>
        </div>
        <div class="dead-panel" id="dead-b">
          <p class="eyebrow">Par la poste${FINE}?</p>
          <div class="dead-art post-art">
            ${cartonSvg("post")}
            <div class="post-label" id="post-label">
              <span class="label">${postage.carrier} · ${postage.bracket.split(",")[0]}</span>
              <span class="price">${euros(postage.priceCents, 2)}</span>
              <span class="post-barcode"></span>
            </div>
          </div>
          <h3 class="display dead-line" id="dead-b-line">Un colis de ${grouped(LOT.weightKg)}${NB}kg${NB}: ${euros(postage.priceCents, 2)} de port.</h3>
          <p class="mono dead-source" id="dead-b-source">${postage.carrier} ${postage.bracket} — La Poste, tarifs 2026.</p>
        </div>
      </div>
    </section>`;
  }

  function dividersHtml() {
    return `<div class="site-dividers"><div class="site-dividers-track">
      <span class="divider divider-all">Tous les jeux</span>
      ${GAMES.map(
        (game) => `<span class="divider" style="--c: var(--${game.id}); --c-ink: var(--${game.id}-ink)">${game.label}<span class="divider-fill">${game.label}</span></span>`,
      ).join("")}
    </div></div>`;
  }

  function brandScene() {
    return `<section class="scene light" id="s-brand">
      <div class="site" id="site">
        <header class="site-head" id="site-head">
          <div class="site-bar">
            <span class="site-logo" id="site-logo"><span class="site-logo-slot" id="site-logo-slot">${markSvg({ outline: true })}</span><span class="wordmark">Bulk<span class="light">TCG</span></span></span>
            <nav class="site-nav">
              <span class="site-nav-item">Annonces ${icon("chevronDown")}</span>
              <span class="site-nav-item">Recherches</span>
              <span class="site-nav-item">Pros</span>
            </nav>
            <span class="site-search site-nav-item">${icon("search")}Vrac, display, EV08…</span>
            <span class="site-tools">
              <span class="site-tool site-tool-item">${icon("moon")}</span>
              <span class="site-tool site-tool-item">${icon("bell")}</span>
              <span class="site-tool site-tool-item">${icon("message")}</span>
              <span class="site-avatar site-tool-item"><i>JC</i></span>
              <span class="site-cta site-tool-item" id="site-cta">${icon("plus")}<span class="cta-short">Déposer</span><span class="cta-long">Déposer une annonce</span></span>
              <span class="site-menu site-tool-item">${icon("menu")}</span>
            </span>
          </div>
          <div class="site-tranche tranche" id="site-tranche">${NAMED.map((game) => `<i style="background: var(--${game.id})"></i>`).join("")}</div>
        </header>
        <div class="site-hero">
          <div class="site-hero-main">
            <div>
              <p class="site-eyebrow" id="site-eyebrow">Partout en France · de la main à la main</p>
              <h1 class="site-h1" id="site-h1">Tout le bulk, près de chez vous.</h1>
            </div>
            <div id="site-search-block">
              <div class="site-searchbar">
                <span class="site-field site-field-what"><b>Quoi</b><span>Vrac, classeur, EV08…</span></span>
                <span class="site-field site-field-where"><b>Où</b><span>Ville ou code postal</span></span>
                <span class="site-go">${icon("search")}Chercher</span>
              </div>
              <p class="site-lead" id="site-lead">Vrac, classeurs, decks et scellé, entre particuliers et en main propre. Ni envoi, ni commission.</p>
            </div>
          </div>
          ${dividersHtml()}
        </div>
      </div>
      <p class="eyebrow brand-tagline" id="brand-tagline">Lots, vrac et scellé · de la main à la main</p>
    </section>`;
  }

  function lotHtml() {
    const title = `Vrac ${grouped(LOT.cardCount)} cartes Écarlate et Violet`;
    return `<div class="hero-card" id="hero-card">
      <article class="lot" id="lot">
        <p class="lot-type label" id="lot-type"><span class="lot-mark" id="lot-mark"></span><span class="lot-type-text" id="lot-type-text"><span>Pokémon</span><span class="lot-type-format">Vrac</span></span></p>
        <span class="lot-price-wrap" id="lot-price-wrap"><span class="lot-price price price-chip">${euros(LOT.priceCents)}</span><span class="lot-sold-chip price" id="lot-sold-chip">${euros(LOT.priceCents)}</span></span>
        <h3 class="lot-title"><span id="lot-title-text" data-full="${title}"></span><span class="caret" id="lot-caret"></span></h3>
        <div class="lot-window" id="lot-window">
          <div class="photo box-photo" id="lot-photo">
            <div class="box-inner">
              <div class="box-row"><span class="box-tab" style="left: 8%">EV08</span></div>
              <div class="box-row"><span class="box-tab" style="left: 38%">EV09</span></div>
              <div class="box-row"><span class="box-tab" style="left: 66%">EV10</span></div>
            </div>
            <div class="box-shade"></div>
          </div>
          <div class="lot-gloss" id="lot-gloss"></div>
          <span class="stamp stamp-reserved" id="stamp-reserved">Réservé</span>
          <span class="stamp stamp-sold" id="stamp-sold">Vendu</span>
          <p class="credit" id="lot-credit"><span>@julie_cartes</span><span class="credit-rating"><span class="credit-star">★</span> <b>4,7</b> (41)</span></p>
        </div>
        <div class="lot-facts">
          <div class="lot-fact">${grouped(LOT.cardCount)} cartes</div>
          <div class="lot-fact"><span class="meter">${[0, 1, 2, 3, 4].map((index) => `<i>${index < 3 ? `<b class="meter-on"></b>` : ""}</i>`).join("")}</span>LP</div>
          <div class="lot-fact">VF</div>
        </div>
        <div class="lot-sets">${["EV08", "EV09", "EV10"].map((code) => `<span class="tag">${code}</span>`).join("")}</div>
        <p class="lot-foot mono" id="lot-foot"><span>Carpentras</span><span>1 min</span></p>
      </article>
    </div>`;
  }

  function depositScene() {
    const slug = `vrac-${grouped(LOT.cardCount).replace(/\D/g, "-").replace(/-+/g, "-")}-cartes-ecarlate-et-violet-carpentras-7f3a2c19`;
    return `<section class="scene light" id="s-deposit">
      <div class="copy" id="dep-copy">
        <p class="eyebrow" id="dep-eyebrow">Déposer une annonce</p>
        <h2 class="display copy-title" id="dep-title">Déposez votre lot.</h2>
        <ul class="steps">
          <li class="step" id="step-0"><span class="step-icon">${icon("camera")}</span><span class="step-text">3 photos gratuites</span></li>
          <li class="step" id="step-1"><span class="step-icon">${icon("sliders")}</span><span class="step-text">Jeu, séries, état, langue</span></li>
          <li class="step" id="step-2"><span class="step-icon">${icon("link")}</span><span class="step-text">Un lien qui ne change jamais</span></li>
        </ul>
        <div class="permalink" id="permalink">
          ${icon("link")}
          <span class="mono permalink-path" id="permalink-path" data-full="/annonces/${slug}"></span>
          <span class="permalink-copy" id="permalink-copy"><span id="copy-idle">Copier</span><span id="copy-done">${icon("check")}Copié</span></span>
        </div>
      </div>
    </section>`;
  }

  const WANTS = [
    { initials: "PI", title: "Vrac Pokémon récent pour compléter mes séries", budgetCents: 20000, place: "Avignon · 30 km", sure: true },
    { initials: "SO", title: "Cherche bulk Écarlate et Violet", budgetCents: 15000, place: "Orange · 25 km", sure: true },
    { initials: "KA", title: "Un gros lot de cartes pour mes enfants", budgetCents: null, place: "Apt · 40 km", sure: false },
  ];

  function matchScene() {
    const sure = WANTS.filter((want) => want.sure).length;
    const unsure = WANTS.length - sure;
    return `<section class="scene light" id="s-match">
      <div class="copy" id="match-copy">
        <p class="eyebrow" id="match-eyebrow">Le croisement</p>
        <h2 class="display copy-title" id="match-title">Les acheteurs déposent ce qu’ils cherchent.</h2>
      </div>
      <svg class="match-lines" id="match-lines" aria-hidden="true">
        ${WANTS.map((_, index) => `<path id="match-line-${index}" pathLength="1"/><circle id="match-dot-${index}" r="9"/>`).join("")}
      </svg>
      <div class="wants">
        ${WANTS.map(
          (want, index) => `<article class="want" id="want-${index}">
            <span class="want-band"></span>
            <p class="want-type label">${icon("search")}<span class="lot-type-text"><span>Recherche</span><span class="lot-type-format">Pokémon — Vrac</span></span></p>
            <p class="want-budget price price-chip-outline">${want.budgetCents === null ? "—" : `≤${NB}${euros(want.budgetCents)}`}</p>
            <h3 class="want-title">${want.title}</h3>
            <div class="want-foot"><span class="avatar">${want.initials}</span><span>${want.place}</span>
              <span class="want-verdict ${want.sure ? "verdict-sure" : "verdict-check"}" id="verdict-${index}">${want.sure ? `${icon("check")}À coup sûr` : `${icon("alert")}À vérifier`}</span>
            </div>
          </article>`,
        ).join("")}
      </div>
      <div class="toast" id="toast-match">
        <span class="toast-icon" id="toast-bell">${icon("bell")}<span class="toast-dot"></span></span>
        <span>
          <p class="toast-title">${WANTS.length} personnes cherchent ce que vous décrivez</p>
          <p class="toast-sub">${sure} correspondent à coup sûr, ${unsure} est à vérifier.</p>
        </span>
      </div>
    </section>`;
  }

  function statusScene() {
    const labels = ["Disponible", "Réservé", "Vendu"];
    return `<section class="scene light" id="s-status">
      <div class="copy" id="status-copy">
        <p class="eyebrow" id="status-eyebrow">Statut de l’annonce</p>
        <h2 class="display copy-title" id="status-title">Vendu${FINE}?<br> Un clic.</h2>
        <p class="copy-sub" id="status-sub">Le lien reste à jour partout où vous l’avez partagé.</p>
      </div>
      <div class="segmented" id="segmented">
        ${labels.map((label, index) => `<span class="segment" id="segment-${index}"><span class="segment-ring" id="segment-ring-${index}"></span><span class="segment-label">${label}</span></span>`).join("")}
      </div>
    </section>`;
  }

  function proScene() {
    return `<section class="scene dark" id="s-pro">
      <div class="copy" id="pro-copy">
        <p class="eyebrow" id="pro-eyebrow">Offre pro</p>
        <h2 class="display copy-title" id="pro-title">Une collection entière${FINE}? Réservez-la aux boutiques.</h2>
        <p class="copy-sub" id="pro-sub">Seules les boutiques au forfait la verront.</p>
      </div>
      <div class="audience" id="audience">
        <p class="audience-q">Qui voit votre annonce${FINE}?</p>
        <div class="audience-option" id="aud-0"><span class="audience-ring" id="aud-ring-0"></span><span class="radio"><b id="aud-dot-0"></b></span>Tout le monde</div>
        <div class="audience-option" id="aud-1"><span class="audience-ring" id="aud-ring-1"></span><span class="radio"><b id="aud-dot-1"></b></span>Professionnels uniquement</div>
        <span class="audience-badge label" id="aud-badge">${icon("lock")}Réservée aux pros</span>
      </div>
    </section>`;
  }

  function keepScene() {
    const postage = CONFIG.postage;
    const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${CONFIG.checkedOn}T12:00:00`));
    return `<section class="scene light" id="s-keep">
      <div class="copy" id="keep-copy">
        <p class="eyebrow" id="keep-eyebrow">Ce que ça rapporte</p>
        <h2 class="display copy-title" id="keep-title">Un lot vendu ${euros(LOT.priceCents)}.</h2>
      </div>
      <div class="keep-grid">
        ${KEEP.map(
          (market, index) => `<article class="keep-card ${market.id === "bulktcg" ? "us" : ""}" id="keep-${index}">
            ${market.id === "bulktcg" ? `<div class="tranche">${NAMED.map((game) => `<i style="background: var(--${game.id})"></i>`).join("")}</div>` : ""}
            <p class="keep-name">${market.name}</p>
            <dl class="keep-row" id="keep-${index}-fee"><dt>${market.feeLabel}</dt><dd>${feeText(market)}</dd></dl>
            <dl class="keep-row" id="keep-${index}-ship"><dt>Envoi</dt><dd>${market.shipping}</dd></dl>
            <div class="keep-total" id="keep-${index}-total"><p class="price" id="keep-${index}-amount">${euros(0, 2)}</p><span>vous restent</span></div>
          </article>`,
        ).join("")}
      </div>
      <p class="keep-note" id="keep-note">${icon("box")}<span>Sans envoi, votre acheteur ne paie pas de port${NB}: <b>${euros(postage.priceCents, 2)}</b> pour un colis de ${grouped(LOT.weightKg)}${NB}kg en ${postage.carrier}.</span></p>
      <p class="mono keep-sources" id="keep-sources">Relevé le ${date}. Cardmarket${NB}: frais de vente de 5${NB}%, envoi suivi obligatoire au-delà de 25${NB}€ (help.cardmarket.com). Leboncoin${NB}: Transaction sécurisée gratuite pour le vendeur (assistance.leboncoin.info). La Poste${NB}: ${postage.carrier} ${postage.bracket}, ${euros(postage.priceCents, 2)} (tarifs 2026).</p>
    </section>`;
  }

  function endScene() {
    const address = CONFIG.siteAddress;
    return `<section class="scene dark" id="s-end">
      <div class="lockup end-lockup" id="end-lockup">
        <span class="lockup-mark" id="end-mark">${markSvg({ outline: false })}</span>
        <span class="wordmark" id="end-word">Bulk<span class="light">TCG</span></span>
      </div>
      <h2 class="display end-title" id="end-title">Déposez votre lot.</h2>
      <p class="end-sub" id="end-sub"><span>Gratuit.</span> <span>Sans commission.</span> <span>Sans envoi.</span></p>
      ${address ? `<p class="mono end-address" id="end-address">${address}</p>` : ""}
      <div class="end-tranche tranche" id="end-tranche">${NAMED.map((game) => `<i style="background: var(--${game.id})"></i>`).join("")}</div>
    </section>`;
  }

  function buildStage(stage, portrait) {
    stage.classList.toggle("portrait", portrait);
    stage.innerHTML = `
      ${stockScene()}
      ${deadScene(portrait)}
      ${brandScene()}
      ${depositScene()}
      ${matchScene()}
      ${statusScene()}
      ${proScene()}
      ${keepScene()}
      ${endScene()}
      <div class="card-layer" id="card-layer">${lotHtml()}</div>
      <div class="lockup brand-lockup" id="brand-lockup">
        <span class="lockup-mark" id="brand-mark">${markSvg({ outline: true })}</span>
        <span class="wordmark" id="brand-word">Bulk<span class="light">TCG</span></span>
      </div>
      <div class="caption-block" id="caption-games"><p class="eyebrow">Les intercalaires</p><p class="display" id="caption-games-text">Sept jeux. Et tous les autres.</p></div>
      <div class="wipe" id="wipe-a">${NAMED.map((game) => `<i style="--c: var(--${game.id})"></i>`).join("")}</div>
      <div class="wipe wipe-cols" id="wipe-b">${NAMED.map((game) => `<i style="--c: var(--${game.id})"></i>`).join("")}</div>
      <div class="wipe" id="wipe-c">${NAMED.map((game) => `<i style="--c: var(--${game.id})"></i>`).join("")}</div>
      <div class="ink-flood" id="ink-flood"></div>
      <span class="click-ring" id="click-ring"></span>
      <span class="cursor" id="cursor">${CURSOR_SVG}</span>
    `;
  }

  /* ---------- mesures ---------- */

  /* La position d'un élément dans son ancêtre, transformations ignorées :
     ce que la mise en page décide, avant tout mouvement. */
  function layoutRect(el, ancestor) {
    let x = 0;
    let y = 0;
    let node = el;
    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    if (node !== ancestor) throw new Error(`${el.id || el.className} n'est pas sous ${ancestor.id || ancestor.className}`);
    return { x, y, width: el.offsetWidth, height: el.offsetHeight };
  }

  /* ---------- le mouvement ---------- */

  function buildTimeline(stage, portrait) {
    const W = portrait ? 1080 : 1920;
    const H = portrait ? 1920 : 1080;
    const P = portrait;
    const $ = (selector) => {
      const el = stage.querySelector(selector);
      if (!el) throw new Error(`Introuvable : ${selector}`);
      return el;
    };
    const $$ = (selector) => Array.from(stage.querySelectorAll(selector));
    const tl = new Timeline(stage);

    /* -- vocabulaire -- */
    const show = (el, t0, t1) => {
      tl.key(el, "o", -1, 0, "hold");
      tl.key(el, "o", t0, 1, "hold");
      tl.key(el, "o", t1, 0, "hold");
    };
    const appear = (target, t, { x = 0, y = 30, s = 1, r = 0, d = 0.6, ease = "brand" } = {}) =>
      tl.fromTo(target, { o: 0, x, y, s, r }, { o: 1, x: 0, y: 0, s: 1, r: 0 }, t, d, ease);
    const vanish = (target, t, { x = 0, y = -24, s = 1, d = 0.35, ease = "inCubic" } = {}) =>
      tl.to(target, { o: 0, x, y, s }, t, d, ease);
    const rise = (el, t, { step = 0.055, d = 0.65, ease = "brand" } = {}) => {
      const words = splitWords(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      words.forEach((word, index) => tl.fromTo(word, { y: size * 1.18 }, { y: 0 }, t + index * step, d, ease));
      words.size = size;
      return words;
    };
    const sink = (words, t, { step = 0.025, d = 0.38 } = {}) =>
      words.forEach((word, index) => tl.to(word, { y: -words.size * 1.2 }, t + index * step, d, "inCubic"));
    const drift = (el, t0, t1, amount = 0.035) => tl.fromTo(el, { s: 1 }, { s: 1 + amount }, t0, t1 - t0, "linear");

    const cursor = $("#cursor");
    const ring = $("#click-ring");
    tl.set(cursor, { o: 0, x: W + 80, y: H + 80 }, -1);
    tl.set(ring, { o: 0 }, -1);
    const click = (x, y, t) => {
      tl.fromTo(cursor, {}, { s: 0.86 }, t - 0.06, 0.06, "outQuad");
      tl.to(cursor, { s: 1 }, t, 0.16, "outBack");
      tl.set(ring, { x, y }, t);
      tl.fromTo(ring, { o: 0.9, s: 0.25 }, { o: 0, s: 1.5 }, t, 0.45, "outCubic");
      tl.sfx("click", t);
    };
    const pointTo = (x, y, t, d = 0.45) => tl.to(cursor, { x, y }, t, d, "brandInOut");

    /* ================= 1. le stock qui dort : 0 → 6 ================= */

    show($("#s-stock"), 0, 6);
    if (P) {
      const grid = $(".stock-grid");
      grid.style.top = `${Math.round((H - grid.offsetHeight) / 2 - 60)}px`;
    }
    drift($("#s-stock .world"), 0, 6, 0.04);

    const stockTimes = [0.1, 1.2, 2.3];
    // Le classeur tombe à plat, puis ses cartes se posent une à une.
    tl.fromTo("#stock-0 .stock-art", { o: 0, y: -90, r: -5 }, { o: 1, y: 0, r: 0 }, stockTimes[0], 0.55, "outBack");
    tl.sfx("swish", stockTimes[0]);
    $$("#stock-0 .b-card").forEach((card, index) => {
      const t = stockTimes[0] + 0.32 + index * 0.045;
      tl.fromTo(card, { o: 0, s: 0.3 }, { o: 1, s: 1 }, t, 0.32, "outBackHard");
      tl.sfx("tick", t, { pitch: 0.9 + index * 0.06, level: 0.7 });
    });
    // Le carton chute, s'écrase, rebondit : il pèse.
    const fall = stockTimes[1] + 0.3;
    tl.fromTo("#stock-1 .stock-art", { o: 0, y: -460 }, { o: 1, y: 0 }, stockTimes[1], 0.3, "inQuad");
    tl.key("#stock-1 .carton", "sy", fall, 1, "hold");
    tl.key("#stock-1 .carton", "sy", fall + 0.08, 0.84, "outQuad");
    tl.key("#stock-1 .carton", "sy", fall + 0.45, 1, "outBack");
    tl.key("#stock-1 .carton", "sx", fall, 1, "hold");
    tl.key("#stock-1 .carton", "sx", fall + 0.08, 1.1, "outQuad");
    tl.key("#stock-1 .carton", "sx", fall + 0.45, 1, "outBack");
    tl.sfx("thud", fall);
    $$("#stock-1 .dust circle").forEach((dot, index) => {
      const side = index < 3 ? -1 : 1;
      tl.set(dot, { o: 0 }, -1);
      tl.fromTo(dot, { o: 0.9, x: 0, y: 0, s: 1 }, { o: 0, x: side * (40 + (index % 3) * 30), y: -18 - (index % 2) * 16, s: 0.4 }, fall, 0.6, "outCubic");
    });
    // Le display monte, et un reflet passe sur le film plastique.
    tl.fromTo("#stock-2 .stock-art", { o: 0, y: 80, s: 0.9 }, { o: 1, y: 0, s: 1 }, stockTimes[2], 0.6, "outBack");
    tl.sfx("swish", stockTimes[2]);
    tl.fromTo("#stock-2 .glint", { x: -60 }, { x: 520 }, stockTimes[2] + 0.45, 0.7, "inOutCubic");
    tl.sfx("tick", stockTimes[2] + 0.75, { pitch: 1.6, level: 0.8 });

    [0, 1, 2].forEach((index) => {
      tl.fromTo(`#stock-${index} .eyebrow`, { o: 0, y: 14 }, { o: 1, y: 0 }, stockTimes[index] + 0.3, 0.45);
      rise($(`#stock-${index} .stock-line`), stockTimes[index] + 0.38, { step: 0.05 });
    });

    // La question : les objets reculent, la phrase arrive.
    tl.to(".stock-grid", { y: P ? -$(".stock-grid").offsetTop + 90 : -120, o: 0.3, s: 0.92 }, 3.7, 0.7, "brandInOut");
    rise($("#stock-question"), 3.85, { step: 0.06, d: 0.7 });
    tl.sfx("whoosh", 3.75, { duration: 0.5, level: 0.6 });

    /* ================= 2. les deux impasses : 6 → 10.5 ================= */

    show($("#s-dead"), 6, 11.45);
    drift($("#s-dead .world"), 6, 11.45, 0.03);
    tl.sfx("whoosh", 5.9, { duration: 0.45, level: 0.8 });

    appear("#dead-a", 6.0, { y: P ? 80 : 60, d: 0.6 });
    appear("#dead-a .eyebrow", 6.15, { y: 12, d: 0.4 });
    $$("#dead-a .sort-card").forEach((card, index) => {
      const t = 6.3 + index * 0.024;
      tl.fromTo(card, { o: 0, s: 0.5 }, { o: 1, s: 1 }, t, 0.2, "outBack");
    });
    tl.counter("#sort-count", 6.3, 2.6, 1, LOT.cardCount, (value) => {
      const digits = String(Math.round(value)).padStart(4, "0");
      return `${digits.slice(0, -3)}${FINE}${digits.slice(-3)}`;
    }, "inOutQuad");
    for (let t = 6.35; t < 8.9; t += 0.09) tl.sfx("tick", t, { pitch: 0.8 + (t - 6.3) * 0.25, level: 0.45 });
    rise($("#dead-a-line"), 6.5, { step: 0.05 });

    appear("#dead-b", 7.2, { y: P ? 80 : 60, d: 0.6 });
    appear("#dead-b .eyebrow", 7.35, { y: 12, d: 0.4 });
    const drop = 7.75;
    tl.fromTo("#dead-b .post-art > svg", { o: 0, y: -300 }, { o: 1, y: 0 }, drop - 0.28, 0.28, "inQuad");
    tl.key("#dead-b .carton", "sy", drop, 1, "hold");
    tl.key("#dead-b .carton", "sy", drop + 0.07, 0.88, "outQuad");
    tl.key("#dead-b .carton", "sy", drop + 0.4, 1, "outBack");
    tl.sfx("thud", drop, { level: 0.8 });
    $$("#dead-b .dust circle").forEach((dot, index) => {
      const side = index < 3 ? -1 : 1;
      tl.set(dot, { o: 0 }, -1);
      tl.fromTo(dot, { o: 0.8, x: 0, y: 0 }, { o: 0, x: side * (30 + (index % 3) * 26), y: -14 }, drop, 0.5, "outCubic");
    });
    tl.fromTo("#post-label", { o: 0, s: 1.35, r: -18 }, { o: 1, s: 1, r: -4 }, 8.15, 0.42, "outBackHard");
    tl.sfx("stamp", 8.2, { level: 0.7 });
    rise($("#dead-b-line"), 8.35, { step: 0.05 });
    appear("#dead-b-source", 8.9, { y: 10, d: 0.5 });

    /* ================= la tranche balaie l'écran : 10.5 → 12 ================= */

    const lockup = $("#brand-lockup");
    const brandMark = $("#brand-mark");
    const lockupBox = { width: lockup.offsetWidth, height: lockup.offsetHeight };
    const lockupX = Math.round((W - lockupBox.width) / 2);
    const lockupY = Math.round(P ? 820 - lockupBox.height / 2 : 450 - lockupBox.height / 2);
    const markBox = layoutRect(brandMark, lockup);
    const markLeft = lockupX + markBox.x;
    const markTop = lockupY + markBox.y;
    const unit = markBox.width / 32;

    tl.sfx("riser", 10.5, { duration: 1.42 });
    const bands = $$("#wipe-a > i");
    const bandHeight = H / bands.length;
    bands.forEach((band, index) => {
      band.style.top = `${index * bandHeight}px`;
      band.style.height = `${bandHeight + 1}px`;
      const tIn = 10.55 + index * 0.05;
      tl.set(band, { o: 0 }, -1);
      tl.set(band, { o: 1 }, tIn);
      tl.fromTo(band, { x: -W - 40 }, { x: 0 }, tIn, 0.55, "whip");
      // Les bandes se resserrent et deviennent les couches du symbole.
      const layerTop = markTop + (13 + index * (13 / bands.length)) * unit;
      const targetHeight = (13 / bands.length + 0.05) * unit;
      const tMorph = 11.4 + index * 0.015;
      tl.to(
        band,
        { x: markLeft + 3.5 * unit, y: layerTop - index * bandHeight, sx: (15 * unit) / W, sy: targetHeight / (bandHeight + 1) },
        tMorph,
        0.5,
        "whip",
      );
      tl.set(band, { o: 0 }, 12.0);
    });
    tl.sfx("whoosh", 10.55, { duration: 0.55, level: 0.9, from: -0.9, to: 0.9 });

    /* ================= 3. la marque, puis le site : 12 → 20 ================= */

    const brand = $("#s-brand");
    show(brand, 11.38, 20.0);
    const site = $("#site");
    const S = P ? W / 390 : W / 1440;
    tl.set(site, { x: 0, y: 0, s: S, o: 0 }, -1);
    tl.set(site, { o: 1 }, 13.35);

    // Le symbole prend le relais des bandes, puis s'épaissit.
    tl.set(lockup, { x: lockupX, y: lockupY, o: 0 }, -1);
    tl.set(lockup, { o: 1 }, 12.0);
    tl.fromTo(lockup, { s: 1.04 }, { s: 1 }, 12.0, 0.6, "outCubic");
    tl.fromTo("#brand-mark .mk-side", { sx: 0 }, { sx: 1 }, 12.0, 0.4, "outBack");
    tl.fromTo("#brand-mark .mk-top", { sy: 0 }, { sy: 1 }, 12.05, 0.4, "outBack");
    tl.fromTo("#brand-mark .mk-outline", { dash: 1 }, { dash: 0 }, 12.15, 0.5, "outCubic");
    tl.sfx("impact", 12.0);
    tl.sfx("motif", 12.0);
    const brandLetters = splitLetters($("#brand-word"));
    const wordSize = parseFloat(getComputedStyle($("#brand-word")).fontSize);
    brandLetters.forEach((letter, index) => tl.fromTo(letter, { y: wordSize * 1.1 }, { y: 0 }, 12.08 + index * 0.035, 0.55, "brand"));
    appear("#brand-tagline", 12.6, { y: 16, d: 0.5 });
    vanish("#brand-tagline", 13.3, { y: -10, d: 0.3 });

    // La marque rejoint l'en-tête pendant que le site se compose autour.
    const logoSlot = layoutRect($("#site-logo-slot"), site);
    const dockScale = (logoSlot.width * S) / markBox.width;
    const dockX = logoSlot.x * S - markBox.x * dockScale;
    const dockY = logoSlot.y * S - markBox.y * dockScale;
    tl.to(lockup, { x: dockX, y: dockY, s: dockScale }, 13.4, 0.8, "whip");
    tl.sfx("whoosh", 13.4, { duration: 0.6, level: 0.7, from: 0.4, to: -0.6 });
    if (P) {
      // Sur téléphone, la marque empilée ne se superpose pas au logo en ligne :
      // elle s'efface pendant que celui de l'en-tête apparaît.
      tl.to(lockup, { o: 0 }, 13.95, 0.25, "linear");
      tl.fromTo("#site-logo", { o: 0 }, { o: 1 }, 14.0, 0.25, "linear");
    } else {
      tl.set(lockup, { o: 0 }, 14.2);
      tl.set("#site-logo", { o: 0 }, -1);
      tl.set("#site-logo", { o: 1 }, 14.2);
    }
    tl.fromTo("#site-head", { y: -90 }, { y: 0 }, 13.45, 0.55, "brand");
    tl.fromTo("#site-tranche", { sx: 0 }, { sx: 1 }, 13.7, 0.6, "brandInOut");
    tl.stagger(".site-nav-item", 13.85, 0.06, (el, t) => appear(el, t, { y: -10, d: 0.4 }));
    tl.stagger(".site-tool-item", 13.95, 0.05, (el, t) => appear(el, t, { s: 0.6, y: 0, d: 0.35, ease: "outBack" }));

    appear("#site-eyebrow", 14.2, { y: 10, d: 0.45 });
    rise($("#site-h1"), 14.25, { step: 0.06 });
    appear("#site-search-block", 14.9, { y: 34, d: 0.6 });
    appear("#site-lead", 15.15, { y: 10, d: 0.45 });

    const tabs = $$(".site-dividers .divider");
    tabs.forEach((tab, index) => {
      const t = 15.3 + index * 0.05;
      tl.fromTo(tab, { y: 60 }, { y: 0 }, t, 0.45, "outBack");
      tl.sfx("pop", t, { pitch: 0.8 + index * 0.08, level: 0.55 });
    });

    // La caméra descend sur les intercalaires ; la couleur passe d'un jeu à
    // l'autre — seules les couleurs changent, comme sur le site.
    const track = $(".site-dividers-track");
    const trackBox = layoutRect(track, site);
    const dividersBox = layoutRect($(".site-dividers"), site);
    const zoom = P ? 1.0 : 1.36;
    const focusX = P ? 195 : trackBox.x + trackBox.width / 2;
    const focusY = dividersBox.y + dividersBox.height / 2;
    const screenX = W / 2;
    const screenY = P ? 980 : 760;
    const zoomed = { x: screenX - focusX * S * zoom, y: screenY - focusY * S * zoom, s: S * zoom };
    tl.to(site, zoomed, 16.0, 0.7, "whip");
    tl.sfx("whoosh", 16.0, { duration: 0.55, level: 0.6 });

    const caption = $("#caption-games");
    {
      // La légende se pose dans le vide entre la phrase d'accroche et les
      // onglets, une fois la caméra descendue : elle ne recouvre rien.
      const lead = layoutRect($("#site-lead"), site);
      const leadBottom = zoomed.y + (lead.y + lead.height) * zoomed.s;
      const tabsTop = zoomed.y + dividersBox.y * zoomed.s;
      const tabsBottom = zoomed.y + (dividersBox.y + dividersBox.height) * zoomed.s;
      const room = tabsTop - leadBottom;
      // En vertical, la page est remontée : la légende se pose sous les onglets.
      const top = P ? tabsBottom + 90 : leadBottom + Math.max(16, (room - caption.offsetHeight) / 2);
      caption.style.top = `${Math.round(top)}px`;
      caption.style.left = `${Math.round(P ? 70 : Math.max(120, zoomed.x + trackBox.x * zoomed.s))}px`;
    }
    tl.set(caption, { o: 0 }, -1);
    tl.set(caption, { o: 1 }, 16.3);
    // Un découpage négatif au repos : l'ombre portée déborde du bloc.
    tl.set(caption, { ct: -20, cb: -20, cl: -20 }, -1);
    tl.fromTo(caption, { cr: 100 }, { cr: -20 }, 16.3, 0.55, "whip");
    tl.fromTo("#caption-games .eyebrow", { o: 0 }, { o: 1 }, 16.55, 0.3, "linear");
    rise($("#caption-games-text"), 16.5, { step: 0.07 });

    const fills = $$(".site-dividers .divider-fill");
    tl.set(fills, { o: 0 }, -1);
    const chaseStart = 16.55;
    const chaseStep = 0.22;
    fills.forEach((fill, index) => {
      const t = chaseStart + index * chaseStep;
      tl.set(fill, { o: 1 }, t);
      tl.to(fill, { o: 0 }, t + chaseStep, 0.1, "linear");
      tl.sfx("pop", t, { pitch: 1 + index * 0.07, level: 0.5 });
    });
    const chaseEnd = chaseStart + fills.length * chaseStep;
    fills.forEach((fill, index) => {
      tl.set(fill, { o: 1 }, chaseEnd + 0.05 + index * 0.02);
      tl.to(fill, { o: 0 }, chaseEnd + 0.42, 0.18, "linear");
    });
    tl.sfx("chime", chaseEnd + 0.05, { level: 0.5 });

    if (P) {
      // Sur téléphone, la rangée défile pour suivre l'onglet coloré.
      const visible = 390 / zoom - 32;
      const tabBoxes = tabs.map((tab) => layoutRect(tab, $(".site-dividers")));
      const maxShift = Math.max(0, trackBox.width - visible);
      tabBoxes.slice(1).forEach((box, index) => {
        const target = Math.min(maxShift, Math.max(0, box.x + box.width / 2 - visible / 2));
        tl.to(track, { x: -target }, chaseStart + index * chaseStep - 0.12, 0.24, "brandInOut");
      });
      tl.to(track, { x: 0 }, chaseEnd + 0.5, 0.5, "brandInOut");
    }

    vanish(caption, 18.55, { y: -20, d: 0.35 });
    tl.to(site, { x: 0, y: 0, s: S }, 18.6, 0.6, "whip");
    tl.sfx("whoosh", 18.6, { duration: 0.5, level: 0.5, from: 0.6, to: -0.4 });

    // Le curseur clique « Déposer une annonce », et l'on entre dans le bouton.
    const cta = layoutRect($("#site-cta"), site);
    const ctaX = (cta.x + cta.width * 0.42) * S;
    const ctaY = (cta.y + cta.height * 0.55) * S;
    tl.set(cursor, { o: 1, x: W * (P ? 0.7 : 0.82), y: H + 40 }, 18.85);
    pointTo(ctaX, ctaY, 18.88, 0.5);
    click(ctaX, ctaY, 19.42);
    tl.fromTo("#site-cta", { s: 1 }, { s: 0.94 }, 19.38, 0.06, "outQuad");
    tl.to("#site-cta", { s: 1 }, 19.44, 0.2, "outBack");
    tl.set(cursor, { o: 0 }, 19.62);
    const ctaCenter = { x: cta.x + cta.width / 2, y: cta.y + cta.height / 2 };
    const dive = 14;
    tl.to(site, { x: W / 2 - ctaCenter.x * S * dive, y: H / 2 - ctaCenter.y * S * dive, s: S * dive }, 19.5, 0.45, "inExpo");
    tl.sfx("whoosh", 19.48, { duration: 0.5, level: 0.9 });
    const flood = $("#ink-flood");
    tl.set(flood, { o: 0 }, -1);
    tl.fromTo(flood, { o: 0 }, { o: 1 }, 19.82, 0.12, "linear");
    tl.set(flood, { cb: 0 }, -1);
    tl.to(flood, { cb: 100 }, 20.0, 0.5, "whip");
    tl.set(flood, { o: 0 }, 20.55);

    /* ================= 4. le dépôt : 20 → 26 ================= */

    show($("#s-deposit"), 19.95, 26.2);
    const cardLayer = $("#card-layer");
    show(cardLayer, 20.0, 35.19);
    const card = $("#hero-card");
    const lot = $("#lot");
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;

    const place = (scale, centerX, top) => ({ x: centerX - (cardWidth * scale) / 2, y: top, s: scale });
    const depositCopy = $("#dep-copy");
    const stepsBox = layoutRect($(".steps"), stage);
    const depositScale = P ? 1.7 : 1.9;
    const depositPlace = P
      ? place(depositScale, W / 2, stepsBox.y + stepsBox.height + 50)
      : place(depositScale, 1420, Math.round(H / 2 - (cardHeight * depositScale) / 2));
    if (P) {
      // Le lien permanent sous la vignette, dans la colonne de texte.
      $("#permalink").style.top = `${Math.round(depositPlace.y + cardHeight * depositScale + 44 - depositCopy.offsetTop)}px`;
    }
    tl.set(card, depositPlace, -1);

    if (!P) {
      const copy = $("#dep-copy");
      copy.style.top = `${Math.round((H - copy.offsetHeight) / 2)}px`;
    }
    appear("#dep-eyebrow", 20.15, { y: 12, d: 0.4 });
    rise($("#dep-title"), 20.2, { step: 0.06 });

    tl.set(lot, { ct: -20, cl: -20, cr: -20 }, -1);
    tl.fromTo(lot, { cb: 100 }, { cb: -20 }, 20.32, 0.5, "brand");
    tl.fromTo(card, { s: depositPlace.s * 0.94, y: depositPlace.y + 30 }, { s: depositPlace.s, y: depositPlace.y }, 20.32, 0.6, "brand");
    tl.sfx("swish", 20.32);
    tl.fromTo("#lot-mark", { s: 0 }, { s: 1 }, 20.6, 0.35, "outBackHard");
    appear("#lot-type-text", 20.62, { x: -12, y: 0, d: 0.4 });
    tl.fromTo("#lot-price-wrap", { o: 0, s: 1.7, r: -8 }, { o: 1, s: 1, r: 0 }, 20.75, 0.4, "outBackHard");
    tl.sfx("pop", 20.78, { pitch: 0.75, level: 0.9 });
    tl.set("#lot-sold-chip", { o: 0 }, -1);

    const titleText = $("#lot-title-text");
    const typeStart = 20.95;
    const typeLength = titleText.dataset.full.length;
    const typeDuration = 0.8;
    tl.type(titleText, typeStart, typeDuration);
    for (let i = 0; i < typeLength; i += 2) tl.sfx("type", typeStart + (i / typeLength) * typeDuration);
    const caret = $("#lot-caret");
    tl.set(caret, { o: 0 }, -1);
    tl.set(caret, { o: 1 }, typeStart);
    for (let t = typeStart + typeDuration + 0.25; t + 0.25 < 22.6; t += 0.5) {
      tl.set(caret, { o: 0 }, t);
      tl.set(caret, { o: 1 }, t + 0.25);
    }
    tl.set(caret, { o: 0 }, 22.6);

    tl.fromTo("#lot-photo", { o: 0, y: 40, s: 1.08 }, { o: 1, y: 0, s: 1 }, 21.55, 0.7, "brand");
    tl.stagger("#lot-photo .box-tab", 21.85, 0.08, (el, t) => {
      tl.fromTo(el, { y: 14, o: 0 }, { y: 0, o: 1 }, t, 0.35, "outBack");
      tl.sfx("tick", t, { pitch: 1.3, level: 0.5 });
    });
    tl.fromTo("#lot-gloss", { x: -360 }, { x: 360 }, 21.95, 0.8, "inOutCubic");
    tl.fromTo("#lot-credit", { y: 26 }, { y: 0 }, 22.0, 0.45, "brand");
    tl.set("#lot-credit", { o: 0 }, -1);
    tl.set("#lot-credit", { o: 1 }, 22.0);
    tl.stagger("#lot .lot-fact", 22.25, 0.1, (el, t) => appear(el, t, { y: 10, d: 0.35 }));
    $$("#lot .meter-on").forEach((cell, index) => {
      tl.set(cell, { o: 0 }, -1);
      tl.set(cell, { o: 1 }, 22.45 + index * 0.07);
      tl.sfx("tick", 22.45 + index * 0.07, { pitch: 1.1 + index * 0.12, level: 0.5 });
    });
    tl.stagger("#lot .tag", 22.65, 0.08, (el, t, index) => {
      appear(el, t, { s: 0.6, y: 0, d: 0.35, ease: "outBack" });
      tl.sfx("pop", t, { pitch: 1.2 + index * 0.1, level: 0.4 });
    });
    appear("#lot-foot", 22.95, { y: 8, d: 0.4 });

    [21.25, 22.3, 23.25].forEach((t, index) => {
      tl.fromTo(`#step-${index} .step-icon`, { o: 0, s: 0.4, r: -12 }, { o: 1, s: 1, r: 0 }, t, 0.4, "outBackHard");
      rise($(`#step-${index} .step-text`), t + 0.06, { step: 0.045 });
      tl.sfx("pop", t, { pitch: 0.9 + index * 0.15, level: 0.6 });
    });

    appear("#permalink", 23.6, { y: 24, d: 0.5 });
    const path = $("#permalink-path");
    tl.type(path, 23.75, 0.55);
    for (let t = 23.75; t < 24.3; t += 0.05) tl.sfx("type", t, { level: 0.6 });
    tl.set("#copy-done", { o: 0 }, -1);
    const copyButton = layoutRect($("#permalink-copy"), stage);
    const copyX = copyButton.x + copyButton.width * 0.5;
    const copyY = copyButton.y + copyButton.height * 0.6;
    tl.set(cursor, { o: 1, x: W * 0.62, y: H * 0.98 }, 24.3);
    pointTo(copyX, copyY, 24.32, 0.5);
    click(copyX, copyY, 24.9);
    tl.set("#copy-idle", { o: 0 }, 24.92);
    tl.fromTo("#copy-done", { o: 0, s: 0.7 }, { o: 1, s: 1 }, 24.92, 0.3, "outBackHard");
    tl.sfx("pop", 24.95, { pitch: 1.5, level: 0.7 });
    tl.to(cursor, { o: 0, x: copyX + 60, y: copyY + 80 }, 25.3, 0.4, "inCubic");

    vanish("#dep-copy", 25.75, { y: -30, d: 0.4 });

    /* ================= 5. le croisement : 26 → 30.5 ================= */

    show($("#s-match"), 25.9, 30.75);
    const toastEl = $("#toast-match");
    const matchCopy = $("#match-copy");
    const portraitToastTop = matchCopy.offsetTop + matchCopy.offsetHeight + 40;
    const wants = $$(".want");
    const wantScale = P ? 1.45 : 1.6;
    const wantWidth = wants[0].offsetWidth * wantScale;
    const wantHeights = wants.map((want) => want.offsetHeight * wantScale);
    const wantGap = P ? 18 : 30;
    const wantsHeight = wantHeights.reduce((sum, height) => sum + height, 0) + wantGap * (wants.length - 1);
    const wantX = P ? W - 60 - wantWidth : W - 140 - wantWidth;
    const matchScale = P ? 1.2 : 1.38;
    const cardMatchHeight = cardHeight * matchScale;
    // En vertical : notification sous le titre, puis la vignette centrée sur
    // la colonne des demandes. En grand écran : vignette à gauche, demandes
    // centrées sur elle.
    const wantsTop = P ? portraitToastTop + toastEl.offsetHeight + 60 : null;
    const matchPlace = P
      ? place(matchScale, 60 + (cardWidth * matchScale) / 2, Math.round(wantsTop + wantsHeight / 2 - cardMatchHeight / 2))
      : place(matchScale, 140 + (cardWidth * matchScale) / 2, 330);
    let wantY = P ? wantsTop : Math.max(140, matchPlace.y + cardMatchHeight / 2 - wantsHeight / 2);
    tl.to(card, matchPlace, 25.85, 0.6, "whip");
    tl.sfx("whoosh", 25.85, { duration: 0.5, level: 0.6, from: 0.5, to: -0.5 });

    appear("#match-eyebrow", 26.1, { y: 12, d: 0.4 });
    rise($("#match-title"), 26.15, { step: 0.055 });

    const cardRight = matchPlace.x + cardWidth * matchPlace.s;
    const cardMid = matchPlace.y + cardMatchHeight * 0.42;
    const svg = $("#match-lines");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    wants.forEach((want, index) => {
      const top = wantY;
      wantY += wantHeights[index] + wantGap;
      const t = 26.4 + index * 0.15;
      tl.set(want, { x: wantX, y: top, s: wantScale, o: 0 }, -1);
      tl.fromTo(want, { o: 0, x: wantX + 140 }, { o: 1, x: wantX }, t, 0.6, "brand");
      tl.sfx("swish", t);
      const endX = wantX - 4;
      const endY = top + wantHeights[index] / 2;
      const bend = (endX - cardRight) * 0.5;
      $(`#match-line-${index}`).setAttribute("d", `M${cardRight + 4} ${cardMid} C${cardRight + bend} ${cardMid}, ${endX - bend} ${endY}, ${endX} ${endY}`);
      const dot = $(`#match-dot-${index}`);
      dot.setAttribute("cx", endX);
      dot.setAttribute("cy", endY);
      tl.fromTo(`#match-line-${index}`, { dash: 1 }, { dash: 0 }, 26.9 + index * 0.1, 0.5, "brandInOut");
      tl.set(dot, { o: 0 }, -1);
      tl.fromTo(dot, { o: 0, s: 0 }, { o: 1, s: 1 }, 27.35 + index * 0.1, 0.3, "outBackHard");
      dot.style.transformBox = "fill-box";
      dot.style.transformOrigin = "center";
      tl.fromTo(`#verdict-${index}`, { o: 0, s: 0.5 }, { o: 1, s: 1 }, 27.45 + index * 0.1, 0.35, "outBackHard");
      tl.sfx("tick", 27.45 + index * 0.1, { pitch: 1.4 + index * 0.1, level: 0.6 });
    });

    const toast = $("#toast-match");
    if (P) {
      toast.style.top = `${Math.round(portraitToastTop)}px`;
    } else {
      toast.style.top = `${Math.round(matchPlace.y + cardMatchHeight + 30)}px`;
    }
    tl.fromTo(toast, { o: 0, y: 40, s: 0.96 }, { o: 1, y: 0, s: 1 }, 27.75, 0.5, "outBack");
    tl.sfx("chime", 27.8);
    [0, 0.08, 0.16, 0.24, 0.32].forEach((offset, index) => {
      tl.to("#toast-bell .icon", { r: index % 2 ? -14 : 14 }, 27.85 + offset, 0.08, "inOutQuad");
    });
    tl.to("#toast-bell .icon", { r: 0 }, 28.25, 0.12, "outQuad");

    tl.stagger(".want", 30.15, 0.05, (el, t) => tl.to(el, { o: 0, x: wantX + 90 }, t, 0.3, "inCubic"));
    tl.to("#match-lines", { o: 0 }, 30.1, 0.25, "linear");
    vanish(toast, 30.1, { y: 20, d: 0.3 });
    vanish("#match-copy", 30.15, { y: -24, d: 0.3 });

    /* ================= 6. réservé, vendu : 30.5 → 35 ================= */

    show($("#s-status"), 30.4, 35.19);
    const segmented = $("#segmented");
    const segmentScale = P ? 2.1 : 1.95;
    const statusScale = P ? 1.55 : 1.62;
    const statusGap = P ? 50 : 44;
    const groupHeight = cardHeight * statusScale + statusGap + segmented.offsetHeight * segmentScale;
    const statusCopy = $("#status-copy");
    const statusTop = P ? Math.round(statusCopy.offsetTop + statusCopy.offsetHeight + 56) : Math.round((H - groupHeight) / 2);
    if (!P) statusCopy.style.top = `${Math.round(H / 2 - statusCopy.offsetHeight / 2)}px`;
    const statusPlace = place(statusScale, P ? W / 2 : 1420, statusTop);
    tl.to(card, statusPlace, 30.35, 0.6, "whip");
    tl.sfx("whoosh", 30.35, { duration: 0.5, level: 0.6, from: -0.5, to: 0.5 });

    appear("#status-eyebrow", 30.6, { y: 12, d: 0.4 });
    rise($("#status-title"), 30.65, { step: 0.07, d: 0.7 });
    rise($("#status-sub"), 31.05, { step: 0.035 });

    const segmentWidth = segmented.offsetWidth * segmentScale;
    const segmentX = statusPlace.x + (cardWidth * statusPlace.s) / 2 - segmentWidth / 2;
    const segmentY = statusPlace.y + cardHeight * statusPlace.s + statusGap;
    tl.set(segmented, { x: segmentX, y: segmentY, s: segmentScale, o: 0 }, -1);
    tl.fromTo(segmented, { o: 0, y: segmentY + 24 }, { o: 1, y: segmentY }, 31.0, 0.5, "brand");
    tl.set(["#segment-ring-1", "#segment-ring-2"], { o: 0 }, -1);
    const segmentCenter = (index) => {
      const box = layoutRect($(`#segment-${index}`), segmented);
      return { x: segmentX + (box.x + box.width / 2) * segmentScale, y: segmentY + (box.y + box.height * 0.62) * segmentScale };
    };
    const reserved = segmentCenter(1);
    const sold = segmentCenter(2);
    tl.set(cursor, { o: 1, x: W * (P ? 0.9 : 0.95), y: H * 0.95 }, 31.35);
    pointTo(reserved.x, reserved.y, 31.38, 0.5);
    click(reserved.x, reserved.y, 31.95);
    tl.set("#segment-ring-0", { o: 0 }, 31.97);
    tl.fromTo("#segment-ring-1", { o: 0, s: 0.9 }, { o: 1, s: 1 }, 31.97, 0.25, "outBack");

    const stampIn = (selector, t) => {
      tl.set(selector, { o: 0 }, -1);
      tl.fromTo(selector, { o: 0, s: 2.4, r: -24 }, { o: 1, s: 1, r: -8 }, t, 0.32, "outBackHard");
      tl.sfx("stamp", t + 0.08);
      const base = tl.valueAt(card, "x", t + 0.1);
      [[0.08, 7], [0.12, -6], [0.16, 4], [0.2, -2], [0.24, 0]].forEach(([offset, shift]) => {
        tl.to(card, { x: base + shift }, t + offset, 0.04, "linear");
      });
    };
    stampIn("#stamp-reserved", 32.05);

    pointTo(sold.x, sold.y, 32.85, 0.4);
    click(sold.x, sold.y, 33.3);
    tl.set("#segment-ring-1", { o: 0 }, 33.32);
    tl.fromTo("#segment-ring-2", { o: 0, s: 0.9 }, { o: 1, s: 1 }, 33.32, 0.25, "outBack");
    tl.to("#stamp-reserved", { o: 0, s: 1.15 }, 33.35, 0.15, "linear");
    stampIn("#stamp-sold", 33.42);
    tl.fromTo("#lot-photo", { gray: 0 }, { gray: 1 }, 33.5, 0.4, "linear");
    tl.to("#lot-photo", { o: 0.5 }, 33.5, 0.4, "linear");
    tl.fromTo("#lot-sold-chip", { o: 0 }, { o: 1 }, 33.5, 0.25, "linear");
    tl.to(cursor, { o: 0, x: sold.x + 70, y: sold.y + 90 }, 34.0, 0.4, "inCubic");

    /* ================= la tranche, en colonnes : vers les boutiques ================= */

    const columns = $$("#wipe-b > i");
    const columnWidth = W / columns.length;
    columns.forEach((column, index) => {
      column.style.left = `${index * columnWidth}px`;
      column.style.width = `${columnWidth + 1}px`;
      const t = 34.6 + index * 0.03;
      tl.set(column, { o: 0 }, -1);
      tl.set(column, { o: 1 }, t);
      tl.fromTo(column, { y: -H - 20 }, { y: 0 }, t, 0.4, "whip");
      tl.to(column, { y: H + 20 }, 35.2 + index * 0.03, 0.45, "whip");
      tl.set(column, { o: 0 }, 35.7 + index * 0.03);
    });
    tl.sfx("whoosh", 34.6, { duration: 0.5, level: 0.9, from: 0.8, to: -0.8 });

    /* ================= 7. réservé aux pros : 35 → 38 ================= */

    show($("#s-pro"), 35.19, 38.25);
    {
      const copy = $("#pro-copy");
      const box = $("#audience");
      if (P) {
        // Centré dans les trois quarts hauts : le quart bas reste libre.
        const total = copy.offsetHeight + 110 + box.offsetHeight;
        const top = Math.round((H * 0.75 - total) / 2);
        copy.style.top = `${top}px`;
        box.style.top = `${top + copy.offsetHeight + 110}px`;
      } else {
        copy.style.top = `${Math.round((H - copy.offsetHeight) / 2)}px`;
        box.style.top = `${Math.round((H - box.offsetHeight) / 2)}px`;
      }
    }
    appear("#pro-eyebrow", 35.45, { y: 12, d: 0.4 });
    rise($("#pro-title"), 35.5, { step: 0.05 });
    rise($("#pro-sub"), 36.0, { step: 0.04 });
    appear("#audience", 35.55, { x: P ? 0 : 60, y: P ? 60 : 0, d: 0.6 });
    tl.set(["#aud-ring-1", "#aud-dot-1", "#aud-badge"], { o: 0 }, -1);
    const option = layoutRect($("#aud-1"), stage);
    const optionX = option.x + option.width * 0.3;
    const optionY = option.y + option.height * 0.6;
    tl.set(cursor, { o: 1, x: optionX + 260, y: optionY + 320 }, 35.9);
    pointTo(optionX, optionY, 35.92, 0.45);
    click(optionX, optionY, 36.42);
    tl.set(["#aud-ring-0", "#aud-dot-0"], { o: 0 }, 36.44);
    tl.fromTo("#aud-ring-1", { o: 0, s: 0.96 }, { o: 1, s: 1 }, 36.44, 0.25, "outBack");
    tl.fromTo("#aud-dot-1", { o: 0, s: 0 }, { o: 1, s: 1 }, 36.44, 0.3, "outBackHard");
    tl.fromTo("#aud-badge", { o: 0, s: 0.6, r: -6 }, { o: 1, s: 1, r: 0 }, 36.7, 0.4, "outBackHard");
    tl.sfx("pop", 36.72, { pitch: 0.9, level: 0.8 });
    tl.to(cursor, { o: 0, x: optionX + 80, y: optionY + 100 }, 37.1, 0.35, "inCubic");

    /* ================= la tranche, à l'horizontale : vers le comparatif ================= */

    const bandsC = $$("#wipe-c > i");
    const bandCHeight = H / bandsC.length;
    bandsC.forEach((band, index) => {
      band.style.top = `${index * bandCHeight}px`;
      band.style.height = `${bandCHeight + 1}px`;
      const t = 37.7 + index * 0.035;
      tl.set(band, { o: 0 }, -1);
      tl.set(band, { o: 1 }, t);
      tl.fromTo(band, { x: W + 20 }, { x: 0 }, t, 0.42, "whip");
      tl.to(band, { x: -W - 20 }, 38.2 + index * 0.035, 0.45, "whip");
      tl.set(band, { o: 0 }, 38.75 + index * 0.035);
    });
    tl.sfx("whoosh", 37.7, { duration: 0.5, level: 0.9, from: 0.8, to: -0.8 });

    /* ================= 8. ce que ça rapporte : 38 → 46 ================= */

    show($("#s-keep"), 38.15, 46.1);
    {
      const grid = $(".keep-grid");
      const note = $("#keep-note");
      const sources = $("#keep-sources");
      const gridBottom = grid.offsetTop + grid.offsetHeight;
      note.style.top = `${gridBottom + (P ? 40 : 40)}px`;
      sources.style.top = `${gridBottom + (P ? 40 : 40) + note.offsetHeight + 26}px`;
    }
    appear("#keep-eyebrow", 38.4, { y: 12, d: 0.4 });
    rise($("#keep-title"), 38.45, { step: 0.06 });
    KEEP.forEach((market, index) => {
      const t = 38.75 + index * 0.25;
      appear(`#keep-${index}`, t, { y: 60, d: 0.7 });
      tl.sfx("swish", t);
      appear(`#keep-${index}-fee`, t + 0.3, { y: 12, d: 0.4 });
      appear(`#keep-${index}-ship`, t + 0.45, { y: 12, d: 0.4 });
      appear(`#keep-${index}-total`, t + 0.55, { y: 12, d: 0.4 });
      const countStart = t + 0.6;
      const countDuration = 1.3;
      tl.counter(`#keep-${index}-amount`, countStart, countDuration, 0, market.keepCents, (value) => euros(value, 2), "outCubic");
      for (let k = 0; k < 9; k++) tl.sfx("tick", countStart + k * 0.12, { pitch: 1 + k * 0.05 + index * 0.1, level: 0.35 });
    });
    tl.fromTo("#keep-note", { o: 0, cr: 100 }, { o: 1, cr: 0 }, 41.9, 0.6, "whip");
    tl.sfx("whoosh", 41.9, { duration: 0.45, level: 0.5 });
    appear("#keep-sources", 42.6, { y: 8, d: 0.6 });

    /* ================= 9. la fin : 46 → 50 ================= */

    const end = $("#s-end");
    show(end, 45.6, 99);
    tl.fromTo(end, { ct: 100 }, { ct: 0 }, 45.6, 0.5, "whip");
    tl.sfx("whoosh", 45.55, { duration: 0.5, level: 0.8 });
    const endLockup = $("#end-lockup");
    const endBox = { width: endLockup.offsetWidth, height: endLockup.offsetHeight };
    const endTitle = $("#end-title");
    const endSub = $("#end-sub");
    const endAddress = CONFIG.siteAddress ? $("#end-address") : null;
    const blockHeight = endBox.height + 70 + endTitle.offsetHeight + 34 + endSub.offsetHeight + (endAddress ? 40 + endAddress.offsetHeight : 0);
    const endX = Math.round((W - endBox.width) / 2);
    const endY = Math.round((H - blockHeight) / 2 - (P ? 40 : 10));
    endTitle.style.top = `${endY + endBox.height + 70}px`;
    endSub.style.top = `${endY + endBox.height + 70 + endTitle.offsetHeight + 34}px`;
    if (endAddress) endAddress.style.top = `${endY + endBox.height + 70 + endTitle.offsetHeight + 34 + endSub.offsetHeight + 40}px`;
    tl.set(endLockup, { x: endX, y: endY }, -1);
    tl.fromTo("#end-tranche", { sx: 0 }, { sx: 1 }, 45.85, 0.6, "brandInOut");
    tl.fromTo("#end-mark", { o: 0, s: 0.7, y: 30 }, { o: 1, s: 1, y: 0 }, 46.0, 0.55, "outBack");
    tl.fromTo("#end-mark .mk-side", { sx: 0 }, { sx: 1 }, 46.05, 0.4, "outBack");
    tl.fromTo("#end-mark .mk-top", { sy: 0 }, { sy: 1 }, 46.1, 0.4, "outBack");
    tl.sfx("impact", 46.0, { level: 0.8 });
    tl.sfx("motif", 46.0);
    const endLetters = splitLetters($("#end-word"));
    const endSize = parseFloat(getComputedStyle($("#end-word")).fontSize);
    endLetters.forEach((letter, index) => tl.fromTo(letter, { y: endSize * 1.1 }, { y: 0 }, 46.1 + index * 0.035, 0.55, "brand"));
    rise($("#end-title"), 46.55, { step: 0.07, d: 0.7 });
    tl.stagger("#end-sub > span", 47.05, 0.18, (el, t) => {
      appear(el, t, { y: 16, d: 0.45 });
      tl.sfx("tick", t, { pitch: 1.2, level: 0.5 });
    });
    if (CONFIG.siteAddress) appear("#end-address", 47.7, { y: 12, d: 0.5 });

    return tl;
  }

  /* Comme splitWords, lettre par lettre : le logotype se compose. */
  function splitLetters(el) {
    const letters = [];
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          for (const character of child.textContent) {
            const mask = document.createElement("span");
            mask.className = "mask";
            const inner = document.createElement("span");
            inner.className = "mask-in";
            inner.textContent = character;
            mask.appendChild(inner);
            fragment.appendChild(mask);
            letters.push(inner);
          }
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };
    walk(el);
    return letters;
  }

  function create(stage, { portrait = false } = {}) {
    buildStage(stage, portrait);
    const timeline = buildTimeline(stage, portrait);
    return { timeline, cues: timeline.cues };
  }

  window.Film = { DURATION, CHAPTERS, create, size: (portrait) => (portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }) };
})();
