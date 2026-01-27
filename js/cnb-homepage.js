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

  const renderImage = (image) => {
    if (!image) return null;
    const imageData = typeof image === "string" ? { src: image } : image;
    if (!imageData || !imageData.src) return null;

    const figure = withReveal(createEl("figure", "cnb-home-image"));
    const img = document.createElement("img");
    img.alt = imageData.alt || "";
    img.loading = "lazy";
    img.src = normalizeUrl(imageData.src);
    if (imageData.fit) img.dataset.fit = imageData.fit;
    figure.appendChild(img);

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
      const target = "Black ownership is Black";
      if (normalized.toLowerCase().startsWith(target.toLowerCase())) {
        const remainder = normalized.slice(target.length).trim();
        const lineOne = createEl("span", "cnb-home-title-line", target);
        const lineTwo = createEl("span", "cnb-home-title-line", remainder || "");
        title.append(lineOne, lineTwo);
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
    const image = renderImage(section.image);
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
    const image = renderImage(section.image);
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

    const nav = createEl("nav", "cnb-site-nav");
    nav.setAttribute("aria-label", "Primary");
    navItems.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href || "#";
      link.textContent = item.label || "";
      if (item.newWindow) link.target = "_blank";
      if (item.rel) link.rel = item.rel;
      nav.appendChild(link);
    });
    inner.appendChild(nav);

    header.appendChild(inner);
    return header;
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
