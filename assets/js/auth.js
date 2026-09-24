/* ==========================================================================
   auth.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the mock authentication and role-routing stub. Chooses a role on
            index.html, remembers it, and stops a page from rendering for the
            wrong role.
   Dependencies: data.js (ROLES, DISTRICTS, PERIODS for the session shape).
   Storage keys:
     smps_role    — localStorage, the signed-in role id. Section 3 mandates
                    this exact key and this exact storage.
     smps_user    — localStorage, the mock user id typed on index.html.
     smps_session — sessionStorage, the operator's district and working period.

   There is no real authentication here and there must not be: Section 1 and
   Section 12 put real auth, JWT and sessions explicitly out of scope. Any
   credentials are accepted, per Section 8. This file is therefore a routing
   guard, not a security boundary — it exists so the mockup demonstrates the
   role flow, and it deliberately trusts whatever role it finds.
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. STORAGE KEYS
   -------------------------------------------------------------------------- */
const AUTH_KEYS = {
  role: "smps_role",        /* mandated by Section 3 */
  user: "smps_user",
  session: "smps_session"
};

/* --------------------------------------------------------------------------
   2. LOW-LEVEL STORAGE HELPERS
   Every localStorage/sessionStorage access is wrapped, because a page opened
   from file:// in a locked-down browser profile can throw on access. A throw
   here would abort the whole script and leave a blank page, so failures
   degrade to "no stored value" instead.
   -------------------------------------------------------------------------- */
function storageGet(store, key) {
  try {
    return window[store].getItem(key);
  } catch (err) {
    return null;
  }
}

function storageSet(store, key, value) {
  try {
    window[store].setItem(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

function storageRemove(store, key) {
  try {
    window[store].removeItem(key);
    return true;
  } catch (err) {
    return false;
  }
}

/* --------------------------------------------------------------------------
   3. ROLE RESOLUTION
   -------------------------------------------------------------------------- */

/* The signed-in role id, or null when nobody is signed in. */
function getRole() {
  const role = storageGet("localStorage", AUTH_KEYS.role);
  return ROLES[role] ? role : null;
}

/* The full role definition from data.js. */
function getRoleDef() {
  const role = getRole();
  return role ? ROLES[role] : null;
}

/* The user id typed on the login screen. */
function getUserId() {
  return storageGet("localStorage", AUTH_KEYS.user) || "";
}

function isLoggedIn() {
  return getRole() !== null;
}

/* Sign in. Returns the role definition so the caller can route immediately.
   `user` and `district` are stored for display only — nothing is checked. */
function login(roleId, user, district) {
  if (!ROLES[roleId]) return null;
  storageSet("localStorage", AUTH_KEYS.role, roleId);
  storageSet("localStorage", AUTH_KEYS.user, user || "");
  storageSet("sessionStorage", AUTH_KEYS.session, JSON.stringify({
    district: district || null,
    period: CURRENT_PERIOD
  }));
  return ROLES[roleId];
}

/* Sign out: clear identity, keep the submission snapshot.
   Editors in verify.js persist their work under its own key, and wiping that
   here would silently discard an admin's edits the moment they log out. */
function logout() {
  storageRemove("localStorage", AUTH_KEYS.role);
  storageRemove("localStorage", AUTH_KEYS.user);
  storageRemove("sessionStorage", AUTH_KEYS.session);
}

/* --------------------------------------------------------------------------
   4. SESSION SHAPE — operator district and working period
   -------------------------------------------------------------------------- */
function getSession() {
  const raw = storageGet("sessionStorage", AUTH_KEYS.session);
  if (!raw) return { district: null, period: CURRENT_PERIOD };
  try {
    const parsed = JSON.parse(raw);
    return {
      district: parsed && parsed.district ? parsed.district : null,
      period: parsed && PERIODS.indexOf(parsed.period) !== -1
        ? parsed.period
        : CURRENT_PERIOD
    };
  } catch (err) {
    return { district: null, period: CURRENT_PERIOD };
  }
}

function setSession(patch) {
  const next = Object.assign(getSession(), patch);
  storageSet("sessionStorage", AUTH_KEYS.session, JSON.stringify(next));
  return next;
}

/* The district an operator is scoped to. Falls back to the first reporting
   district so entry.html still renders if the session was cleared but the
   role somehow survived — better a working demo than a blank screen. */
function getDistrict() {
  return getSession().district || DISTRICT_ALLOCATIONS[0].district;
}

function setDistrict(district) {
  return setSession({ district: district });
}

/* The period the operator or admin is currently working on. */
function getActivePeriod() {
  return getSession().period || CURRENT_PERIOD;
}

function setActivePeriod(period) {
  if (PERIODS.indexOf(period) === -1) return getActivePeriod();
  return setSession({ period: period }).period;
}

/* --------------------------------------------------------------------------
   5. ROUTING
   -------------------------------------------------------------------------- */

/* Send the browser to a page in the project root. */
function goTo(page) {
  window.location.replace(page);
}

/* Landing page for the signed-in role. */
function landingPageFor(roleId) {
  const role = ROLES[roleId];
  return role ? role.landing : "index.html";
}

/* Which page is currently open, e.g. "entry.html". Uses the last path segment
   so it works from file:// as well as from a local web server.
   When a directory URL is opened (…/agri/ or …/agri) the browser serves
   index.html, so that case is normalised here rather than returning "agri". */
function currentPage() {
  const parts = window.location.pathname.split("/");
  const last = decodeURIComponent(parts[parts.length - 1]);
  if (last === "" || last.indexOf(".html") === -1) return "index.html";
  return last;
}

/* --------------------------------------------------------------------------
   6. PAGE GUARDS
   Each page calls exactly one of these as its first act, before any data is
   rendered. Section 3: "Each page checks role on load; if wrong role →
   redirect to index.html."
   -------------------------------------------------------------------------- */

/* index.html uses this: bounce an already-signed-in user to their landing
   page so the login screen is not reachable while signed in. */
function redirectIfLoggedIn() {
  if (isLoggedIn()) goTo(landingPageFor(getRole()));
}

/* Every protected page uses this. Returns the role definition when access is
   allowed. When access is denied it redirects and returns null — callers must
   treat null as "stop, the page is going away" and return immediately. */
function requireRole(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const role = getRole();

  if (role === null) {
    goTo("index.html");
    return null;
  }

  if (allowed.indexOf(role) === -1) {
    /* Signed in, but on a page this role may not see: send them to their own
       landing page rather than back to login. */
    goTo(landingPageFor(role));
    return null;
  }

  return ROLES[role];
}

/* Convenience wrappers so each page reads as intent, not as a role list. */
function requireOperator() {
  return requireRole("operator");
}

function requireAdmin() {
  return requireRole("admin");
}

function requireManagement() {
  return requireRole("pengurusan");
}

/* --------------------------------------------------------------------------
   7. HEADER PRESENTATION
   The header is identical on all three portals (Section 3): logo, page title,
   role badge and "Log Keluar". Pages supply their own title; the badge text
   comes from data.js so there is one spelling of each role name.
   -------------------------------------------------------------------------- */

/* Badge text for the signed-in user, including the district for an operator:
   "Operator — Tawau" (Section 4.2). */
function roleBadgeText() {
  const role = getRoleDef();
  if (!role) return "";
  if (role.id === "operator") {
    return role.badge + " \u2014 " + getDistrict();
  }
  return role.badge;
}

/* Fill in the shared header elements. Each page includes the markup with
   these ids; anything missing is skipped so a page can opt out of a slot. */
function renderHeader(options) {
  const opts = options || {};

  const badge = document.getElementById("roleBadge");
  if (badge) {
    badge.textContent = roleBadgeText();
    badge.classList.add("badge", "badge--role");
  }

  const title = document.getElementById("pageTitle");
  if (title && opts.pageTitle) title.textContent = opts.pageTitle;

  const context = document.getElementById("headerContext");
  if (context && opts.context) context.textContent = opts.context;

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    /* Attached with addEventListener rather than an inline handler attribute,
       which Section 7 forbids. Be aware that a plain grep for the forbidden
       attribute name will match this comment. */
    logoutBtn.addEventListener("click", function () {
      logout();
      goTo("index.html");
    });
  }

  const langBtn = document.getElementById("langToggle");
  if (langBtn) {
    /* Language toggle is a STUB only (Section 8): it flips a data-lang
       attribute and updates its own label. No i18n framework, no string
       tables. This is the whole implementation, by design. */
    langBtn.addEventListener("click", function () {
      const root = document.documentElement;
      const next = root.getAttribute("data-lang") === "en" ? "ms" : "en";
      root.setAttribute("data-lang", next);
      langBtn.textContent = next === "en" ? "BM" : "EN";
      langBtn.setAttribute("aria-label",
        next === "en" ? "Tukar ke Bahasa Malaysia" : "Switch to English");
    });
  }

  const menuBtn = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", function () {
      const open = sidebar.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (backdrop) backdrop.hidden = !open;
    });
  }
  if (backdrop && sidebar) {
    backdrop.addEventListener("click", function () {
      sidebar.classList.remove("is-open");
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
      backdrop.hidden = true;
    });
  }
}

