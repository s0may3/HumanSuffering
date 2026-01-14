// js/sections/shocks.js
import { markColor } from "../theme.js";

/**
 * Section 2 — Economic Shocks (Histogram + Tooltip)
 * Data: dataset/hdx_hapi_food_price_afg.csv
 *
 * Histogram of YoY% changes per commodity (+ market if exists).
 * Tooltip on bins shows: range (%) and frequency (count).
 */
export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  const rows = await d3.csv("./dataset/hdx_hapi_food_price_afg.csv");

  const parseYear = (d) => {
    if (!d) return null;
    const s = String(d).trim();
    if (/^\d{4}/.test(s)) return +s.slice(0, 4);
    const p = s.split(/[\/\-]/);
    return p.length === 3 ? +p[2] : null;
  };

  const toNumber = (x) => {
    const n = +String(x).replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : null;
  };

  const priceCol = rows.length && ("price" in rows[0]) ? "price" : "value";
  const commodityCol = rows.length && ("commodity" in rows[0]) ? "commodity"
                    : (rows.length && ("commodity_name" in rows[0]) ? "commodity_name" : null);
  const marketCol = rows.length && ("market" in rows[0]) ? "market"
                  : (rows.length && ("market_name" in rows[0]) ? "market_name" : null);

  // Group records into series: commodity + market (if available)
  const series = new Map();

  for (const r of rows) {
    const year = parseYear(r.reference_period_start);
    const price = toNumber(r[priceCol]);
    if (!year || price === null) continue;

    const commodity = commodityCol ? (r[commodityCol] || "Unknown").trim() : "All";
    const market = marketCol ? (r[marketCol] || "All").trim() : "All";
    const key = `${commodity}||${market}`;

    if (!series.has(key)) series.set(key, new Map());
    const byYear = series.get(key);

    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(price);
  }

  // Build YoY% samples
  const pctChanges = [];

  for (const [, byYear] of series) {
    const yearly = Array.from(byYear, ([year, prices]) => ({
      year,
      avg: d3.mean(prices),
    })).sort((a, b) => a.year - b.year);

    if (yearly.length < 2) continue;

    for (let i = 1; i < yearly.length; i++) {
      const prev = yearly[i - 1].avg;
      const cur = yearly[i].avg;
      if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) continue;

      const pct = ((cur - prev) / prev) * 100;
      if (Number.isFinite(pct)) pctChanges.push(pct);
    }
  }

  if (pctChanges.length === 0) {
    g.marks.append("text")
      .attr("x", 20)
      .attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text("Not enough data to compute price changes.");
    return;
  }

  // Layout
  const margin = { top: 20, right: 20, bottom: 44, left: 64 };
  const w = Math.max(10, width - margin.left - margin.right);
  const h = Math.max(10, height - margin.top - margin.bottom);
  const chart = g.root.attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(pctChanges))
    .nice()
    .range([0, w]);

  const bins = d3.bin()
    .domain(x.domain())
    .thresholds(18)(pctChanges);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([h, 0]);

  // Axes
  const xAxis = d3.axisBottom(x).ticks(6);
  const yAxis = d3.axisLeft(y).ticks(6);

  const gx = chart.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(xAxis);

  const gy = chart.append("g")
    .call(yAxis);

  gx.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 11);
  gy.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 11);
  gx.selectAll("path,line").attr("stroke", "rgba(148,163,184,.25)");
  gy.selectAll("path,line").attr("stroke", "rgba(148,163,184,.25)");

  // Labels
  chart.append("text")
    .attr("x", 0)
    .attr("y", -6)
    .attr("fill", theme.text)
    .attr("font-size", 12)
    .attr("font-weight", 600)
    .text("Distribution of year-to-year food price changes (%)");


  chart.append("text")
    .attr("x", w / 2)
    .attr("y", h + 36)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .attr("text-anchor", "middle")
    .text("Year-to-year change in food prices (%)");

  chart.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -46)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .attr("text-anchor", "middle")
    .text("Frequency");

  // Zero line
  chart.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", 0)
    .attr("y2", h)
    .attr("stroke", "rgba(148,163,184,.35)")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4,4");

  // Interpretation note (top-right, no overlap)
  chart.append("text")
    .attr("x", w)
    .attr("y", 12)
    .attr("fill", theme.context)
    .attr("font-size", 10)
    .attr("text-anchor", "end")
    .text("Right tail = price spikes · Left tail = price drops");

  // ---------- Tooltip (shared) ----------
  let tip = document.getElementById("viz-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "viz-tooltip";
    tip.style.position = "fixed";
    tip.style.zIndex = "9999";
    tip.style.pointerEvents = "none";
    tip.style.background = "rgba(2,6,23,.92)";
    tip.style.border = "1px solid rgba(148,163,184,.25)";
    tip.style.borderRadius = "10px";
    tip.style.padding = "8px 10px";
    tip.style.color = theme.text;
    tip.style.fontFamily = "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    tip.style.fontSize = "12px";
    tip.style.boxShadow = "0 12px 30px rgba(0,0,0,.55)";
    tip.style.display = "none";
    document.body.appendChild(tip);
  }

  const fmt1 = d3.format(".1f");

  function showTip(event, bin) {
    const x0 = fmt1(bin.x0);
    const x1 = fmt1(bin.x1);
    const n = bin.length;

    tip.innerHTML = `
  <div style="font-weight:600; margin-bottom:2px;">
    Price change compared to the previous year
  </div>
  <div style="color:${theme.mutedText};">
    ${x0}% to ${x1}%
  </div>
  <div style="margin-top:6px;">
    <span style="color:${theme.mutedText};">Number of observations:</span> ${n}
  </div>
`;


    const pad = 12;
    const tx = Math.min(window.innerWidth - 220, event.clientX + pad);
    const ty = Math.min(window.innerHeight - 90, event.clientY + pad);
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
    tip.style.display = "block";
  }

  function hideTip() {
    tip.style.display = "none";
  }

  // Bars (with tooltip)
  chart.selectAll(".bar")
    .data(bins)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.x0) + 1)
    .attr("y", d => y(d.length))
    .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr("height", d => h - y(d.length))
    .attr("fill", markColor("context"))
    .attr("opacity", 0.35)
    .attr("stroke", markColor("shock"))
    .attr("stroke-width", 1.5)
    .on("mouseenter", function (event, d) {
      // emphasize hovered bar (still within palette)
      d3.select(this)
        .attr("opacity", 0.55)
        .attr("stroke-width", 2.2);
      showTip(event, d);
    })
    .on("mousemove", function (event, d) {
      showTip(event, d);
    })
    .on("mouseleave", function () {
      d3.select(this)
        .attr("opacity", 0.35)
        .attr("stroke-width", 1.5);
      hideTip();
    });
}
