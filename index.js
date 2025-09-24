import { ChartManager } from './ChartManager.js';
import { MetricStore } from './MetricStore.js';
import { syncShellTheme, onThemeChange } from './ThemeManager.js';


const metricStore = new MetricStore(() => {
  const select = document.getElementById("pointLimit");
  return parseInt(select?.value || "128", 10);
});

// syncShellTheme();

const chartManager = new ChartManager("chart");

function fetchDisks() {
  // -n no header, -P output in key-value format, e7 - exclude loops
  cockpit.spawn(["lsblk", "-nP", "-e7", "-o", "NAME,TYPE"])
    .then(output => {
      const lines = output.trim().split("\n");
      const select = document.getElementById("diskSelect");
      if (!select) return;

      select.innerHTML = "";

      lines.forEach(line => {
        const fields = {};
        line.trim().split(/\s+/).forEach(pair => {
          const [key, val] = pair.split("=");
          fields[key] = val.replace(/"/g, "");
        });

        const name = fields.NAME;
        const type = fields.TYPE;

        if (["disk", "part", "lvm"].includes(type)) {
          const opt = document.createElement("option");
          opt.value = name;
          opt.text = name;
          select.appendChild(opt);
        }
      });

      if (select.options.length === 0) {
        const opt = document.createElement("option");
        opt.text = "❌ Не знойдзена прылад";
        opt.disabled = true;
        select.appendChild(opt);
      }
    });
}

function startMonitoring() {
  setInterval(() => {
    const diskSelect = document.getElementById("diskSelect");
    const metricSelect = document.getElementById("metricSelect");

    if (!diskSelect || !metricSelect) return;

    const disk = diskSelect.value;
    const metric = metricSelect.value;
    if (!disk || !metric) return;

    cockpit.spawn(["/usr/share/cockpit/diskio/diskio.sh", disk])
      .then(output => {
        const data = JSON.parse(output);
        const now = new Date().toLocaleTimeString();

        Object.entries(data).forEach(([key, val]) => {
          if (!["disk", "type", "name"].includes(key)) {
            metricStore.add(disk, key, now, val);
          }
        });

        const typeLabel = document.getElementById("diskTypeLabel");
        if (typeLabel) {
          typeLabel.textContent = `Тып: ${data.type || "Unknown"}`;
        }

        if (chartManager.isOutdated(disk, metric)) {
          chartManager.setSelection(disk, metric);
          chartManager.renderInitial(metricStore);
          return;
        }

        chartManager.updateFromStore(metricStore);
      });
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  fetchDisks();
  setTimeout(startMonitoring, 1000);

  const pointLimit = document.getElementById("pointLimit");
  if (pointLimit) {
    pointLimit.addEventListener("change", () => {
      chartManager.updateFromStore(metricStore);
    });
  }

  const diskSelect = document.getElementById("diskSelect");
  const metricSelect = document.getElementById("metricSelect");

  if (diskSelect) {
    diskSelect.addEventListener("change", () => {
      const disk = diskSelect.value;
      const metric = metricSelect?.value;
      chartManager.setSelection(disk, metric);
    });
  }

  if (metricSelect) {
    metricSelect.addEventListener("change", () => {
      const disk = diskSelect?.value;
      const metric = metricSelect.value;
      chartManager.setSelection(disk, metric);
    });
  }
  
  // ✅ падпіска на змену тэмы
  // onThemeChange(() => {
  //   // if (chartManager.disk && chartManager.metric) {
  //     console.log("🎨 Тэма змянілася — перастварэнне графіка");
  //     const disk = diskSelect?.value;
  //     const metric = metricSelect.value;
  //     chartManager.setSelection(disk, metric);
  //     // chartManager.renderInitial(metricStore);
  //   // }
  // });

  const classes = [...document.documentElement.classList];
  // console.log('HTML classes:', classes);
  // console.log(localStorage.getItem('shell:style'));

});
