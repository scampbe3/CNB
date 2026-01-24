/* CNB — AI Concierge (placeholder)
   Requirement: opens as overlay/modal; user stays on Home; close returns to same scroll pos.
*/
(function () {
  window.CNB = window.CNB || {};

  function createModal() {
    const overlay = document.createElement("div");
    overlay.className = "cnb-modal-overlay";
    overlay.innerHTML = `
      <div class="cnb-modal" role="dialog" aria-modal="true" aria-label="AI Concierge">
        <div class="cnb-modal-header">
          <div class="cnb-modal-title">Cupcakes + Broccoli — AI Concierge</div>
          <button class="cnb-modal-close" type="button">Close</button>
        </div>
        <div class="cnb-modal-body">
          <p><strong>Placeholder for Phase 1.</strong> This is where the “Ask a question” experience will live.</p>
          <p>For now, we’re proving the interaction model: overlay opens, no navigation, and closes back to the same scroll position.</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

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

  window.CNB.aiConcierge = {
    init() {
      // Only activate if the Home AI section exists
      const aiSection = document.querySelector(".cnb-home-ai");
      if (!aiSection) return;

      const overlay = createModal();

      const open = () => {
        overlay.dataset.open = "true";
        lockScroll();
      };

      const close = () => {
        overlay.dataset.open = "false";
        unlockScroll();
      };

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      overlay.querySelector(".cnb-modal-close")?.addEventListener("click", close);

      // Hook 1: Form submit (recommended)
      const form = aiSection.querySelector("form");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          open();
        });
      }

      // Hook 2: If you used a Button block instead of a Form, clicking it opens modal
      aiSection.querySelectorAll(".sqs-block-button a").forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          open();
        });
      });
    },
  };
})();
