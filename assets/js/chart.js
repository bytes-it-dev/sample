/* ==========================================================================
   chart.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: a thin lazy wrapper around the locally vendored Chart.js UMD build.
            Charts are constructed only when their tab first becomes visible
            (Section 7: "Charts: initialize only when tab is visible (lazy
            init)"), and never at page load.
   Dependencies: assets/vendor/chart.umd.js must be loaded on the page BEFORE
                 dashboard.js. Nothing here touches the global `Chart` at
                 parse time — only inside create(), which the dashboard calls
                 on demand.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. REGISTRY
   Keys are chart ids, values are live Chart instances, so a tab switch can
   re-render a chart with new data without leaking a second canvas context.
   -------------------------------------------------------------------------- */
const CHART_INSTANCES = {};

const CHART_PALETTE = {
  green: "#1b5e20",
  greenLight: "#4caf50",
  gold: "#f9a825",
  blue: "#1565c0",
  red: "#c62828",
  orange: "#ef6c00",
  teal: "#00838f",
  brown: "#6d4c41",
  grey: "#90a4ae",
  purple: "#6a1b9a"
};

/* Category → colour, so the donut keeps consistent meaning across periods. */
const CATEGORY_COLORS = {
  "Tanaman Makanan": CHART_PALETTE.greenLight,
  "Tanaman Industri": CHART_PALETTE.green,
  "Tanaman Kontan": CHART_PALETTE.gold
};

function chartAvailable() {
  return typeof window.Chart !== "undefined";
}

/* --------------------------------------------------------------------------
   2. SHARED CHART.JS OPTIONS
   -------------------------------------------------------------------------- */
function chartFont() {
  return {
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    size: 12
  };
}

function chartTooltip(extra) {
  return Object.assign({
    backgroundColor: "rgba(26,26,26,0.92)",
    titleFont: { size: 13 },
    bodyFont: { size: 13 },
    padding: 10,
    cornerRadius: 4
  }, extra || {});
}

function chartLegend(extra) {
  return Object.assign({
    labels: { font: chartFont(), boxWidth: 12, usePointStyle: true }
  }, extra || {});
}

function baseChartOptions(extra) {
  const options = Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    /* No animation on first paint: the mockup must look settled in a
       screenshot and when printed to PDF. */
    animation: { duration: 300 },
    plugins: {
      legend: chartLegend(),
      tooltip: chartTooltip()
    }
  }, extra || {});

  /* Merge plugin-level overrides without dropping the defaults. */
  if (extra && extra.plugins) {
    options.plugins = {
      legend: extra.plugins.legend !== undefined
        ? extra.plugins.legend : chartLegend(),
      tooltip: extra.plugins.tooltip !== undefined
        ? extra.plugins.tooltip : chartTooltip()
    };
  }

  return options;
}

/* --------------------------------------------------------------------------
   3. LIFECYCLE
   -------------------------------------------------------------------------- */

/* Create (or replace) a chart on the canvas with the supplied id. Safe to call
   repeatedly: an existing instance is destroyed first, which is what lets the
   period switch re-render without stacking canvases. */
function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  if (!chartAvailable()) {
    showChartFallback(canvas, "Carta tidak dapat dimuatkan.");
    return null;
  }

  if (CHART_INSTANCES[canvasId]) {
    CHART_INSTANCES[canvasId].destroy();
    delete CHART_INSTANCES[canvasId];
  }

  try {
    CHART_INSTANCES[canvasId] = new window.Chart(canvas.getContext("2d"), config);
    return CHART_INSTANCES[canvasId];
  } catch (err) {
    showChartFallback(canvas, "Carta tidak dapat dipaparkan.");
    return null;
  }
}

/* Rendered in place of a canvas when Chart.js is missing or a dataset is
   empty, so the dashboard still reads sensibly. */
