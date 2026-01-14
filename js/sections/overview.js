// js/sections/overview.js
import { markColor } from "../theme.js";

/**
 * Section 1 — Migration Pressure (Outbound) Over Time
 * Data source: dataset/hdx_hapi_refugees_afg.csv
 *
 * Filtering / aggregation:
 * - origin_location_code === "AFG"
 * - asylum_location_code !== "AFG"
 * - population_group in ["REF", "ASY"] (if present)
 * - aggregated by year(reference_period_start)
 */
export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  // ---------- 1) Load & aggregate ----------
  const rows = await d3.csv("./dataset/hdx_hapi_refugees_afg.csv");

  const parseYear = (d) => {
    if (!d) return null;
    const s = String(d).trim();
    if (/^\d{4}/.test(s)) return +s.slice(0, 4);
    const p = s.split(/[\/\-]/);
    return p.length === 3 ? +p[2] : null;
  };

  const toNumber = (x) => {
    const n = +String(x).replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };

  const sumByYear = new Map();

  for (const r of rows) {
    if ((r.origin_location_code || "").trim() !== "AFG") continue;
    if ((r.asylum_location_code || "").trim() === "AFG") continue;

    const group = (r.population_group || "").trim();
    if (group && group !== "REF" && group !== "ASY") continue;

    const year = parseYear(r.reference_period_start);
    if (!year) continue;

    const pop = toNumber(r.population);
    if (pop <= 0) continue;

    sumByYear.set(year, (sumByYear.get(year) || 0) + pop);
  }

  const data = Array.from(sumByYear, ([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);

  if (!data.length) {
    g.marks.append("text")
      .attr("x", 20)
      .attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text("No data available for this selection.");
    return;
  }

  // ---------- 2) Layout ----------
  const margin = { top: 20, right: 20, bottom: 44, left: 64 };
  const w = Math.max(10, width - margin.left - margin.right);
  const h = Math.max(10, height - margin.top - margin.bottom);

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .range([0, w]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .nice()
    .range([h, 0]);

  const chart = g.root.attr("transform", `translate(${margin.left},${margin.top})`);

  // ---------- 3) Axes ----------
  const xAxis = d3.axisBottom(x)
    .ticks(Math.min(8, data.length))
    .tickFormat(d3.format("d"));

  const yAxis = d3.axisLeft(y)
    .ticks(6)
    .tickFormat(d3.format("~s"));

  const gx = chart.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(xAxis);

  const gy = chart.append("g")
    .call(yAxis);

  gx.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 11);
  gy.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 11);
  gx.selectAll("path,line").attr("stroke", "rgba(148,163,184,.25)");
  gy.selectAll("path,line").attr("stroke", "rgba(148,163,184,.25)");

  // ---------- 4) Labels ----------
  chart.append("text")
    .attr("x", 0)
    .attr("y", -6)
    .attr("fill", theme.text)
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("Outbound migration pressure ");

  chart.append("text")
    .attr("x", w / 2)
    .attr("y", h + 36)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .attr("text-anchor", "middle")
    .text("Year");

  chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -46)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .attr("text-anchor", "middle")
    .text("People (count)");

  // ---------- 5) Line ----------
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  chart.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", markColor("pressure"))
    .attr("stroke-width", 2.5)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("d", line);

  // ---------- 6) Tooltip (no vertical guideline) ----------
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
    tip.style.boxShadow = "0 12px 30px rgba(0,0,0,.55)";
    tip.style.display = "none";
    document.body.appendChild(tip);
  }

  const fmt = d3.format(",");
  const bisect = d3.bisector(d => d.year).left;

  const focus = chart.append("g").style("display", "none");

  focus.append("circle")
    .attr("r", 5.5)
    .attr("fill", markColor("pressure"))
    .attr("stroke", "rgba(229,231,235,.9)")
    .attr("stroke-width", 2);

  chart.append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "transparent")
    .on("mouseenter", () => { focus.style("display", null); tip.style.display = "block"; })
    .on("mouseleave", () => { focus.style("display", "none"); tip.style.display = "none"; })
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const yearGuess = Math.round(x.invert(mx));
      let i = bisect(data, yearGuess);
      if (i <= 0) i = 1;
      if (i >= data.length) i = data.length - 1;

      const a = data[i - 1];
      const b = data[i];
      const d = (yearGuess - a.year) > (b.year - yearGuess) ? b : a;

      const cx = x(d.year);
      const cy = y(d.value);
      focus.attr("transform", `translate(${cx},${cy})`);

      tip.innerHTML = `
        <div style="font-weight:600;">Year: ${d.year}</div>
        <div style="color:${theme.mutedText};">People: ${fmt(d.value)}</div>
      `;

      const pad = 12;
      tip.style.left = `${Math.min(window.innerWidth - 220, event.clientX + pad)}px`;
      tip.style.top  = `${Math.min(window.innerHeight - 80,  event.clientY + pad)}px`;
    });
}
