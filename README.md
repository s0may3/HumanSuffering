# Afghan Migration — Data-Driven Storytelling Website

This project is a data-driven storytelling website built with **HTML, CSS, JavaScript, and D3.js**.
It presents Afghan migration as a **multi-stage human process**, moving from pressure and
displacement to routes, destinations, hosting, and long-term outcomes.

The website is designed for **exploratory and explanatory visualization**, not prediction
or causal modeling.

---

## 1) Run the website locally

This is a static website. No build step is required.

### Option A — Python (recommended)
From the repository root:

python3 -m http.server 8080

Open in your browser:

http://localhost:8080

### Option B — Node.js
npx serve .

---

## 2) Preprocessing and reproducibility

All visualizations are based on **lightweight, transparent preprocessing**.
Raw humanitarian datasets are transformed into **processed CSV files** that are used
directly by the visualizations.

Preprocessing is implemented as **Jupyter notebooks** and is fully reproducible.

### What preprocessing does
- Parses numeric values and dates from raw CSV files
- Extracts and normalizes years from heterogeneous date formats
- Aggregates records by year, province, or destination depending on the section
- Filters invalid or non-informative rows (e.g. missing year, non-positive counts)

No statistical imputation or prediction is performed.

---

## 2.1 Raw input data

Raw datasets should be placed in the following directory:

dataset/

Raw inputs (from HDX HAPI Afghanistan):

- hdx_hapi_refugees_afg.csv
- hdx_hapi_idps_afg.csv
- hdx_hapi_food_price_afg.csv
- hdx_hapi_returnees_afg.csv

Geographic files:

- dataset/geo/afghanistan_adm1.geojson
- dataset/geo/world_countries.topojson

---

## 2.2 Run preprocessing notebooks

Preprocessing notebooks are provided as a ZIP archive:

notebooks/jupyter_preprocess_notebooks_v2.zip

Workflow:
1. Unzip the archive
2. Open Jupyter (jupyter lab or jupyter notebook)
3. Open any notebook
4. Run all cells

The notebooks generate **processed CSV files** used by the website.

---

## 3) Folder structure

.
├─ index.html
├─ js/
│  ├─ app.js
│  ├─ scroll.js
│  ├─ data.js
│  ├─ theme.js
│  └─ sections/
│     ├─ overview.js
│     ├─ shocks.js
│     ├─ idps.js
│     ├─ flows.js
│     ├─ destinations.js
│     └─ protection.js
├─ dataset/
│  ├─ hdx_hapi_refugees_afg.csv
│  ├─ hdx_hapi_idps_afg.csv
│  ├─ hdx_hapi_food_price_afg.csv
│  ├─ hdx_hapi_returnees_afg.csv
│  ├─ geo/
│  │  ├─ afghanistan_adm1.geojson
│  │  └─ world_countries.topojson
├─ data/
│  └─ processed/
│     ├─ outflow_by_year.csv
│     ├─ food_price_yoy_pct.csv
│     ├─ idps_latest_by_province.csv
│     ├─ destinations_yearly_top12.csv
│     └─ protection_composition_by_year.csv
└─ notebooks/
   └─ jupyter_preprocess_notebooks_v2.zip

---

## 4) Which visualization uses which data?

### Section 1 — Overview (overview.js)
- Input: data/processed/outflow_by_year.csv
- Derived from: dataset/hdx_hapi_refugees_afg.csv
- Description: Annual totals of Afghan refugee and asylum-seeker outflows.

### Section 2 — Shocks (shocks.js)
- Input: data/processed/food_price_yoy_pct.csv
- Derived from: dataset/hdx_hapi_food_price_afg.csv
- Description: Year-over-year food price changes, visualized as distributions over time.

### Section 3 — IDPs (idps.js)
- Input: data/processed/idps_latest_by_province.csv
- Derived from: dataset/hdx_hapi_idps_afg.csv
- Geo: dataset/geo/afghanistan_adm1.geojson
- Description: Latest provincial snapshot of internal displacement (admin-1).

### Section 4 — Flows (flows.js)
- Input: Derived in-browser from dataset/hdx_hapi_refugees_afg.csv
- Geo: dataset/geo/world_countries.topojson
- Description: Top destination countries and directional flows for the latest year.

### Section 5 — Destinations (destinations.js)
- Input: data/processed/destinations_yearly_top12.csv
- Derived from: dataset/hdx_hapi_refugees_afg.csv
- Description: Multi-year trends for the top 12 destination countries.

### Section 6 — Protection (protection.js)
- Input: data/processed/protection_composition_by_year.csv
- Derived from:
  - dataset/hdx_hapi_refugees_afg.csv
  - dataset/hdx_hapi_returnees_afg.csv
- Description: Yearly composition of displacement outcomes (Refugees, Asylum-seekers, Returnees),
  normalized to percentages.

---

## 5) Data sources

Primary data source:

HDX — HAPI Afghanistan  
https://data.humdata.org/dataset/hdx-hapi-afg

All datasets used in this project are publicly available humanitarian data.

---

## 6) Author

Somayyeh Eslami  
Data storytelling & web development
