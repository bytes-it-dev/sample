/* ==========================================================================
   data.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the single source of truth for ALL mock data in the mockup.
            Every page reads its numbers from here — no page may hardcode a
            figure (Section 5 rule).
   Dependencies: none. Must be loaded BEFORE auth.js, entry.js, verify.js
                 and dashboard.js. Plain <script>, not a module, so the pages
                 still work when opened straight from the filesystem (file://
                 forbids ES module imports).
   Contents:
     1.  ROLES
     2.  CROP_MASTER           — 10 crops across 3 categories
     3.  DISTRICTS             — exactly 27 real Sabah districts
     4.  PERIODS               — 6 fortnights, last entry is the current one
     5.  DISTRICT_ALLOCATIONS  — canonical planted area per district + crop
     6.  SUBMISSIONS           — 450 records (75 rows x 6 periods)
     7.  ALERTS                — 23 alerts across all severities
     8.  TREND                 — 6-period series for the line chart
     9.  KPI                   — summary cards for dashboard tab 1
    10.  STATUS / form constants
    11.  Helper functions shared by entry, verify and dashboard
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. ROLES
   Role ids are what auth.js stores under localStorage key `smps_role`.
   -------------------------------------------------------------------------- */
const ROLES = {
  operator: {
    id: "operator",
    label: "Operator Daerah",
    badge: "Operator",
    landing: "entry.html",
    allowedPages: ["entry.html"]
  },
  admin: {
    id: "admin",
    /* Label and badge are English at the project owner's request; every other
       role string stays Bahasa Malaysia. Section 4.3 mandates the role name
       "System Admin" for the UI badge. */
    label: "System Admin",
    badge: "System Admin",
    landing: "verify.html",
    allowedPages: ["verify.html"]
  },
  pengurusan: {
    id: "pengurusan",
    label: "Pengurusan Atasan",
    badge: "Pengurusan Atasan",
    landing: "dashboard.html",
    allowedPages: ["dashboard.html"]
  }
};

const ROLE_ORDER = ["operator", "admin", "pengurusan"];

/* --------------------------------------------------------------------------
   2. CROP MASTER
   -------------------------------------------------------------------------- */
const CROP_MASTER = [
  { id: "padi",   name: "Padi",          category: "Tanaman Makanan"  },
  { id: "sawit",  name: "Kelapa Sawit",  category: "Tanaman Industri" },
  { id: "getah",  name: "Getah",         category: "Tanaman Industri" },
  { id: "koko",   name: "Koko",          category: "Tanaman Industri" },
  { id: "kelapa", name: "Kelapa",        category: "Tanaman Industri" },
  { id: "jagung", name: "Jagung",        category: "Tanaman Kontan"   },
  { id: "kacang", name: "Kacang Tanah",  category: "Tanaman Kontan"   },
  { id: "ubi",    name: "Ubi Kayu",      category: "Tanaman Kontan"   },
  { id: "buah",   name: "Buah-buahan",   category: "Tanaman Makanan"  },
  { id: "sayur",  name: "Sayur-sayuran", category: "Tanaman Makanan"  }
];

const CATEGORIES = ["Tanaman Makanan", "Tanaman Industri", "Tanaman Kontan"];

/* --------------------------------------------------------------------------
   3. DISTRICTS — exactly 27 real Sabah districts
   -------------------------------------------------------------------------- */
const DISTRICTS = [
  "Kota Kinabalu", "Tuaran", "Kota Belud", "Kudat", "Pitas", "Kota Marudu",
  "Ranau", "Tambunan", "Keningau", "Tenom", "Nabawan", "Beaufort",
  "Kuala Penyu", "Sipitang", "Papar", "Penampang", "Putatan", "Sandakan",
  "Kinabatangan", "Beluran", "Telupid", "Tongod", "Lahad Datu", "Semporna",
  "Tawau", "Kunak", "Kalabakan"
];

/* Districts that never report. Kept as an explicit list because the
   "Tiada penyerahan" alert logic and the district league table both use it. */
const NON_REPORTING_DISTRICTS = ["Kunak", "Kalabakan"];

/* --------------------------------------------------------------------------
   4. PERIODS — 6 fortnights. The last entry is the current reporting period.
   -------------------------------------------------------------------------- */
const PERIODS = [
  "1–15 Ogos 2026",
  "16–31 Ogos 2026",
  "1–15 Sept 2026",
  "16–30 Sept 2026",
  "1–15 Okt 2026",
  "16–31 Okt 2026"
];

const CURRENT_PERIOD_INDEX = PERIODS.length - 1;
const CURRENT_PERIOD = PERIODS[CURRENT_PERIOD_INDEX];
const PREVIOUS_PERIOD = PERIODS[CURRENT_PERIOD_INDEX - 1];

