/* CNB Home Page interactions for Squarespace */
(function () {
  "use strict";

  const SECTION_CONFIG = [
    { ids: ["cnb-home-hero", "cnb-hero"], classes: ["cnb-hero"] },
    { ids: ["cnb-home-what", "cnb-what-we-do"], classes: [] },
    { ids: ["cnb-home-ai", "cnb-ai-concierge"], classes: ["cnb-ai"] },
    { ids: ["cnb-home-learn", "cnb-learn"], classes: [] },
    { ids: ["cnb-home-work", "cnb-work-with-amanda"], classes: [] },
    { ids: ["cnb-home-dinners", "cnb-blind-dinners"], classes: [] },
    { ids: ["cnb-home-membership", "cnb-membership"], classes: ["cnb-membership"] },
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

    return section;
  }

  function groupButtons(section) {
    if (!section) return;
    const buttons = Array.from(section.querySelectorAll(".sqs-block-button"));
    if (!buttons.length) return;

    const parent = buttons[0].parentElement;
    if (parent && buttons.every((btn) => btn.parentElement === parent)) {
      parent.classList.add("cnb-cta-row");
    }
  }

  function markSecondaryButton(section) {
    if (!section) return;
    const buttons = section.querySelectorAll(".sqs-block-button");
    if (buttons[1]) buttons[1].classList.add("cnb-btn-secondary");
  }

  function wireAiConcierge(section) {
    if (!section) return;

    const triggers = section.querySelectorAll(
      ".sqs-block-button-element, button, a[href^='#']"
    );

    triggers.forEach((trigger) => {
      if (trigger.dataset.cnbAiWired) return;
      trigger.dataset.cnbAiWired = "true";
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        if (window.CNB && window.CNB.aiConcierge && typeof window.CNB.aiConcierge.open === "function") {
          window.CNB.aiConcierge.open();
        }
      });
    });

    const form = section.querySelector("form");
    if (form && !form.dataset.cnbAiWired) {
      form.dataset.cnbAiWired = "true";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (window.CNB && window.CNB.aiConcierge && typeof window.CNB.aiConcierge.open === "function") {
          window.CNB.aiConcierge.open();
        }
      });
    }
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
    let membershipSection = null;
    let aiSection = null;

    SECTION_CONFIG.forEach((config) => {
      const section = claimSection(config.ids, config.classes);
      if (section) {
        found = true;
        groupButtons(section);
        if (config.ids.indexOf("cnb-home-hero") >= 0 || config.ids.indexOf("cnb-hero") >= 0) {
          heroSection = section;
        }
        if (config.ids.indexOf("cnb-home-membership") >= 0 || config.ids.indexOf("cnb-membership") >= 0) {
          membershipSection = section;
        }
        if (config.ids.indexOf("cnb-home-ai") >= 0 || config.ids.indexOf("cnb-ai-concierge") >= 0) {
          aiSection = section;
        }
      }
    });

    if (!found) return;

    document.body.classList.add("cnb-active");
    if (heroSection) document.body.classList.add("cnb-home");

    markSecondaryButton(heroSection);
    markSecondaryButton(membershipSection);
    wireAiConcierge(aiSection);
    revealOnScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("load", init);
})();
