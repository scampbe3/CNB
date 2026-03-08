/* CNB Home Page interactions for Squarespace */
(function () {
  "use strict";

  const SECTION_CONFIG = [
    {
      ids: ["cnb-home-hero", "cnb-hero"],
      classes: ["cnb-hero", "cnb-photo-panel", "cnb-photo-hero"],
    },
    {
      ids: ["cnb-home-decision-room", "cnb-decision-room", "cnb-home-membership", "cnb-membership"],
      classes: ["cnb-membership", "cnb-membership-texture"],
    },
    {
      ids: ["cnb-home-business-counsel", "cnb-business-counsel", "cnb-home-work", "cnb-work-with-amanda"],
      classes: ["cnb-work", "cnb-photo-panel", "cnb-photo-work"],
    },
    {
      ids: ["cnb-home-strategic-partnership", "cnb-strategic-partnership"],
      classes: ["cnb-work", "cnb-photo-panel", "cnb-photo-work"],
    },
    {
      ids: ["cnb-home-case-studies", "cnb-case-studies", "cnb-home-stories", "cnb-stories"],
      classes: ["cnb-learn", "cnb-photo-panel", "cnb-photo-learn"],
    },
    {
      ids: ["cnb-home-dinners", "cnb-blind-dinners"],
      classes: ["cnb-dinners", "cnb-dinners-texture"],
    },
    { ids: ["cnb-home-closing", "cnb-closing"], classes: ["cnb-closing"] },
  ];

  function findSection(anchorId) {
    const el = document.getElementById(anchorId);
    if (!el) return null;
    return el.closest("section") || el.closest(".page-section") || el;
  }

  function claimSection(ids, classes) {
    let section = null;
    let matched = "";

    for (let i = 0; i < ids.length; i += 1) {
      section = findSection(ids[i]);
      if (section) {
        matched = ids[i];
        break;
      }
    }

    if (!section) return null;

    if (!section.dataset.cnbClaimed) {
      section.classList.add("cnb-section", ...classes);
      section.dataset.cnbClaimed = matched;
      section.setAttribute("data-reveal", "");
    }

    flagSection(section);
    return section;
  }

  function flagSection(section) {
    if (!section) return;
    if (section.querySelector(".sqs-block-image img, img")) {
      section.classList.add("cnb-has-image");
    }
    if (section.querySelector("ul, ol")) {
      section.classList.add("cnb-has-list");
    }
    if (section.querySelector("form")) {
      section.classList.add("cnb-has-form");
    }
  }

  function groupButtons(section) {
    if (!section) return;
    const buttons = Array.from(section.querySelectorAll(".sqs-block-button"));
    if (!buttons.length) return;

    const parent = buttons[0].parentElement;
    if (!parent) return;

    if (buttons.every((btn) => btn.parentElement === parent)) {
      parent.classList.add("cnb-cta-row");
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "cnb-cta-row";
    parent.insertBefore(wrapper, buttons[0]);
    buttons.forEach((btn) => wrapper.appendChild(btn));
  }

  function markSecondaryButton(section) {
    if (!section) return;
    const buttons = section.querySelectorAll(".sqs-block-button");
    if (buttons[1]) buttons[1].classList.add("cnb-btn-secondary");
  }

  function revealOnScroll() {
    const items = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!items.length) return;

    items.forEach((el, index) => {
      const delay = Math.min(index * 80, 360);
      el.style.setProperty("--reveal-delay", `${delay}ms`);
    });

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    items.forEach((el) => observer.observe(el));
  }

  function init() {
    let found = false;
    let heroSection = null;
    let decisionRoomSection = null;

    SECTION_CONFIG.forEach((config) => {
      const section = claimSection(config.ids, config.classes);
      if (section) {
        found = true;
        groupButtons(section);
        if (config.ids.indexOf("cnb-home-hero") >= 0 || config.ids.indexOf("cnb-hero") >= 0) {
          heroSection = section;
        }
        if (
          config.ids.indexOf("cnb-home-decision-room") >= 0 ||
          config.ids.indexOf("cnb-decision-room") >= 0 ||
          config.ids.indexOf("cnb-home-membership") >= 0 ||
          config.ids.indexOf("cnb-membership") >= 0
        ) {
          decisionRoomSection = section;
        }
      }
    });

    if (!found) return;

    document.body.classList.add("cnb-active");
    if (heroSection) document.body.classList.add("cnb-home");

    markSecondaryButton(heroSection);
    markSecondaryButton(decisionRoomSection);
    revealOnScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", init);
})();
