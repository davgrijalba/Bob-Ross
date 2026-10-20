// Bob Ross style dashboard.
// All data is loaded at runtime from dashboard_data/*.csv (never embedded here).
// The CSV files are written by scripts/prepare_data.py (see dashboard_data/PROVENANCE.md).

const DATA_DIR = "dashboard_data/";
const FILES = {
  shares: "element_share_by_season.csv",
  changes: "element_change_summary.csv",
  seasons: "season_summary.csv",
  episodes: "episodes.csv",
};

// Duke palette (course duke-figures skill). All have at least 3:1 contrast on white.
const COLORS = {
  navy: "#012169",
  copper: "#C84E00",
  shale: "#0577B1",
  graphite: "#666666",
  ink: "#262626",
  muted: "#5c5c5c",
  grid: "#E5E5E5",
};
const HEATMAP_ELEMENTS = 20;

const state = { changeView: "clear", element: null };
const charts = {};
const data = {};

// ---------- Loading ----------

function loadCsv(fileName) {
  return fetch(DATA_DIR + fileName).then(function (response) {
    if (!response.ok) {
      throw new Error("Could not load " + fileName + " (HTTP " + response.status + ")");
    }
    return response.text();
  }).then(function (text) {
    return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
  });
}

function setStatus(message, isError) {
  const status = document.getElementById("load-status");
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

// ---------- Helpers ----------

function textStyle() {
  return { fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", color: COLORS.ink };
}

function makeChart(id) {
  charts[id] = echarts.init(document.getElementById(id), null, { renderer: "svg" });
  return charts[id];
}

function isNarrow(id) {
  return document.getElementById(id).clientWidth < 600;
}

function signed(value) {
  return (value > 0 ? "+" : "") + value.toFixed(1);
}

function pct(value) {
  return value.toFixed(1) + "%";
}

function setPressed(attribute, value) {
  document.querySelectorAll("[" + attribute + "]").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.getAttribute(attribute) === value));
  });
}

// ---------- KPIs ----------

function renderKpis() {
  const analysed = data.seasons.reduce(function (sum, row) { return sum + row.paintings_analysed; }, 0);
  document.getElementById("kpi-paintings").textContent = String(analysed);
  document.getElementById("kpi-paintings-label").textContent =
    "Bob Ross paintings analysed, " + data.seasons.length + " seasons";

  const clear = data.changes.filter(function (row) { return row.direction !== "no clear change"; });
  let biggestFall = null;
  let biggestRise = null;
  clear.forEach(function (row) {
    if (row.direction === "fell" && (!biggestFall || row.change_pct_points < biggestFall.change_pct_points)) { biggestFall = row; }
    if (row.direction === "rose" && (!biggestRise || row.change_pct_points > biggestRise.change_pct_points)) { biggestRise = row; }
  });
  if (biggestFall) {
    document.getElementById("kpi-fall").textContent = biggestFall.element_label;
    document.getElementById("kpi-fall-label").textContent = "Biggest clear drop: " +
      pct(biggestFall.pct_seasons_1_15) + " → " + pct(biggestFall.pct_seasons_16_31) + " of paintings";
  }
  if (biggestRise) {
    document.getElementById("kpi-rise").textContent = biggestRise.element_label;
    document.getElementById("kpi-rise-label").textContent = "Biggest clear rise: " +
      pct(biggestRise.pct_seasons_1_15) + " → " + pct(biggestRise.pct_seasons_16_31) + " of paintings";
  }
}

// ---------- 1. What changed ----------

