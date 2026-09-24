/* ==========================================================================
   verify.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the System Administrator console. Filters submissions, surfaces
            anomalies, and lets the admin view / edit / approve / reject rows
            across all districts. Every edit requires a reason and is written
            to the row's auditLog (Section 4.3).
   Dependencies: data.js, auth.js, shared.js (in that order).
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. GUARD — admin only.
     ------------------------------------------------------------------ */
  if (!requireAdmin()) return;

  let activePeriod = getActivePeriod();
  let editingId = null;

  const filters = { district: "", crop: "", status: "", search: "" };
  const selected = new Set();   /* ids ticked in the pending table */

  /* ------------------------------------------------------------------
     1. DOM
     ------------------------------------------------------------------ */
  const periodSelect = document.getElementById("periodSelect");
  const periodState = document.getElementById("periodState");
  const districtFilter = document.getElementById("districtFilter");
  const cropFilter = document.getElementById("cropFilter");
  const statusFilter = document.getElementById("statusFilter");
  const searchInput = document.getElementById("searchInput");
  const resetFilterBtn = document.getElementById("resetFilterBtn");

  const anomaliBody = document.getElementById("anomaliBody");
  const anomaliCount = document.getElementById("anomaliCount");
  const pendingBody = document.getElementById("pendingBody");
  const pendingCount = document.getElementById("pendingCount");
  const approvedBody = document.getElementById("approvedBody");
  const approvedCount = document.getElementById("approvedCount");
  const selectAllPending = document.getElementById("selectAllPending");
  const bulkApproveBtn = document.getElementById("bulkApproveBtn");
  const bulkRejectBtn = document.getElementById("bulkRejectBtn");
  const sidebarSummary = document.getElementById("sidebarSummary");

  const modal = document.getElementById("editModal");
  const editForm = document.getElementById("editForm");
  const editModalTitle = document.getElementById("editModalTitle");
  const editModalContext = document.getElementById("editModalContext");
  const editCrop = document.getElementById("editCrop");
  const editCategory = document.getElementById("editCategory");
  const editArea = document.getElementById("editArea");
  const editLuas = document.getElementById("editLuas");
  const editLuasError = document.getElementById("editLuasError");
  const editMatang = document.getElementById("editMatang");
  const editMatangValue = document.getElementById("editMatangValue");
  const editTarikh = document.getElementById("editTarikh");
  const editCatatan = document.getElementById("editCatatan");
  const editCatatanCount = document.getElementById("editCatatanCount");
  const editStatus = document.getElementById("editStatus");
  const editReason = document.getElementById("editReason");
  const editReasonError = document.getElementById("editReasonError");

  /* ------------------------------------------------------------------
     2. FILTERING
     ------------------------------------------------------------------ */

  /* Rows for the active period shaped for the three tables. A row is "pending"
     when Dihantar, "approved" when Diluluskan, and rejected rows appear only
     under the status filter (they are neither queue nor record). */
  function periodRows() {
    return submissionsForPeriod(activePeriod);
  }

  function matchesFilters(row) {
    if (filters.district && row.district !== filters.district) return false;
    if (filters.crop && row.cropId !== filters.crop) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.search) {
      const haystack = [
        row.district, cropName(row.cropId), row.area, row.catatan,
        row.submittedBy, row.status
      ].join(" ").toLowerCase();
      if (haystack.indexOf(filters.search.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function filteredRows() {
    return periodRows().filter(matchesFilters);
  }

  /* Anomalies follow the filter bar too, minus the status/queue distinction:
     an alert is shown when its district, crop or free text matches. */
  function filteredAlerts() {
    return liveAlerts(activePeriod).filter(function (alert) {
      if (filters.district && alert.district !== filters.district) return false;
      if (filters.crop && alert.cropId !== filters.crop) return false;
      if (filters.search) {
        const haystack = [
          alert.district, alert.cropId ? cropName(alert.cropId) : "Semua tanaman",
          alert.issue, alert.status
        ].join(" ").toLowerCase();
        if (haystack.indexOf(filters.search.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------
     3. SECTION A — ANOMALI
     Actions: [Semak] opens the detail context, [Sunting] opens the edit modal
     for the underlying row, [Tolak] marks the alert resolved.
     ------------------------------------------------------------------ */
  function renderAnomali() {
    const alerts = filteredAlerts();
    anomaliCount.textContent = String(alerts.length);

    if (alerts.length === 0) {
      render(anomaliBody, [
        el("tr", {}, [el("td", { colspan: "6" }, [
          emptyState("Tiada anomali", "Tiada amaran bagi tapisan semasa.")
        ])])
      ]);
      return;
    }

    render(anomaliBody, alerts.map(function (alert) {
      const group = el("div", { class: "btn-group" });

      const semak = el("button", {
        type: "button", class: "btn btn--ghost btn--sm", text: "Semak"
      });
      semak.setAttribute("aria-label", "Semak anomali " + alert.id);
      semak.addEventListener("click", function () { inspectAlert(alert); });

      const sunting = el("button", {
        type: "button", class: "btn btn--secondary btn--sm", text: "Sunting"
      });
      sunting.setAttribute("aria-label", "Sunting rekod berkaitan " + alert.id);
      sunting.disabled = !findAlertRow(alert);
      sunting.addEventListener("click", function () {
        const row = findAlertRow(alert);
        if (row) openEditModal(row);
      });

      const tolak = el("button", {
        type: "button", class: "btn btn--danger btn--sm", text: "Tolak"
      });
      tolak.setAttribute("aria-label", "Tanda anomali " + alert.id + " selesai");
      tolak.disabled = alert.status === "Selesai";
      tolak.addEventListener("click", function () {
        setAlertStatus(alert.id, "Selesai");
        refresh();
      });

      group.appendChild(semak);
      group.appendChild(sunting);
      group.appendChild(tolak);

      const label = alert.cropId ? cropName(alert.cropId) : "—";

      return el("tr", {}, [
        el("td", { text: alert.district }),
        el("td", { text: label }),
        el("td", { text: alert.issue }),
        el("td", { text: alert.since }),
        el("td", {}, [
          el("span", {
            class: "badge " + (alert.status === "Selesai" ? "badge--approved" :
                               alert.status === "Dalam Tindakan" ? "badge--submitted" :
                               "badge--rejected"),
            text: alert.status
          })
        ]),
        el("td", { class: "col-actions" }, [group])
      ]);
    }));
  }

  /* The submission a "luas luar biasa" alert refers to. */
  function findAlertRow(alert) {
    return SUBMISSIONS.find(function (row) {
      return row.district === alert.district && row.period === alert.period &&
             row.cropId === alert.cropId;
    }) || null;
  }

  /* [Semak] — describe the alert in the info panel without opening the editor,
     so the admin can read the full issue before acting. */
  function inspectAlert(alert) {
    renderInfoPanel([
      "Amaran " + alert.id + " (" + (SEVERITY_LABEL[alert.severity] || alert.severity) + ")",
      alert.issue,
      "Daerah: " + alert.district,
      "Tanaman: " + (alert.cropId ? cropName(alert.cropId) : "Semua tanaman"),
      "Dikesan: " + alert.since,
      "Status: " + alert.status
    ]);
  }

  /* Shared read-only info panel used by both [Semak] and [Lihat]. Created on
     first use and left in the DOM afterwards, so repeated clicks update it in
     place instead of stacking duplicates. */
  function renderInfoPanel(lines) {
    let panel = document.getElementById("inspectPanel");
    if (!panel) {
      panel = el("div", { class: "alert-box alert-box--info", id: "inspectPanel",
                          role: "status" });
      const container = document.querySelector(".container");
      const firstCard = container.querySelector(".card");
      container.insertBefore(panel, firstCard);
    }
    render(panel, lines.map(function (line) { return el("p", { text: line }); }));
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ------------------------------------------------------------------
     4. SECTION B — MENUNGGU SEMAKAN
     ------------------------------------------------------------------ */
  function pendingRows() {
    return filteredRows().filter(function (row) {
      return row.status === STATUS.SUBMITTED;
    });
  }

  function renderPending() {
    const rows = pendingRows();
    pendingCount.textContent = String(rows.length);

    /* Drop any selection whose row is no longer on screen. */
    const visible = new Set(rows.map(function (row) { return row.id; }));
    selected.forEach(function (id) { if (!visible.has(id)) selected.delete(id); });
    selectAllPending.checked = rows.length > 0 && selected.size === rows.length;

    if (rows.length === 0) {
      render(pendingBody, [
        el("tr", {}, [el("td", { colspan: "8" }, [
          emptyState("Tiada rekod menunggu semakan",
                     "Rekod yang dihantar oleh operator akan muncul di sini.")
        ])])
      ]);
      return;
    }

    render(pendingBody, rows.map(function (row) {
      const check = el("input", {
        type: "checkbox", value: row.id,
        "aria-label": "Pilih rekod " + cropName(row.cropId) + " " + row.district
      });
      check.checked = selected.has(row.id);
      check.addEventListener("change", function () {
        if (check.checked) selected.add(row.id); else selected.delete(row.id);
        renderPending();
      });

      return el("tr", {}, [
        el("td", { class: "col-check" }, [check]),
        el("td", { text: row.district }),
        el("td", { text: cropName(row.cropId) }),
        el("td", { text: row.area }),
        el("td", { class: "num", text: formatNumber(row.luas, 1) }),
        el("td", { class: "num" }, [
          el("span", { class: matangBand(row.pctMatang),
                       text: formatPct(row.pctMatang) })
        ]),
        el("td", { text: row.submittedBy || "—" }),
        el("td", { class: "col-actions" }, [
          el("div", { class: "btn-group" }, [
            actionBtn("Lihat", "btn--ghost", function () { viewRow(row); },
                      "Lihat rekod " + row.id),
            actionBtn("Sunting", "btn--secondary", function () { openEditModal(row); },
                      "Sunting rekod " + row.id),
            actionBtn("Lulus", "btn--success", function () { approveRow(row.id); },
                      "Lulus rekod " + row.id),
            actionBtn("Tolak", "btn--danger", function () { rejectRow(row.id); },
                      "Tolak rekod " + row.id)
          ])
        ])
      ]);
    }));
  }

  function actionBtn(label, variant, handler, ariaLabel) {
    const button = el("button", {
      type: "button", class: "btn " + variant + " btn--sm", text: label
    });
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", handler);
    return button;
  }

  /* [Lihat] — read-only summary of everything on the row. */
  function viewRow(row) {
    renderInfoPanel([
      row.id + " — " + cropName(row.cropId) + " (" + cropCategory(row.cropId) + ")",
      "Daerah: " + row.district + " · Area: " + row.area,
      "Luas: " + formatNumber(row.luas, 1) + " ha · % Matang: " + formatPct(row.pctMatang),
      "Tarikh Semai: " + row.tarikhSemai,
      "Dihantar oleh: " + (row.submittedBy || "—") + " pada " + (row.submittedAt || "—"),
      "Catatan: " + (row.catatan || "—"),
      "Jejak audit: " + auditSummary(row)
    ]);
  }

  /* ------------------------------------------------------------------
     5. SECTION C — DILULUSKAN
     ------------------------------------------------------------------ */
  function approvedRows() {
    return filteredRows().filter(function (row) {
      return row.status === STATUS.APPROVED;
    });
  }

  function renderApproved() {
    const rows = approvedRows();
    approvedCount.textContent = String(rows.length);

    if (rows.length === 0) {
      render(approvedBody, [
        el("tr", {}, [el("td", { colspan: "7" }, [
          emptyState("Tiada rekod diluluskan", "Kelulusan akan dipaparkan di sini.")
        ])])
      ]);
      return;
    }

    render(approvedBody, rows.map(function (row) {
      return el("tr", {}, [
        el("td", { text: row.district }),
        el("td", { text: cropName(row.cropId) }),
        el("td", { text: row.area }),
        el("td", { class: "num", text: formatNumber(row.luas, 1) }),
        el("td", { class: "num" }, [
          el("span", { class: matangBand(row.pctMatang),
                       text: formatPct(row.pctMatang) })
        ]),
        el("td", { class: "text-muted", text: auditSummary(row) }),
        el("td", { class: "col-actions" }, [
          el("div", { class: "btn-group" }, [
            actionBtn("Sunting", "btn--secondary", function () { openEditModal(row); },
                      "Sunting rekod " + row.id),
            actionBtn("Batalkan Kelulusan", "btn--ghost",
                      function () { unapproveRow(row.id); },
                      "Batalkan kelulusan " + row.id)
          ])
        ])
      ]);
    }));
  }

  /* ------------------------------------------------------------------
     6. APPROVAL ACTIONS
     The inner *Silently helpers mutate only the data; refresh() is called once
     by the caller afterwards. Doing it the other way round — refreshing inside
     the loop — re-renders the whole console once per row, which on a 36-row
     bulk approval means 36 full DOM rebuilds on a single click.
     ------------------------------------------------------------------ */
  function approveRowSilently(id, reason) {
    setSubmissionStatus(id, STATUS.APPROVED,
      reason || "Diluluskan oleh pentadbir.");
  }

  function rejectRowSilently(id, reason) {
    setSubmissionStatus(id, STATUS.REJECTED,
      reason || "Ditolak oleh pentadbir — sila semak dan hantar semula.");
  }

  function approveRow(id) {
    approveRowSilently(id);
    refresh();
  }

  function rejectRow(id) {
    rejectRowSilently(id);
    refresh();
  }

  /* "Rare use" per Section 4.3: return an approved row to the pending queue. */
  function unapproveRow(id) {
    setSubmissionStatus(id, STATUS.SUBMITTED,
      "Kelulusan dibatalkan oleh pentadbir — rekod dikembalikan ke senarai semakan.");
    refresh();
  }

  function bulkApprove() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    selected.clear();
    ids.forEach(function (id) {
      approveRowSilently(id, "Diluluskan secara pukal oleh pentadbir.");
    });
    refresh();
  }

  function bulkReject() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    selected.clear();
    ids.forEach(function (id) {
      rejectRowSilently(id, "Ditolak secara pukal oleh pentadbir.");
    });
    refresh();
  }

  /* ------------------------------------------------------------------
     7. EDIT MODAL
     ------------------------------------------------------------------ */
  function fillEditSelects() {
    render(editCrop, CROP_MASTER.map(function (crop) {
      return el("option", { value: crop.id, text: crop.name });
    }));
    render(editCategory, CATEGORIES.map(function (category) {
      return el("option", { value: category, text: category });
    }));
  }

  function openEditModal(row) {
    editingId = row.id;
    editModalTitle.textContent = "Sunting Rekod — " + row.id;

    render(editModalContext, [
      el("span", {}, [
        el("strong", { text: row.district + " · " + cropName(row.cropId) + " · " + row.area }),
        el("br"),
        el("span", {
          text: "Tempoh " + row.period + " · Status semasa: " + row.status
        })
      ])
    ]);

    editCrop.value = row.cropId;
    editCategory.value = cropCategory(row.cropId);
    editArea.value = row.area;
    editLuas.value = row.luas;
    editMatang.value = String(row.pctMatang);
    editMatangValue.textContent = row.pctMatang + "%";
    editTarikh.value = row.tarikhSemai;
    editCatatan.value = row.catatan || "";
    editCatatanCount.textContent = (row.catatan || "").length + " / " + CATATAN_MAX;
    editStatus.value = row.status === STATUS.DRAFT ? STATUS.SUBMITTED : row.status;
    editReason.value = "";
    editLuasError.textContent = "";
    editReasonError.textContent = "";

    modal.hidden = false;
    document.body.classList.add("is-modal-open");
    editReason.focus();
  }

  function closeEditModal() {
    modal.hidden = true;
    editingId = null;
    document.body.classList.remove("is-modal-open");
  }

  /* Save: the reason is mandatory (Section 4.3) and is appended to auditLog. */
  function saveEdit(event) {
    event.preventDefault();
    const row = findSubmission(editingId);
    if (!row) { closeEditModal(); return; }

    const luas = parseFloat(editLuas.value);
    if (!isFinite(luas) || luas <= 0) {
      editLuasError.textContent = "Luas mesti lebih besar daripada 0.";
      editLuas.focus();
      return;
    }
    editLuasError.textContent = "";

    const reason = editReason.value.trim();
    if (reason === "") {
      editReasonError.textContent = "Sebab suntingan wajib diisi.";
      editReason.focus();
      return;
    }
    editReasonError.textContent = "";

    updateSubmission(editingId, {
      cropId: editCrop.value,
      category: editCategory.value,
      area: editArea.value.trim(),
      luas: luas,
      pctMatang: parseInt(editMatang.value, 10),
      tarikhSemai: editTarikh.value,
      catatan: editCatatan.value.trim(),
      status: editStatus.value
    }, reason, getUserId() || "admin");

    closeEditModal();
    refresh();
  }

  /* ------------------------------------------------------------------
     8. SIDEBAR SUMMARY
     ------------------------------------------------------------------ */
  function renderSidebar() {
    const rows = periodRows();
    const stats = [
      ["Jumlah rekod", rows.length],
      ["Menunggu", rows.filter(function (r) { return r.status === STATUS.SUBMITTED; }).length],
      ["Diluluskan", rows.filter(function (r) { return r.status === STATUS.APPROVED; }).length],
      ["Ditolak", rows.filter(function (r) { return r.status === STATUS.REJECTED; }).length],
      ["Amaran", liveAlerts(activePeriod).length],
      ["Jumlah luas", formatNumber(sumLuas(rows), 1) + " ha"]
    ];
    render(sidebarSummary, stats.flatMap(function (pair) {
      return [
        el("dt", { text: pair[0] }),
        el("dd", { text: String(pair[1]) })
      ];
    }));
  }

  /* ------------------------------------------------------------------
     9. PAGE CHROME
     ------------------------------------------------------------------ */
  function renderChrome() {
    const isCurrent = activePeriod === CURRENT_PERIOD;
    periodState.textContent = isCurrent ? "Sedang berjalan" : "Sejarah";
    periodState.className = "badge " + (isCurrent ? "badge--approved" : "badge--neutral");

    renderHeader({
      pageTitle: "Konsol Pengesahan",
      context: "Tempoh: " + activePeriod
    });
  }

  function refresh() {
    renderChrome();
    renderAnomali();
    renderPending();
    renderApproved();
    renderSidebar();
  }

  /* ------------------------------------------------------------------
     10. WIRING
     ------------------------------------------------------------------ */
  fillEditSelects();
  fillDistrictSelect(districtFilter, { includeAll: true, allLabel: "Semua Daerah" });
  render(cropFilter, [el("option", { value: "", text: "Semua Tanaman" })].concat(
    CROP_MASTER.map(function (crop) {
      return el("option", { value: crop.id, text: crop.name });
    })
  ));
  fillPeriodSelect(periodSelect, { selected: activePeriod });

  periodSelect.addEventListener("change", function () {
    activePeriod = setActivePeriod(periodSelect.value);
    selected.clear();
    refresh();
  });

  districtFilter.addEventListener("change", function () {
    filters.district = districtFilter.value; refresh();
  });
  cropFilter.addEventListener("change", function () {
    filters.crop = cropFilter.value; refresh();
  });
  statusFilter.addEventListener("change", function () {
    filters.status = statusFilter.value; refresh();
  });
  searchInput.addEventListener("input", function () {
    filters.search = searchInput.value.trim(); refresh();
  });
  resetFilterBtn.addEventListener("click", function () {
    filters.district = ""; filters.crop = ""; filters.status = ""; filters.search = "";
    districtFilter.value = ""; cropFilter.value = ""; statusFilter.value = "";
    searchInput.value = "";
    refresh();
  });

  selectAllPending.addEventListener("change", function () {
    const rows = pendingRows();
    if (selectAllPending.checked) {
      rows.forEach(function (row) { selected.add(row.id); });
    } else {
      selected.clear();
    }
    renderPending();
  });

  bulkApproveBtn.addEventListener("click", bulkApprove);
  bulkRejectBtn.addEventListener("click", bulkReject);

  document.getElementById("editModalClose").addEventListener("click", closeEditModal);
  document.getElementById("editCancelBtn").addEventListener("click", closeEditModal);
  editForm.addEventListener("submit", saveEdit);
  editMatang.addEventListener("input", function () {
    editMatangValue.textContent = editMatang.value + "%";
  });
  editCatatan.addEventListener("input", function () {
    editCatatanCount.textContent = editCatatan.value.length + " / " + CATATAN_MAX;
  });
  editCrop.addEventListener("change", function () {
    const category = cropCategory(editCrop.value);
    if (category) editCategory.value = category;
  });

  /* Collapsible sections A / B / C. */
  [["anomaliToggle", "anomaliPanel"],
   ["pendingToggle", "pendingPanel"],
   ["approvedToggle", "approvedPanel"]].forEach(function (pair) {
    const toggle = document.getElementById(pair[0]);
    const panel = document.getElementById(pair[1]);
    toggle.addEventListener("click", function () {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      panel.hidden = expanded;
    });
  });

  /* Escape closes the modal — expected behaviour for a dialog. */
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !modal.hidden) closeEditModal();
  });

  /* Clicking the backdrop (but not the dialog) closes the modal. */
  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeEditModal();
  });

  /* ------------------------------------------------------------------
     11. BOOT
     ------------------------------------------------------------------ */
  hydrateSubmissions();
  refresh();
})();