/* --------------------------------------------------------------------------
   8. LOGIN PAGE SUPPORT
   -------------------------------------------------------------------------- */

/* Populate a <select> with all 27 districts. Used by index.html (operator
   district picker) and reused by entry.html and verify.html so the district
   list has exactly one rendering path. */
function fillDistrictSelect(select, options) {
  if (!select) return;
  const opts = options || {};
  const previous = opts.selected || select.value;

  select.innerHTML = "";
  if (opts.includeAll) {
    const all = document.createElement("option");
    all.value = "";
    all.textContent = opts.allLabel || "Semua Daerah";
    select.appendChild(all);
  }
  DISTRICTS.forEach(function (district) {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    select.appendChild(option);
  });

  if (previous && DISTRICTS.indexOf(previous) !== -1) select.value = previous;
}

/* Populate a <select> with the reporting periods, newest first. Periods after
   the current one are never shown; past periods are marked read-only by the
   caller. */
function fillPeriodSelect(select, options) {
  if (!select) return;
  const opts = options || {};
  const previous = opts.selected || select.value;
  const upTo = typeof opts.upToIndex === "number"
    ? opts.upToIndex
    : CURRENT_PERIOD_INDEX;

  select.innerHTML = "";
  for (let i = upTo; i >= 0; i--) {
    const option = document.createElement("option");
    option.value = PERIODS[i];
    option.textContent = "Tempoh: " + PERIODS[i] +
      (i === CURRENT_PERIOD_INDEX ? " (semasa)" : "");
    select.appendChild(option);
  }

  if (previous && PERIODS.indexOf(previous) !== -1 &&
      PERIODS.indexOf(previous) <= upTo) {
    select.value = previous;
  }
}
