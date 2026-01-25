/* CNB AI Concierge placeholder modal */
(function () {
  "use strict";

  if (window.CNB && window.CNB.aiConcierge) return;

  let overlay;
  let lastFocus;

  function lockScroll() {
    const y = window.scrollY || 0;
    document.body.dataset.cnbScrollY = String(y);
    document.body.style.position = "fixed";
    document.body.style.top = `-${y}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
  }

  function unlockScroll() {
    const y = Number(document.body.dataset.cnbScrollY || "0");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    delete document.body.dataset.cnbScrollY;
    window.scrollTo(0, y);
  }

  function buildModal() {
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "cnb-modal-overlay";
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <div class="cnb-modal" role="dialog" aria-modal="true" aria-label="AI Concierge">
        <div class="cnb-modal-header">
          <h3 class="cnb-modal-title">Cupcakes + Broccoli — AI Concierge</h3>
          <button class="cnb-modal-close" type="button">Close</button>
        </div>
        <div class="cnb-modal-body">
          <p><strong>Phase 1 placeholder.</strong> This will become the expanded AI concierge experience.</p>
          <p>Ask a question in your own words and we will guide you toward clarity, context, and next steps.</p>
          <label class="cnb-field">
            <span>Your question</span>
            <input type="text" placeholder="What are you stuck on right now?" />
          </label>
          <div class="cnb-modal-actions">
            <button class="cnb-btn cnb-btn-primary" type="button">Submit</button>
            <button class="cnb-btn cnb-btn-secondary" type="button" data-ai-close>Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    const closeBtn = overlay.querySelector(".cnb-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", close);

    const cancelBtn = overlay.querySelector("[data-ai-close]");
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    const submitBtn = overlay.querySelector(".cnb-modal-actions .cnb-btn-primary");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const input = overlay.querySelector("input");
        const value = input ? input.value.trim() : "";
        if (value) {
          console.log("[CNB] AI placeholder submitted:", value);
        }
        close();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay && overlay.dataset.open === "true") {
        close();
      }
    });

    return overlay;
  }

  function open() {
    const modal = buildModal();
    lastFocus = document.activeElement;
    modal.dataset.open = "true";
    modal.setAttribute("aria-hidden", "false");
    lockScroll();
    const input = modal.querySelector("input");
    if (input) input.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.dataset.open = "false";
    overlay.setAttribute("aria-hidden", "true");
    unlockScroll();
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  window.CNB = window.CNB || {};
  window.CNB.aiConcierge = {
    open,
    close,
  };
})();
