/* ==========================================================================
   dashboard.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the Executive Dashboard. Five tabs for a 2-minute read: Ringkasan,
            Peta, Tanaman, Daerah, Amaran. Charts are initialised lazily, only
            when their tab first becomes visible (Section 7).
   Dependencies: data.js, auth.js, shared.js, vendor/chart.umd.js, chart.js.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. GUARD — Top Management only.
     ------------------------------------------------------------------ */
  if (!requireManagement()) return;

  let activePeriod = CURRENT_PERIOD_INDEX;
  let compareOffset = 1;          /* 1 = previous period, 2 = two back, … */
  let activeTab = "ringkasan";
  const chartDone = {};           /* tab id -> charts already built */

  const TABS = ["ringkasan", "peta", "tanaman", "daerah", "amaran"];

  /* District drill-down state for tab 4. */
  let districtDrill = null;
  /* Crop row expansion state for tab 3. */
  let expandedCrop = null;

  const sortState = {
    crops: { key: "luas", dir: "desc" },
    districts: { key: "luas", dir: "desc" }
  };

  /* ------------------------------------------------------------------
     1. DOM
     ------------------------------------------------------------------ */
  const periodSelect = document.getElementById("periodSelect");
  const compareSelect = document.getElementById("compareSelect");
  const printBtn = document.getElementById("printBtn");
  const kpiRow = document.getElementById("kpiRow");
  const mapGrid = document.getElementById("mapGrid");
  const mapLegend = document.getElementById("mapLegend");
  const layerSelect = document.getElementById("layerSelect");
  const cropHeadRow = document.getElementById("cropHeadRow");
  const cropBody = document.getElementById("cropBody");
  const districtHeadRow = document.getElementById("districtHeadRow");
  const districtBody = document.getElementById("districtBody");
  const districtFilterNote = document.getElementById("districtFilterNote");
  const alertGroups = document.getElementById("alertGroups");
  const districtPanel = document.getElementById("districtPanel");
  const districtPanelTitle = document.getElementById("districtPanelTitle");
  const districtPanelBody = document.getElementById("districtPanelBody");

  function period() { return PERIODS[activePeriod]; }
  function comparePeriodIndex() { return activePeriod - compareOffset; }
  function comparePeriod() {
    const i = comparePeriodIndex();
    return i >= 0 ? PERIODS[i] : null;
  }

  /* ------------------------------------------------------------------
     2. TAB 1 — RINGKASAN (KPI cards + 3 charts)
     ------------------------------------------------------------------ */
  function renderKpis() {
    const kpi = liveKpi();

    const cards = [
      {
        label: "Total Luas",
        value: formatNumber(kpi.totalLuas, 0),
        unit: "ha",
        delta: kpi.delta.luas,
        deltaUnit: "%"
      },
      {
        label: "Jumlah Rekod",
        value: formatNumber(kpi.totalRekod),
        unit: "rekod",
        delta: kpi.delta.rekod,
        deltaUnit: ""
      },
      {
        label: "Purata % Matang",
        value: formatNumber(kpi.avgMatang),
        unit: "%",
        delta: kpi.delta.matang,
        deltaUnit: "%"
      },
      {
        label: "Amaran Aktif",
        value: formatNumber(kpi.activeAlerts),
        unit: "amaran",
        delta: null,
        danger: kpi.activeAlerts > 0
      }
    ];

    render(kpiRow, cards.map(function (card) {
      const article = el("article", {
        class: "kpi-card col-3" + (card.danger ? " kpi-card--danger" : "")
      }, [
        el("p", { class: "kpi-card__label", text: card.label }),
        el("p", { class: "kpi-card__value", html:
          esc(card.value) + '<span class="kpi-card__unit">' + esc(card.unit) + "</span>" })
      ]);

      if (card.delta !== null) {
        article.appendChild(deltaSpan(card.delta, { unit: card.deltaUnit }));
        article.appendChild(el("p", {
          class: "kpi-card__note",
          text: "berbanding " + (comparePeriod() || "tempoh sebelumnya")
        }));
      } else if (card.danger) {
        article.appendChild(el("span", {
          class: "alert-pill alert-pill--high", text: "Perlu tindakan"
        }));
      }

      return article;
    }));
  }

  /* Charts are built here and ONLY here — this runs when the Ringkasan tab is
     first shown, never at page load (lazy init, Section 7). */
  function renderSummaryCharts() {
    renderCategoryDonut("chartCategory", period());
    renderTrendLine("chartTrend", period());
    renderTopDistrictsBar("chartTopDistricts", period());
    chartDone.ringkasan = true;
  }

  /* ------------------------------------------------------------------
     3. TAB 2 — PETA (27 heat tiles + side panel + layer toggle)
     The spec explicitly allows a grid of 27 labelled tiles instead of a
     simplified Sabah SVG (Section 8).
     ------------------------------------------------------------------ */
  function layerLuas(districtRow, layerCropId) {
    if (!layerCropId) return districtRow.luas;
    /* "jagung" stands in for the Tanaman Kontan layer. */
    const crops = layerCropId === "jagung"
      ? CROP_MASTER.filter(function (c) { return c.category === "Tanaman Kontan"; })
          .map(function (c) { return c.id; })
      : [layerCropId];

    return sumLuas(submissionsForDistrict(districtRow.district, period())
      .filter(function (row) { return crops.indexOf(row.cropId) !== -1; }));
  }

  function heatFor(value, max) {
    if (max <= 0 || value <= 0) return 0;
    return Math.min(6, Math.ceil((value / max) * 6));
  }

  function renderMap() {
    const rows = districtSummary(period());
    const layer = layerSelect.value;
    const values = rows.map(function (row) { return layerLuas(row, layer); });
    const max = Math.max.apply(null, values.concat([0]));

    render(mapGrid, rows.map(function (row, i) {
      const value = values[i];
      const tile = el("button", {
        type: "button",
        class: "map-tile" + (districtDrill === row.district ? " is-selected" : ""),
        dataset: { heat: String(heatFor(value, max)) },
        "aria-label": row.district + ", " + formatNumber(value, 1) + " hektar"
      }, [
        el("span", { class: "map-tile__name", text: row.district }),
        el("span", { class: "map-tile__value", text: formatNumber(value, 1) + " ha" })
      ]);
      tile.addEventListener("click", function () { openDistrictPanel(row); });
      return tile;
    }));

    render(mapLegend, [
      el("span", { class: "legend__item", text: "Aktiviti rendah" })
    ].concat([0, 1, 2, 3, 4, 5, 6].map(function (level) {
      return el("span", { class: "legend__swatch", dataset: { heat: String(level) } });
    })).concat([
      el("span", { class: "legend__item", text: "Aktiviti tinggi" }),
      el("span", {
        class: "legend__item text-muted",
        text: layer ? "Lapisan: " + cropName(layer)
                    : "Semua tanaman · maksimum " + formatNumber(max, 1) + " ha"
      })
    ]));
  }

  function openDistrictPanel(row) {
    districtDrill = row.district;
    districtPanelTitle.textContent = row.district;
    districtPanel.setAttribute("aria-hidden", "false");
    districtPanel.classList.add("is-open");

    const rows = submissionsForDistrict(row.district, period());
    const alerts = liveAlerts(period()).filter(function (alert) {
      return alert.district === row.district;
    });

    render(districtPanelBody, [
      el("div", { class: "side-panel__stats" }, [
        statBox(formatNumber(row.luas, 1), "Hektar"),
        statBox(String(row.rekod), "Rekod"),
        statBox(formatPct(row.avgMatang), "% Matang")
      ]),

      el("h3", { class: "card__title mb-0", text: "Pecahan Tanaman" }),
      el("div", { class: "table-wrap mt-3" }, [
        el("table", { class: "table" }, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", { scope: "col", text: "Tanaman" }),
              el("th", { scope: "col", class: "num", text: "Luas (ha)" }),
              el("th", { scope: "col", class: "num", text: "% Matang" })
            ])
          ]),
          el("tbody", {}, rows.length ? rows.map(function (r) {
            return el("tr", {}, [
              el("td", { text: cropName(r.cropId) }),
              el("td", { class: "num", text: formatNumber(r.luas, 1) }),
              el("td", { class: "num" }, [
                el("span", { class: matangBand(r.pctMatang), text: formatPct(r.pctMatang) })
              ])
            ]);
          }) : [
            el("tr", {}, [el("td", { colspan: "3" }, [
              emptyState("Tiada rekod", "Daerah ini belum menyerahkan data.")
            ])])
          ])
        ])
      ]),

      el("h3", { class: "card__title mt-4 mb-0", text: "Amaran" }),
      alerts.length ? el("div", { class: "mt-3" }, alerts.map(function (alert) {
        return el("p", {}, [
          severityPill(alert.severity),
          el("span", { text: " " + alert.issue })
        ]);
      })) : el("p", { class: "text-muted mt-3", text: "Tiada amaran bagi daerah ini." })
    ]);

    renderMap();
  }

  function statBox(value, label) {
    return el("div", { class: "side-panel__stat" }, [
      el("span", { class: "side-panel__stat-value", text: value }),
      el("span", { class: "side-panel__stat-label", text: label })
    ]);
  }

  function closeDistrictPanel() {
    districtPanel.classList.remove("is-open");
    districtPanel.setAttribute("aria-hidden", "true");
    districtDrill = null;
    renderMap();
  }

  /* ------------------------------------------------------------------
     4. TAB 3 — TANAMAN (sortable, colour-coded, expandable)
     ------------------------------------------------------------------ */
  const CROP_COLUMNS = [
    { key: "name", label: "Tanaman" },
    { key: "category", label: "Kategori" },
    { key: "luas", label: "Luas (ha)", align: "num" },
    { key: "pctMatang", label: "% Matang", align: "num" },
    { key: "delta", label: "vs. Tempoh Lepas", align: "num" },
    { key: "trend", label: "Trend", align: "num" }
  ];

  function renderCrops() {
    const rows = cropSummary(period()).filter(function (row) {
      return row.luas > 0 || row.prevLuas > 0;
    }).map(function (row) {
      row.trend = row.delta;
      return row;
    });

    const sorted = applySort(rows, sortState.crops);

    render(cropHeadRow, CROP_COLUMNS.map(function (column) {
      return sortableTh(column.label, column.key, sortState.crops, function (key) {
        toggleSort(sortState.crops, key);
        renderCrops();
      }, column.align);
    }));

    render(cropBody, sorted.flatMap(function (row) {
      const tr = el("tr", {}, [
        el("td", {}, [
          el("button", {
            type: "button", class: "link-btn", text: row.name,
            "aria-expanded": expandedCrop === row.cropId ? "true" : "false"
          })
        ]),
        el("td", { text: row.category }),
        el("td", { class: "num", text: formatNumber(row.luas, 1) }),
        el("td", { class: "num" }, [
          el("span", { class: matangBand(row.pctMatang), text: formatPct(row.pctMatang) })
        ]),
        el("td", { class: "num " + (row.delta > 0 ? "text-success"
          : row.delta < 0 ? "text-danger" : "text-muted"),
          text: formatDelta(row.delta) + "%" }),
        el("td", { class: "num", text: trendArrow(row.trend) })
      ]);

      /* Click the row to expand the district breakdown (Section 4.4 tab 3). */
      tr.addEventListener("click", function (event) {
        if (event.target.tagName === "BUTTON") return;
        expandedCrop = expandedCrop === row.cropId ? null : row.cropId;
        renderCrops();
      });

      const nodes = [tr];

      if (expandedCrop === row.cropId) {
        const breakdown = districtSummary(period()).filter(function (d) {
          return d.crops.indexOf(row.cropId) !== -1;
        }).sort(function (a, b) { return b.luas - a.luas; });

        nodes.push(el("tr", { class: "row-detail" }, [
          el("td", { colspan: String(CROP_COLUMNS.length) }, [
            el("div", { class: "row-detail__inner" }, [
              el("p", { class: "card__subtitle", text: "Pecahan daerah — " + row.name }),
              el("div", { class: "table-wrap" }, [
                el("table", { class: "table" }, [
                  el("thead", {}, [
                    el("tr", {}, [
                      el("th", { scope: "col", text: "Daerah" }),
                      el("th", { scope: "col", class: "num", text: "Luas (ha)" }),
                      el("th", { scope: "col", class: "num", text: "% Matang" })
                    ])
                  ]),
                  el("tbody", {}, breakdown.map(function (d) {
                    const detail = submissionsForDistrict(d.district, period())
                      .filter(function (r) { return r.cropId === row.cropId; })[0];
                    return el("tr", {}, [
                      el("td", { text: d.district }),
                      el("td", { class: "num", text: formatNumber(detail ? detail.luas : 0, 1) }),
                      el("td", { class: "num" }, [
                        el("span", {
                          class: matangBand(detail ? detail.pctMatang : 0),
                          text: formatPct(detail ? detail.pctMatang : 0)
                        })
                      ])
                    ]);
                  }))
                ])
              ])
            ])
          ])
        ]));
      }

      return nodes;
    }));
  }

  /* ------------------------------------------------------------------
     5. TAB 4 — DAERAH (27-district league table)
     ------------------------------------------------------------------ */
  const DISTRICT_COLUMNS = [
    { key: "district", label: "Daerah" },
    { key: "luas", label: "Luas (ha)", align: "num" },
    { key: "rekod", label: "Rekod", align: "num" },
    { key: "avgMatang", label: "% Matang", align: "num" },
    { key: "amaran", label: "Amaran", align: "num" }
  ];

  function renderDistricts() {
    let rows = districtSummary(period());
    rows = applySort(rows, sortState.districts);

    render(districtHeadRow, [el("th", { scope: "col", text: "Rank" })].concat(
      DISTRICT_COLUMNS.map(function (column) {
        return sortableTh(column.label, column.key, sortState.districts, function (key) {
          toggleSort(sortState.districts, key);
          renderDistricts();
        }, column.align);
      })
    ));

    render(districtBody, rows.map(function (row, i) {
      /* Build the row, then make the first cell a drill-down button. */
      const cells = [
        el("td", { class: "num", text: "#" + (i + 1) }),
        el("td", {}, [
          el("button", { type: "button", class: "link-btn", text: row.district })
        ]),
        el("td", { class: "num", text: formatNumber(row.luas, 1) }),
        el("td", { class: "num", text: String(row.rekod) }),
        el("td", { class: "num" }, [
          el("span", { class: matangBand(row.avgMatang), text: formatPct(row.avgMatang) })
        ]),
        el("td", { class: "num" }, [
          row.amaran > 0
            ? el("span", { class: "alert-pill alert-pill--high", text: String(row.amaran) })
            : el("span", { class: "text-muted", text: "0" })
        ])
      ];

      cells[1].querySelector("button").addEventListener("click", function () {
        districtDrill = row.district;
        switchTab("tanaman");
      });

      return el("tr", {}, cells);
    }));

    districtFilterNote.textContent = districtDrill
      ? "Tapisan aktif: " + districtDrill + " — klik Daerah untuk menetapkan semula."
      : "Klik nama daerah untuk melihat pecahan tanaman.";
  }

  /* ------------------------------------------------------------------
     6. TAB 5 — AMARAN (severity-grouped, status actions)
     ------------------------------------------------------------------ */
  function renderAlerts() {
    const groups = SEVERITY_ORDER.map(function (severity) {
      return {
        severity: severity,
        label: SEVERITY_LABEL[severity],
        items: liveAlerts(period()).filter(function (alert) {
          return alert.severity === severity;
        })
      };
    });

    render(alertGroups, groups.map(function (group) {
      const card = el("section", {
        class: "card card--" + (group.severity === "high" ? "danger"
          : group.severity === "medium" ? "warning" : "info")
      });

      card.appendChild(el("div", {
        class: "card__header card__header--" + (group.severity === "high" ? "danger"
          : group.severity === "medium" ? "warning" : "success")
      }, [
        severityPill(group.severity),
        el("h2", { class: "card__title", text: group.label }),
        el("span", { class: "count-chip", text: String(group.items.length) })
      ]));

      if (group.items.length === 0) {
        card.appendChild(el("div", { class: "card__body" }, [
          emptyState("Tiada amaran " + group.label.toLowerCase(),
                     "Tiada amaran pada tahap ini bagi tempoh dipilih.")
        ]));
        return card;
      }

      const body = el("div", { class: "table-wrap" }, [
        el("table", { class: "table" }, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", { scope: "col", text: "Daerah" }),
              el("th", { scope: "col", text: "Tanaman" }),
              el("th", { scope: "col", text: "Isu" }),
              el("th", { scope: "col", text: "Sejak" }),
              el("th", { scope: "col", text: "Status" }),
              el("th", { scope: "col", class: "col-actions", text: "Tindakan" })
            ])
          ]),
          el("tbody", {}, group.items.map(function (alert) {
            const done = alert.status === "Selesai";
            const btn = el("button", {
              type: "button",
              class: "btn btn--ghost btn--sm" + (done ? " is-done" : ""),
              text: done ? "Selesai" : "Tanda Selesai",
              disabled: done
            });
            btn.setAttribute("aria-label", "Tanda selesai amaran " + alert.id);
            btn.addEventListener("click", function () {
              setAlertStatus(alert.id, "Selesai");
              renderAlerts();
            });

            return el("tr", {}, [
              el("td", { text: alert.district }),
              el("td", { text: alert.cropId ? cropName(alert.cropId) : "—" }),
              el("td", { text: alert.issue }),
              el("td", { text: alert.since }),
              el("td", {}, [
                el("span", {
                  class: "badge " + (done ? "badge--approved"
                    : alert.status === "Dalam Tindakan" ? "badge--submitted" : "badge--rejected"),
                  text: alert.status
                })
              ]),
              el("td", { class: "col-actions" }, [btn])
            ]);
          }))
        ])
      ]);

      card.appendChild(body);
      return card;
    }));
  }

  /* ------------------------------------------------------------------
     7. TAB SWITCHING — this is where lazy chart init happens
     ------------------------------------------------------------------ */
  function switchTab(tabId) {
    if (TABS.indexOf(tabId) === -1) return;
    activeTab = tabId;

    TABS.forEach(function (id) {
      const button = document.getElementById("tab-" + id);
      const panel = document.getElementById("panel-" + id);
      const isActive = id === tabId;

      /* aria-selected drives the button styling; aria-hidden works with the
         print rules in layout.css; hidden drives screen behaviour. All three
         must stay in step. */
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.setAttribute("tabindex", isActive ? "0" : "-1");
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      panel.hidden = !isActive;
    });

    /* Page-level chrome and KPI cards belong to the dashboard rather than to
       any single tab, so they are rendered here — this is the only path that
       both shows a tab and prepares the page around it. */
    renderChrome();
    renderKpis();

    /* Each tab renders its own content, and the charts only on first visit. */
    if (tabId === "ringkasan") {
      if (!chartDone.ringkasan) renderSummaryCharts();
    } else if (tabId === "peta") {
      renderMap();
    } else if (tabId === "tanaman") {
      renderCrops();
    } else if (tabId === "daerah") {
      renderDistricts();
    } else if (tabId === "amaran") {
      renderAlerts();
    }
  }

  /* ------------------------------------------------------------------
     8. CHROME + BOOT
     ------------------------------------------------------------------ */
  function renderChrome() {
    renderHeader({
      pageTitle: "Papan Pemuka Eksekutif",
      context: "Tempoh: " + period()
    });
    setText("printPeriod", "Tempoh: " + period());
  }

  /* Re-render everything for the current period. */
  function refresh() {
    renderChrome();
    renderKpis();
    chartDone.ringkasan = false;   /* force charts to rebuild with new data */
    if (activeTab === "ringkasan") renderSummaryCharts();
    else if (activeTab === "peta") renderMap();
    else if (activeTab === "tanaman") renderCrops();
    else if (activeTab === "daerah") renderDistricts();
    else if (activeTab === "amaran") renderAlerts();
  }

  /* ------------------------------------------------------------------
     9. WIRING
     ------------------------------------------------------------------ */
  fillPeriodSelect(periodSelect, { selected: PERIODS[activePeriod] });
  periodSelect.addEventListener("change", function () {
    activePeriod = PERIODS.indexOf(periodSelect.value);
    districtDrill = null;
    refresh();
  });

  /* Compare selector: how many periods back the deltas are measured against. */
  PERIODS.forEach(function (label, i) {
    if (i >= CURRENT_PERIOD_INDEX) return;
    const option = el("option", {
      value: String(CURRENT_PERIOD_INDEX - i),
      text: label
    });
    compareSelect.appendChild(option);
  });
  compareSelect.addEventListener("change", function () {
    compareOffset = parseInt(compareSelect.value, 10) || 1;
    renderKpis();
  });

  printBtn.addEventListener("click", function () { window.print(); });

  layerSelect.addEventListener("change", renderMap);

  document.getElementById("districtPanelClose")
    .addEventListener("click", closeDistrictPanel);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && districtPanel.classList.contains("is-open")) {
      closeDistrictPanel();
    }
  });

  TABS.forEach(function (id) {
    document.getElementById("tab-" + id).addEventListener("click", function () {
      switchTab(id);
    });
  });

  /* Keyboard navigation across the tablist (left/right arrows). */
  document.querySelector(".tabs").addEventListener("keydown", function (event) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const i = TABS.indexOf(activeTab);
    const next = event.key === "ArrowRight"
      ? TABS[(i + 1) % TABS.length]
      : TABS[(i - 1 + TABS.length) % TABS.length];
    switchTab(next);
    document.getElementById("tab-" + next).focus();
    event.preventDefault();
  });

  /* ------------------------------------------------------------------
     10. BOOT
     switchTab() is the single entry point: it sets the panel visibility,
     renders the chrome and KPIs, and builds the charts for the one visible
     tab. Calling refresh() here as well would render everything twice and
     build each chart twice over.
     Charts remain lazy — only the Ringkasan charts are built at boot, and the
     other tabs build theirs on first visit.
     ------------------------------------------------------------------ */
  hydrateSubmissions();
  switchTab("ringkasan");
})();
