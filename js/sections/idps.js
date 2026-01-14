// js/sections/idps.js
import { markColor } from "../theme.js";

export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  // ---------- 1) Load IDPs data ----------
  const rows = await d3.csv("./dataset/hdx_hapi_idps_afg.csv");

  const toNumber = (x) => {
    const n = +String(x).replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };

  const parseDate = (s) => {
    const d = new Date(String(s).trim());
    return isNaN(d.getTime()) ? null : d;
  };

  const level1 = rows.filter(r => String(r.admin_level).trim() === "1");
  if (!level1.length) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("No admin_level=1 records found in IDPs dataset.");
    return;
  }

  // ---------- 2) Latest date ----------
  let latest = null;
  for (const r of level1) {
    const d = parseDate(r.reference_period_start);
    if (d && (!latest || d > latest)) latest = d;
  }
  if (!latest) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("Could not parse reference_period_start.");
    return;
  }
  const latestISO = latest.toISOString().slice(0, 10);

  // ---------- 3) Aggregate IDPs by province ----------
  const idpsByProvince = new Map();
  for (const r of level1) {
    const d = parseDate(r.reference_period_start);
    if (!d || d.getTime() !== latest.getTime()) continue;

    const name = (r.admin1_name || "").trim();
    if (!name) continue;

    const pop = toNumber(r.population);
    idpsByProvince.set(name, (idpsByProvince.get(name) || 0) + pop);
  }

  // ---------- 4) Load LOCAL GeoJSON ----------
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

  // ---------- 5) Name normalization ----------
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
  for (const [name, val] of idpsByProvince.entries()) {
    const k0 = norm(name);
    const k = alias.get(k0) || k0;
    lookup.set(k, val);
  }

  const getShapeName = (f) => {
    const p = f.properties || {};
    return p.shapeName || p.NAME_1 || p.name || "";
  };

  // ---------- 6) Values & color ----------
  const values = geo.features.map(f => {
    const name = getShapeName(f);
    const key = alias.get(norm(name)) || norm(name);
    return lookup.get(key) || 0;
  });

  const nonZero = values.filter(v => v > 0);

  // Quantiles for readability
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

  // ---------- 7) Layout ----------
  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const w = Math.max(10, width - margin.left - margin.right);
  const h = Math.max(10, height - margin.top - margin.bottom);

  const chart = g.root.attr("transform", `translate(${margin.left},${margin.top})`);

  // geoIdentity avoids projection mismatch for some GeoJSON files
  const projection = d3.geoIdentity()
    .reflectY(true)
    .fitSize([w, h], geo);

  const path = d3.geoPath(projection);

  // ---------- 8) Tooltip ----------
  let tip = document.getElementById("viz-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "viz-tooltip";
    tip.style.position = "fixed";
    tip.style.pointerEvents = "none";
    tip.style.background = "rgba(2,6,23,.92)";
    tip.style.border = "1px solid rgba(148,163,184,.25)";
    tip.style.borderRadius = "10px";
    tip.style.padding = "8px 10px";
    tip.style.color = theme.text;
    tip.style.fontSize = "12px";
    tip.style.display = "none";
    document.body.appendChild(tip);
  }

  const fmt = d3.format(",");

  // ---------- 9) Draw map ----------
  const baseStroke = "rgba(148,163,184,.25)";
  const hoverStroke = "rgba(229,231,235,.85)"; // ✅ neutral highlight (no pink)

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
        <div style="color:${theme.mutedText}; margin-top:4px;">Reference date: ${latestISO}</div>
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

  // ---------- 10) Title note ----------
  chart.append("text")
    .attr("x", w)
    .attr("y", 14)
    .attr("fill", theme.context)
    .attr("font-size", 10)
    .attr("text-anchor", "end")
    .text(`IDPs by province · reference: ${latestISO}`);
}