function renderChange() {
  let rows = data.changes.slice();
  if (state.changeView === "clear") {
    rows = rows.filter(function (row) { return row.direction !== "no clear change"; });
  }
  // Largest rise at the top, largest fall at the bottom.
  rows.sort(function (a, b) { return b.change_pct_points - a.change_pct_points; });

  const rose = rows.filter(function (row) { return row.direction === "rose"; }).length;
  const fell = rows.filter(function (row) { return row.direction === "fell"; }).length;
  const allClear = data.changes.filter(function (row) { return row.direction !== "no clear change"; });
  const fellNames = allClear.filter(function (row) { return row.direction === "fell"; })
    .sort(function (a, b) { return a.change_pct_points - b.change_pct_points; })
    .slice(0, 3).map(function (row) { return row.element_label.toLowerCase(); });
  document.getElementById("change-finding").textContent =
    "Of " + data.changes.length + " elements, " + allClear.filter(function (r) { return r.direction === "fell"; }).length +
    " clearly fell and " + allClear.filter(function (r) { return r.direction === "rose"; }).length +
    " clearly rose after season 15. The biggest drops: " + fellNames.slice(0, -1).join(", ") +
    " and " + fellNames[fellNames.length - 1] + ".";

  const narrow = isNarrow("change-chart");
  const chartElement = document.getElementById("change-chart");
  chartElement.style.height = Math.max(360, rows.length * 26 + 80) + "px";
  charts["change-chart"].resize();

  charts["change-chart"].setOption({
    textStyle: textStyle(),
    grid: { left: narrow ? 130 : 200, right: narrow ? 56 : 72, top: 16, bottom: 44 },
    tooltip: {
      trigger: "item",
      formatter: function (params) {
        const row = rows[params.dataIndex];
        return "<strong>" + row.element_label + "</strong> (" + row.category + ")<br>" +
          "Seasons 1–15: " + pct(row.pct_seasons_1_15) + " of paintings<br>" +
          "Seasons 16–31: " + pct(row.pct_seasons_16_31) + "<br>" +
          "Change: " + signed(row.change_pct_points) + " points (z = " + row.z_score.toFixed(2) + ")<br>" +
          (row.direction === "no clear change" ? "No clear change" : "Clear change: " + row.direction);
      },
    },
    xAxis: {
      type: "value", name: "Change in % of paintings (points)", nameLocation: "middle", nameGap: 28,
      // Leave room beyond the longest bars for their labels.
      min: function (extent) { return Math.floor((extent.min - 6) / 5) * 5; },
      max: function (extent) { return Math.ceil((extent.max + 6) / 5) * 5; },
      nameTextStyle: { fontSize: 14 }, splitNumber: narrow ? 3 : 6,
      axisLabel: { fontSize: 13, hideOverlap: true, formatter: function (v) { return (v > 0 ? "+" : "") + v.toFixed(0); } },
      splitLine: { lineStyle: { color: COLORS.grid } },
    },
    yAxis: {
      type: "category", inverse: true, data: rows.map(function (row) { return row.element_label; }),
      axisLabel: { fontSize: narrow ? 12 : 14, width: (narrow ? 130 : 200) - 12, overflow: "truncate" },
      axisTick: { show: false }, axisLine: { show: false },
    },
    series: [{
      type: "bar", barMaxWidth: 18,
      data: rows.map(function (row) {
        let color = COLORS.graphite;
        if (row.direction === "rose") { color = COLORS.copper; }
        if (row.direction === "fell") { color = COLORS.navy; }
        return { value: row.change_pct_points, itemStyle: { color: color } };
      }),
      label: {
        show: true, fontSize: 13, color: COLORS.ink,
        position: "right",
        formatter: function (params) { return signed(params.value); },
      },
      labelLayout: function (params) {
        // Put labels of negative bars on the left end of the bar.
        const value = rows[params.dataIndex].change_pct_points;
        if (value < 0) { return { x: params.rect.x - 6, align: "right" }; }
        return {};
      },
      markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: COLORS.ink, width: 1, type: "solid" }, data: [{ xAxis: 0 }] },
    }],
  }, true);

  chartElement.setAttribute("aria-label", "Bar chart of the change in share of paintings for " + rows.length +
    " elements between seasons 1 to 15 and 16 to 31; " + rose + " rose and " + fell + " fell clearly.");
}

// ---------- 2. Element explorer ----------