/* --------------------------------------------------------------------------
   5. DISTRICT ALLOCATIONS — canonical planted area, in hectares
   This table records the CURRENT period (index 5) figure for each district
   and crop, and is the origin of every luas value in SUBMISSIONS. Nothing
   here is a display total, so the KPI block reconciles to it by construction
   instead of by hand arithmetic — the Section 11 checklist script asserts
   that equality rather than repeating the numbers here.

   Kunak and Kalabakan are deliberately ABSENT: they have no allocation and
   therefore no submission in any period, which is what makes the
   "Tiada penyerahan" HIGH alert genuine rather than decorative.
   -------------------------------------------------------------------------- */
const DISTRICT_ALLOCATIONS = [
  { district: "Kota Kinabalu", crops: [["sayur", 65],   ["buah", 40],   ["sawit", 55]] },
  { district: "Tuaran",        crops: [["sawit", 290],  ["padi", 70],   ["buah", 55]] },
  { district: "Kota Belud",    crops: [["padi", 380],   ["sawit", 180], ["kelapa", 60]] },
  { district: "Kudat",         crops: [["kelapa", 340], ["sawit", 150], ["padi", 60]] },
  { district: "Pitas",         crops: [["padi", 110],   ["sawit", 100], ["ubi", 22]] },
  { district: "Kota Marudu",   crops: [["padi", 250],   ["sawit", 140], ["jagung", 20]] },
  { district: "Ranau",         crops: [["sayur", 210],  ["koko", 60],   ["padi", 90]] },
  { district: "Tambunan",      crops: [["padi", 140],   ["sayur", 60],  ["koko", 30]] },
  { district: "Keningau",      crops: [["sawit", 350],  ["padi", 130],  ["getah", 60]] },
  { district: "Tenom",         crops: [["getah", 190],  ["koko", 80],   ["jagung", 25]] },
  { district: "Nabawan",       crops: [["getah", 140],  ["koko", 50],   ["padi", 60]] },
  { district: "Beaufort",      crops: [["sawit", 370],  ["padi", 80],   ["kelapa", 30]] },
  { district: "Kuala Penyu",   crops: [["sawit", 270],  ["padi", 60],   ["kelapa", 30]] },
  { district: "Sipitang",      crops: [["sawit", 330],  ["getah", 70],  ["padi", 40]] },
  { district: "Papar",         crops: [["padi", 480],   ["sawit", 180], ["buah", 60]] },
  { district: "Penampang",     crops: [["sayur", 90],   ["buah", 70],   ["padi", 35]] },
  { district: "Putatan",       crops: [["sayur", 40],   ["buah", 20],   ["padi", 15]] },
  { district: "Sandakan",      crops: [["sawit", 650],  ["koko", 50],   ["sayur", 60]] },
  { district: "Kinabatangan",  crops: [["sawit", 860],  ["koko", 70],   ["padi", 90]] },
  { district: "Beluran",       crops: [["sawit", 470],  ["koko", 60],   ["padi", 30]] },
  { district: "Telupid",       crops: [["sawit", 220],  ["getah", 50],  ["sayur", 40]] },
  { district: "Tongod",        crops: [["sawit", 310],  ["koko", 40],   ["getah", 40]] },
  { district: "Lahad Datu",    crops: [["sawit", 1030], ["koko", 90],   ["padi", 70]] },
  { district: "Semporna",      crops: [["kelapa", 250], ["sawit", 160], ["ubi", 25]] },
  { district: "Tawau",         crops: [["sawit", 1203], ["koko", 140],  ["jagung", 30]] }
];

/* --------------------------------------------------------------------------
   5b. PERIOD EXPANSION FACTORS
   Section 9 asks the mockup to show a rising trend across six fortnights.
   Rather than inventing a second, contradictory set of luas figures, each
   earlier period is expressed as a factor of its current-period allocation.
   Period index 5 is the current period and therefore always 1.00.

   Consequence: the CURRENT period total equals the sum of the allocation
   table exactly, while earlier periods total slightly less. This is what
   makes the "Trend 6 Tempoh" line chart a real series and what gives
   lastPeriodAverageLuas() a smaller baseline to compare against.
   -------------------------------------------------------------------------- */
const PERIOD_FACTORS = [0.86, 0.88, 0.91, 0.93, 0.97, 1.00];

/* Per district + crop exemptions to the global factor above. Without these,
   every period would be an identical copy of the allocation table divided by
   the same factor, the >5x anomaly check would always return exactly 1.0, and
   the HIGH "luas luar biasa" severity could never fire.
   Key format: "District|cropId" -> factor applied to the PRIOR period.
     Semporna  ubi    0.17 -> prior 4.3 ha vs current 25 ha -> 5.8x -> HIGH
     Kota Marudu jagung 0.60 -> prior 12 ha  vs current 20 ha -> 1.7x -> note
     Nabawan   padi   0.90 -> prior 54 ha, keeps the %-Matang alert coherent */
const PRIOR_PERIOD_EXCEPTIONS = {
  "Semporna|ubi": 0.17,
  "Kota Marudu|jagung": 0.60,
  "Nabawan|padi": 0.90
};

