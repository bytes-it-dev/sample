/* ==========================================================================
   shared.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the small shared layer that entry.js, verify.js and dashboard.js
            all sit on. Three jobs:
              1. Persistence — edits made in the browser survive a reload.
              2. DOM helpers — one escaping path, one element builder.
              3. Live derived values — figures recomputed after a mutation.
   Dependencies: data.js, then auth.js. Loaded by entry, verify and dashboard.

   WHY THIS FILE EXISTS
   Section 8: "No real persistence. Use localStorage for role + draft
   entries. On refresh, re-read from data.js for everything else." So the base
   dataset stays authoritative and the browser only ever stores a sparse
   overlay of changed or newly added rows on top of it. Clear localStorage and
   the mockup returns to exactly the state data.js describes.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. PERSISTENCE
   Key naming is deliberately one per concern:
     smps_data_v1     — overlay of edited / added submissions
     smps_alert_v1    — alert status overrides (Baru -> Selesai)
     smps_draft_v1    — unsent operator drafts (Section 8: "draft entries")
   -------------------------------------------------------------------------- */
const STORE_KEYS = {
  submissions: "smps_data_v1",
  alerts: "smps_alert_v1",
  drafts: "smps_draft_v1"
};

function storeRead(key, fallback) {
  const raw = storageGet("localStorage", key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null ? fallback : parsed;
  } catch (err) {
    /* Corrupt payload: discard rather than crash the page. */
    return fallback;
  }
}

function storeWrite(key, value) {
  return storageSet("localStorage", key, JSON.stringify(value));
}

/* --------------------------------------------------------------------------
   2. SUBMISSION OVERLAY
   Only rows that differ from data.js are stored, keyed by id. On boot the
   overlay is applied over the pristine array so every data.js helper
   (districtSummary, cropSummary, KPI basis, …) sees the edited reality.
   -------------------------------------------------------------------------- */

/* Apply the stored overlay to SUBMISSIONS in place. Mutating the array that
   data.js already published means the existing helper functions keep working
   without a second data path. */
function hydrateSubmissions() {
  const overrides = storeRead(STORE_KEYS.submissions, {});
  const added = overrides.__added || [];
  const edits = overrides.__edits || {};

  SUBMISSIONS.forEach(function (row) {
    if (edits[row.id]) Object.assign(row, edits[row.id]);
  });

  added.forEach(function (row) {
    if (!SUBMISSIONS.some(function (r) { return r.id === row.id; })) {
      SUBMISSIONS.push(row);
    }
  });
}

/* Persist one row: an existing row becomes an edit, a new row is an addition. */
function persistSubmission(row) {
  const overrides = storeRead(STORE_KEYS.submissions, {});
  overrides.__added = overrides.__added || [];
  overrides.__edits = overrides.__edits || {};

  const isNew = !SUBMISSIONS.some(function (r) { return r.id === row.id; });
  const snapshot = JSON.parse(JSON.stringify(row));

  if (isNew) {
    overrides.__added.push(snapshot);
  } else {
    overrides.__edits[row.id] = snapshot;
  }

  storeWrite(STORE_KEYS.submissions, overrides);
}

function removeStoredSubmission(id) {
  const overrides = storeRead(STORE_KEYS.submissions, {});
  if (overrides.__edits) delete overrides.__edits[id];
  if (overrides.__added) {
    overrides.__added = overrides.__added.filter(function (r) { return r.id !== id; });
  }
  storeWrite(STORE_KEYS.submissions, overrides);
}

/* --------------------------------------------------------------------------
   3. PUBLIC MUTATIONS
   Every write goes through here so the in-memory array, the overlay and any
   page re-render stay in step.
   -------------------------------------------------------------------------- */

function findSubmission(id) {
  return SUBMISSIONS.find(function (row) { return row.id === id; });
}

/* Update an existing row. `changes` is a partial submission. Passing a reason
   appends to the row's auditLog, which is what the verify.html edit modal is
   required to produce (Section 4.3). */
function updateSubmission(id, changes, reason, actor) {
  const row = findSubmission(id);
  if (!row) return null;

  Object.assign(row, changes);

  if (reason) {
    row.auditLog = row.auditLog || [];
    row.auditLog.push({
      at: row.submittedAt || CURRENT_PERIOD,
      by: actor || getUserId() || "admin",
      action: changes.status ? changes.status : "Disunting",
      reason: reason
    });
  }

  persistSubmission(row);
  return row;
}

