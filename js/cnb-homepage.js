(() => {
  const ROOT_SELECTOR = "[data-cnb-home-root]";
  const defaultData = { sections: [] };

  const mounts = Array.from(document.querySelectorAll(ROOT_SELECTOR));
  if (!mounts.length) return;
  const mount =
    mounts.find((node) => node.dataset && node.dataset.cnbPage && node.dataset.cnbPage.trim()) ||
    mounts[0];
  mounts.forEach((node) => {
    if (node !== mount) node.remove();
  });
  const jsonUrl = mount.dataset.cnbSrc || window.CNB_CONTENT_URL || window.CNB_HOME_JSON_URL;
  const renderedSrc = mount.dataset.cnbRenderedSrc;
  if (mount.dataset.cnbMounted === "true" && renderedSrc === jsonUrl) return;
  mount.dataset.cnbMounted = "true";
  mount.dataset.cnbRenderedSrc = jsonUrl || "";
  if (mount.childElementCount) mount.innerHTML = "";
  const assetBase = mount.dataset.cnbAssets || window.CNB_HOME_ASSET_BASE || "";

  const SECTION_MAP = {
    Hero: "hero",
    "What This Is": "what",
    "AI Concierge": "ai",
    Learn: "learn",
    "Work With Amanda": "work",
    "Blind Dinners": "dinners",
    Membership: "membership",
    Closing: "closing",
  };

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

  const normalizePath = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      const path = url.pathname.replace(/\/+$/, "");
      return path || "/";
    } catch (err) {
      const cleaned = String(value).split("#")[0].replace(/^[a-z]+:\/\//i, "");
      const path = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
      return path.replace(/\/+$/, "") || "/";
    }
  };

  const isSameOriginPath = (href) => {
    if (!href) return false;
    const trimmed = String(href).trim();
    if (!trimmed || trimmed.startsWith("#")) return false;
    try {
      const url = new URL(trimmed, window.location.href);
      if (url.origin !== window.location.origin) return false;
      return normalizePath(url.pathname) === normalizePath(window.location.pathname);
    } catch (err) {
      if (!trimmed.startsWith("/")) return false;
      return normalizePath(trimmed) === normalizePath(window.location.pathname);
    }
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

  const renderBodyWithInlineImage = (body, parent, sectionEl, section) => {
    const items = body || [];
    const inlineAfter = Number.isFinite(section.inlineImageAfter)
      ? Math.max(1, Math.floor(section.inlineImageAfter))
      : null;
    let inlineImage = null;
    if (inlineAfter && section.image) {
      inlineImage = renderImage(section.image, { sectionEl, inline: true });
    }
    items.forEach((copy, index) => {
      const p = withReveal(createEl("p", "cnb-home-body", copy));
      parent.appendChild(p);
      if (inlineImage && index + 1 === inlineAfter) {
        parent.appendChild(inlineImage);
        inlineImage = null;
      }
    });
    if (inlineImage) parent.appendChild(inlineImage);
  };

  const renderList = (items, className = "cnb-home-list") => {
    if (!items || !items.length) return null;
    const list = withReveal(createEl("ul", className));
    items.forEach((item) => {
      const value =
        typeof item === "string"
          ? item
          : item && (item.text || item.label || item.value)
            ? item.text || item.label || item.value
            : "";
      if (!value) return;
      const li = createEl("li", "", value);
      list.appendChild(li);
    });
    return list;
  };

  const applyListVariant = (listEl, section) => {
    if (!listEl || !section) return;
    const variant = section.listVariant || section.listStyle || section.listLayout;
    if (!variant) return;
    listEl.classList.add(`is-${variant}`);
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
    if (options.inline) figure.classList.add("is-inline");
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
    const classes = ["cnb-home-section"];
    if (extraClass) classes.push(extraClass);
    if (section && section.layoutVariant) classes.push(`is-layout-${section.layoutVariant}`);
    const sectionEl = createEl("section", classes.join(" ").trim());
    if (section.id) sectionEl.id = section.id;
    if (section.theme) sectionEl.dataset.theme = section.theme;
    if (section.image) {
      sectionEl.dataset.hasImage = "true";
      const layout = section.layout === "image-left" ? "image-left" : "image-right";
      sectionEl.dataset.textSide = layout === "image-left" ? "right" : "left";
    }
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
      const isMobileTitle = window.matchMedia("(max-width: 720px)").matches;
      const mobilePrefix = "Black ownership is Black";
      const lineOneText = "Black ownership is";
      const lineTwoText = "Black survival,";
      if (normalized.toLowerCase().startsWith(mobilePrefix.toLowerCase()) && isMobileTitle) {
        let remainder = normalized.slice(mobilePrefix.length).trim();
        if (remainder) {
          remainder = remainder.replace(/^survival,?/i, "survival,").replace(/freedom\\s+and/i, "freedom, and");
        }
        const lineOne = createEl("span", "cnb-home-title-line", mobilePrefix);
        const lineTwo = createEl("span", "cnb-home-title-line", remainder || "");
        title.append(lineOne, lineTwo);
      } else if (normalized.toLowerCase().startsWith(lineOneText.toLowerCase())) {
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

    if (section.inlineImageAfter) {
      renderBodyWithInlineImage(section.body, copy, sectionEl, section);
    } else {
      renderBody(section.body, copy);
    }

    const media = createEl("div", "cnb-home-hero-media");
    const image = renderImage(section.image, { sectionEl });
    if (image) {
      media.appendChild(image);
      grid.append(copy, media);
    } else {
      grid.append(copy);
    }
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

    const list = renderList(section.list, "cnb-home-list");
    if (list) {
      applyListVariant(list, section);
      copy.appendChild(list);
    }

    if (section.bodyAfter) {
      renderBody(section.bodyAfter, copy);
    }

    const inlineLink = renderInlineLink(section.inlineLink);
    if (inlineLink) copy.appendChild(inlineLink);

    const ctas = renderCtas(section.ctas);
    if (ctas) copy.appendChild(ctas);

    const media = createEl("div", "cnb-home-media");
    const image = section.inlineImageAfter ? null : renderImage(section.image, { sectionEl });
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

  const renderTiers = (section) => {
    const sectionEl = buildSection(section, "cnb-home-tiers");
    if (section.variant) sectionEl.classList.add(`is-${section.variant}`);
    const inner = createEl("div", "cnb-home-inner");

    const header = createEl("div", "cnb-home-tiers-header");
    const eyebrow = renderKicker(section.eyebrow, "cnb-home-eyebrow");
    if (eyebrow) header.appendChild(eyebrow);

    if (section.title) {
      header.appendChild(withReveal(createEl("h2", "cnb-home-title", section.title)));
    }

    renderBody(section.body, header);

    const headerList = renderList(section.list, "cnb-home-list");
    if (headerList) {
      applyListVariant(headerList, section);
      header.appendChild(headerList);
    }

    const content = createEl("div", "cnb-home-copy cnb-home-tiers-copy");
    if (header.childElementCount) content.appendChild(header);

    const grid = createEl("div", "cnb-home-tiers-grid");
    if (section.variant === "stacked" || section.stack === "vertical") {
      grid.classList.add("is-stacked");
    }
    (section.tiers || []).forEach((tier) => {
      const card = withReveal(createEl("div", "cnb-tier-card"));
      if (tier && tier.featured) card.classList.add("is-featured");

      if (tier && tier.kicker) {
        card.appendChild(withReveal(createEl("div", "cnb-tier-kicker", tier.kicker)));
      }

      if (tier && tier.title) {
        card.appendChild(withReveal(createEl("h3", "cnb-tier-title", tier.title)));
      }

      if (tier && tier.price) {
        card.appendChild(withReveal(createEl("div", "cnb-tier-price", tier.price)));
      }

      if (tier && tier.summary) {
        card.appendChild(withReveal(createEl("p", "cnb-tier-summary", tier.summary)));
      }

      if (tier && tier.lead) {
        card.appendChild(withReveal(createEl("p", "cnb-tier-lead", tier.lead)));
      }

      const tierList = renderList(tier && tier.bullets, "cnb-tier-list");
      if (tierList) card.appendChild(tierList);

      if (tier && tier.note) {
        card.appendChild(withReveal(createEl("p", "cnb-tier-note", tier.note)));
      }

      if (tier && tier.cta && tier.cta.label) {
        const ctaEl = buildCta(tier.cta);
        ctaEl.classList.add("cnb-tier-cta");
        card.appendChild(ctaEl);
      }

      grid.appendChild(card);
    });

    content.appendChild(grid);

    const ctas = renderCtas(section.ctas);
    if (ctas) content.appendChild(ctas);

    if (section.image) {
      const gridWrap = createEl("div", "cnb-home-grid split");
      if (section.layout === "image-left") gridWrap.classList.add("is-reversed");
      const media = createEl("div", "cnb-home-media");
      const image = renderImage(section.image, { sectionEl });
      if (image) media.appendChild(image);
      if (image) {
        gridWrap.append(content, media);
      } else {
        gridWrap.append(content);
      }
      inner.appendChild(gridWrap);
    } else {
      inner.appendChild(content);
    }

    sectionEl.appendChild(inner);
    applyRevealDelays(sectionEl);
    return sectionEl;
  };

  const parseCsv = (text) => {
    if (!text) return [];
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }
      if (char === '"') {
        inQuotes = true;
        continue;
      }
      if (char === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      if (char === "\r") continue;
      field += char;
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  };

  const rowsFromCsv = (text) => {
    const grid = parseCsv(text);
    if (!grid.length) return [];
    const headers = grid.shift().map((h) => String(h || "").trim());
    if (headers[0]) headers[0] = headers[0].replace(/^\uFEFF/, "");

    const looksLikeUrl = (value) =>
      /^(?:https?:\/\/|\/|#|mailto:|tel:|www\.)/i.test(String(value || "").trim());

    const normalizeRow = (row) => {
      if (!Array.isArray(row)) return row;
      if (headers.length !== 5) {
        if (row.length < headers.length) {
          return row.concat(Array(headers.length - row.length).fill(""));
        }
        return row;
      }
      if (row.length === 5) {
        const section = row[0] == null ? "" : String(row[0]);
        const field = row[1] == null ? "" : String(row[1]);
        const value = row[2] == null ? "" : String(row[2]);
        const link = row[3] == null ? "" : String(row[3]);
        const notes = row[4] == null ? "" : String(row[4]);
        if (link && !looksLikeUrl(link)) {
          const merged = [value, link, notes].filter((part) => String(part).trim() !== "").join(", ");
          return [section, field, merged, "", ""];
        }
        return [section, field, value, link, notes];
      }

      const section = row[0] == null ? "" : String(row[0]);
      const field = row[1] == null ? "" : String(row[1]);
      const rest = row.slice(2).map((cell) => (cell == null ? "" : String(cell)));

      if (!rest.length) return [section, field, "", "", ""];
      if (rest.length <= 3) {
        return [section, field, rest[0] || "", rest[1] || "", rest[2] || ""];
      }

      const linkIndex = rest.findIndex((cell) => looksLikeUrl(cell));
      if (linkIndex === -1) {
        return [section, field, rest.join(",").trim(), "", ""];
      }

      const value = rest.slice(0, linkIndex).join(",").trim();
      const link = rest[linkIndex] || "";
      const notes = rest.slice(linkIndex + 1).join(",").trim();
      return [section, field, value, link, notes];
    };

    return grid
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
      .map((row) => {
        const normalizedRow = normalizeRow(row);
        const obj = {};
        headers.forEach((key, i) => {
          if (!key) return;
          obj[key] = normalizedRow[i] == null ? "" : String(normalizedRow[i]);
        });
        return obj;
      });
  };

  const deriveGvizUrl = (csvUrl) => {
    if (!csvUrl) return "";
    if (/\/gviz\/tq/i.test(csvUrl)) return csvUrl;
    try {
      const url = new URL(csvUrl, window.location.href);
      url.pathname = url.pathname.replace(/\/pub\/?$/i, "/gviz/tq");
      url.searchParams.set("tqx", "out:json");
      url.searchParams.delete("output");
      url.searchParams.delete("single");
      return url.toString();
    } catch (err) {
      return "";
    }
  };

  const loadGviz = (url, timeoutMs = 8000) =>
    new Promise((resolve, reject) => {
      if (!url) return reject(new Error("Missing GViz URL"));
      const script = document.createElement("script");
      let timeoutId;
      const cleanup = () => {
        clearTimeout(timeoutId);
        script.remove();
        if (window.google && window.google.visualization && window.google.visualization.Query) {
          delete window.google.visualization.Query.setResponse;
        }
      };
      const setResponse = (data) => {
        cleanup();
        resolve(data);
      };
      window.google = window.google || {};
      window.google.visualization = window.google.visualization || {};
      window.google.visualization.Query = window.google.visualization.Query || {};
      window.google.visualization.Query.setResponse = setResponse;
      script.onerror = () => {
        cleanup();
        reject(new Error("GViz load failed"));
      };
      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("GViz timeout"));
      }, timeoutMs);
      script.src = url;
      script.async = true;
      document.head.appendChild(script);
    });

  const rowsFromGviz = (payload) => {
    const table = payload && payload.table;
    if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) return [];
    const headers = table.cols.map((col) => String((col && col.label) || "").trim());
    return table.rows
      .map((row) => {
        const obj = {};
        (row.c || []).forEach((cell, i) => {
          const key = headers[i];
          if (!key) return;
          obj[key] = cell && cell.v != null ? String(cell.v) : "";
        });
        return obj;
      })
      .filter((row) => Object.values(row).some((value) => String(value || "").trim() !== ""));
  };

  const looksLikeUrl = (value) =>
    /^(?:https?:\/\/|\/|#|mailto:|tel:|www\.)/i.test(String(value || "").trim());

  const applyRowsToPage = (page, rows) => {
    const byId = {};
    (page.sections || []).forEach((section) => {
      if (section.id) byId[section.id] = section;
    });

    const updates = {};

    rows.forEach((row) => {
      const sectionName = row.section || "";
      const field = row.field || "";
      let value = row.value || "";
      let link = row.link || "";
      let notes = row.notes || "";
      if (!sectionName || !field) return;

      const isCtaField = /^cta\s*\d*/i.test(field) || /^inline\s*link/i.test(field);
      if (!isCtaField && link && !looksLikeUrl(link)) {
        const merged = [value, link, notes].filter((part) => String(part || "").trim() !== "").join(", ");
        value = merged;
        link = "";
        notes = "";
      }
    let sectionId = SECTION_MAP[sectionName];
    if (!sectionId) {
      const normalized = String(sectionName).trim().toLowerCase();
      const directMatch = Object.keys(byId).find((id) => id.toLowerCase() === normalized);
      sectionId = directMatch || "";
    }
    if (!sectionId) return;
      if (!updates[sectionId]) updates[sectionId] = {};
      const bucket = updates[sectionId];

      if (/^Body\s*\d+/i.test(field)) {
        const idx = Number(field.replace(/\D+/g, "")) || 1;
        if (!bucket.body) bucket.body = {};
        bucket.body[idx] = value;
        bucket.hasBody = true;
        return;
      }

      if (/^Body\s*After\s*\d+/i.test(field)) {
        const idx = Number(field.replace(/\D+/g, "")) || 1;
        if (!bucket.bodyAfter) bucket.bodyAfter = {};
        bucket.bodyAfter[idx] = value;
        bucket.hasBodyAfter = true;
        return;
      }

      if (/^List\s*\d+/i.test(field)) {
        const idx = Number(field.replace(/\D+/g, "")) || 1;
        if (!bucket.list) bucket.list = {};
        bucket.list[idx] = value;
        bucket.hasList = true;
        return;
      }

      if (/^Prompt\s*\d+/i.test(field)) {
        const idx = Number(field.replace(/\D+/g, "")) || 1;
        if (!bucket.prompts) bucket.prompts = {};
        bucket.prompts[idx] = value;
        bucket.hasPrompts = true;
        return;
      }

      if (/^CTA\s*\d*/i.test(field)) {
        const idxMatch = field.match(/\d+/);
        const idx = idxMatch ? Number(idxMatch[0]) : 1;
        if (!bucket.ctas) bucket.ctas = {};
        bucket.ctas[idx] = { label: value, href: link, notes };
        bucket.hasCtas = true;
        return;
      }

      if (/^Tier\s*\d+\s*CTA/i.test(field)) {
        const idxMatch = field.match(/\d+/);
        const idx = idxMatch ? Number(idxMatch[0]) : 1;
        if (!bucket.tierCtas) bucket.tierCtas = {};
        bucket.tierCtas[idx] = { label: value, href: link, notes };
        bucket.hasTierCtas = true;
        return;
      }

      if (/^Inline\s*link/i.test(field)) {
        bucket.inlineLink = { label: value, href: link };
        return;
      }

      if (/^Image/i.test(field)) {
        bucket.image = { src: value, alt: notes };
        return;
      }

      if (/^Panel\s*label/i.test(field)) {
        bucket.panelLabel = value;
        return;
      }

      if (/^Title/i.test(field)) {
        bucket.title = value;
        return;
      }

      if (/^Subhead/i.test(field)) {
        bucket.subhead = value;
        return;
      }

      if (/^Note/i.test(field)) {
        bucket.note = value;
        return;
      }

      if (/^Eyebrow/i.test(field)) {
        bucket.eyebrow = value;
      }
    });

    Object.keys(updates).forEach((sectionId) => {
      const section = byId[sectionId];
      if (!section) return;
      const data = updates[sectionId];

      ["title", "subhead", "note", "eyebrow", "panelLabel"].forEach((key) => {
        if (key in data) section[key] = data[key];
      });

      if (data.inlineLink) section.inlineLink = data.inlineLink;
      if (data.image && data.image.src) {
        section.image = section.image || {};
        section.image.src = data.image.src;
        if (data.image.alt) section.image.alt = data.image.alt;
      }

      if (data.hasBody) {
        const body = Object.keys(data.body || {})
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => data.body[k])
          .filter(Boolean);
        section.body = body;
      }

      if (data.hasBodyAfter) {
        const bodyAfter = Object.keys(data.bodyAfter || {})
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => data.bodyAfter[k])
          .filter(Boolean);
        section.bodyAfter = bodyAfter;
      }

      if (data.hasList) {
        const list = Object.keys(data.list || {})
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => data.list[k])
          .filter(Boolean);
        section.list = list;
      }

      if (data.hasPrompts) {
        const prompts = Object.keys(data.prompts || {})
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => data.prompts[k])
          .filter(Boolean);
        section.prompts = prompts;
      }

      if (data.hasCtas) {
        const ctas = Object.keys(data.ctas || {})
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => {
            const cta = data.ctas[k];
            if (!cta || !cta.label) return null;
            const out = { label: cta.label, href: cta.href };
            const note = (cta.notes || "").toLowerCase();
            if (note.includes("primary")) out.variant = "primary";
            if (note.includes("ghost")) out.variant = "ghost";
            if (note.includes("accent")) out.variant = "accent";
            if (note.includes("modal")) out.behavior = "modal";
            return out;
          })
          .filter(Boolean);
        section.ctas = ctas;
      }

      if (data.hasTierCtas && Array.isArray(section.tiers)) {
        Object.keys(data.tierCtas || {}).forEach((key) => {
          const idx = Number(key) - 1;
          if (!Number.isFinite(idx) || idx < 0 || idx >= section.tiers.length) return;
          const cta = data.tierCtas[key];
          if (!cta || (!cta.label && !cta.href)) return;
          const base = section.tiers[idx].cta || {};
          const out = {
            ...base,
            label: cta.label || base.label || "",
            href: cta.href || base.href || "",
          };
          const note = (cta.notes || "").toLowerCase();
          if (note.includes("primary")) out.variant = "primary";
          if (note.includes("ghost")) out.variant = "ghost";
          if (note.includes("accent")) out.variant = "accent";
          if (note.includes("modal")) out.behavior = "modal";
          if (out.label) section.tiers[idx].cta = out;
        });
      }
    });

    return page;
  };

  const isCsvUrl = (url) => /\.csv(?:\?|$)/i.test(url || "") || /output=csv/i.test(url || "");
  const fetchText = (url) =>
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null);

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

    const copy = createEl("div", "cnb-home-copy");

    const eyebrow = renderKicker(section.eyebrow, "cnb-home-eyebrow");
    if (eyebrow) copy.appendChild(eyebrow);

    const title = withReveal(createEl("h2", "cnb-home-title", section.title || ""));
    copy.appendChild(title);

    renderBody(section.body, copy);

    const list = renderList(section.list, "cnb-home-list");
    if (list) {
      applyListVariant(list, section);
      copy.appendChild(list);
    }

    const ctas = renderCtas(section.ctas);
    if (ctas) copy.appendChild(ctas);

    if (section.image) {
      const grid = createEl("div", "cnb-home-grid split");
      if (section.layout === "image-left") grid.classList.add("is-reversed");
      const media = createEl("div", "cnb-home-media");
      const image = renderImage(section.image, { sectionEl });
      if (image) media.appendChild(image);
      if (image) {
        grid.append(copy, media);
      } else {
        grid.append(copy);
      }
      inner.appendChild(grid);
    } else {
      inner.appendChild(copy);
    }

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
      const isCurrent =
        (item.page && resolvePageKey() && String(item.page).toLowerCase() === resolvePageKey()) ||
        isSameOriginPath(item.href || "");
      if (isCurrent) {
        link.classList.add("is-current");
      }
      if (item.newWindow) link.target = "_blank";
      if (item.rel) link.rel = item.rel;
      nav.appendChild(link);
    });
    if (loginItem) {
      const loginLink = document.createElement("a");
      loginLink.href = loginItem.href || "#";
      loginLink.textContent = loginItem.label || "";
      loginLink.className = "cnb-site-nav-button cnb-site-login";
      if (loginItem.newWindow) loginLink.target = "_blank";
      if (loginItem.rel) loginLink.rel = loginItem.rel;
      navWrap.appendChild(loginLink);
    }

    const menuRow = createEl("div", "cnb-site-menu-row");

    const menuToggle = createEl("button", "cnb-site-menu-toggle", "Menu");
    menuToggle.type = "button";
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-controls", navId);
    menuToggle.setAttribute("aria-label", "Toggle navigation");
    menuRow.appendChild(menuToggle);

    const navPanel = createEl("div", "cnb-site-nav-panel");
    navPanel.appendChild(nav);

    navWrap.appendChild(menuRow);
    navWrap.appendChild(navPanel);
    inner.appendChild(navWrap);

    const mobileNav = createEl("nav", "cnb-site-nav-mobile");
    mobileNav.setAttribute("aria-label", "Primary");
    menuItems.forEach((item) => {
      const isCurrent =
        (item.page && resolvePageKey() && String(item.page).toLowerCase() === resolvePageKey()) ||
        isSameOriginPath(item.href || "");
      if (isCurrent) return;
      const link = document.createElement("a");
      link.href = item.href || "#";
      link.textContent = item.label || "";
      if (item.newWindow) link.target = "_blank";
      if (item.rel) link.rel = item.rel;
      mobileNav.appendChild(link);
    });

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
    header.appendChild(mobileNav);
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
      case "tiers":
        return renderTiers(section);
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
    document.body.classList.add("cnb-homepage-active", "cnb-page-active");
    if (data && data.page) {
      document.body.classList.add(`cnb-page-${data.page}`);
    }
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

  const safeHydrate = (data) => {
    if (mount.dataset.cnbRenderedSrc !== jsonUrl) return;
    hydrate(data);
  };

  const fetchJson = (url) =>
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

  const loadJsonp = (url, timeoutMs = 8000) =>
    new Promise((resolve, reject) => {
      if (!url) return reject(new Error("Missing URL"));
      const callbackName = `CNBContentCallback_${Math.random().toString(36).slice(2, 8)}`;
      const hasCallback = /[?&]callback=/.test(url);
      const jsonpUrl = hasCallback ? url : `${url}${url.includes("?") ? "&" : "?"}callback=${callbackName}`;
      let timeoutId;
      const script = document.createElement("script");
      window[callbackName] = (data) => {
        clearTimeout(timeoutId);
        delete window[callbackName];
        script.remove();
        resolve(data);
      };
      script.onerror = () => {
        clearTimeout(timeoutId);
        delete window[callbackName];
        script.remove();
        reject(new Error("JSONP failed"));
      };
      timeoutId = window.setTimeout(() => {
        delete window[callbackName];
        script.remove();
        reject(new Error("JSONP timeout"));
      }, timeoutMs);
      script.src = jsonpUrl;
      script.async = true;
      document.head.appendChild(script);
    });

  const shouldJsonp = (url) => /script\\.google\\.com|googleusercontent\\.com/.test(url || "");

  const resolvePageKey = () => {
    const mount = document.querySelector("[data-cnb-home-root]");
    if (mount && mount.dataset && mount.dataset.cnbPage) {
      return String(mount.dataset.cnbPage).trim().toLowerCase();
    }
    if (window.CNB_PAGE) return String(window.CNB_PAGE).trim().toLowerCase();
    return "";
  };

  const buildFallbackUrl = () => {
    const assetBase = window.CNB_HOME_ASSET_BASE || window.CNB_ASSET_BASE || "";
    if (!assetBase) return "";
    const pageKey = resolvePageKey();
    if (!pageKey || pageKey === "home" || pageKey === "homepage") {
      return `${assetBase}/data/cnb-homepage.json`;
    }
    return `${assetBase}/data/cnb-${pageKey}.json`;
  };

  let fallbackUrl = window.CNB_HOME_FALLBACK_URL;
  if (!fallbackUrl || isCsvUrl(fallbackUrl)) {
    const builtFallback = buildFallbackUrl();
    if (builtFallback) fallbackUrl = builtFallback;
  }
  window.CNB_HOME_FALLBACK_URL = fallbackUrl;
  const mergeWithFallback = (primary, fallback) => {
    if (!primary) return fallback || defaultData;
    if (!fallback) return primary;
    const merged = { ...fallback, ...primary };
    if (!primary.header && fallback.header) merged.header = fallback.header;
    if (!primary.footer && fallback.footer) merged.footer = fallback.footer;
    if (!Array.isArray(primary.sections) || primary.sections.length === 0) {
      merged.sections = fallback.sections || primary.sections || [];
    }
    return merged;
  };

  if (jsonUrl && isCsvUrl(jsonUrl)) {
    window.CNB_LAST_CONTENT_URL = jsonUrl;
    const isGoogleSheetCsv = /docs\.google\.com\/spreadsheets/i.test(jsonUrl);
    const gvizUrl = isGoogleSheetCsv ? deriveGvizUrl(jsonUrl) : "";
    const loadGvizRows = gvizUrl
      ? loadGviz(gvizUrl)
          .then((payload) => rowsFromGviz(payload))
          .catch(() => null)
      : Promise.resolve(null);
    const loadCsvRows = fetchText(jsonUrl)
      .then((csvText) => (csvText ? rowsFromCsv(csvText) : null))
      .catch(() => null);
    const loadBase = fallbackUrl ? fetchJson(fallbackUrl) : Promise.resolve(defaultData);
    Promise.all([loadGvizRows, loadCsvRows, loadBase])
      .then(([gvizRows, csvRows, baseData]) => {
        const rows = (gvizRows && gvizRows.length ? gvizRows : csvRows) || null;
        const source = gvizRows && gvizRows.length ? "gviz" : "csv";
        return { rows, baseData, source };
      })
      .then(({ rows, baseData, source }) => {
        if (!rows || rows.length === 0) throw new Error("Missing rows");
        const base = baseData ? JSON.parse(JSON.stringify(baseData)) : JSON.parse(JSON.stringify(defaultData));
        const data = applyRowsToPage(base, rows);
        window.CNB_LAST_CONTENT_SOURCE = source;
        window.CNB_LAST_CONTENT_DATA = data;
        safeHydrate(data || defaultData);
      })
      .catch(() => {
        if (fallbackUrl) {
          fetchJson(fallbackUrl).then((data) => {
            window.CNB_LAST_CONTENT_SOURCE = "fallback";
            window.CNB_LAST_CONTENT_DATA = data || defaultData;
            safeHydrate(data || defaultData);
          });
        } else {
          window.CNB_LAST_CONTENT_SOURCE = "default";
          window.CNB_LAST_CONTENT_DATA = defaultData;
          safeHydrate(defaultData);
        }
      });
  } else if (jsonUrl) {
    window.CNB_LAST_CONTENT_URL = jsonUrl;
    const useJsonp = shouldJsonp(jsonUrl);
    const loadPrimary = useJsonp
      ? loadJsonp(jsonUrl)
          .then((data) => {
            window.CNB_LAST_CONTENT_SOURCE = "jsonp";
            return data;
          })
          .catch(() => null)
      : fetchJson(jsonUrl).then((data) => {
          if (data) window.CNB_LAST_CONTENT_SOURCE = "fetch";
          return data;
        });

    loadPrimary
      .then((data) => {
        if (fallbackUrl && fallbackUrl !== jsonUrl) {
          const needsFallback = !data || !Array.isArray(data.sections) || data.sections.length === 0;
          if (needsFallback) {
            return fetchJson(fallbackUrl).then((fallback) => {
              window.CNB_LAST_CONTENT_SOURCE = window.CNB_LAST_CONTENT_SOURCE
                ? `${window.CNB_LAST_CONTENT_SOURCE}+fallback`
                : "fallback";
              return mergeWithFallback(data, fallback);
            });
          }
        }
        return data;
      })
      .then((data) => {
        window.CNB_LAST_CONTENT_DATA = data || defaultData;
        safeHydrate(data || defaultData);
      })
      .catch(() => {
        if (fallbackUrl && fallbackUrl !== jsonUrl) {
          fetchJson(fallbackUrl).then((data) => {
            window.CNB_LAST_CONTENT_SOURCE = "fallback";
            window.CNB_LAST_CONTENT_DATA = data || defaultData;
            safeHydrate(data || defaultData);
          });
        } else {
          window.CNB_LAST_CONTENT_SOURCE = window.CNB_LAST_CONTENT_SOURCE || "default";
          window.CNB_LAST_CONTENT_DATA = defaultData;
          safeHydrate(defaultData);
        }
      });
  } else if (window.CNB_HOME_DATA) {
    safeHydrate(window.CNB_HOME_DATA);
  } else {
    safeHydrate(defaultData);
  }
})();