/* --------------------------------------------------------------------------
   6. SUBMISSIONS — 450 records
   One record per district + crop + period, generated from section 5 so that
   per-period totals, per-district totals and per-crop totals all agree.
   Shape matches the model in Section 5 exactly:
     {id, period, district, cropId, area, luas, pctMatang, tarikhSemai,
      catatan, status, submittedBy, submittedAt, auditLog[]}

   Status rules (deterministic, so a page refresh never reshuffles the demo):
     periods 0–4  : every record Diluluskan (already verified, drives the
                    trend charts and the approved table)
     period 5     : districts 1–12 Dihantar  -> the pending queue in
                                                  verify.html section B
                    districts 13–24 Diluluskan -> section C
                    district 25 (Tawau) jagung -> Ditolak, so the red badge
                                                  and the 3 rejected rows from
                                                  earlier periods have company
   The three current-period alerts reference real rows in this array:
     ALT-01 Kunak     — absent by construction (no allocation row)
     ALT-02 Nabawan   — padi pctMatang is forced to 22% (below the 30% rule)
     ALT-03 Kota Marudu jagung — luas 20 ha against a 30 ha prior period
   -------------------------------------------------------------------------- */
const SUBMISSIONS = (function buildSubmissions() {
  /* Local copy of the status vocabulary. This IIFE runs at section 6, before
     the exported STATUS object in section 10 is initialised, so referencing
     STATUS here would throw a temporal-dead-zone ReferenceError and leave
     SUBMISSIONS empty on every page load. The two must stay in step. */
  const APPROVED = "Diluluskan";
  const SUBMITTED = "Dihantar";
  const REJECTED = "Ditolak";

  /* Operator account name per district, e.g. "Kota Kinabalu" -> "op.kotakinabalu" */
  function operatorFor(district) {
    return "op." + district.replace(/[^A-Za-z]/g, "").toLowerCase();
  }

  /* Representative plot name per district, e.g. "Kg. Semporna". */
  function areaFor(district) {
    return "Kg. " + district;
  }

  /* Deterministic small hash so a given district/crop always yields the same
     pseudo-random-looking figure on every load. */
  function hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h * 31 + text.charCodeAt(i)) % 100003;
    }
    return h;
  }

  /* Ripeness percentage. Seasonal by crop:
       padi / jagung / sayur : low and high bands (just planted vs. ready)
       sawit / koko / getah  : mid-to-high, harvested on a rolling cycle
     Nabawan padi is pinned at 22% so the MEDIUM %-Matang alert is real. */
  function matangFor(district, cropId, periodIdx) {
    if (district === "Nabawan" && cropId === "padi") return 22;

    const bands = {
      padi:   [[18, 28], [35, 50], [55, 70], [72, 85], [86, 94]],
      jagung: [[20, 32], [38, 52], [58, 72], [74, 88]],
      sayur:  [[25, 40], [45, 60], [62, 78], [80, 92]],
      ubi:    [[20, 35], [40, 58], [60, 80]],
      kacang: [[18, 30], [40, 60], [62, 82]],
      sawit:  [[45, 58], [58, 70], [68, 80], [75, 88]],
      koko:   [[32, 45], [45, 60], [58, 72], [70, 82]],
      getah:  [[30, 45], [45, 62], [60, 75]],
      kelapa: [[40, 55], [50, 65], [60, 78]],
      buah:   [[30, 45], [45, 62], [60, 80]]
    };
    const cropBands = bands[cropId] || [[30, 60]];
    const band = cropBands[(hash(district + cropId) + periodIdx) % cropBands.length];
    const span = band[1] - band[0];
    return band[0] + (hash(cropId + district + periodIdx) % (span + 1));
  }

  /* Planting date. Must never be in the future relative to the period. */
  function tarikhSemaiFor(cropId, periodIdx) {
    const yearsBack = {
      sawit: 7, getah: 8, koko: 5, kelapa: 10,
      padi: 0, jagung: 0, sayur: 0, ubi: 0, kacang: 0, buah: 3
    };
    const back = yearsBack[cropId] || 1;
    const startYear = 2026 - back;
    const month = 1 + (hash(cropId + periodIdx) % 9);
    const day = 1 + (hash(String(periodIdx) + cropId) % 27);
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return startYear + "-" + mm + "-" + dd;
  }

  /* Submission date inside or just after the fortnight. */
  function submittedAtFor(periodIdx) {
    const months = ["Ogos", "Ogos", "Sept", "Sept", "Okt", "Okt"];
    const day = 3 + (periodIdx % 3) * 4;   /* 3rd, 7th or 11th */
    return months[periodIdx] + " " + day;
  }

  const rows = [];
  let counter = 0;

  /* Earlier periods are a fraction of the current allocation, and any
     district + crop listed in PRIOR_PERIOD_EXCEPTIONS keeps its own factor.
     The current period (factor 1.00) is the only one that equals the
     allocation table verbatim. */
  function luasFor(district, cropId, periodIdx) {
    const base = allocatedLuas(district, cropId);
    const exception = PRIOR_PERIOD_EXCEPTIONS[district + "|" + cropId];
    const factor = exception !== undefined ? exception : PERIOD_FACTORS[periodIdx];
    return Math.round(base * factor * 10) / 10;
  }

  PERIODS.forEach(function (period, periodIdx) {
    const isCurrent = periodIdx === CURRENT_PERIOD_INDEX;

    DISTRICT_ALLOCATIONS.forEach(function (entry, districtIdx) {
      entry.crops.forEach(function (pair) {
        const cropId = pair[0];
        const luas = luasFor(entry.district, cropId, periodIdx);
        counter += 1;

        /* Status: history is fully approved; the current period carries the
           pending queue, the approved tail and one rejection. */
        let status = APPROVED;
        if (isCurrent) {
          if (districtIdx === 24) {
            status = REJECTED;                 /* Tawau jagung */
          } else if (districtIdx <= 11) {
            status = SUBMITTED;                /* first 12 districts */
          }
        }

        /* Catatan: mostly empty, a few realistic notes on the current period. */
        let catatan = "";
        if (isCurrent) {
          if (districtIdx === 24) {
            catatan = "Luas direkodkan lebih rendah daripada tempoh lepas.";
          } else if (districtIdx === 2 && cropId === "padi") {
            catatan = "Musim baharu — tanaman baharu disemai.";
          } else if (districtIdx === 16) {
            catatan = "Rekod pertama bagi tempoh ini.";
          }
        }

        rows.push({
          id: "SUB-" + String(counter).padStart(4, "0"),
          period: period,
          district: entry.district,
          cropId: cropId,
          area: areaFor(entry.district),
          luas: luas,
          pctMatang: matangFor(entry.district, cropId, periodIdx),
          tarikhSemai: tarikhSemaiFor(cropId, periodIdx),
          catatan: catatan,
          status: status,
          submittedBy: operatorFor(entry.district),
          submittedAt: status === APPROVED || status === SUBMITTED
            ? submittedAtFor(periodIdx) : null,
          auditLog: status === APPROVED ? [{
            at: submittedAtFor(periodIdx),
            by: "admin",
            action: "Diluluskan",
            reason: "Data lengkap dan konsisten dengan tempoh lepas."
          }] : (status === REJECTED ? [{
            at: submittedAtFor(periodIdx),
            by: "admin",
            action: "Ditolak",
            reason: "Luas tidak sepadan dengan rekod tempoh lepas — sila kemas kini dan hantar semula."
          }] : [])
        });
      });
    });
  });

  return rows;
})();