function fillElementSelect() {
  const select = document.getElementById("element-select");
  const byCategory = {};
  data.changes.forEach(function (row) {
    if (!byCategory[row.category]) { byCategory[row.category] = []; }
    byCategory[row.category].push(row);
  });
  Object.keys(byCategory).sort().forEach(function (category) {
    const group = document.createElement("optgroup");
    group.label = category;
    byCategory[category].sort(function (a, b) { return a.element_label.localeCompare(b.element_label); })
      .forEach(function (row) {
        const option = document.createElement("option");
        option.value = row.element;
        option.textContent = row.element_label;
        group.appendChild(option);
      });
    select.appendChild(group);
  });
  // Start with the element that changed most clearly (most extreme z-score).
  let start = data.changes[0];
  data.changes.forEach(function (row) { if (Math.abs(row.z_score) > Math.abs(start.z_score)) { start = row; } });
  state.element = start.element;
  select.value = state.element;
}

function renderElement() {
  const summary = data.changes.find(function (row) { return row.element === state.element; });
  const rows = data.shares.filter(function (row) { return row.element === state.element; })
    .sort(function (a, b) { return a.season - b.season; });

  let verdict = "There is no clear change between the two halves.";
  if (summary.direction === "fell") { verdict = "That is a clear drop."; }
  if (summary.direction === "rose") { verdict = "That is a clear rise."; }
  document.getElementById("element-finding").textContent =
    summary.element_label + " appeared in " + pct(summary.pct_seasons_1_15) + " of paintings in seasons 1–15 and " +
    pct(summary.pct_seasons_16_31) + " in seasons 16–31 (" + signed(summary.change_pct_points) + " points). " + verdict +
    " Its peak was season " + summary.peak_season + " (" + pct(summary.peak_season_pct) + ").";

  charts["element-chart"].setOption({
    textStyle: textStyle(),
    grid: { left: 52, right: 24, top: 36, bottom: 40 },
    tooltip: {
      trigger: "axis", axisPointer: { type: "shadow" },
      formatter: function (params) {
        const row = rows[params[0].dataIndex];
        return "<strong>Season " + row.season + "</strong><br>" + row.paintings_with_element + " of " +
          row.paintings_in_season + " paintings (" + pct(row.pct_of_paintings) + ")";
      },
    },
    xAxis: { type: "category", data: rows.map(function (row) { return row.season; }), name: "Season",
      nameLocation: "middle", nameGap: 26, axisLabel: { fontSize: 13 } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { fontSize: 13, formatter: "{value}%" },
      splitLine: { lineStyle: { color: COLORS.grid } } },
    series: [{
      type: "bar", barWidth: "65%",
      data: rows.map(function (row) { return row.pct_of_paintings; }),
      itemStyle: { color: COLORS.shale },
      markLine: {
        silent: true, symbol: "none",
        lineStyle: { type: "dashed", width: 2.5 },
        label: { fontSize: 13, fontWeight: "bold", position: "insideEndTop", backgroundColor: "rgba(255,255,255,0.9)", padding: [2, 4], borderRadius: 3 },
        data: [
          [{ coord: ["1", summary.pct_seasons_1_15], lineStyle: { color: COLORS.navy },
             label: { formatter: "Seasons 1–15: " + pct(summary.pct_seasons_1_15), color: COLORS.navy } },
           { coord: ["15", summary.pct_seasons_1_15] }],
          [{ coord: ["16", summary.pct_seasons_16_31], lineStyle: { color: COLORS.copper },
             label: { formatter: "Seasons 16–31: " + pct(summary.pct_seasons_16_31), color: COLORS.copper } },
           { coord: ["31", summary.pct_seasons_16_31] }],
        ],
      },
    }],
  }, true);
  document.getElementById("element-chart").setAttribute("aria-label",
    "Bar chart of the share of paintings containing " + summary.element_label + " in each of the 31 seasons");
}

// ---------- 3. Heatmap ----------

