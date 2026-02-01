(() => {
  const repo = "scampbe3/CNB";
  const branch = "main";

  const getCacheBust = () => {
    const val = window.CNB_ASSET_VERSION || window.CNB_CACHE_BUST || "";
    return val ? String(val) : "";
  };

  const withCacheBust = (url) => {
    const bust = getCacheBust();
    if (!bust || !url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${encodeURIComponent(bust)}`;
  };

  const addStylesheet = (href) => {
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = withCacheBust(href);
    document.head.appendChild(link);
  };

  const addScript = (src) => {
    if (!src) return;
    const script = document.createElement("script");
    script.defer = true;
    script.src = withCacheBust(src);
    document.head.appendChild(script);
  };

  const resolvePageKey = (mount) => {
    if (mount && mount.dataset && mount.dataset.cnbPage) {
      return String(mount.dataset.cnbPage).trim();
    }
    if (window.CNB_PAGE) return String(window.CNB_PAGE).trim();
    return "";
  };

  const resolveDataUrl = (base, pageKey) => {
    const normalized = (pageKey || "").toLowerCase();
    if (!normalized || normalized === "home" || normalized === "homepage") {
      return `${base}/data/cnb-homepage.json`;
    }
    return `${base}/data/cnb-${normalized}.json`;
  };

  const setMountSources = (base) => {
    const mount = document.querySelector("[data-cnb-home-root]");
    const pageKey = resolvePageKey(mount);
    const externalContentUrl = window.CNB_CONTENT_URL;
    const dataUrl = resolveDataUrl(base, pageKey);
    const isHomePage = !pageKey || pageKey === "home" || pageKey === "homepage";
    const resolvedContentUrl = isHomePage ? externalContentUrl || dataUrl : dataUrl;

    if (mount) {
      mount.dataset.cnbSrc = mount.dataset.cnbSrc || resolvedContentUrl;
      mount.dataset.cnbAssets = base;
    }
    window.CNB_HOME_JSON_URL = resolvedContentUrl;
    window.CNB_HOME_FALLBACK_URL = resolvedContentUrl;
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