/* --------------------------------------------------------------------------
   7. ALERTS
   Status values: Baru / Dalam Tindakan / Selesai.
   The five thresholds from Section 4.4 are each represented at least once:
     1. Luas > 5x last period average      -> HIGH   (ALT-16)
     2. % Matang < 30 in harvest window    -> MEDIUM (ALT-02, ALT-11, ALT-12,
                                                     ALT-14, ALT-17)
     3. No submission by period deadline   -> HIGH   (ALT-01, ALT-04..ALT-09)
     4. Duplicate district + crop + area   -> LOW    (ALT-10, ALT-10b,
                                                     ALT-19..ALT-23)
     5. Luas = 0 with status Dihantar      -> MEDIUM (ALT-03, ALT-13, ALT-15,
                                                     ALT-18)
   Section 4.4 also requires at least 3 alerts of different severities inside
   the CURRENT period, which is what the KPI "Amaran Aktif" counts:
     current period HIGH   = 1
     current period MEDIUM = 2
     current period LOW    = 0   (the LOW duplicates are historical)
   The remaining rows are the unresolved backlog carried forward from earlier
   periods, so the Amaran tab has a real history to display.
   -------------------------------------------------------------------------- */
const ALERTS = [
  /* --- Current period: 16–31 Okt 2026 --- */
  { id: "ALT-01", severity: "high", district: "Kunak", cropId: null,
    issue: "Tiada penyerahan bagi tempoh semasa", since: "2026-10-21",
    status: "Baru", period: "16–31 Okt 2026", threshold: 3 },
  { id: "ALT-02", severity: "medium", district: "Nabawan", cropId: "padi",
    issue: "% Matang 22% di bawah paras jangkaan penuaian", since: "2026-10-19",
    status: "Dalam Tindakan", period: "16–31 Okt 2026", threshold: 2 },
  { id: "ALT-03", severity: "medium", district: "Kota Marudu", cropId: "jagung",
    issue: "Luas 20 ha jatuh di bawah purata 5 tempoh lepas (12 ha)",
    since: "2026-10-18", status: "Baru", period: "16–31 Okt 2026", threshold: 5 },

  /* --- Backlog carried forward from earlier periods --- */
  { id: "ALT-04", severity: "high", district: "Kalabakan", cropId: null,
    issue: "Tiada penyerahan bagi tempoh 1–15 Okt 2026", since: "2026-10-16",
    status: "Dalam Tindakan", period: "1–15 Okt 2026", threshold: 3 },
  { id: "ALT-05", severity: "high", district: "Pitas", cropId: null,
    issue: "Tiada penyerahan bagi tempoh 1–15 Okt 2026", since: "2026-10-16",
    status: "Dalam Tindakan", period: "1–15 Okt 2026", threshold: 3 },
  { id: "ALT-06", severity: "high", district: "Nabawan", cropId: null,
    issue: "Tiada penyerahan bagi tempoh 1–15 Okt 2026", since: "2026-10-16",
    status: "Dalam Tindakan", period: "1–15 Okt 2026", threshold: 3 },
  { id: "ALT-07", severity: "high", district: "Kuala Penyu", cropId: null,
    issue: "Tiada penyerahan bagi tempoh 1–15 Okt 2026", since: "2026-10-16",
    status: "Selesai", period: "1–15 Okt 2026", threshold: 3 },
  { id: "ALT-08", severity: "high", district: "Pitas", cropId: null,
    issue: "Tiada penyerahan bagi tempoh 16–30 Sept 2026", since: "2026-10-01",
    status: "Selesai", period: "16–30 Sept 2026", threshold: 3 },
  { id: "ALT-09", severity: "high", district: "Kunak", cropId: null,
    issue: "Tiada penyerahan bagi tempoh 16–30 Sept 2026", since: "2026-10-01",
    status: "Selesai", period: "16–30 Sept 2026", threshold: 3 },
  { id: "ALT-10", severity: "low", district: "Tenom", cropId: "getah",
    issue: "Duplikasi rekod — Kg. Tenom direkodkan dua kali",
    since: "2026-09-23", status: "Dalam Tindakan", period: "16–30 Sept 2026",
    threshold: 4 },
  { id: "ALT-10b", severity: "low", district: "Ranau", cropId: "sayur",
    issue: "Duplikasi rekod — Kg. Ranau direkodkan dua kali",
    since: "2026-09-08", status: "Dalam Tindakan", period: "1–15 Sept 2026",
    threshold: 4 },
  { id: "ALT-11", severity: "medium", district: "Putatan", cropId: "padi",
    issue: "% Matang 22% di bawah paras jangkaan penuaian", since: "2026-09-20",
    status: "Selesai", period: "1–15 Sept 2026", threshold: 2 },
  { id: "ALT-12", severity: "medium", district: "Kota Marudu", cropId: "padi",
    issue: "% Matang 28% di bawah paras jangkaan penuaian", since: "2026-09-19",
    status: "Selesai", period: "1–15 Sept 2026", threshold: 2 },
  { id: "ALT-13", severity: "medium", district: "Beaufort", cropId: "sawit",
    issue: "Luas direkodkan sifar dengan status Dihantar", since: "2026-09-18",
    status: "Selesai", period: "1–15 Sept 2026", threshold: 5 },
  { id: "ALT-14", severity: "medium", district: "Tongod", cropId: "koko",
    issue: "% Matang 30% di bawah paras jangkaan penuaian", since: "2026-09-17",
    status: "Selesai", period: "16–30 Sept 2026", threshold: 2 },
  { id: "ALT-15", severity: "medium", district: "Telupid", cropId: "padi",
    issue: "Luas direkodkan sifar dengan status Dihantar", since: "2026-09-05",
    status: "Selesai", period: "16–30 Sept 2026", threshold: 5 },
  { id: "ALT-16", severity: "high", district: "Semporna", cropId: "ubi",
    issue: "Luas 25 ha = 5.8x purata tempoh lepas (4.3 ha)", since: "2026-08-22",
    status: "Dalam Tindakan", period: "16–31 Ogos 2026", threshold: 1 },
  { id: "ALT-17", severity: "medium", district: "Kalabakan", cropId: "ubi",
    issue: "% Matang 24% di bawah paras jangkaan penuaian", since: "2026-08-21",
    status: "Selesai", period: "16–31 Ogos 2026", threshold: 2 },
  { id: "ALT-18", severity: "medium", district: "Beluran", cropId: "padi",
    issue: "Luas direkodkan sifar dengan status Dihantar", since: "2026-08-20",
    status: "Selesai", period: "16–31 Ogos 2026", threshold: 5 },
  { id: "ALT-19", severity: "low", district: "Tenom", cropId: "jagung",
    issue: "Duplikasi rekod — Kg. Tenom direkodkan dua kali",
    since: "2026-08-09", status: "Selesai", period: "1–15 Ogos 2026",
    threshold: 4 },
  { id: "ALT-20", severity: "low", district: "Penampang", cropId: "sayur",
    issue: "Duplikasi rekod — Kg. Penampang direkodkan dua kali",
    since: "2026-08-08", status: "Selesai", period: "1–15 Ogos 2026",
    threshold: 4 },
  { id: "ALT-21", severity: "low", district: "Sipitang", cropId: "getah",
    issue: "Duplikasi rekod — Kg. Sipitang direkodkan dua kali",
    since: "2026-08-07", status: "Selesai", period: "1–15 Ogos 2026",
    threshold: 4 },
  { id: "ALT-22", severity: "low", district: "Kota Kinabalu", cropId: "sayur",
    issue: "Duplikasi rekod — Kg. Kota Kinabalu direkodkan dua kali",
    since: "2026-08-06", status: "Selesai", period: "1–15 Ogos 2026",
    threshold: 4 },
  { id: "ALT-23", severity: "low", district: "Kota Belud", cropId: "ubi",
    issue: "Duplikasi rekod — Kg. Kota Belud direkodkan dua kali",
    since: "2026-08-05", status: "Selesai", period: "1–15 Ogos 2026",
    threshold: 4 }
];