function showChartFallback(canvas, message) {
  const wrapper = canvas.parentNode;
  if (!wrapper) return;
  if (wrapper.querySelector(".empty-state")) return;
  canvas.hidden = true;
  wrapper.appendChild(el("div", { class: "empty-state" }, [
    el("p", { class: "empty-state__text", text: message })
  ]));
}

/* Undo a fallback before a real chart is drawn into the same box. */
function clearChartFallback(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.hidden = false;
  const wrapper = canvas.parentNode;
  const fallback = wrapper ? wrapper.querySelector(".empty-state") : null;
  if (fallback) wrapper.removeChild(fallback);
}

/* --------------------------------------------------------------------------
   4. THE THREE SUMMARY CHARTS
   -------------------------------------------------------------------------- */

/* Donut: Luas Mengikut Kategori Tanaman. */
function renderCategoryDonut(canvasId, period) {
  const totals = categoryTotals(period).filter(function (row) { return row.luas > 0; });
  clearChartFallback(canvasId);

  if (totals.length === 0) {
    showChartFallback(document.getElementById(canvasId), "Tiada data kategori.");
    return null;
  }

  return createChart(canvasId, {
    type: "doughnut",
    data: {
      labels: totals.map(function (row) { return row.category; }),
      datasets: [{
        data: totals.map(function (row) { return row.luas; }),
        backgroundColor: totals.map(function (row) {
          return CATEGORY_COLORS[row.category] || CHART_PALETTE.grey;
        }),
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: baseChartOptions({
      cutout: "58%",
      plugins: {
        legend: chartLegend({ position: "bottom" }),
        tooltip: chartTooltip({
          callbacks: {
            label: function (ctx) {
              return ctx.label + ": " + formatNumber(ctx.parsed, 1) + " ha";
            }
          }
        })
      }
    })
  });
}

/* Line: Trend 6 Tempoh (total luas over time). */
function renderTrendLine(canvasId, period) {
  const series = liveTrend();
  clearChartFallback(canvasId);

  return createChart(canvasId, {
    type: "line",
    data: {
      labels: series.map(function (row) { return row.period; }),
      datasets: [{
        label: "Jumlah luas (ha)",
        data: series.map(function (row) { return row.totalLuas; }),
        borderColor: CHART_PALETTE.green,
        backgroundColor: "rgba(27,94,32,0.12)",
        fill: true,
        tension: 0.32,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_PALETTE.green,
        borderWidth: 2
      }]
    },
    options: baseChartOptions({
      plugins: { legend: { display: false }, tooltip: chartTooltip() },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) { return formatNumber(value); }
          },
          grid: { color: "rgba(0,0,0,0.06)" }
        },
        x: {
          ticks: { maxRotation: 0, autoSkip: false, font: { size: 10 } },
          grid: { display: false }
        }
      }
    })
  });
}

/* Bar: Top 5 Daerah Mengikut Luas. */
function renderTopDistrictsBar(canvasId, period) {
  const rows = topDistricts(period, 5);
  clearChartFallback(canvasId);

  if (rows.length === 0) {
    showChartFallback(document.getElementById(canvasId), "Tiada data daerah.");
    return null;
  }

  return createChart(canvasId, {
    type: "bar",
    data: {
      labels: rows.map(function (row) { return row.district; }),
      datasets: [{
        label: "Luas (ha)",
        data: rows.map(function (row) { return row.luas; }),
        backgroundColor: rows.map(function (row, i) {
          return i === 0 ? CHART_PALETTE.green : CHART_PALETTE.greenLight;
        }),
        borderRadius: 4,
        maxBarThickness: 64
      }]
    },
    options: baseChartOptions({
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: function (value) { return formatNumber(value); } },
          grid: { color: "rgba(0,0,0,0.06)" }
        },
        x: { grid: { display: false } }
      }
    })
  });
}

/* Destroy everything — used when the dashboard re-renders wholesale. */
function destroyAllCharts() {
  Object.keys(CHART_INSTANCES).forEach(function (key) {
    CHART_INSTANCES[key].destroy();
    delete CHART_INSTANCES[key];
  });
}
