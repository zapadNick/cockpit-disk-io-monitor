const TranslationBridge = (() => {
  const lang = navigator.language.slice(0, 2);
  const dict = window._translations?.[lang] || window._translations?.["en"] || {};
  const fallback = window._translations?.["en"] || {};

  function _(key) {
    if (dict[key]) return dict[key];
    if (fallback[key]) {
      console.warn(`🔸 Missing translation for "${key}" in "${lang}", using fallback`);
      return fallback[key];
    }
    console.warn(`❌ Missing translation for "${key}" in "${lang}" and no fallback`);
    return key;
  }

  return { _ };
})();
