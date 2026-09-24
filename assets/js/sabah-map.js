/* ==========================================================================
   sabah-map.js — Sistem Maklumat Pertanian Sabah (SMPS)
   Purpose: the district label anchors for the Sabah map, plus the wiring that
            turns assets/img/sabah-map.svg into an interactive heat map.
   Dependencies: data.js, auth.js, shared.js. Loaded by dashboard.html only.

   HOW THE MAP WAS MADE (and its honest limits)
   The outline and the 27 district shapes were extracted from a real
   administrative map of Sabah supplied by the project owner, then simplified
   to 1,144 path points / 11 KB:
     1. The 443,365-pixel Sabah landmass was isolated from the source image by
        colour, and its coastline traced with marching squares + Douglas-Peucker.
     2. The source map does NOT draw borders between districts that share a
        division colour (Tawau, Kunak, Semporna and Kalabakan are one green
        mass), so pixel tracing cannot separate them.
     3. District territories were therefore hand-placed as bias polygons and
        resolved by nearest-anchor assignment, then clipped to the true
        coastline.
   RESULT: the state outline and the island groups are accurate; the internal
   district borders are APPROXIMATE. Good enough for a mockup, not for survey
   or legal use.
   ========================================================================== */

/* Label anchor per district, in the SVG's own coordinate space. Placed at each
   district's centroid, nudged for the small west-coast districts where a
   centroid label would collide with its neighbour. */
const SABAH_LABEL_ANCHORS = {
  "Kudat":          { x: 458, y: 130 },
  "Pitas":          { x: 512, y: 240 },
  "Kota Marudu":    { x: 424, y: 295 },
  "Kota Belud":     { x: 372, y: 355 },
  "Tuaran":         { x: 296, y: 420 },
  "Kota Kinabalu":  { x: 226, y: 404 },
  "Putatan":        { x: 232, y: 462 },
  "Penampang":      { x: 318, y: 500 },
  "Papar":          { x: 356, y: 448 },
  "Kuala Penyu":    { x: 196, y: 540 },
  "Beaufort":       { x: 292, y: 578 },
  "Sipitang":       { x: 285, y: 700 },
  "Tenom":          { x: 400, y: 578 },
  "Keningau":       { x: 442, y: 520 },
  "Tambunan":       { x: 480, y: 495 },
  "Ranau":          { x: 470, y: 372 },
  "Telupid":        { x: 578, y: 385 },
  "Beluran":        { x: 640, y: 250 },
  "Sandakan":       { x: 700, y: 380 },
  "Tongod":         { x: 590, y: 500 },
  "Kinabatangan":   { x: 790, y: 450 },
  "Nabawan":        { x: 512, y: 680 },
  "Lahad Datu":     { x: 965, y: 505 },
  "Kalabakan":      { x: 862, y: 640 },
  "Tawau":          { x: 700, y: 610 },
  "Kunak":          { x: 785, y: 745 },
  "Semporna":       { x: 1000, y: 645 }
};

/* Districts whose label sits in a crowded corner and therefore gets a leader
   line out to clear space instead of sitting on the shape. */
const SABAH_OFFSET_LABELS = {
  "Kota Kinabalu": { x: 150, y: 395 },
  "Putatan":       { x: 150, y: 452 },
  "Kuala Penyu":   { x: 120, y: 560 }
};

/* The map's own coordinate space, used to convert label anchors to percentages
   so the labels can be positioned with CSS rather than inline styles. */
const SABAH_VIEWBOX = { x: 81, y: 0, width: 1092, height: 913 };

function labelPercent(px, py) {
  return {
    left: ((px - SABAH_VIEWBOX.x) / SABAH_VIEWBOX.width) * 100,
    top: (py / SABAH_VIEWBOX.height) * 100
  };
}

/* --------------------------------------------------------------------------
   HEAT MAPPING
   Seven steps from light to dark, matching the .map-district[data-heat="n"]
   rules in components.css.
   -------------------------------------------------------------------------- */
function heatStep(value, max) {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(6, Math.ceil((value / max) * 6));
}

