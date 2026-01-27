(() => {
  const ROOT_SELECTOR = "[data-cnb-home-root]";
  const defaultData = { sections: [] };

  const mount = document.querySelector(ROOT_SELECTOR);
  if (!mount) return;
  if (mount.dataset.cnbMounted === "true") return;
  mount.dataset.cnbMounted = "true";

  const jsonUrl = mount.dataset.cnbSrc || window.CNB_HOME_JSON_URL;
  const assetBase = mount.dataset.cnbAssets || window.CNB_HOME_ASSET_BASE || "";

  const normalizeUrl = (value) => {
    if (!value) return "";
    const trimmed = String(value).trim();
    if (!trimmed) return "";
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed) || trimmed.startsWith("data:")) {
      return trimmed;
    }
    if (!assetBase) return trimmed;
    const base = assetBase.replace(/\/+$/, "");
    const path = trimmed.replace(/^\/+/, "");
    return `${base}/${path}`;
  };

  const createEl = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  const withReveal = (el) => {
    if (el) el.dataset.reveal = "true";
    return el;
  };

  const renderKicker = (text, className) => {
    if (!text) return null;
    return withReveal(createEl("div", className, text));
  };

  const renderBody = (body, parent) => {
    (body || []).forEach((copy) => {
      const p = withReveal(createEl("p", "cnb-home-body", copy));
      parent.appendChild(p);
    });
  };

  const buildCta = (cta) => {
    const isModal = cta.behavior === "modal";
    const el = document.createElement(isModal ? "button" : "a");
    el.className = `cnb-home-btn ${cta.variant || "primary"}`.trim();
    el.textContent = cta.label || "";
    if (isModal) {
      el.type = "button";
      el.dataset.behavior = "modal";
      if (cta.href) el.dataset.href = cta.href;
    } else if (cta.href) {
      el.href = cta.href;
    }
    return el;
  };

  const renderCtas = (ctas = []) => {
    if (!ctas.length) return null;
    const wrap = withReveal(createEl("div", "cnb-home-cta-row"));
    ctas.forEach((cta) => wrap.appendChild(buildCta(cta)));
    return wrap;
  };

  const renderInlineLink = (link) => {
    if (!link || !link.label) return null;
    if (!link.href) return withReveal(createEl("span", "cnb-inline-link", link.label));
    const anchor = createEl("a", "cnb-inline-link", link.label);
    anchor.href = link.href;
    return withReveal(anchor);
  };

  const clamp01 = (value) => Math.min(1, Math.max(0, value));

  const shouldUseCors = (src) => {
    try {
      const url = new URL(src, window.location.href);
      if (url.origin === window.location.origin) return true;
      return /cdn\.jsdelivr\.net|githubusercontent\.com$/i.test(url.hostname);
    } catch (err) {
      return false;
    }
  };

  const computeImageAccentRgb = (img) => {
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, size, size);

    let data;
    try {
      data = ctx.getImageData(0, 0, size, size).data;
    } catch (err) {
      return null;
    }

    let weightTotal = 0;
    let rTotal = 0;
    let gTotal = 0;
    let bTotal = 0;

    // Sample a subset of pixels to keep this very cheap.
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const spread = max - min;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Exclude black, white, and very light/dark tones.
      if (luma < 32 || luma > 225) continue;

      const saturation = max === 0 ? 0 : spread / max;
      // Exclude grayscale-ish colors.
      if (saturation < 0.2 || spread < 24) continue;

      const midTone = clamp01(1 - Math.abs(luma / 255 - 0.55) * 1.6);
      const weight = saturation * (0.6 + 0.8 * midTone);
      if (weight <= 0) continue;

      weightTotal += weight;
      rTotal += r * weight;
      gTotal += g * weight;
      bTotal += b * weight;
    }

    if (!weightTotal) return null;
    return {
      r: Math.round(rTotal / weightTotal),
      g: Math.round(gTotal / weightTotal),
      b: Math.round(bTotal / weightTotal),
    };
  };

  const applyImageAccentToSection = (sectionEl, img) => {
    if (!sectionEl || sectionEl.dataset.theme === "ink") return;
    const accent = computeImageAccentRgb(img);
    if (!accent) return;
    sectionEl.style.setProperty("--cnb-section-accent-rgb", `${accent.r}, ${accent.g}, ${accent.b}`);
  };

  const renderImage = (image, options = {}) => {
    if (!image) return null;
    const imageData = typeof image === "string" ? { src: image } : image;
    if (!imageData || !imageData.src) return null;

    const figure = withReveal(createEl("figure", "cnb-home-image"));
    const img = document.createElement("img");
    img.alt = imageData.alt || "";
    img.loading = "lazy";
    const src = normalizeUrl(imageData.src);
    if (shouldUseCors(src)) img.crossOrigin = "anonymous";
    img.src = src;
    if (imageData.fit) img.dataset.fit = imageData.fit;
    figure.appendChild(img);

    const { sectionEl } = options;
    if (sectionEl) {
      const applyAccent = () => applyImageAccentToSection(sectionEl, img);
      if (img.complete) {
        requestAnimationFrame(applyAccent);
      } else {
        img.addEventListener("load", applyAccent, { once: true });
      }
    }

    if (imageData.caption || imageData.credit) {
      const captionText = [imageData.caption, imageData.credit].filter(Boolean).join(" ");
      const caption = withReveal(createEl("figcaption", "cnb-home-caption", captionText));
      figure.appendChild(caption);
    }

    return figure;
  };

  const applyRevealDelays = (sectionEl) => {
    const revealNodes = sectionEl.querySelectorAll("[data-reveal]");
    revealNodes.forEach((node, index) => {
      node.style.setProperty("--reveal-delay", `${index * 80}ms`);
    });
  };

  const buildSection = (section, extraClass) => {
    const sectionEl = createEl("section", `cnb-home-section ${extraClass || ""}`.trim());
    if (section.id) sectionEl.id = section.id;
    if (section.theme) sectionEl.dataset.theme = section.theme;
    return sectionEl;
  };

  const renderHero = (section) => {
    const sectionEl = buildSection(section, "cnb-home-hero");
    const inner = createEl("div", "cnb-home-inner");
    const grid = createEl("div", "cnb-home-grid hero");

    const heroTop = createEl("div", "cnb-home-hero-top");
    if (section.note) {
      const note = withReveal(createEl("div", "cnb-home-hero-note", section.note));
      heroTop.appendChild(note);
    }

    const copy = createEl("div", "cnb-home-copy");
    const title = withReveal(createEl("h1", "cnb-home-title cnb-home-hero-title"));
    if (section.title) {
      const normalized = section.title.trim();
      const lineOneText = "Black ownership is";
      const lineTwoText = "Black survival,";
      if (normalized.toLowerCase().startsWith(lineOneText.toLowerCase())) {
        const afterLineOne = normalized.slice(lineOneText.length).trim();
        const afterLineTwo = afterLineOne.toLowerCase().startsWith(lineTwoText.toLowerCase())
          ? afterLineOne.slice(lineTwoText.length).trim()
          : afterLineOne.replace(/^Black\\s+survival,?/i, "").trim();
        const lineOne = createEl("span", "cnb-home-title-line", lineOneText);
        const lineTwo = createEl("span", "cnb-home-title-line", lineTwoText);
        const lineThree = createEl("span", "cnb-home-title-line", afterLineTwo || "");
        title.append(lineOne, lineTwo, lineThree);
      } else {
        title.textContent = normalized;
      }
    }
    copy.appendChild(title);
    if (section.subhead) {
      const subhead = withReveal(createEl("p", "cnb-home-subhead", section.subhead));
      copy.appendChild(subhead);
    }

    renderBody(section.body, copy);

    const media = createEl("div", "cnb-home-hero-media");
    const image = renderImage(section.image, { sectionEl });
    if (image) media.appendChild(image);

    grid.append(copy, media);
    inner.append(heroTop, grid);
    sectionEl.appendChild(inner);

    applyRevealDelays(sectionEl);
    return sectionEl;
  };

  const renderFeature = (section) => {
    const sectionEl = buildSection(section, "cnb-home-feature");
    const inner = createEl("div", "cnb-home-inner");
    const grid = createEl("div", "cnb-home-grid split");
    if (section.layout === "image-left") grid.classList.add("is-reversed");

    const copy = createEl("div", "cnb-home-copy");
    const eyebrow = renderKicker(section.eyebrow, "cnb-home-eyebrow");
    if (eyebrow) copy.appendChild(eyebrow);

    const title = withReveal(createEl("h2", "cnb-home-title", section.title || ""));
    copy.appendChild(title);

    renderBody(section.body, copy);

    const inlineLink = renderInlineLink(section.inlineLink);
    if (inlineLink) copy.appendChild(inlineLink);

    const ctas = renderCtas(section.ctas);
    if (ctas) copy.appendChild(ctas);

    const media = createEl("div", "cnb-home-media");
    const image = renderImage(section.image, { sectionEl });
    if (image) media.appendChild(image);

    if (image) {
      grid.append(copy, media);
    } else {
      grid.append(copy);
    }

    inner.appendChild(grid);
    sectionEl.appendChild(inner);

    applyRevealDelays(sectionEl);
    return sectionEl;
  };

  const renderAi = (section) => {
    const sectionEl = buildSection(section, "cnb-home-ai");
    const inner = createEl("div", "cnb-home-inner");
    const grid = createEl("div", "cnb-home-grid split");

    const copy = createEl("div", "cnb-home-copy");
    const eyebrow = renderKicker(section.eyebrow, "cnb-home-eyebrow");
    if (eyebrow) copy.appendChild(eyebrow);

    const title = withReveal(createEl("h2", "cnb-home-title", section.title || ""));
    copy.appendChild(title);

    renderBody(section.body, copy);

    const panel = createEl("div", "cnb-ai-panel");
    const label = withReveal(createEl("div", "cnb-ai-label", section.panelLabel || "Example prompts"));
    panel.appendChild(label);

    const list = createEl("ul", "cnb-ai-prompts");
    (section.prompts || []).forEach((prompt) => {
      const item = createEl("li", "");
      const button = createEl("button", "cnb-ai-prompt", prompt);
      button.type = "button";
      button.dataset.prompt = prompt;
      item.appendChild(button);
      list.appendChild(item);
    });
    panel.appendChild(list);

    const inputWrap = createEl("label", "cnb-ai-input");
    const inputLabel = createEl("span", "cnb-ai-input-label", "Your question");
    const textarea = document.createElement("textarea");
    textarea.className = "cnb-ai-textarea";
    textarea.rows = 3;
    textarea.placeholder = section.inputPlaceholder || "Type your question here.";
    inputWrap.append(inputLabel, textarea);
    panel.appendChild(inputWrap);

    const ctas = renderCtas(section.ctas);
    if (ctas) {
      ctas.classList.add("cnb-ai-actions");
      panel.appendChild(ctas);
    }

    grid.append(copy, panel);
    inner.appendChild(grid);
    sectionEl.appendChild(inner);

    applyRevealDelays(sectionEl);
    return sectionEl;
  };

  const renderClosing = (section) => {
    const sectionEl = buildSection(section, "cnb-home-closing");
    const inner = createEl("div", "cnb-home-inner");

    const eyebrow = renderKicker(section.eyebrow, "cnb-home-eyebrow");
    if (eyebrow) inner.appendChild(eyebrow);

    const title = withReveal(createEl("h2", "cnb-home-title", section.title || ""));
    inner.appendChild(title);

    renderBody(section.body, inner);

    const ctas = renderCtas(section.ctas);
    if (ctas) inner.appendChild(ctas);

    sectionEl.appendChild(inner);
    applyRevealDelays(sectionEl);
    return sectionEl;
  };

  const renderSiteHeader = (data) => {
    const headerData = (data && data.header) || {};
    if (headerData.enabled === false) return null;

    const header = createEl("header", "cnb-site-header");
    const inner = createEl("div", "cnb-site-header-inner");

    const brand = createEl("div", "cnb-site-brand");
    const logoSrc = headerData.logo || "assets/images/cb-icon-white.png";
    const logo = document.createElement("img");
    logo.className = "cnb-site-logo";
    logo.src = normalizeUrl(logoSrc);
    logo.alt = headerData.logoAlt || "Cupcakes + Broccoli";
    brand.appendChild(logo);

    const title = createEl("span", "cnb-site-title", headerData.title || "Cupcakes + Broccoli");
    brand.appendChild(title);

    inner.appendChild(brand);

    const navItems = headerData.nav || [
      { label: "Home", href: "/" },
      { label: "Contact", href: "/contact" },
      { label: "Instagram", href: "https://www.instagram.com" },
      { label: "LinkedIn", href: "https://www.linkedin.com" },
    ];

    const loginItem = navItems.find((item) => item.variant === "button" || item.isButton);
    const menuItems = loginItem ? navItems.filter((item) => item !== loginItem) : navItems;

    const navWrap = createEl("div", "cnb-site-nav-wrap");
    const nav = createEl("nav", "cnb-site-nav");
    nav.setAttribute("aria-label", "Primary");
    const navId = `cnb-site-nav-${Math.random().toString(36).slice(2, 8)}`;
    nav.id = navId;
    menuItems.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href || "#";
      link.textContent = item.label || "";
      if (item.newWindow) link.target = "_blank";
      if (item.rel) link.rel = item.rel;
      nav.appendChild(link);
    });
    navWrap.appendChild(nav);

    const menuToggle = createEl("button", "cnb-site-menu-toggle", "Menu");
    menuToggle.type = "button";
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-controls", navId);
    menuToggle.setAttribute("aria-label", "Toggle navigation");
    navWrap.appendChild(menuToggle);
    inner.appendChild(navWrap);

    if (loginItem) {
      const loginLink = document.createElement("a");
      loginLink.href = loginItem.href || "#";
      loginLink.textContent = loginItem.label || "";
      loginLink.className = "cnb-site-nav-button cnb-site-login";
      if (loginItem.newWindow) loginLink.target = "_blank";
      if (loginItem.rel) loginLink.rel = loginItem.rel;
      inner.appendChild(loginLink);
    }

    const closeNav = () => {
      header.classList.remove("is-menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    };

    menuToggle.addEventListener("click", () => {
      const isOpen = header.classList.toggle("is-menu-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeNav();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 960) closeNav();
    });

    header.appendChild(inner);
    return header;
  };

  const createIconSvg = (type) => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    if (type === "linkedin") {
      path.setAttribute(
        "d",
        "M6.9 6.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM4.5 9h2.9v9H4.5V9Zm5.1 0h2.8v1.2h.1c.4-.7 1.3-1.5 2.7-1.5 3 0 3.5 1.9 3.5 4.5V18h-3v-3.8c0-1 0-2.2-1.3-2.2s-1.5 1-1.5 2V18H9.6V9Z"
      );
    } else {
      path.setAttribute(
        "d",
        "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm6-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      );
    }
    svg.appendChild(path);
    return svg;
  };

  const renderSiteFooter = (data) => {
    const footerData = (data && data.footer) || {};
    if (footerData.enabled === false) return null;

    const footer = createEl("footer", "cnb-site-footer");
    const inner = createEl("div", "cnb-site-footer-inner");

    const company = createEl(
      "div",
      "cnb-site-footer-left",
      footerData.company || "Cupcakes + Broccoli, LLC"
    );
    inner.appendChild(company);

    const socialWrap = createEl("div", "cnb-site-footer-social");
    const headerNav = (data && data.header && data.header.nav) || [];
    const socialItems =
      footerData.social ||
      headerNav.filter((item) => /instagram|linkedin/i.test(item.label || ""));

    socialItems.forEach((item) => {
      const link = document.createElement("a");
      link.className = "cnb-site-footer-icon";
      link.href = item.href || "#";
      link.setAttribute("aria-label", item.label || "Social link");
      if (item.newWindow) link.target = "_blank";
      if (item.rel) link.rel = item.rel;
      const iconType = /linkedin/i.test(item.label || "") ? "linkedin" : "instagram";
      link.appendChild(createIconSvg(iconType));
      socialWrap.appendChild(link);
    });
    inner.appendChild(socialWrap);

    const emailLink = document.createElement("a");
    emailLink.className = "cnb-site-footer-right";
    const email = footerData.email || "amanda@cupcakesandbroccoli.com";
    emailLink.href = `mailto:${email}`;
    emailLink.textContent = email;
    inner.appendChild(emailLink);

    footer.appendChild(inner);
    return footer;
  };

  const renderSection = (section) => {
    switch (section.type) {
      case "hero":
        return renderHero(section);
      case "ai":
        return renderAi(section);
      case "closing":
        return renderClosing(section);
      default:
        return renderFeature(section);
    }
  };

  const bindModalTriggers = () => {
    mount.addEventListener("click", (event) => {
      const trigger = event.target.closest('[data-behavior="modal"]');
      if (!trigger) return;
      event.preventDefault();
      if (window.CNB && window.CNB.aiConcierge && typeof window.CNB.aiConcierge.open === "function") {
        window.CNB.aiConcierge.open();
      } else if (trigger.dataset.href) {
        window.location.href = trigger.dataset.href;
      }
    });
  };

  const insertHeaderBrand = (header) => {
    if (!header || header.querySelector(".cnb-header-title")) return true;

    const title = document.createElement("span");
    title.className = "cnb-header-title";
    title.textContent = "Cupcakes + Broccoli";

    const brandingRoot =
      header.querySelector(".header-title-logo") ||
      header.querySelector(".header-logo") ||
      header.querySelector(".Header-branding") ||
      header.querySelector(".header-branding") ||
      header.querySelector(".site-title") ||
      header.querySelector(".header-title") ||
      header.querySelector("[data-header-branding]");

    if (brandingRoot) {
      const logoEl = brandingRoot.querySelector("img, svg") || brandingRoot;
      const logoWrapper = logoEl.closest("a") || logoEl.parentElement;
      if (logoWrapper && logoWrapper.parentElement) {
        logoWrapper.insertAdjacentElement("afterend", title);
        return true;
      }
      brandingRoot.appendChild(title);
      return true;
    }

    const logoEl = header.querySelector("img, svg");
    if (logoEl) {
      const logoWrapper = logoEl.closest("a") || logoEl.parentElement;
      if (logoWrapper && logoWrapper.parentElement) {
        logoWrapper.insertAdjacentElement("afterend", title);
        return true;
      }
    }

    header.prepend(title);
    return true;
  };

  const injectHeaderBrand = () => {
    const header =
      document.querySelector("header") ||
      document.querySelector(".Header") ||
      document.querySelector("#header");
    if (insertHeaderBrand(header)) return;

    const observer = new MutationObserver(() => {
      const nextHeader =
        document.querySelector("header") ||
        document.querySelector(".Header") ||
        document.querySelector("#header");
      if (nextHeader && insertHeaderBrand(nextHeader)) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  const bindPromptFill = () => {
    mount.addEventListener("click", (event) => {
      const promptButton = event.target.closest(".cnb-ai-prompt");
      if (!promptButton) return;
      const panel = promptButton.closest(".cnb-ai-panel");
      if (!panel) return;
      const textarea = panel.querySelector(".cnb-ai-textarea");
      if (!textarea) return;
      textarea.value = promptButton.dataset.prompt || promptButton.textContent || "";
      textarea.focus();
    });
  };

  const setupRevealObserver = () => {
    const sections = Array.from(mount.querySelectorAll(".cnb-home-section"));
    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2 }
    );

    sections.forEach((section) => observer.observe(section));
  };

  const hydrate = (data) => {
    document.body.classList.add("cnb-homepage-active");
    mount.classList.add("cnb-home-root");
    const header = renderSiteHeader(data);
    if (header) mount.appendChild(header);
    const sections = (data && data.sections) || defaultData.sections;
    sections.forEach((section) => mount.appendChild(renderSection(section)));
    const footer = renderSiteFooter(data);
    if (footer) {
      const gap = createEl("div", "cnb-footer-gap");
      gap.setAttribute("aria-hidden", "true");
      mount.appendChild(gap);
      mount.appendChild(footer);
    }
    bindModalTriggers();
    bindPromptFill();
    setupRevealObserver();
  };

  if (jsonUrl) {
    fetch(jsonUrl)
      .then((res) => (res.ok ? res.json() : defaultData))
      .then(hydrate)
      .catch(() => hydrate(defaultData));
  } else if (window.CNB_HOME_DATA) {
    hydrate(window.CNB_HOME_DATA);
  } else {
    hydrate(defaultData);
  }
})();
