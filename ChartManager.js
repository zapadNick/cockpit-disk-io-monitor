import {
  onThemeChange,
  getEffectivePalette,
  syncShellTheme
} from './ThemeManager.js';


export class ChartManager {
  constructor(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error("❌ Canvas не знойдзены");

    this.ctx = canvas.getContext("2d");
    this.chart = null;
    this.disk = null;
    this.metric = null;

    syncShellTheme();
  }

  // rebuildChart(store) {
  //   if (!this.disk || !this.metric) return;
  //   this.renderInitial(store);
  // }

  setSelection(disk, metric) {
    this.disk = disk;
    this.metric = metric;
  }

  computeSuggestedMax(values) {
    const maxValue = Math.max(...values);
    return maxValue > 0 ? maxValue * 1.05 : 1;
  }

  computeSuggestedMin(values) {
    const filtered = values.filter(v => typeof v === "number" && !isNaN(v));
    if (!filtered.length) return 0;

    const minValue = Math.min(...filtered);
    return minValue > 0 ? minValue * 0.95 : 0;
  }

  renderInitial(store) {
    // падпіска на змену тэмы (адзін раз)
    if (!this._themeSubscribed) {
      onThemeChange(() => this.updateColors());
      this._themeSubscribed = true;
    }

    const history = store.getPadded(this.disk, this.metric);
    const fullHistory = store.getAll?.(this.disk, this.metric) || history;

    const labels = history.map(p => p.time);
    const values = history.map(p => p.value);
    const fullValues = fullHistory.map(p => p.value);

    const annotations = {};
    const p95 = this.buildPercentileAnnotation(fullValues, 95);
    if (p95) annotations.p95Line = p95;

    const suggestedMax = this.computeSuggestedMax(values);
    const suggestedMin = this.computeSuggestedMin(values);
    const palette = getEffectivePalette();

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(this.ctx, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["—"],
        datasets: [{
          label: this.metric,
          data: labels.length ? values : [0],
          borderColor: palette.accent,
          fill: false,
          tension: 0.2,
          spanGaps: false
        }]
      },
      options: {
        animation: false,
        scales: {
          y: {
            suggestedMax,
            suggestedMin,
            grid: {
              color: palette.chartGrid
            }
          },
          x: {
            ticks: {
              maxTicksLimit: 10
            },
            grid: {
              color: palette.chartGrid
            }
          }
        },
        plugins: {
          annotation: {
            annotations
          }
        }
      }
    });

    // console.log(`📈 Графік пераствораны для ${this.disk} → ${this.metric}`);
  }

  updateFromStore(store) {
    if (!this.chart || !this.disk || !this.metric) return;

    const history = store.getPadded(this.disk, this.metric);
    const labels = history.map(p => p.time);
    const values = history.map(p => p.value);
    const max = store.getLimit();

    this.chart.data.labels = labels.slice(-max);
    this.chart.data.datasets[0].data = values.slice(-max);

    this.chart.options.scales.y.suggestedMax = this.computeSuggestedMax(values);
    this.chart.options.scales.y.suggestedMin = this.computeSuggestedMin(values);

    const p95 = this.buildPercentileAnnotation(values, 95);
    if (p95) {
      this.chart.options.plugins.annotation.annotations.p95Line = p95;
    } else {
      delete this.chart.options.plugins.annotation.annotations.p95Line;
    }

    this.chart.update();
  }

  updateColors() {
    if (!this.chart) return;

    const palette = getEffectivePalette();
    // console.log("🎨 Атрыманая палітра:", palette);

    // абнаўляем колер лініі
    this.chart.data.datasets[0].borderColor = palette.accent;

    // абнаўляем колер сеткі
    this.chart.options.scales.x.grid.color = palette.chartGrid;
    this.chart.options.scales.y.grid.color = palette.chartGrid;

    // перастварэнне анатацыі
    const values = this.chart.data.datasets[0].data;
    const p95 = this.buildPercentileAnnotation(values, 95);

    // 🔁 абнаўляем анатацыі цалкам
    this.chart.options.plugins.annotation.annotations = {};
    if (p95) {
      this.chart.options.plugins.annotation.annotations.p95Line = p95;
    }

    this.chart.update();
  }

  isOutdated(disk, metric) {
    return !this.chart || this.disk !== disk || this.metric !== metric || this.chart.data.datasets[0].label !== metric;
  }

  buildPercentileAnnotation(values, percentile = 95) {
    const numeric = values.filter(v => typeof v === "number");
    if (numeric.length <= 12) return null;

    const sorted = [...numeric].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const value = sorted[index];

    const palette = getEffectivePalette();

    return {
      type: "line",
      scaleID: "y",
      value,
      borderColor: palette.annotationLabelFg,
      borderWidth: 2,
      label: {
        content: `${percentile}% перцынціль: ${value}`,
        enabled: true,
        position: "start",
        backgroundColor: palette.annotationLabelBg,
        color: palette.annotationLabelFg
      }
    };
  }
}
