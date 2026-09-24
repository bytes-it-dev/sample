/* ==========================================================================
   entry.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the District Operator portal. Renders the entry form, validates it
            client-side, stores drafts, submits rows for verification, and
            lists everything the operator has recorded for the active period.
   Dependencies: data.js, auth.js, shared.js (in that order).
   Scope rules (Section 4.2): the operator sees and edits ONLY their own
            district, and only the current period is writable — past periods
            are locked read-only.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     0. GUARD — wrong role or no role leaves the page immediately.
     ------------------------------------------------------------------ */
  if (!requireOperator()) return;

  const district = getDistrict();
  let activePeriod = getActivePeriod();
  let editing = null;   /* id of the row currently loaded into the form */

  /* ------------------------------------------------------------------
     1. DOM REFERENCES
     ------------------------------------------------------------------ */
  const form = document.getElementById("entryForm");
  const recordIdInput = document.getElementById("recordId");
  const cropSelect = document.getElementById("cropSelect");
  const categorySelect = document.getElementById("categorySelect");
  const areaInput = document.getElementById("areaInput");
  const areaOptions = document.getElementById("areaOptions");
  const luasInput = document.getElementById("luasInput");
  const luasWarning = document.getElementById("luasWarning");
  const tarikhSemaiInput = document.getElementById("tarikhSemai");
  const matangRange = document.getElementById("matangRange");
  const matangValue = document.getElementById("matangValue");
  const catatanInput = document.getElementById("catatanInput");
  const catatanCount = document.getElementById("catatanCount");
  const draftBtn = document.getElementById("draftBtn");
  const resetBtn = document.getElementById("resetBtn");
  const submitBtn = document.getElementById("submitBtn");
  const formMode = document.getElementById("formMode");
  const periodSelect = document.getElementById("periodSelect");
  const periodState = document.getElementById("periodState");
  const lockedNotice = document.getElementById("lockedNotice");
  const recordsBody = document.getElementById("recordsBody");
  const recordsCount = document.getElementById("recordsCount");
  const recordsPeriod = document.getElementById("recordsPeriod");

  /* ------------------------------------------------------------------
     2. VALIDATION SCAFFOLD
     Red inline text under the field, per Section 4.2.
     ------------------------------------------------------------------ */
  const FIELDS = {
    crop:     { error: "cropError",     control: cropSelect },
    category: { error: "categoryError", control: categorySelect },
    area:     { error: "areaError",     control: areaInput },
    luas:     { error: "luasError",     control: luasInput },
    tarikh:   { error: "tarikhError",   control: tarikhSemaiInput }
  };

  function setFieldState(key, message) {
    const field = FIELDS[key];
    if (!field) return;
    const slot = document.getElementById(field.error);
    if (slot) slot.textContent = message || "";
    const wrapper = field.control.closest(".form-group");
    if (wrapper) wrapper.classList.toggle("has-error", Boolean(message));
  }

  function clearAllErrors() {
    Object.keys(FIELDS).forEach(function (key) { setFieldState(key, ""); });
  }

  /* ------------------------------------------------------------------
     3. PERIOD STATE
     The current period is the last one in PERIODS and is the only writable
     one; anything earlier is locked read-only (Section 4.2).
     ------------------------------------------------------------------ */
  function periodIndexFor(period) {
    return PERIODS.indexOf(period);
  }

  function isLocked(period) {
    return periodIndexFor(period) < CURRENT_PERIOD_INDEX;
  }

  /* ------------------------------------------------------------------
     4. FORM POPULATION
     ------------------------------------------------------------------ */

  /* Crops: one option per CROP_MASTER row. */
  function fillCropSelect() {
    render(cropSelect, CROP_MASTER.map(function (crop) {
      return el("option", { value: crop.id, text: crop.name });
    }));
  }

  /* Categories: the three fixed values from data.js. */
  function fillCategorySelect() {
    render(categorySelect, CATEGORIES.map(function (category) {
      return el("option", { value: category, text: category });
    }));
  }

  /* Area suggestions come from data.js so the operator gets the district's
     three canonical plot names plus anything already recorded. */
  function fillAreaOptions() {
    const suggestions = AREA_SUGGESTIONS.find(function (row) {
      return row.district === district;
    });
    const fromData = submissionsForDistrict(district, activePeriod)
      .map(function (row) { return row.area; });
    const all = (suggestions ? suggestions.areas : []).concat(fromData);
    const unique = all.filter(function (value, i) { return all.indexOf(value) === i; });

    render(areaOptions, unique.map(function (value) {
      return el("option", { value: value });
    }));
  }

  /* Keep Kategori in step with the chosen crop, but never fight the operator:
     choosing a crop re-fills the category, and the operator may then change it
     freely (Section 4.2: "Auto-filled based on crop, editable"). */
  function syncCategoryFromCrop() {
    const category = cropCategory(cropSelect.value);
    if (category) categorySelect.value = category;
  }

  /* ------------------------------------------------------------------
     5. THE % MATANG SLIDER — live value beside it
     ------------------------------------------------------------------ */
  function updateMatangLabel() {
    matangValue.textContent = matangRange.value + "%";
  }

  /* ------------------------------------------------------------------
     6. THE >5x ANOMALY WARNING (yellow, non-blocking)
     Section 4.2: "If Luas > 5 x last period's average for same crop in this
     district → show yellow warning Nilai luar biasa — sila semak".
     This is a warning, not an error: it never blocks submission, which is
     exactly why it is rendered into a separate container from the red
     field errors.
     ------------------------------------------------------------------ */
  function updateLuasWarning() {
    render(luasWarning, []);

    const luas = parseFloat(luasInput.value);
    if (!isFinite(luas) || luas <= 0) return;

    const check = checkLuasAnomaly(district, cropSelect.value, luas, activePeriod);
    if (!check.anomalous) return;

    const ratio = Math.round(check.ratio * 10) / 10;
    luasWarning.appendChild(el("p", { class: "field-warning" }, [
      el("span", { class: "field-warning__mark", text: "!" }),
      el("span", {
        text: "Nilai luar biasa — sila semak. " + luas + " ha ialah " +
              ratio + "x purata tempoh lepas (" + check.average + " ha)."
      })
    ]));
  }

  /* ------------------------------------------------------------------
     7. CHARACTER COUNTER (Catatan, max 200)
     ------------------------------------------------------------------ */
  function updateCharCount() {
    const length = catatanInput.value.length;
    catatanCount.textContent = length + " / " + CATATAN_MAX;
    catatanCount.classList.toggle("is-limit", length >= CATATAN_MAX);
  }

  /* ------------------------------------------------------------------
     8. FORM READ / WRITE
     ------------------------------------------------------------------ */
  function readForm() {
    return {
      cropId: cropSelect.value,
      category: categorySelect.value,
      area: areaInput.value.trim(),
      luas: parseFloat(luasInput.value),
      pctMatang: parseInt(matangRange.value, 10),
      tarikhSemai: tarikhSemaiInput.value,
      catatan: catatanInput.value.trim()
    };
  }

  function resetForm() {
    editing = null;
    recordIdInput.value = "";
    form.reset();
    matangRange.value = "0";
    luasInput.value = "";
    catatanInput.value = "";
    updateMatangLabel();
    updateCharCount();
    render(luasWarning, []);
    clearAllErrors();
    formMode.textContent = "Baharu";
    resetBtn.hidden = true;
    applyTarikhBounds();
  }

  /* Load a row (submission or local draft) into the form for editing. */
  function loadIntoForm(row) {
    editing = row.id;
    recordIdInput.value = row.id;
    cropSelect.value = row.cropId;
    categorySelect.value = cropCategory(row.cropId);
    areaInput.value = row.area;
    luasInput.value = row.luas;
    matangRange.value = String(row.pctMatang);
    tarikhSemaiInput.value = row.tarikhSemai;
    catatanInput.value = row.catatan || "";
    updateMatangLabel();
    updateCharCount();
    updateLuasWarning();
    clearAllErrors();
    formMode.textContent = "Suntingan";
    resetBtn.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Tarikh Semai must not be in the future. The `max` attribute plus an
     explicit comparison covers both the picker and typed input. */
  function applyTarikhBounds() {
    const today = new Date().toISOString().slice(0, 10);
    tarikhSemaiInput.max = today;
  }

  /* ------------------------------------------------------------------
     9. VALIDATION
     ------------------------------------------------------------------ */
  function validate() {
    clearAllErrors();
    const data = readForm();
    let ok = true;
    let firstInvalid = null;

    function fail(key, control, message) {
      setFieldState(key, message);
      firstInvalid = firstInvalid || control;
      ok = false;
    }

    if (!data.cropId) fail("crop", cropSelect, "Sila pilih jenis tanaman.");
    if (!data.category) fail("category", categorySelect, "Sila pilih kategori.");

    if (data.area === "") {
      fail("area", areaInput, "Lokasi / area diperlukan.");
    } else if (data.area.length > AREA_MAX) {
      fail("area", areaInput, "Maksimum " + AREA_MAX + " aksara.");
    }

    if (luasInput.value === "") {
      fail("luas", luasInput, "Luas diperlukan.");
    } else if (!isFinite(data.luas)) {
      fail("luas", luasInput, "Luas mesti berbentuk nombor.");
    } else if (data.luas <= 0) {
      fail("luas", luasInput, "Luas mesti lebih besar daripada 0.");
    } else if (data.luas < LUAS_MIN) {
      fail("luas", luasInput, "Luas minimum ialah " + LUAS_MIN + " hektar.");
    } else if (data.luas > LUAS_MAX) {
      fail("luas", luasInput, "Luas melebihi had " + LUAS_MAX + " hektar.");
    }

    if (data.tarikhSemai === "") {
      fail("tarikh", tarikhSemaiInput, "Tarikh semai diperlukan.");
    } else if (data.tarikhSemai > new Date().toISOString().slice(0, 10)) {
      fail("tarikh", tarikhSemaiInput, "Tarikh semai tidak boleh pada masa hadapan.");
    }

    /* % Matang is a 0-100 range control so it cannot be out of bounds through
       the UI, but the rule from Section 4.2 is still enforced here so the
       constraint lives in the validation layer rather than in the widget. */
    if (data.pctMatang < PCT_MIN || data.pctMatang > PCT_MAX) {
      fail("luas", luasInput, "% Matang mesti antara 0 hingga 100.");
    }

    if (firstInvalid) firstInvalid.focus();
    return ok;
  }

  /* ------------------------------------------------------------------
     10. BUILD A ROW
     Only one record may exist per crop + area + period, which is also alert
     threshold 4 in data.js, so a duplicate is blocked here at the source.
     ------------------------------------------------------------------ */
  function buildRow(status) {
    const data = readForm();
    const existing = SUBMISSIONS.find(function (row) {
      return row.district === district && row.period === activePeriod &&
             row.cropId === data.cropId &&
             normaliseText(row.area) === normaliseText(data.area) &&
             row.id !== editing;
    });
    if (existing) {
      return { error: "Rekod bagi " + cropName(data.cropId) + " di " + data.area +
                      " sudah wujud untuk tempoh ini." };
    }

    return {
      row: {
        id: editing || nextSubmissionId(),
        period: activePeriod,
        district: district,
        cropId: data.cropId,
        area: data.area,
        luas: data.luas,
        pctMatang: data.pctMatang,
        tarikhSemai: data.tarikhSemai,
        catatan: data.catatan,
        status: status,
        submittedBy: getUserId() || ("op." + normaliseText(district).replace(/\s/g, "")),
        submittedAt: status === STATUS.DRAFT ? null : new Date().toISOString().slice(0, 10),
        auditLog: []
      }
    };
  }

  /* ------------------------------------------------------------------
     11. ACTIONS
     ------------------------------------------------------------------ */

  /* Simpan Draf — stays local until the operator submits it (Section 4.2).
     Named saveDraftRow, not saveDraft: shared.js already publishes a global
     saveDraft(row), and a same-named local declaration would shadow it and
     turn the call below into infinite recursion. */
  function saveDraftRow() {
    if (!validate()) return;
    const built = buildRow(STATUS.DRAFT);
    if (built.error) { setFieldState("area", built.error); return; }

    const row = built.row;
    if (editing) removeDraft(editing);
    saveDraft(row);
    editing = null;
    resetForm();
    refresh();
    announce("Draf disimpan.");
  }

  /* Hantar untuk Semakan — becomes a real submission with status Dihantar,
     visible to verify.html and the dashboard. */
  function submitForReview(event) {
    event.preventDefault();
    if (isLocked(activePeriod)) return;
    if (!validate()) return;

    const built = buildRow(STATUS.SUBMITTED);
    if (built.error) { setFieldState("area", built.error); return; }

    const row = built.row;
    if (editing) removeDraft(editing);

    const existing = findSubmission(row.id);
    if (existing) {
      updateSubmission(row.id, row, "Dihantar semula oleh operator selepas suntingan.");
    } else {
      addSubmission(row);
    }

    editing = null;
    resetForm();
    refresh();
    announce("Rekod dihantar untuk semakan.");
  }

  /* Draft-only actions (Section 4.2: Edit/Delete only for Draft). */
  function editRecord(id) {
    if (isLocked(activePeriod)) return;
    const draft = readDrafts().find(function (d) { return d.id === id; });
    if (draft) { loadIntoForm(draft); return; }

    const row = findSubmission(id);
    if (!row) return;
    loadIntoForm(row);
  }

  function deleteRecord(id) {
    if (isLocked(activePeriod)) return;
    const isDraft = readDrafts().some(function (d) { return d.id === id; });
    if (isDraft) {
      removeDraft(id);
    } else {
      deleteSubmission(id);
    }
    if (editing === id) resetForm();
    refresh();
    announce("Rekod dipadam.");
  }

  /* Placeholder id for a brand-new draft is not needed: buildRow() allocates a
     real sequential id from nextSubmissionId(), so a draft keeps the id it will
     have once submitted and nothing has to be rewritten on submit. */

  /* ------------------------------------------------------------------
     12. RENDER — Rekod Saya
     Drafts and submissions are merged into one list so the table has a single
     row shape, exactly as Section 4.2 describes.
     ------------------------------------------------------------------ */
  function tableRows() {
    const drafts = draftsFor(district, activePeriod).map(function (draft) {
      return Object.assign({}, draft, { local: true });
    });
    const submitted = submissionsForDistrict(district, activePeriod);
    return drafts.concat(submitted);
  }

  function renderRecords() {
    const rows = tableRows();
    const locked = isLocked(activePeriod);

    recordsCount.textContent = String(rows.length);
    recordsPeriod.textContent = activePeriod;

    if (rows.length === 0) {
      render(recordsBody, [
        el("tr", {}, [
          el("td", { colspan: "6" }, [
            emptyState("Tiada rekod bagi tempoh ini",
                       "Rekod yang anda simpan atau hantar akan dipaparkan di sini.")
          ])
        ])
      ]);
      return;
    }

    render(recordsBody, rows.map(function (row) {
      return el("tr", {}, [
        el("td", { text: cropName(row.cropId) }),
        el("td", { text: row.area }),
        el("td", { class: "num", text: formatNumber(row.luas, 1) }),
        el("td", { class: "num" }, [
          el("span", { class: matangBand(row.pctMatang),
                       text: formatPct(row.pctMatang) })
        ]),
        el("td", {}, [statusBadge(row.status)]),
        el("td", { class: "col-actions" }, [
          actionButtons(row, locked)
        ])
      ]);
    }));
  }

  /* Section 4.2: Edit and Delete only for Draft rows. A submitted row already
     shows how it got there, so no action is offered. */
  function actionButtons(row, locked) {
    const group = el("div", { class: "btn-group" });

    if (locked) {
      group.appendChild(el("span", { class: "text-muted", text: "Dikunci" }));
      return group;
    }

    const editable = row.status === STATUS.DRAFT;
    if (editable) {
      const editBtn = el("button", {
        type: "button", class: "btn btn--ghost btn--sm", text: "Edit"
      });
      editBtn.setAttribute("aria-label", "Edit record " + cropName(row.cropId));
      editBtn.addEventListener("click", function () { editRecord(row.id); });

      const deleteBtn = el("button", {
        type: "button", class: "btn btn--danger btn--sm", text: "Padam"
      });
      deleteBtn.setAttribute("aria-label", "Padam rekod " + cropName(row.cropId));
      deleteBtn.addEventListener("click", function () { deleteRecord(row.id); });

      group.appendChild(editBtn);
      group.appendChild(deleteBtn);
    } else {
      group.appendChild(el("span", { class: "text-muted", text: "—" }));
    }

    return group;
  }

  /* ------------------------------------------------------------------
     13. RENDER — page chrome and period state
     ------------------------------------------------------------------ */
  function renderPeriodState() {
    const locked = isLocked(activePeriod);
    periodState.textContent = locked ? "Dikunci" : "Sedang berjalan";
    periodState.className = "badge " + (locked ? "badge--neutral" : "badge--approved");
    lockedNotice.hidden = !locked;

    /* Past periods are read-only: the form is disabled, not merely ignored. */
    const controls = form.querySelectorAll("input, select, textarea, button");
    Array.prototype.forEach.call(controls, function (control) {
      control.disabled = locked;
    });

    renderHeader({
      pageTitle: "Kemasukan Data Daerah",
      context: "Tempoh: " + activePeriod
    });
    setText("sidebarPeriod", activePeriod);
    setText("sidebarDistrict", district);
  }

  /* Transient status message for the operator. */
  function announce(message) {
    let bar = document.getElementById("entryStatus");
    if (!bar) {
      bar = el("div", { class: "alert-box alert-box--success", id: "entryStatus",
                        role: "status" });
      form.parentNode.insertBefore(bar, form);
    }
    bar.textContent = message;
    window.setTimeout(function () {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    }, 3200);
  }

  function refresh() {
    fillAreaOptions();
    renderRecords();
  }

  /* ------------------------------------------------------------------
     14. WIRING
     ------------------------------------------------------------------ */
  fillCropSelect();
  fillCategorySelect();
  syncCategoryFromCrop();
  fillAreaOptions();
  updateMatangLabel();
  updateCharCount();
  applyTarikhBounds();

  /* Period selector: six periods, newest first, past ones locked. */
  fillPeriodSelect(periodSelect, { selected: activePeriod });
  periodSelect.addEventListener("change", function () {
    activePeriod = setActivePeriod(periodSelect.value);
    resetForm();
    renderPeriodState();
    refresh();
  });

  cropSelect.addEventListener("change", function () {
    setFieldState("crop", "");
    syncCategoryFromCrop();
    updateLuasWarning();
  });

  categorySelect.addEventListener("change", function () { setFieldState("category", ""); });
  areaInput.addEventListener("input", function () { setFieldState("area", ""); });

  luasInput.addEventListener("input", function () {
    setFieldState("luas", "");
    updateLuasWarning();
  });

  tarikhSemaiInput.addEventListener("change", function () { setFieldState("tarikh", ""); });
  matangRange.addEventListener("input", updateMatangLabel);
  catatanInput.addEventListener("input", updateCharCount);

  draftBtn.addEventListener("click", saveDraftRow);
  form.addEventListener("submit", submitForReview);
  resetBtn.addEventListener("click", resetForm);

  /* ------------------------------------------------------------------
     15. BOOT
     ------------------------------------------------------------------ */
  hydrateSubmissions();
  renderPeriodState();
  refresh();
})();

