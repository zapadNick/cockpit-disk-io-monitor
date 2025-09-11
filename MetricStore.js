export class MetricStore {
  constructor(getLimitFn) {
    this.store = {}; // { disk: { metric: [{time, value}, ...] } }
    this.getLimit = getLimitFn;
  }

  add(disk, metric, time, value) {
    if (!this.store[disk]) this.store[disk] = {};
    if (!this.store[disk][metric]) this.store[disk][metric] = [];

    this.store[disk][metric].push({ time, value });

    const max = this.getLimit();
    if (this.store[disk][metric].length > max) {
      this.store[disk][metric] = this.store[disk][metric].slice(-max);
    }
  }

  get(disk, metric) {
    const max = this.getLimit();
    return (this.store[disk]?.[metric] || []).slice(-max);
  }

  getLatest(disk, metric) {
    const list = this.store[disk]?.[metric];
    return list?.[list.length - 1] || null;
  }

  clear(disk, metric) {
    if (this.store[disk]) {
      delete this.store[disk][metric];
    }
  }

  metrics(disk) {
    return Object.keys(this.store[disk] || {});
  }

  disks() {
    return Object.keys(this.store);
  }

  getAll(disk, metric) {
    return this.store[disk]?.[metric] || [];
  }

  percentile(disk, metric, p) {
    const values = this.getAll(disk, metric).map(p => p.value);
    if (!values.length) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
