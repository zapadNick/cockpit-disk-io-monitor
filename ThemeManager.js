export function isDarkThemeActive() {
  const style = localStorage.getItem('shell:style') || 'auto';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return style === 'dark' || (style === 'auto' && prefersDark);
}

export function getThemeVersion() {
  const html = document.documentElement;
  const classes = [...html.classList];
  const themeClass = classes.find(cls => cls.endsWith('theme-dark') || cls.endsWith('theme-light'));
  return themeClass?.split('-theme-')[0] || 'pf-v5';
}

export function applyThemeClass() {
  const html = document.documentElement;
  const currentClasses = [...html.classList];
  const darkClass = currentClasses.find(cls => cls.endsWith('theme-dark'));
  const lightClass = currentClasses.find(cls => cls.endsWith('theme-light'));

  const isDark = isDarkThemeActive();
  const versionPrefix = darkClass?.split('-theme-dark')[0] || lightClass?.split('-theme-light')[0] || 'pf-v5';
  const targetClass = `${versionPrefix}-theme-${isDark ? 'dark' : 'light'}`;

  if (!html.classList.contains(targetClass)) {
    currentClasses
      .filter(cls => cls.includes('-theme-dark') || cls.includes('-theme-light'))
      .forEach(cls => html.classList.remove(cls));

    html.classList.add(targetClass);
    // console.log(`🔁 Тэма абноўлена: ${targetClass}`);
  // } else {
  //   console.log(`✅ Тэма ўжо актуальная: ${targetClass}`);
  }
}

export function injectShellVariables() {
  const shellRoot = window.parent?.document?.documentElement;
  if (!shellRoot) {
    console.warn("⚠️ Не ўдалося атрымаць shellRoot для пераменных");
    return;
  }

  const shellStyles = getComputedStyle(shellRoot);
  const cssLines = [];

  for (const name of shellStyles) {
    if (name.startsWith('--pf-')) {
      const value = shellStyles.getPropertyValue(name).trim();
      if (value) {
        cssLines.push(`${name}: ${value};`);
      }
    }
  }

  const styleTag = document.createElement('style');
  styleTag.setAttribute('data-theme-vars', 'true');
  styleTag.textContent = `:root {\n  ${cssLines.join('\n  ')}\n}`;
  document.head.appendChild(styleTag);

  // console.log("🎨 CSS-пераменныя Cockpit устаўлены праз <style> у :root");
}

export function injectAliasVariables() {
  try {
    const version = getThemeVersion();
    if (!version) throw new Error("❌ Не атрыманы version тэмы");

    const root = document.documentElement;
    const styleTargets = [root, document.body, ...document.querySelectorAll('[class*="pf-"]')];

    const aliases = {
      //--pf-v5-global--Color--100
      '--bg': `--${version}-global--BackgroundColor--100`,
      '--fg': `--${version}-global--Color--100`,
      '--panel-bg': `--${version}-global--BackgroundColor--200`,
      '--border': `--${version}-global--BorderColor--100`,
      '--chart-bg': `--${version}-global--BackgroundColor--200`,
      '--chart-grid': `--${version}-global--BorderColor--200`,
      '--chart-border': `--${version}-global--BorderColor--100`,
      '--accent': `--${version}-global--primary-color--100`,
      '--annotation-label-bg': `--${version}-global--palette--red-100`,
      '--annotation-label-fg': `--${version}-global--palette--gold-500`
    };

    function resolveVariable(varName) {
      const targets = [
        window.parent.document.documentElement,
        document.documentElement,
        document.body,
        ...document.querySelectorAll('[class*="pf-"]')
      ];

      for (const el of targets) {
        const value = getComputedStyle(el).getPropertyValue(varName)?.trim();
        if (value) return value;
      }

      const fallback = getComputedStyle(document.documentElement).getPropertyValue(varName)?.trim();
      if (fallback) {
        console.warn(`⚠️ Found only via fallback to <html>: ${fallback}`);
        return fallback;
      }

      console.error(`❌ Variable ${varName} not found`);
      return null;
    }

    const cssLines = [];
    for (const [alias, real] of Object.entries(aliases)) {
      const value = resolveVariable(real);
      if (!value) {
        console.warn(`⚠️ Не знойдзена пераменная ${real} для ${alias}`);
        continue;
      }
      cssLines.push(`${alias}: ${value};`);
    }

    if (cssLines.length === 0) {
      console.warn("⚠️ Няма пераменных для ін’екцыі — style не будзе дададзены");
      return;
    }

    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-theme-alias', 'true');
    styleTag.textContent = `:root {\n  ${cssLines.join('\n  ')}\n}`;
    document.head.appendChild(styleTag);

    // console.log("🔗 Аліасы пераменных устаўлены праз <style>");
  } catch (err) {
    console.error("❌ Памылка пры ін’екцыі аліасаў:", err);
  }
}

export function getPalette() {
  const styles = getComputedStyle(document.querySelector(':root'));
  return {
    line: styles.getPropertyValue('--accent')?.trim() || '#328181',
    annotationBorder: styles.getPropertyValue('--annotation-label-fg')?.trim() || 'gray',
    annotationBg: styles.getPropertyValue('--annotation-label-bg')?.trim() || 'rgba(255,0,0,0.1)',
    annotationText: styles.getPropertyValue('--annotation-label-fg')?.trim() || 'gray'
  };
}

export function getEffectivePalette() {
  const styles = getComputedStyle(document.querySelector(':root'));

  function get(name, fallback) {
    const value = styles.getPropertyValue(name)?.trim();
    return value || fallback;
  }

  return {
    // bg: get('--bg', '#f4f6f8'),
    bg: get('--bg', '#db0e41ff'),
    fg: get('--fg', '#333'),
    panelBg: get('--panel-bg', '#fff'),
    border: get('--border', '#ccc'),
    shadow: get('--shadow', 'rgba(0, 0, 0, 0.05)'),
    chartBg: get('--chart-bg', '#fff'),
    chartGrid: get('--chart-grid', 'gray'),
    chartBorder: get('--chart-border', '#ddd'),
    accent: get('--accent', '#328181'),
    annotationLabelBg: get('--annotation-label-bg', 'rgba(255,0,0,0.1)'),
    annotationLabelFg: get('--annotation-label-fg', 'gray')
  };
}

export function onThemeChange(callback) {
  const update = () => {
    applyThemeClass();
    injectShellVariables();
    injectAliasVariables();
    callback?.(isDarkThemeActive());
  };

  try {
    const shellRoot = window.parent?.document?.documentElement;
    if (shellRoot) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            update();
            break;
          }
        }
      });

      observer.observe(shellRoot, { attributes: true, attributeFilter: ['class'] });
      // console.log("👁️ Падпіска на змену класа тэмы праз MutationObserver");
    }
  } catch (err) {
    console.warn("⚠️ Не ўдалося падпісацца на змену тэмы:", err);
  }

  // дадатковая падпіска на сістэмную змену тэмы
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', update);
}

export function syncShellTheme() {
  applyThemeClass();
  injectShellVariables();
  injectAliasVariables();
  // console.log("🧩 Тэма сінхранізавана з Shell");
}
