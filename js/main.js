
/* CNB — bootstrap
   Adds stable classes to sections based on section Anchor IDs, so CSS stays clean.
*/
(function () {
  function findSectionByAnchorId(anchorId) {
    const el = document.getElementById(anchorId);
    if (!el) return null;

    // Sometimes the ID is on the <section>, sometimes on a child.
    return el.closest("section") || el;
  }

  function claimSection(anchorId, classes) {
    const section = findSectionByAnchorId(anchorId);
    if (!section) return null;

    section.classList.add("cnb-section", ...classes);

    // Helpful: add a stack wrapper class to whatever Squarespace uses as section inner container
    const inner =
      section.querySelector(".content-wrapper") ||
      section.querySelector(".section-border-content") ||
      section;

    inner.classList.add("cnb-stack");
    return section;
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("cnb");

    // Home anchors we’ll set in Squarespace
    const claimed = {
      "cnb-home-hero": ["cnb-home-hero"],
      "cnb-home-what": ["cnb-home-what"],
      "cnb-home-ai": ["cnb-home-ai"],
      "cnb-home-learn": ["cnb-feature"],
      "cnb-home-work": ["cnb-feature"],
      "cnb-home-dinners": ["cnb-feature"],
      "cnb-home-membership": ["cnb-feature"],
      "cnb-home-closing": ["cnb-feature"],
    };

    let isHome = false;

    Object.entries(claimed).forEach(([id, cls]) => {
      const section = claimSection(id, cls);
      if (section && id === "cnb-home-hero") isHome = true;
    });

    if (isHome) document.body.classList.add("cnb-home");

    // Mark secondary buttons (simple heuristic: 2nd button in hero + 2nd in membership)
    const hero = document.querySelector(".cnb-home-hero");
    if (hero) {
      const btnBlocks = hero.querySelectorAll(".sqs-block-button");
      if (btnBlocks[1]) btnBlocks[1].classList.add("cnb-btn-secondary");
      const ctaRow = document.createElement("div");
      ctaRow.className = "cnb-cta-row";
      // If Squarespace renders buttons separated, we just wrap visually by adding a row class to their parent container.
      // (CSS will still work even if this doesn't happen.)
      const parent = btnBlocks[0]?.parentElement;
      if (parent) parent.classList.add("cnb-cta-row");
    }

    const membership = document.querySelector("#cnb-home-membership")?.closest("section") || document.querySelector(".cnb-home-membership");
    if (membership) {
      const btnBlocks = membership.querySelectorAll(".sqs-block-button");
      if (btnBlocks[1]) btnBlocks[1].classList.add("cnb-btn-secondary");
    }

    // AI modal placeholder
    if (window.CNB && window.CNB.aiConcierge && typeof window.CNB.aiConcierge.init === "function") {
      window.CNB.aiConcierge.init();
    }
  });
})();
