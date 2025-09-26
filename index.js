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
  cockpit.spawn([
    "bash", "-c",
    `LC_ALL=C sar -dp 1 1 | grep -v loop | awk '
      /^Average:/ && /DEV/ {
        for (i = 1; i <= NF; i++) {
          if ($i == "DEV") {
            dev = i;
            break;
          }
        }
        next;
      }

      /^Average:/ {
        if (dev) print $(dev);
      }
    '`
  ])
    .then(output => {
      const lines = output.trim().split("\n");
      const select = document.getElementById("diskSelect");
      if (!select) return;

      select.innerHTML = "";

      lines.forEach(name => {
        name = name.trim();
        if (!name) return;

        const opt = document.createElement("option");
        opt.value = name;
        opt.text = name;
        select.appendChild(opt);
      });

      if (select.options.length === 0) {
        const opt = document.createElement("option");
        opt.text = "❌ Не знойдзена прылад";
        opt.disabled = true;
        select.appendChild(opt);
      }
    })
    .catch(err => {
      console.error("❌ fetchDisks error:", err);
      const select = document.getElementById("diskSelect");
      if (select) {
        const opt = document.createElement("option");
        opt.text = "Не знойдзена";
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

    const selectedDisk = diskSelect.value;
    const selectedMetric = metricSelect.value;
    if (!selectedDisk || !selectedMetric) return;

    // Выклікаем без аргументаў — diskio.sh вяртае ўсе дыскі
    cockpit.spawn(["/usr/share/cockpit/diskio/diskio.sh"])
      .then(output => {
        const allDisksData = JSON.parse(output);
        const now = new Date().toLocaleTimeString();

        // Перабіраем усе дыскі
        Object.entries(allDisksData).forEach(([diskName, diskData]) => {
          Object.entries(diskData).forEach(([key, val]) => {
            metricStore.add(diskName, key, now, val);
          });
        });

        // Абнаўляем графік толькі для выбранага дыску і метрыкі
        if (chartManager.isOutdated(selectedDisk, selectedMetric)) {
          chartManager.setSelection(selectedDisk, selectedMetric);
          chartManager.renderInitial(metricStore);
          return;
        }

        chartManager.updateFromStore(metricStore);
      });
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {

  const _ = TranslationBridge._;
  document.getElementById("title").textContent = _("Disk I/O Monitor");
  document.getElementById("label").textContent = _("Select drive: ");
  document.getElementById("mtrSelName").textContent = _("Metric select: ");
  document.getElementById("pointLimName").textContent = _("Display values: ");
  document.getElementById("mS01").textContent = _("TPS");
  document.getElementById("mS02").textContent = _("Read/kBsec");
  document.getElementById("mS03").textContent = _("Write/kBsec");
  document.getElementById("mS04").textContent = _("Avg Request Size");
  document.getElementById("mS05").textContent = _("Avg Queue Size");
  document.getElementById("mS06").textContent = _("Await");
  document.getElementById("mS07").textContent = _("Service Time ms");
  document.getElementById("mS08").textContent = _("%Util");
  
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
  const classes = [...document.documentElement.classList];
  // console.log('HTML classes:', classes);
  // console.log(localStorage.getItem('shell:style'));

});