/* Append a new row (entry.js). */
function addSubmission(row) {
  SUBMISSIONS.push(row);
  persistSubmission(row);
  return row;
}

function deleteSubmission(id) {
  const i = SUBMISSIONS.findIndex(function (row) { return row.id === id; });
  if (i !== -1) SUBMISSIONS.splice(i, 1);
  removeStoredSubmission(id);
}

/* Set a submission's status, recording the reason in the audit trail. */
function setSubmissionStatus(id, status, reason) {
  return updateSubmission(id, { status: status }, reason || (
    status === STATUS.APPROVED ? "Diluluskan oleh pentadbir." :
    status === STATUS.REJECTED ? "Ditolak oleh pentadbir." : null
  ));
}

/* --------------------------------------------------------------------------
   4. ALERT STATUS OVERRIDES
   The static ALERTS array is the historical record; this layer only stores the
   admin's "Tanda Selesai" actions so the Amaran tab keeps its state.
   -------------------------------------------------------------------------- */
function alertStatusOf(alertId) {
  const overrides = storeRead(STORE_KEYS.alerts, {});
  return overrides[alertId] || null;
}

function setAlertStatus(alertId, status) {
  const overrides = storeRead(STORE_KEYS.alerts, {});
  overrides[alertId] = status;
  storeWrite(STORE_KEYS.alerts, overrides);
}

/* --------------------------------------------------------------------------
   5. OPERATOR DRAFTS
   Section 8 asks for drafts to survive a refresh. Local draft rows are kept
   separate from SUBMISSIONS so they stay invisible to verify.html and the
   dashboard until the operator actually submits them.
   -------------------------------------------------------------------------- */
function readDrafts() {
  return storeRead(STORE_KEYS.drafts, []);
}

function saveDraft(draft) {
  const drafts = readDrafts();
  const i = drafts.findIndex(function (d) { return d.id === draft.id; });
  if (i === -1) drafts.push(draft); else drafts[i] = draft;
  storeWrite(STORE_KEYS.drafts, drafts);
  return draft;
}

function removeDraft(id) {
  storeWrite(STORE_KEYS.drafts,
    readDrafts().filter(function (d) { return d.id !== id; }));
}

/* Drafts for one district + period, presented in the same shape as a
   submission so the entry table can render one row template for both. */
function draftsFor(district, period) {
  return readDrafts().filter(function (d) {
    return d.district === district && d.period === period;
  });
}

/* --------------------------------------------------------------------------
   6. LIVE DERIVED VALUES
   data.js computes KPI and TREND once, from the pristine array. After a
   mutation the dashboard must show the new reality, so these recompute from
   the current in-memory data.
   -------------------------------------------------------------------------- */
function liveKpi() {
  const currentRows = submissionsForPeriod(CURRENT_PERIOD);
  const prevRows = submissionsForPeriod(PREVIOUS_PERIOD);
  const totalLuas = sumLuas(currentRows);
  const prevLuas = sumLuas(prevRows);
  const avgMatang = weightedAvgMatang(currentRows);
  const prevMatang = weightedAvgMatang(prevRows);

  return {
    totalLuas: totalLuas,
    totalRekod: currentRows.length,
    avgMatang: avgMatang,
    activeAlerts: activeAlertCount(CURRENT_PERIOD),
    delta: {
      luas: prevLuas > 0
        ? Math.round(((totalLuas - prevLuas) / prevLuas) * 1000) / 10 : 0,
      rekod: currentRows.length - prevRows.length,
      matang: avgMatang - prevMatang
    }
  };
}

/* TREND recomputed against current data, preserving the historical index. */
function liveTrend() {
  return TREND.map(function (point, i) {
    const rows = submissionsForPeriod(PERIODS[i]);
    return {
      period: point.period,
      totalLuas: sumLuas(rows),
      index: point.index,
      rekod: point.rekod,
      avgMatang: weightedAvgMatang(rows)
    };
  });
}

/* Every alert with the admin's stored status applied. */
function liveAlerts(period) {
  return allAlerts().map(function (alert) {
    const override = alertStatusOf(alert.id);
    return override ? Object.assign({}, alert, { status: override }) : alert;
  }).filter(function (alert) {
    return !period || alert.period === period;
  });
}