/* Total luas for one district under the active layer filter. */
function districtLayerLuas(district, period, layerCropId) {
  const rows = submissionsForDistrict(district, period);
  if (!layerCropId) return sumLuas(rows);

  /* "jagung" doubles as the Tanaman Kontan layer selector. */
  const cropIds = layerCropId === "jagung"
    ? CROP_MASTER.filter(function (c) { return c.category === "Tanaman Kontan"; })
        .map(function (c) { return c.id; })
    : [layerCropId];

  return sumLuas(rows.filter(function (row) {
    return cropIds.indexOf(row.cropId) !== -1;
  }));
}

/* --------------------------------------------------------------------------
   RENDER
   Writes the districts, then repeats them for the labels. The label pass is a
   separate <div> overlay so text lives in HTML (selectable, accessible) rather
   than inside the SVG, and long names never distort the map geometry.
   -------------------------------------------------------------------------- */
function renderSabahMap(options) {
  const opts = options || {};
  const mount = document.getElementById(opts.mountId || "sabahMap");
  if (!mount) return;

  const period = opts.period || CURRENT_PERIOD;
  const layer = opts.layer || "";
  const rows = districtSummary(period);

  const byDistrict = {};
  const values = [];
  rows.forEach(function (row) {
    const value = districtLayerLuas(row.district, period, layer);
    byDistrict[row.district] = { row: row, value: value };
    values.push(value);
  });
  const max = Math.max.apply(null, values.concat([0]));

  const inline = mount.querySelector("svg");
  if (!inline) return;

  /* 1. Colour each district by its share of the maximum. */
  const paths = inline.querySelectorAll("path[data-district]");
  Array.prototype.forEach.call(paths, function (path) {
    const district = path.getAttribute("data-district");
    const entry = byDistrict[district];
    const value = entry ? entry.value : 0;

    path.setAttribute("data-heat", String(heatStep(value, max)));
    path.setAttribute("tabindex", "0");
    path.setAttribute("role", "button");
    path.setAttribute("aria-label",
      district + ", " + formatNumber(value, 1) + " hektar");
    path.classList.toggle("is-selected", opts.selected === district);

    if (!path.dataset.bound) {
      path.dataset.bound = "1";
      path.addEventListener("click", function () {
        if (opts.onSelect) opts.onSelect(district);
      });
      path.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (opts.onSelect) opts.onSelect(district);
        }
      });
    }
  });

  /* 2. Label overlay. */
  const labels = el("div", { class: "sabah-map__labels" });
  Object.keys(SABAH_LABEL_ANCHORS).forEach(function (district) {
    const anchor = SABAH_OFFSET_LABELS[district] || SABAH_LABEL_ANCHORS[district];
    const pos = labelPercent(anchor.x, anchor.y);
    const entry = byDistrict[district];

    const node = el("button", {
      type: "button",
      class: "map-label" + (opts.selected === district ? " is-selected" : ""),
      text: district
    });
    /* Dynamic percentage positioning on a generated overlay is the one place
       a style attribute is appropriate; percentages cannot be known ahead of
       time and there is no static class for each district position. */
    node.style.left = pos.left.toFixed(3) + "%";
    node.style.top = pos.top.toFixed(3) + "%";
    node.setAttribute("aria-label",
      district + ", " + (entry ? formatNumber(entry.value, 1) : "0") + " hektar");
    node.addEventListener("click", function () {
      if (opts.onSelect) opts.onSelect(district);
    });
    labels.appendChild(node);
  });

  const existing = mount.querySelector(".sabah-map__labels");
  if (existing) mount.removeChild(existing);
  mount.appendChild(labels);

  return { max: max, rows: rows, byDistrict: byDistrict };
}

/* The low → high legend under the map. */
function renderMapLegend(options) {
  const target = document.getElementById(options.legendId || "mapLegend");
  if (!target) return;

  const items = [el("span", { class: "legend__item", text: "Aktiviti rendah" })];
  for (let level = 0; level <= 6; level++) {
    items.push(el("span", {
      class: "legend__swatch",
      dataset: { heat: String(level) }
    }));
  }
  items.push(el("span", { class: "legend__item", text: "Aktiviti tinggi" }));
  items.push(el("span", {
    class: "legend__item text-muted",
    text: options.note || ""
  }));

  render(target, items);
}
