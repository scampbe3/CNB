(() => {
  const isJoinPage = () => /\/join\/?$/i.test(window.location.pathname);
  if (!isJoinPage()) return;

  const params = new URLSearchParams(window.location.search);
  const autoJoin = params.get("autojoin") || params.get("autoJoin") || "";
  const anchorId = (window.location.hash || "").replace("#", "").trim();
  if (!autoJoin || !anchorId) return;

  const findSignupButton = (root) => {
    if (!root) return null;
    const candidates = Array.from(root.querySelectorAll("button, a")).filter((el) => {
      const text = (el.textContent || "").trim().toLowerCase();
      return text === "sign up" || text.includes("sign up");
    });
    return candidates[0] || null;
  };

  const tryTrigger = () => {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return false;
    const container =
      anchor.closest("section") ||
      anchor.closest(".page-section") ||
      anchor.closest(".sqs-block") ||
      anchor.parentElement;
    const button = findSignupButton(container);
    if (!button) return false;
    button.click();
    return true;
  };

  const attempt = (count = 0) => {
    if (tryTrigger()) return;
    if (count >= 12) return;
    window.setTimeout(() => attempt(count + 1), 300);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => attempt());
  } else {
    attempt();
  }
})();