/* --------------------------------------------------------------------------
   7. DOM HELPERS
   One escaping path for every value interpolated into markup. Anything that
   builds innerHTML from data must route text through esc().
   -------------------------------------------------------------------------- */
function esc(value) {
  return escapeHtml(value);
}

/* setText for a single element by id. */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
  return el;
}

/* Build an element with attributes and children in one call, so pages do not
   repeat six lines of createElement boilerplate per table cell. */
function el(tag, attrs, children) {
  const node = document.createElement(tag);

  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      const value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "dataset") {
        Object.keys(value).forEach(function (d) { node.dataset[d] = value[d]; });
      } else node.setAttribute(key, value === true ? "" : value);
    });
  }

  (children || []).forEach(function (child) {
    if (child === null || child === undefined) return;
    node.appendChild(typeof child === "string"
      ? document.createTextNode(child) : child);
  });

  return node;
}

/* Remove every child of a node, without touching its text node state. */
function clearChildren(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
  /* Also drop any children tracked before firstChild existed. */
  if (node.children) {
    while (node.children.length) node.removeChild(node.children[0]);
  }
}

/* Replace an element's children in one call.
   Clearing is done child-by-child rather than with `textContent = ""`, because
   the latter is a text primitive: on a <select> it would also discard the
   option list in a way that depends on the engine's node handling. */
function render(container, children) {
  if (!container) return;
  clearChildren(container);
  (children || []).forEach(function (child) {
    if (child) container.appendChild(child);
  });
}

/* A status badge span, the single place status colours are decided. */
function statusBadge(status) {
  return el("span", {
    class: "badge " + (STATUS_CLASS[status] || "badge--neutral"),
    text: status
  });
}

/* A severity pill. The label is always present — colour alone is never the
   signal (accessibility rule in Section 7). */
function severityPill(severity) {
  return el("span", {
    class: "alert-pill alert-pill--" + severity,
    text: SEVERITY_LABEL[severity] || severity
  });
}

/* Empty-state block for tables and lists with nothing to show. */
function emptyState(title, text) {
  return el("div", { class: "empty-state" }, [
    el("p", { class: "empty-state__title", text: title }),
    text ? el("p", { class: "empty-state__text", text: text }) : null
  ]);
}

/* Signed delta span for KPI cards. */
function deltaSpan(value, options) {
  const opts = options || {};
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "▬";
  const unit = opts.unit || "";
  return el("span", {
    class: "kpi-card__delta delta--" + dir,
    text: arrow + " " + formatDelta(value) + unit
  });
}

/* --------------------------------------------------------------------------
   8. TABLE HELPERS
   -------------------------------------------------------------------------- */

/* Build a sortable <th> whose button toggles asc/desc and reports state via
   aria-sort on the cell (components.css styles the arrows from that). */
function sortableTh(label, key, state, onToggle, align) {
  const cell = el("th", { scope: "col", class: align === "num" ? "num" : null });
  cell.setAttribute("aria-sort",
    state.key === key ? (state.dir === "asc" ? "ascending" : "descending") : "none");

  const button = el("button", {
    type: "button",
    class: "th-sort",
    text: label
  });
  button.addEventListener("click", function () { onToggle(key); });
  cell.appendChild(button);
  return cell;
}

/* Generic comparator for the sortable tables. */
function compareValues(a, b) {
  const left = typeof a === "string" ? a.toLowerCase() : a;
  const right = typeof b === "string" ? b.toLowerCase() : b;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function toggleSort(state, key) {
  if (state.key === key) {
    state.dir = state.dir === "asc" ? "desc" : "asc";
  } else {
    state.key = key;
    state.dir = "asc";
  }
  return state;
}

function applySort(rows, state) {
  const dir = state.dir === "asc" ? 1 : -1;
  return rows.slice().sort(function (a, b) {
    return compareValues(a[state.key], b[state.key]) * dir;
  });
}

/* --------------------------------------------------------------------------
   9. AUDIT TRAIL RENDERING
   Shared by the verify.html approved table and the edit modal.
   -------------------------------------------------------------------------- */
function auditSummary(row) {
  if (!row.auditLog || row.auditLog.length === 0) return "—";
  const last = row.auditLog[row.auditLog.length - 1];
  return last.action + " oleh " + last.by + " (" + last.at + ")";
}
