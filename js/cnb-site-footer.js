(() => {
  const ROOT_SELECTOR = "[data-cnb-home-root]";
  const FOOTER_ID = "cnb-global-footer";
  const ACTIVE_CLASS = "cnb-global-footer-active";

  // Mount-managed pages render their own footer from JSON data.
  if (document.querySelector(ROOT_SELECTOR)) return;

  const defaultFooter = {
    company: "Cupcakes + Broccoli, LLC",
    email: "amanda@cupcakesandbroccoli.com",
    social: [
      { label: "Instagram", href: "https://www.instagram.com", newWindow: true, rel: "noopener" },
      { label: "LinkedIn", href: "https://www.linkedin.com", newWindow: true, rel: "noopener" },
    ],
  };

  const configured = window.CNB_GLOBAL_FOOTER || {};
  const footerData = {
    company: configured.company || defaultFooter.company,
    email: configured.email || defaultFooter.email,
    social: Array.isArray(configured.social) && configured.social.length ? configured.social : defaultFooter.social,
  };

  const createIconSvg = (type) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
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

  const createFooter = () => {
    const footer = document.createElement("footer");
    footer.id = FOOTER_ID;
    footer.className = "cnb-site-footer cnb-site-footer-global";

    const inner = document.createElement("div");
    inner.className = "cnb-site-footer-inner";

    const company = document.createElement("div");
    company.className = "cnb-site-footer-left";
    company.textContent = footerData.company;
    inner.appendChild(company);

    const socialWrap = document.createElement("div");
    socialWrap.className = "cnb-site-footer-social";
    footerData.social.forEach((item) => {
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
    emailLink.href = `mailto:${footerData.email}`;
    emailLink.textContent = footerData.email;
    inner.appendChild(emailLink);

    footer.appendChild(inner);
    return footer;
  };

  const mountFooter = () => {
    if (document.getElementById(FOOTER_ID)) return;
    document.body.classList.add(ACTIVE_CLASS);
    document.body.appendChild(createFooter());
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountFooter);
  } else {
    mountFooter();
  }
})();
