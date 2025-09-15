export class ChartManager {
  constructor(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error("❌ Canvas не знойдзены");

    this.ctx = canvas.getContext("2d");
    this.chart = null;
    this.disk = null;
    this.metric = null;
  }

  setSelection(disk, metric) {
    this.disk = disk;
    this.metric = metric;
  }
  
  computeSuggestedMax(values) {
    const maxValue = Math.max(...values);
    return maxValue > 0 ? maxValue * 1.05 : 1;
  }

  computeSuggestedMin(values) {
    const minValue = Math.min(...values);
    return minValue > 0 ? minValue * 0.95 : 0;
  }

  renderInitial(store) {
    const history = store.get(this.disk, this.metric);
    const fullHistory = store.getAll?.(this.disk, this.metric) || history;

    const labels = history.map(p => p.time);
    const values = history.map(p => p.value);
    const fullValues = fullHistory.map(p => p.value);

    const annotations = {};
    const p95 = this.buildPercentileAnnotation(fullValues, 95);
    if (p95) annotations.p95Line = p95;

    const suggestedMax = this.computeSuggestedMax(values);
    const suggestedMin = this.computeSuggestedMin(values);

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(this.ctx, {
      type: "line",
      data: {
        labels: labels.length ? labels : ["—"],
        datasets: [{
          label: this.metric,
          data: labels.length ? values : [0],
          borderColor: "blue",
          fill: false,
          tension: 0.2
        }]
      },
      options: {
        animation: false,
        scales: {
          y: {
            // beginAtZero: true,
            suggestedMax: suggestedMax,
            suggestedMin: suggestedMin
          },
          x: {
            ticks: {
              maxTicksLimit: 10 // паказаць не больш за ... подпісаў
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

    console.log(`📈 Графік пераствораны для ${this.disk} → ${this.metric}`);
  }

  updateFromStore(store) {
    if (!this.chart || !this.disk || !this.metric) return;

    const history = store.get(this.disk, this.metric);
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

  isOutdated(disk, metric) {
    return !this.chart || this.disk !== disk || this.metric !== metric || this.chart.data.datasets[0].label !== metric;
  }

  buildPercentileAnnotation(values, percentile = 95) {
    const numeric = values.filter(v => typeof v === "number");
    if (numeric.length <= 12) return null;

    const sorted = [...numeric].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const value = sorted[index];

    return {
      type: "line",
      scaleID: "y",
      value: value,
      borderColor: "gray",
      borderWidth: 2,
      label: {
        content: `${percentile}% перцынціль: ${value}`,
        enabled: true,
        position: "start",
        backgroundColor: "rgba(255,0,0,0.1)",
        color: "gray"
      }
    };
  }
}