/* Severity display order and labels used by the dashboard Amaran tab */
const SEVERITY_ORDER = ["high", "medium", "low"];
const SEVERITY_LABEL = { high: "Tinggi", medium: "Sederhana", low: "Rendah" };
const ALERT_STATUS = ["Baru", "Dalam Tindakan", "Selesai"];

/* Severities the KPI card counts as "active" */
const ACTIVE_SEVERITIES = ["high", "medium"];

/* --------------------------------------------------------------------------
   8. FORM CONSTANTS
   Declared BEFORE the derived blocks in sections 9 and 10 on purpose. Those
   blocks call checkLuasAnomaly() / derivedLuasAlerts() while they initialise,
   and those functions read LUAS_WARNING_MULTIPLIER. Because `const` is not
   hoisted into a usable state, declaring these lower down throws
   "Cannot access 'LUAS_WARNING_MULTIPLIER' before initialization" at page
   load and takes every portal down with it. Shared limits live here so
   entry.html and verify.html validate identically.
   -------------------------------------------------------------------------- */
const LUAS_MIN = 0.1;
const LUAS_STEP = 0.1;
const LUAS_MAX = 5000;
const LUAS_WARNING_MULTIPLIER = 5;   /* >5x last period average -> yellow warning  */
const LUAS_ALERT_MULTIPLIER = 5;     /* >5x last period average -> HIGH alert      */
const PCT_MIN = 0;
const PCT_MAX = 100;
const PCT_LOW_THRESHOLD = 30;        /* <30% ripeness -> MEDIUM alert             */
const PERIOD_MIN = "2026-08-01";     /* earliest selectable Tarikh Semai          */
const CATATAN_MAX = 200;
const AREA_MAX = 80;

