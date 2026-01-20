// js/app.js
import { setupScroll } from "./scroll.js";
import { theme } from "./theme.js";

import * as overview from "./sections/overview.js";
import * as shocks from "./sections/shocks.js";
import * as idps from "./sections/idps.js";
import * as flows from "./sections/flows.js";
import * as destinations from "./sections/destinations.js";
import * as protection from "./sections/protection.js";

const viz = d3.select("#viz");
const gTitle = d3.select("#gTitle");
const gSub = d3.select("#gSub");
const gMode = d3.select("#gMode");

const legendEl = document.getElementById("legend");

const headerMap = {
  overview:     { title: "Overview — Migration pressure", sub: "Long-term trend.", pill: "OVERVIEW" },
  shocks:       { title: "Shocks — Economic stress", sub: "Histogram of volatility.", pill: "SHOCKS" },
  idps:         { title: "Inside Afghanistan — IDPs", sub: "Choropleth map (admin1).", pill: "IDPs" },
  routes:       { title: "Cross-border migration", sub: "Map + flow arrows + Sankey.", pill: "FLOWS" },
  destinations: { title: "Destinations", sub: "Top destinations + multi-year trend.", pill: "DESTINATIONS" },
  protection:   { title: "Return & protection", sub: "Outcome composition (100%).", pill: "PROTECTION" },
};

function setHeader(mode) {
  const h = headerMap[mode] || headerMap.overview;
  gTitle.text(h.title);
  gSub.text(h.sub);
  gMode.text(h.pill);
}

function setLegend(mode) {
  if (!legendEl) return;

  // Which global semantic badges should appear in each section?
  
  const visibleKeysByMode = {
    overview: [],
    shocks: [],
    idps: ["pressure", "context"],
    routes: ["route", "destination"],
    destinations: ["destination", "route", "pressure"],
    protection: [], //  turn OFF global legend in section 6
  };

  const visibleKeys = visibleKeysByMode[mode] || [];
  const legendShouldExist = visibleKeys.length > 0;

  legendEl.classList.toggle("is-hidden", !legendShouldExist);
  if (!legendShouldExist) return;

  const visible = new Set(visibleKeys);
  const badges = legendEl.querySelectorAll(".badge[data-key]");

  badges.forEach(b => {
    const key = b.getAttribute("data-key");
    b.classList.toggle("is-hidden", !visible.has(key));
  });
}

function makeSvg(mode) {
  viz.selectAll("*").remove();

  const r = viz.node().getBoundingClientRect();
  const width = Math.max(320, r.width);

  // More height for heavier sections
  const isMobile = window.innerWidth < 520;
  let height = isMobile ? 320 : 360;

  if (!isMobile) {
    if (mode === "routes") height = 560;
    if (mode === "protection") height = 460;
    if (mode === "idps") height = 460;
  } else {
    if (mode === "routes") height = 420;
    if (mode === "protection") height = 380;
    if (mode === "idps") height = 380;
  }

  const svg = viz.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = {
    root: svg.append("g"),
    marks: svg.append("g").attr("data-layer", "marks"),
    axes: svg.append("g").attr("data-layer", "axes"),
    anno: svg.append("g").attr("data-layer", "anno"),
    ui: svg.append("g").attr("data-layer", "ui"),
  };

  return { svg, g, width, height };
}

const sections = {
  overview,
  shocks,
  idps,
  routes: flows,
  destinations,
  protection,
};

let currentMode = null;
let ctx = { theme, ...makeSvg("overview") };

async function render(mode) {
  setHeader(mode);
  setLegend(mode);

  ctx = { theme, ...makeSvg(mode) };

  const mod = sections[mode] || sections.overview;
  await mod.update(ctx);
}

setupScroll((mode) => {
  if (mode === currentMode) return;
  currentMode = mode;
  render(mode);
});
