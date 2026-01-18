// js/sections/idps.js
import { markColor } from "../theme.js";

export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  // clear
  g.marks.selectAll("*").remove();
  g.axes.selectAll("*").remove();
  g.anno.selectAll("*").remove();
  g.root.selectAll("*").remove();
  g.ui.selectAll("*").remove();

  // ---------- helper ----------
  const toNumber = (x) => {
    const n = +String(x ?? "").replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };

  async function tryLoadCsv(path) {
    try {
      const r = await d3.csv(path);
      return r && r.length ? r : null;
    } catch {
      return null;
    }
  }

  // ---------- 1) Load PREPROCESSED IDPs snapshot ----------
  const candidates = [
    "./data/processed/idps_latest_by_province.csv",
    "./dataset/derived/idps_latest_by_province.csv",
    "./data/processed/idps_latest.csv",
    "./dataset/derived/idps_latest.csv",
  ];

  let rows = null;
  let usedPath = null;
  for (const p of candidates) {
    rows = await tryLoadCsv(p);
    if (rows) { usedPath = p; break; }
  }

  if (!rows) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("Missing preprocessed IDPs file. Expected data/processed/idps_latest_by_province.csv");
    return;
  }

  // detect columns
  const keys = Object.keys(rows[0] || {});
  const lower = (s) => String(s || "").toLowerCase();

  const provinceKey =
    keys.find(k => ["province", "admin1_name", "adm1", "name"].includes(lower(k))) ||
    keys.find(k => lower(k).includes("admin1")) ||
    keys.find(k => lower(k).includes("province")) ||
    keys[0];

  const idpsKey =
    keys.find(k => ["idps", "population", "count", "value"].includes(lower(k))) ||
    keys.find(k => lower(k).includes("idp")) ||
    keys.find(k => lower(k).includes("pop")) ||
    keys.find(k => k !== provinceKey);

  const dateKey =
    keys.find(k => ["latestiso", "reference_date", "date", "latest_date"].includes(lower(k))) ||
    keys.find(k => lower(k).includes("date")) ||
    null;

  // extract latestISO (optional)
  let latestISO = "unknown";
  if (dateKey) {
    const d = (rows[0][dateKey] || "").trim();
    if (d) latestISO = d;
  }

  // build lookup: normalized province -> idps
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/g, "")
      .trim();

  const alias = new Map([
    ["nimroz", "nimruz"],
    ["daykundi", "daikundi"],
  ]);

  const lookup = new Map();
  for (const r of rows) {
    const name = (r[provinceKey] || "").trim();
    if (!name) continue;
    const v = toNumber(r[idpsKey]);
    const k0 = norm(name);
    const k = alias.get(k0) || k0;
    lookup.set(k, (lookup.get(k) || 0) + v);
  }

  // ---------- 2) Load GeoJSON ----------
  const geoPath = "./dataset/geo/afghanistan_adm1.geojson";
  let geo;
  try {
    geo = await d3.json(geoPath);
  } catch (e) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context).attr("font-size", 12)
      .text(`Failed to load GeoJSON: ${geoPath}`);
    return;
  }

  if (!geo || !geo.features) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("GeoJSON loaded but missing 'features'.");
    return;
  }

  const getShapeName = (f) => {
    const p = f.properties || {};
    return p.shapeName || p.NAME_1 || p.name || "";
  };

  // ---------- 3) Colors ----------
  const values = geo.features.map(f => {
    const name = getShapeName(f);
    const key = alias.get(norm(name)) || norm(name);
    return lookup.get(key) || 0;
  });

  const nonZero = values.filter(v => v > 0);

  const quant = d3.scaleQuantile()
    .domain(nonZero.length ? nonZero : [1])
    .range([
      "rgba(251,191,36,0.20)",
      "rgba(251,191,36,0.32)",
      "rgba(251,191,36,0.45)",
      "rgba(251,191,36,0.62)",
      "rgba(251,191,36,0.80)",
    ]);

  const fillFor = (v) => {
    if (v <= 0) return "rgba(15,23,42,0.25)";
    return quant(v);
  };

  // ---------- 4) Layout / projection ----------
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const w = Math.max(10, width - margin.left - margin.right);
  const h = Math.max(10, height - margin.top - margin.bottom);

  const chart = g.root.attr("transform", `translate(${margin.left},${margin.top})`);

  const projection = d3.geoIdentity()
    .reflectY(true)
    .fitSize([w, h], geo);

  const path = d3.geoPath(projection);

  // ---------- 5) Tooltip ----------
  let tip = document.getElementById("viz-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "viz-tooltip";
    tip.style.position = "fixed";
    tip.style.pointerEvents = "none";
    tip.style.background = "rgba(2,6,23,92)";
    tip.style.border = "1px solid rgba(148,163,184,25)";
    tip.style.borderRadius = "10px";
    tip.style.padding = "8px 10px";
    tip.style.color = theme.text;
    tip.style.fontSize = "12px";
    tip.style.display = "none";
    tip.style.zIndex = "2147483647";
    document.body.appendChild(tip);
  } else {
    tip.style.zIndex = "2147483647";
  }

  const fmt = d3.format(",");

  // ---------- 6) Draw map (interactive like before) ----------
  const baseStroke = "rgba(148,163,184,25)";
  const hoverStroke = "rgba(229,231,235,85)";

  chart.selectAll("path.province")
    .data(geo.features)
    .enter()
    .append("path")
    .attr("class", "province")
    .attr("d", path)
    .attr("fill", (f) => {
      const name = getShapeName(f);
      const key = alias.get(norm(name)) || norm(name);
      const v = lookup.get(key) || 0;
      return fillFor(v);
    })
    .attr("stroke", baseStroke)
    .attr("stroke-width", 0.9)
    .on("mouseenter", function (event, f) {
      d3.select(this).attr("stroke-width", 2).attr("stroke", hoverStroke);

      const name = getShapeName(f);
      const key = alias.get(norm(name)) || norm(name);
      const v = lookup.get(key) || 0;

      tip.innerHTML = `
        <div style="font-weight:600;">${name}</div>
        <div style="color:${theme.mutedText};">IDPs (count): ${fmt(v)}</div>
        
      `;
      tip.style.display = "block";
    })
    .on("mousemove", (event) => {
      const pad = 12;
      tip.style.left = `${Math.min(window.innerWidth - 260, event.clientX + pad)}px`;
      tip.style.top = `${Math.min(window.innerHeight - 110, event.clientY + pad)}px`;
    })
    .on("mouseleave", function () {
      d3.select(this).attr("stroke-width", 0.9).attr("stroke", baseStroke);
      tip.style.display = "none";
    });

  // ---------- 7) small note ----------
  chart.append("text")
    .attr("x", w)
    .attr("y", 14)
    .attr("fill", theme.context)
    .attr("font-size", 10)
    .attr("text-anchor", "end")
    .text(`IDPs by province · reference: ${latestISO}`);
}