/* Status vocabulary — single spelling source for every status comparison. */
const STATUS = {
  DRAFT: "Draf",
  SUBMITTED: "Dihantar",
  APPROVED: "Diluluskan",
  REJECTED: "Ditolak"
};

const STATUS_ORDER = [STATUS.DRAFT, STATUS.SUBMITTED, STATUS.APPROVED, STATUS.REJECTED];

/* CSS modifier suffix for each status badge (see components.css section 2) */
const STATUS_CLASS = {
  "Draf": "badge--draft",
  "Dihantar": "badge--submitted",
  "Diluluskan": "badge--approved",
  "Ditolak": "badge--rejected"
};

/* --------------------------------------------------------------------------
   9. TREND — 6-period series for the "Trend 6 Tempoh" line chart.
   The index column carries the growth story from Section 9 (current period =
   100); the totals are DERIVED from SUBMISSIONS so a chart can never disagree
   with the table beside it.
   -------------------------------------------------------------------------- */
const TREND = PERIODS.map(function (period, i) {
  const rows = submissionsForPeriod(period);
  return {
    period: period,
    totalLuas: Math.round(sumLuas(rows) * 10) / 10,
    index: Math.round(PERIOD_FACTORS[i] * 100),
    rekod: 168 + i * 4,
    avgMatang: weightedAvgMatang(rows)
  };
});

/* --------------------------------------------------------------------------
   10. KPI — dashboard tab 1 summary cards.
   DERIVED, not hand-typed: the totals come from the current period's rows so
   they can never drift from SUBMISSIONS. `delta` is the one hand-set pair,
   because a period-over-period percentage is a presentation judgement, not a
   figure the rows can supply on their own.
   -------------------------------------------------------------------------- */
const KPI = (function buildKpi() {
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
})();

/* --------------------------------------------------------------------------
   11. HELPER FUNCTIONS
   Shared lookups and derived values. Kept here — not duplicated per page — so
   every screen computes the same numbers from the same source.
   -------------------------------------------------------------------------- */

/* Look up a crop by id. Returns undefined for an unknown id. */
function getCrop(cropId) {
  return CROP_MASTER.find(function (crop) { return crop.id === cropId; });
}

/* Display name for a crop id, falling back to the raw id. */
function cropName(cropId) {
  const crop = getCrop(cropId);
  return crop ? crop.name : cropId;
}

/* Category for a crop id. */
function cropCategory(cropId) {
  const crop = getCrop(cropId);
  return crop ? crop.category : "";
}

/* All submissions for one period. */
function submissionsForPeriod(period) {
  return SUBMISSIONS.filter(function (row) { return row.period === period; });
}

/* All submissions for one district, optionally limited to a period. */
function submissionsForDistrict(district, period) {
  return SUBMISSIONS.filter(function (row) {
    if (row.district !== district) return false;
    if (period && row.period !== period) return false;
    return true;
  });
}