function renderHeatmap() {
  // The 20 most common scene elements overall (frames excluded), most common at the top.
  const top = data.changes.filter(function (row) { return row.category !== "Frames"; })
    .sort(function (a, b) { return b.pct_all_seasons - a.pct_all_seasons; })
    .slice(0, HEATMAP_ELEMENTS);
  const elementCodes = top.map(function (row) { return row.element; });
  const labels = top.map(function (row) { return row.element_label; });
  const seasons = Array.from(new Set(data.shares.map(function (row) { return row.season; }))).sort(function (a, b) { return a - b; });

  const cells = [];
  data.shares.forEach(function (row) {
    const y = elementCodes.indexOf(row.element);
    if (y >= 0) { cells.push([seasons.indexOf(row.season), y, row.pct_of_paintings]); }
  });

  // Finding: the most common element, and its lowest season share.
  const first = top[0];
  const firstRows = data.shares.filter(function (row) { return row.element === first.element; });
  let lowest = firstRows[0];
  firstRows.forEach(function (row) { if (row.pct_of_paintings < lowest.pct_of_paintings) { lowest = row; } });
  document.getElementById("heat-finding").textContent =
    "The constant: " + first.element_label.toLowerCase() + " appears in " + pct(first.pct_all_seasons) +
    " of all his paintings and never drops below " + pct(lowest.pct_of_paintings) + " in any season (season " + lowest.season + ").";

  const narrow = isNarrow("heat-chart");
  charts["heat-chart"].setOption({
    textStyle: textStyle(),
    grid: { left: narrow ? 120 : 190, right: 16, top: 8, bottom: 84 },
    tooltip: {
      formatter: function (params) {
        return "<strong>" + labels[params.value[1]] + "</strong><br>Season " + seasons[params.value[0]] +
          ": " + pct(params.value[2]) + " of paintings";
      },
    },
    xAxis: { type: "category", data: seasons, name: "Season", nameLocation: "middle", nameGap: 26,
      axisLabel: { fontSize: narrow ? 10 : 12, interval: narrow ? 2 : 0 }, splitArea: { show: false } },
    yAxis: { type: "category", data: labels, inverse: true,
      axisLabel: { fontSize: narrow ? 11 : 13, width: (narrow ? 120 : 190) - 10, overflow: "truncate" } },
    visualMap: {
      min: 0, max: 100, calculable: false, orient: "horizontal", left: "center", bottom: 0,
      itemWidth: 14, itemHeight: narrow ? 160 : 240, text: ["100%", "0%"], textStyle: { fontSize: 12 },
      inRange: { color: ["#FFFFFF", "#E2E6ED", "#0577B1", "#012169"] },
    },
    series: [{
      type: "heatmap", data: cells,
      itemStyle: { borderColor: "#FFFFFF", borderWidth: 1 },
      emphasis: { itemStyle: { borderColor: COLORS.copper, borderWidth: 2 } },
    }],
  }, true);
}

// ---------- 4. Complexity and frames ----------

function renderSeasons() {
  const rows = data.seasons.slice().sort(function (a, b) { return a.season - b.season; });
  const firstFramed = rows.find(function (row) { return row.pct_framed > 0; });
  let busiest = rows[0];
  let simplest = rows[0];
  rows.forEach(function (row) {
    if (row.avg_scene_elements > busiest.avg_scene_elements) { busiest = row; }
    if (row.avg_scene_elements < simplest.avg_scene_elements) { simplest = row; }
  });
  document.getElementById("season-finding").textContent =
    "Frames first appear in season " + firstFramed.season + ". Paintings were busiest in season " + busiest.season +
    " (" + busiest.avg_scene_elements.toFixed(1) + " scene elements on average) and simplest in season " +
    simplest.season + " (" + simplest.avg_scene_elements.toFixed(1) + ").";

  charts["season-chart"].setOption({
    textStyle: textStyle(),
    grid: { left: 52, right: 56, top: 48, bottom: 40 },
    legend: { top: 0, left: 0, textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: rows.map(function (row) { return row.season; }), name: "Season",
      nameLocation: "middle", nameGap: 26, axisLabel: { fontSize: 13 } },
    yAxis: [
      { type: "value", min: 0, max: 100, axisLabel: { fontSize: 13, formatter: "{value}%" },
        splitLine: { lineStyle: { color: COLORS.grid } } },
      { type: "value", min: 0, max: 12, axisLabel: { fontSize: 13 }, splitLine: { show: false } },
    ],
    series: [
      { name: "Paintings with a frame (%)", type: "bar", yAxisIndex: 0, barWidth: "60%",
        data: rows.map(function (row) { return row.pct_framed; }), itemStyle: { color: COLORS.copper },
        tooltip: { valueFormatter: function (v) { return pct(v); } } },
      { name: "Scene elements per painting (right axis)", type: "line", yAxisIndex: 1, symbol: "circle", symbolSize: 8,
        data: rows.map(function (row) { return row.avg_scene_elements; }),
        lineStyle: { width: 3, color: COLORS.navy }, itemStyle: { color: COLORS.navy },
        tooltip: { valueFormatter: function (v) { return v.toFixed(1); } } },
    ],
  }, true);
}

