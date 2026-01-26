(() => {
  const repo = "scampbe3/CNB";
  const branch = "main";

  const addStylesheet = (href) => {
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  };

  const addScript = (src) => {
    if (!src) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = src;
    document.head.appendChild(script);
  };

  const setMountSources = (base) => {
    const mount = document.querySelector("[data-cnb-home-root]");
    if (mount) {
      mount.dataset.cnbSrc = `${base}/data/cnb-homepage.json`;
      mount.dataset.cnbAssets = base;
    }
    window.CNB_HOME_JSON_URL = `${base}/data/cnb-homepage.json`;
    window.CNB_HOME_ASSET_BASE = base;
  };

  const injectAssets = (base) => {
    setMountSources(base);
    addStylesheet(`${base}/css/cnb-homepage.css`);
    addScript(`${base}/js/ai-concierge.js`);
    addScript(`${base}/js/cnb-homepage.js`);
  };

  const fetchLatestSha = async () => {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`);
    if (!res.ok) throw new Error("Failed to fetch latest commit");
    const data = await res.json();
    return data.sha;
  };

  fetchLatestSha()
    .then((sha) => injectAssets(`https://cdn.jsdelivr.net/gh/${repo}@${sha}`))
    .catch(() => injectAssets(`https://cdn.jsdelivr.net/gh/${repo}@${branch}`));
})();