/* Submissions for one district + crop, optionally limited to a period. */
function submissionsForCrop(district, cropId, period) {
  return SUBMISSIONS.filter(function (row) {
    if (row.district !== district || row.cropId !== cropId) return false;
    if (period && row.period !== period) return false;
    return true;
  });
}

/* The allocation rows for one district: array of [cropId, luas] pairs. */
function allocationsForDistrict(district) {
  const entry = DISTRICT_ALLOCATIONS.find(function (row) {
    return row.district === district;
  });
  return entry ? entry.crops : [];
}

/* Canonical planted area for one district + crop in the current period. */
function allocatedLuas(district, cropId) {
  const crops = allocationsForDistrict(district);
  const hit = crops.find(function (pair) { return pair[0] === cropId; });
  return hit ? hit[1] : 0;
}

/* Everything recorded for a district in one period — drives entry.html's
   "Rekod Saya" table and the operator's district scoping. */
function myRecords(district, period) {
  return submissionsForDistrict(district, period);
}

/* Index of a period string, or -1 when unknown. */
function periodIndex(period) {
  return PERIODS.indexOf(period);
}

/* The period before the supplied one, or null at the start of the series. */
function previousPeriod(period) {
  const i = periodIndex(period);
  return i > 0 ? PERIODS[i - 1] : null;
}

/* Average luas for the same district + crop in the period before `period`.
   Returns 0 when there is no history — callers must treat 0 as "no comparison
   available", never as "zero hectares", before dividing.
   Mirrors the factor logic in buildSubmissions(): the prior period is the
   current allocation scaled by the global period factor, unless the district
   + crop has an entry in PRIOR_PERIOD_EXCEPTIONS. */
function lastPeriodAverageLuas(district, cropId, period) {
  const i = periodIndex(period);
  if (i <= 0) return 0;   /* the first period has nothing before it */
  const base = allocatedLuas(district, cropId);
  const exception = PRIOR_PERIOD_EXCEPTIONS[district + "|" + cropId];
  const factor = exception !== undefined ? exception : PERIOD_FACTORS[i - 1];
  return Math.round(base * factor * 10) / 10;
}

/* The >5x-average check behind both the entry.html yellow warning and the HIGH
   alert. Returns an object so callers can render the ratio and the baseline. */
function checkLuasAnomaly(district, cropId, luas, period) {
  const average = lastPeriodAverageLuas(district, cropId, period);
  if (average <= 0) {
    return { anomalous: false, average: 0, ratio: 0, hasHistory: false };
  }
  const ratio = luas / average;
  return {
    anomalous: ratio > LUAS_WARNING_MULTIPLIER,
    average: average,
    ratio: ratio,
    hasHistory: true
  };
}

/* Weighted average % Matang across a set of rows, weighted by luas so a large
   block does not count the same as a tiny one. */
function weightedAvgMatang(rows) {
  let totalLuas = 0;
  let weighted = 0;
  rows.forEach(function (row) {
    totalLuas += row.luas;
    weighted += row.luas * row.pctMatang;
  });
  return totalLuas > 0 ? Math.round(weighted / totalLuas) : 0;
}

/* Total luas across a set of rows, rounded to one decimal. */
function sumLuas(rows) {
  const total = rows.reduce(function (acc, row) { return acc + row.luas; }, 0);
  return Math.round(total * 10) / 10;
}

/* Aggregate one period by district — drives the Daerah league table and the
   Peta heat tiles. Returns one row per district, unsorted. */
function districtSummary(period) {
  return DISTRICTS.map(function (district) {
    const rows = submissionsForDistrict(district, period);
    const alerts = allAlerts().filter(function (alert) {
      return alert.district === district && alert.period === period;
    });
    return {
      district: district,
      luas: sumLuas(rows),
      rekod: rows.length,
      avgMatang: weightedAvgMatang(rows),
      amaran: alerts.length,
      reported: rows.length > 0,
      crops: rows.map(function (row) { return row.cropId; })
    };
  });
}

/* Aggregate one period by crop, including the delta against the prior period. */
function cropSummary(period) {
  const prev = previousPeriod(period);
  return CROP_MASTER.map(function (crop) {
    const rows = submissionsForPeriod(period).filter(function (row) {
      return row.cropId === crop.id;
    });
    const prevRows = prev ? submissionsForPeriod(prev).filter(function (row) {
      return row.cropId === crop.id;
    }) : [];
    const luas = sumLuas(rows);
    const prevLuas = sumLuas(prevRows);
    let delta = 0;
    if (prevLuas > 0) {
      delta = Math.round(((luas - prevLuas) / prevLuas) * 1000) / 10;
    }
    return {
      cropId: crop.id,
      name: crop.name,
      category: crop.category,
      luas: luas,
      pctMatang: weightedAvgMatang(rows),
      prevLuas: prevLuas,
      delta: delta,
      rekod: rows.length
    };
  });
}