// ---------- 5. Episode table ----------

let episodeGrid = null;

function renderEpisodes() {
  const rows = data.episodes.map(function (row) {
    let status = "Analysed";
    if (row.painted_by !== "Bob Ross") { status = "Excluded: guest"; }
    else if (row.nothing_recorded === true || row.nothing_recorded === "True") { status = "Excluded: nothing recorded"; }
    return {
      code: row.episode_code, season: row.season, title: row.title, paintedBy: row.painted_by,
      status: status, elements: row.scene_elements, framed: row.framed === 1 ? "Yes" : "No",
      list: row.elements || "",
    };
  });
  episodeGrid = agGrid.createGrid(document.getElementById("episode-grid"), {
    rowData: rows,
    columnDefs: [
      { field: "code", headerName: "Episode", flex: 0, width: 115 },
      { field: "title", headerName: "Title", minWidth: 200 },
      { field: "paintedBy", headerName: "Painted by", minWidth: 150 },
      { field: "status", headerName: "In charts?", minWidth: 190 },
      { field: "elements", headerName: "Scene elements", flex: 0, width: 150, type: "rightAligned" },
      { field: "framed", headerName: "Framed", flex: 0, width: 110 },
      { field: "list", headerName: "Elements", minWidth: 320, tooltipField: "list" },
    ],
    defaultColDef: { flex: 1, sortable: true, resizable: true, filter: true },
  });
  document.getElementById("episode-search").addEventListener("input", function (event) {
    episodeGrid.setGridOption("quickFilterText", event.target.value);
  });
}

// ---------- Wiring ----------

function wireControls() {
  document.querySelectorAll("[data-change-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.changeView = button.getAttribute("data-change-view");
      setPressed("data-change-view", state.changeView);
      renderChange();
    });
  });
  document.getElementById("element-select").addEventListener("change", function (event) {
    state.element = event.target.value;
    renderElement();
  });
  window.addEventListener("resize", function () {
    Object.keys(charts).forEach(function (id) { charts[id].resize(); });
    renderChange();
    renderHeatmap();
  });
}

Promise.all(Object.keys(FILES).map(function (key) {
  return loadCsv(FILES[key]).then(function (rows) { data[key] = rows; });
})).then(function () {
  if (typeof echarts === "undefined" || typeof agGrid === "undefined") {
    throw new Error("The chart libraries did not load (check your internet connection or a content blocker)");
  }
  setStatus("");
  renderKpis();
  makeChart("change-chart"); renderChange();
  makeChart("element-chart"); fillElementSelect(); renderElement();
  makeChart("heat-chart"); renderHeatmap();
  makeChart("season-chart"); renderSeasons();
  renderEpisodes();
  wireControls();
}).catch(function (error) {
  const hint = error.message.indexOf("Could not load") === 0
    ? ". If you opened index.html as a file, open it through a web server instead (for example: python -m http.server)."
    : ".";
  setStatus(error.message + hint, true);
  console.error(error);
});
