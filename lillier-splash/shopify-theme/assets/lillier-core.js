(function () {
  const root = document.documentElement;
  root.classList.remove("no-js");

  const headers = document.querySelectorAll("[data-lillier-header]");
  if (!headers.length) return;

  headers.forEach((header) => {
    const menuToggle = header.querySelector("[data-lillier-menu-toggle]");
    const menuPanel = header.querySelector("[data-lillier-menu-panel]");
    if (!menuToggle || !menuPanel) return;

    const closeMenu = () => {
      header.classList.remove("is-menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    };

    menuToggle.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpen = header.classList.toggle("is-menu-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    menuPanel.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    let wasDesktop = window.matchMedia("(min-width: 900px)").matches;
    window.addEventListener("resize", () => {
      const isDesktop = window.matchMedia("(min-width: 900px)").matches;
      if (isDesktop !== wasDesktop) {
        closeMenu();
        wasDesktop = isDesktop;
      }
    });
  });
})();
