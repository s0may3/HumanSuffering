// js/sections/overview.js
import { markColor } from "../theme.js";

/**
 * Section 1 — Migration Pressure (Outbound) Over Time (PREPROCESSED)
 * Data source: ./data/processed/outflow_by_year.csv
 * Expected: year + value (or outflow_ref_asy or any numeric col besides year)
 */
export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  // clear layers (match app.js makeSvg layering)
  g.marks.selectAll("*").remove();
  g.axes.selectAll("*").remove();
  g.anno.selectAll("*").remove();
  g.root.selectAll("*").remove();
  g.ui.selectAll("*").remove();

  // ---------- 1) Load processed ----------
  const path = "./data/processed/outflow_by_year.csv";

  let rows;
  try {
    rows = await d3.csv(path);
  } catch (e) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text(`Failed to load: ${path}`);
    console.error(e);
    return;
  }

  if (!rows || !rows.length) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text("No data available for this selection.");
    return;
  }

  const toNumber = (x) => {
    const n = +String(x ?? "").replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };

  // value column detection
  const valueKey =
    ("value" in rows[0]) ? "value" :
    ("outflow_ref_asy" in rows[0]) ? "outflow_ref_asy" :
    Object.keys(rows[0]).find(k => k !== "year");

  const data = rows
    .map(r => ({ year: +r.year, value: toNumber(r[valueKey]) }))
    .filter(d => Number.isFinite(d.year) && d.value > 0)
    .sort((a, b) => a.year - b.year);

  if (!data.length) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text("No data available for this selection.");
    return;
  }

  // ---------- 2) Layout ----------
  // CHANGED: top margin from 20 -> 30 to avoid overlap with hint
  const margin = { top: 30, right: 20, bottom: 44, left: 64 };
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

  const gx = g.axes.append("g")
    .attr("transform", `translate(${margin.left},${margin.top + h})`)
    .call(xAxis);

  const gy = g.axes.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .call(yAxis);

  // style axes to match your site vibe
  gx.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 11);
  gy.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 11);
  gx.selectAll("path,line").attr("stroke", "rgba(148,163,184,.25)");
  gy.selectAll("path,line").attr("stroke", "rgba(148,163,184,.25)");

  // axis labels (kept subtle)
  chart.append("text")
    .attr("x", w / 2).attr("y", h + 36)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .attr("text-anchor", "middle")
    .text("Year");

  chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2).attr("y", -46)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .attr("text-anchor", "middle")
    .text("People (count)");

  // ---------- 4) Line ----------
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

  // ---------- 5) Tooltip + Hover ----------
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
    tip.style.fontFamily = "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    tip.style.fontSize = "12px";
    tip.style.boxShadow = "0 12px 30px rgba(0,0,0,55)";
    tip.style.display = "none";
    tip.style.zIndex = "2147483647";
    document.body.appendChild(tip);
  } else {
    tip.style.zIndex = "2147483647";
  }

  const fmt = d3.format(",");
  const bisect = d3.bisector(d => d.year).left;

  const focus = chart.append("g").style("display", "none");

  focus.append("circle")
    .attr("r", 5.5)
    .attr("fill", markColor("pressure"))
    .attr("stroke", "rgba(229,231,235,0.9)")
    .attr("stroke-width", 1.6);

  function showTip(event, d) {
    tip.innerHTML = `
      <div style="font-weight:600; margin-bottom:2px;">Outbound migration pressure</div>
      <div style="color:${theme.mutedText};">Year: ${d.year}</div>
      <div style="margin-top:6px;">
        <span style="color:${theme.mutedText};">People:</span> ${fmt(Math.round(d.value))}
      </div>
    `;

    const pad = 12;
    const tx = Math.min(window.innerWidth - 260, event.clientX + pad);
    const ty = Math.min(window.innerHeight - 120, event.clientY + pad);
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
    tip.style.display = "block";
  }

  function hideTip() {
    tip.style.display = "none";
  }

  // transparent overlay captures mouse events (keeps it interactive)
  chart.append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .on("mouseenter", () => {
      focus.style("display", null);
      tip.style.display = "block";
    })
    .on("mouseleave", () => {
      focus.style("display", "none");
      hideTip();
    })
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const yearGuess = Math.round(x.invert(mx));

      let i = bisect(data, yearGuess);
      if (i <= 0) i = 1;
      if (i >= data.length) i = data.length - 1;

      const a = data[i - 1];
      const b = data[i];
      const d = (yearGuess - a.year) > (b.year - yearGuess) ? b : a;

      focus.attr("transform", `translate(${x(d.year)},${y(d.value)})`);
      showTip(event, d);
    });

  // ---------- 6) Hint (CHANGED: moved outside plot to g.ui) ----------
  g.ui.attr("transform", `translate(${margin.left},${margin.top - 14})`);

  g.ui.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .attr("fill", theme.mutedText)
    .attr("font-size", 12)
    .attr("text-anchor", "start")
    .attr("dominant-baseline", "hanging")
    .text("Hover the line to see year + count");
}
