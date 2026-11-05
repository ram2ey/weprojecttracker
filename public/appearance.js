/* Runs before paint. Public HTML stays identical across visitors and cache entries. */
(() => {
  try {
    const value = localStorage.getItem("wassa-appearance");
    if (value === "light" || value === "dark")
      document.documentElement.dataset.theme = value;
  } catch {
    /* System appearance remains available when storage is blocked. */
  }
})();