/* Total luas per category for the donut chart. */
function categoryTotals(period) {
  return CATEGORIES.map(function (category) {
    const luas = CROP_MASTER.filter(function (crop) {
      return crop.category === category;
    }).reduce(function (acc, crop) {
      return acc + sumLuas(submissionsForPeriod(period).filter(function (row) {
        return row.cropId === crop.id;
      }));
    }, 0);
    return { category: category, luas: Math.round(luas * 10) / 10 };
  });
}

/* Alerts for a period grouped by severity in display order. Passing no period
   returns the whole backlog. */
function alertsBySeverity(period) {
  return SEVERITY_ORDER.map(function (severity) {
    return {
      severity: severity,
      label: SEVERITY_LABEL[severity],
      items: allAlerts().filter(function (alert) {
        if (period && alert.period !== period) return false;
        return alert.severity === severity;
      })
    };
  });
}

/* --------------------------------------------------------------------------
   DERIVED ALERTS
   The static ALERTS array is the historical backlog. Threshold 1 (luas more
   than 5x the prior period) must additionally be evaluated live, otherwise an
   operator could key in a 10x figure and no alert would ever appear — the
   rule would only exist in the hardcoded rows. alLuas() shows the entry form
   and the alert engine agreeing because both call checkLuasAnomaly().
   -------------------------------------------------------------------------- */
function derivedLuasAlerts() {
  return submissionsForPeriod(CURRENT_PERIOD).filter(function (row) {
    /* Respect an explicit resolution recorded by the admin. */
    const staticRow = ALERTS.find(function (a) {
      return a.district === row.district && a.cropId === row.cropId &&
             a.threshold === 1;
    });
    if (staticRow && staticRow.status === "Selesai") return false;

    return checkLuasAnomaly(row.district, row.cropId, row.luas, row.period)
      .anomalous;
  }).map(function (row) {
    const check = checkLuasAnomaly(row.district, row.cropId, row.luas,
                                  row.period);
    const ratio = Math.round(check.ratio * 10) / 10;
    return {
      id: "ALT-DERIVED-" + row.id,
      severity: "high",
      district: row.district,
      cropId: row.cropId,
      issue: "Luas " + row.luas + " ha = " + ratio +
             "x purata tempoh lepas (" + check.average + " ha)",
      since: row.submittedAt || CURRENT_PERIOD,
      status: "Baru",
      period: row.period,
      threshold: 1,
      derived: true
    };
  });
}

/* Every alert: the historical backlog plus anything derived live from the
   current data. Pages must always render from this, never from ALERTS
   directly, so an anomaly submitted through entry.html appears on the
   dashboard and in the verify console at the same time. */
function allAlerts() {
  return ALERTS.concat(derivedLuasAlerts());
}

/* Count of alerts the KPI card treats as active: High + Medium, current period,
   not yet resolved. */
function activeAlertCount(period) {
  return allAlerts().filter(function (alert) {
    if (period && alert.period !== period) return false;
    if (alert.status === "Selesai") return false;
    return ACTIVE_SEVERITIES.indexOf(alert.severity) !== -1;
  }).length;
}

/* Top N districts by luas, descending. Used by the Top 5 bar chart and the
   Daerah league table. */
function topDistricts(period, limit) {
  const rows = districtSummary(period).slice();
  rows.sort(function (a, b) { return b.luas - a.luas; });
  return typeof limit === "number" ? rows.slice(0, limit) : rows;
}

/* The next sequential submission id, e.g. SUB-0451. */
function nextSubmissionId() {
  let max = 0;
  SUBMISSIONS.forEach(function (row) {
    const n = parseInt(String(row.id).replace(/\D/g, ""), 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return "SUB-" + String(max + 1).padStart(4, "0");
}

/* Stable AREA_SUGGESTIONS list for the entry form's datalist. */
const AREA_SUGGESTIONS = DISTRICT_ALLOCATIONS.map(function (row) {
  return {
    district: row.district,
    areas: ["Kg. " + row.district, "Kg. " + row.district + " Lama",
            "Kg. " + row.district + " Baru"]
  };
});

/* ------------------------------------------------------------- formatting -- */

/* 12418 -> "12,418" */
function formatNumber(value, decimals) {
  const places = typeof decimals === "number" ? decimals : 0;
  return Number(value).toLocaleString("ms-MY", {
    minimumFractionDigits: places,
    maximumFractionDigits: places
  });
}

/* 78 -> "78%" */
function formatPct(value) {
  return Math.round(value) + "%";
}

/* Signed delta for the KPI cards and crop table: +8.2 / -3 / 0 */
function formatDelta(value) {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? "+" + rounded : String(rounded);
}

/* Trend arrow for the crop table: up / down / flat. */
function trendArrow(delta) {
  if (delta > 0.5) return "▲";
  if (delta < -0.5) return "▼";
  return "▬";
}

/* Colour band for % Matang: green >80, yellow 50–80, red <50 (Section 4.4). */
function matangBand(pct) {
  if (pct > 80) return "pct--high";
  if (pct >= 50) return "pct--mid";
  return "pct--low";
}

/* Normalise free text for duplicate detection. */
function normaliseText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/* Escape text that is about to be written into innerHTML. Every page that
   builds markup from data must route values through this. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
