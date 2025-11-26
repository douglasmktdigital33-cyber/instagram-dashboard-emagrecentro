/* script.js - versão premium, compacta e otimizada
   Lê o CSV publicado (link da sua planilha), agrega e desenha UI + charts.
*/

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjDEbxS9ieNObM4lVDYcZ_E9tzuDvf92I8e0VEJCrkByw2r9gHUiUsWWGkE65J97dkiO0Ind8GEoju/pub?gid=308040371&single=true&output=csv";

let latestRows = [];
let chartDirects = null, chartRespostas = null, chartPie = null;
let autoRefreshTimer = null;
const AUTO_REFRESH_MS = 30_000;

// helper: numbers robustos
const toNum = v => {
  if (v === undefined || v === null || v === "") return 0;
  // remove non-digit except comma/dot
  const s = String(v).replace(/[^\d\-,.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

// fetch + parse (cache-bust)
async function fetchCSV() {
  const url = CSV_URL + "&_=" + Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao buscar CSV: " + res.status);
  const txt = await res.text();
  // PapaParse might be loaded; fallback to manual parse if not
  if (window.Papa) {
    const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
    return parsed.data;
  }
  // very simple CSV fallback
  const lines = txt.trim().split("\n").map(l => l.split(","));
  const headers = lines.shift().map(h => h.trim());
  return lines.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] ? row[i].trim() : "");
    return obj;
  });
}

// normalize key access (case-insensitive)
function val(row, keyCandidates) {
  for (const k of keyCandidates) {
    if (row[k] !== undefined) return row[k];
    if (row[k.toLowerCase()] !== undefined) return row[k.toLowerCase()];
    if (row[k.toUpperCase()] !== undefined) return row[k.toUpperCase()];
  }
  return "";
}

// aggregate totals
function aggregate(rows) {
  const tot = { Directs:0, Respostas:0, Agendamentos:0, Comparecimentos:0, Vendas:0 };
  rows.forEach(r => {
    tot.Directs += toNum(val(r, ["Directs","DIRECTS","directs"]));
    tot.Respostas += toNum(val(r, ["Respostas","RESPOSTAS","respostas"]));
    tot.Agendamentos += toNum(val(r, ["Agendamentos","AGENDAMENTOS","agendamentos"]));
    tot.Comparecimentos += toNum(val(r, ["Comparecimentos","COMPARECIMENTOS","comparecimentos"]));
    tot.Vendas += toNum(val(r, ["Vendas","VENDAS","vendas"]));
  });
  return tot;
}

// per-unit map
function unitsMap(rows) {
  const map = {};
  rows.forEach(r => {
    const unidade = (val(r, ["Unidade","UNIDADE","unidade"]) || "Sem Unidade").trim();
    if (!map[unidade]) map[unidade] = { Unidade: unidade, Directs:0, Respostas:0, Agendamentos:0, Comparecimentos:0, Vendas:0 };
    map[unidade].Directs += toNum(val(r, ["Directs"]));
    map[unidade].Respostas += toNum(val(r, ["Respostas"]));
    map[unidade].Agendamentos += toNum(val(r, ["Agendamentos"]));
    map[unidade].Comparecimentos += toNum(val(r, ["Comparecimentos"]));
    map[unidade].Vendas += toNum(val(r, ["Vendas"]));
  });
  return Object.values(map);
}

// update UI cards (totals and delta vs avg)
function updateKPIs(rows) {
  const tot = aggregate(rows);
  const units = unitsMap(rows);
  const avg = units.length ? {
    Directs: Math.round(units.reduce((s,u)=>s+u.Directs,0)/units.length) : 0,
    Respostas: Math.round(units.reduce((s,u)=>s+u.Respostas,0)/units.length) : 0,
    Agendamentos: Math.round(units.reduce((s,u)=>s+u.Agendamentos,0)/units.length) : 0,
    Comparecimentos: Math.round(units.reduce((s,u)=>s+u.Comparecimentos,0)/units.length) : 0,
    Vendas: Math.round(units.reduce((s,u)=>s+u.Vendas,0)/units.length) : 0
  } : {Directs:0,Respostas:0,Agendamentos:0,Comparecimentos:0,Vendas:0};

  // totals
  document.getElementById("kpi-directs-total").innerText = tot.Directs;
  document.getElementById("kpi-respostas-total").innerText = tot.Respostas;
  document.getElementById("kpi-agend-total").innerText = tot.Agendamentos;
  document.getElementById("kpi-comp-total").innerText = tot.Comparecimentos;
  document.getElementById("kpi-vendas-total").innerText = tot.Vendas;
  const conv = tot.Directs>0 ? ((tot.Respostas/tot.Directs)*100).toFixed(1) : "0.0";
  document.getElementById("kpi-conv-total").innerText = conv + "%";

  // deltas vs média
  function deltaHtml(value, avgVal) {
    if (avgVal === 0) return "";
    const pct = ((value - avgVal) / avgVal) * 100;
    const sign = pct >= 0 ? "+" : "";
    const cls = pct >= 0 ? "delta-up" : "delta-down";
    return `<span class="${cls}">${sign}${pct.toFixed(1)}%</span>`;
  }

  document.getElementById("kpi-directs-delta").innerHTML = deltaHtml(tot.Directs, avg.Directs);
  document.getElementById("kpi-respostas-delta").innerHTML = deltaHtml(tot.Respostas, avg.Respostas);
  document.getElementById("kpi-agend-delta").innerHTML = deltaHtml(tot.Agendamentos, avg.Agendamentos);
  document.getElementById("kpi-comp-delta").innerHTML = deltaHtml(tot.Comparecimentos, avg.Comparecimentos);
  document.getElementById("kpi-vendas-delta").innerHTML = deltaHtml(tot.Vendas, avg.Vendas);
  document.getElementById("kpi-conv-delta").innerHTML = "";
}

// fill filter select
function fillFilter(units) {
  const sel = document.getElementById("unitFilter");
  const current = sel.value || "Todas";
  sel.innerHTML = `<option value="Todas">Todas Unidades</option>`;
  units.forEach(u => sel.insertAdjacentHTML("beforeend", `<option value="${u.Unidade}">${u.Unidade}</option>`));
  if ([...sel.options].some(o=>o.value===current)) sel.value = current;
}

// fill unit cards (selected)
function fillUnitCards(units, selected) {
  if (!selected || selected === "Todas") {
    document.getElementById("kpi-directs-unit").innerText = "-";
    document.getElementById("kpi-respostas-unit").innerText = "-";
    document.getElementById("kpi-agend-unit").innerText = "-";
    document.getElementById("kpi-comp-unit").innerText = "-";
    document.getElementById("kpi-vendas-unit").innerText = "-";
    document.getElementById("kpi-conv-unit").innerText = "-";
    return;
  }
  const u = units.find(x => x.Unidade === selected);
  if (!u) return fillUnitCards(units, "Todas");
  document.getElementById("kpi-directs-unit").innerText = u.Directs;
  document.getElementById("kpi-respostas-unit").innerText = u.Respostas;
  document.getElementById("kpi-agend-unit").innerText = u.Agendamentos;
  document.getElementById("kpi-comp-unit").innerText = u.Comparecimentos;
  document.getElementById("kpi-vendas-unit").innerText = u.Vendas;
  const c = u.Directs>0 ? ((u.Respostas/u.Directs)*100).toFixed(1) : "0.0";
  document.getElementById("kpi-conv-unit").innerText = c + "%";
}

// table
function fillTable(units) {
  const tbody = document.querySelector("#unitsTable tbody");
  tbody.innerHTML = "";
  units.sort((a,b)=>b.Directs - a.Directs);
  units.forEach(u=>{
    const conv = u.Directs>0 ? ((u.Respostas/u.Directs)*100).toFixed(1) : "0.0";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${u.Unidade}</td>
      <td>${u.Directs}</td>
      <td>${u.Respostas}</td>
      <td>${u.Agendamentos}</td>
      <td>${u.Comparecimentos}</td>
      <td>${u.Vendas}</td>
      <td>${conv}%</td>`;
    tbody.appendChild(tr);
  });
}

// charts (top N for readability)
function drawCharts(units) {
  const top = [...units].sort((a,b)=>b.Directs - a.Directs).slice(0,10);
  const labels = top.map(u=>u.Unidade);
  const dataDirects = top.map(u=>u.Directs);
  const dataRespostas = top.map(u=>u.Respostas);
  const pieLabels = units.map(u=>u.Unidade);
  const pieData = units.map(u=>u.Respostas);

  // Directs bar
  const ctxD = document.getElementById("chartDirects").getContext("2d");
  if (chartDirects) chartDirects.destroy();
  chartDirects = new Chart(ctxD, {
    type: "bar",
    data: { labels, datasets: [{ label:"Directs", data:dataDirects, backgroundColor:"#00b7c9" }] },
    options: { maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });

  // Respostas bar
  const ctxR = document.getElementById("chartRespostas").getContext("2d");
  if (chartRespostas) chartRespostas.destroy();
  chartRespostas = new Chart(ctxR, {
    type: "bar",
    data: { labels, datasets: [{ label:"Respostas", data:dataRespostas, backgroundColor:"#18e6b4" }] },
    options: { maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });

  // Pie (distribution respostas) - limit to 12 labels for readability
  const pieLabelsLimited = pieLabels.slice(0,12);
  const pieDataLimited = pieData.slice(0,12);
  const ctxP = document.getElementById("chartPie").getContext("2d");
  if (chartPie) chartPie.destroy();
  chartPie = new Chart(ctxP, {
    type: "pie",
    data: { labels: pieLabelsLimited, datasets: [{ data: pieDataLimited, backgroundColor: generateColors(pieDataLimited.length) }]},
    options: { maintainAspectRatio:false, plugins:{legend:{position:"bottom", labels:{boxWidth:12}}} }
  });
}

// generate palette
function generateColors(n) {
  const palette = ["#00b7c9","#18e6b4","#2d8cff","#ffd166","#ff8fa3","#a178ff","#7de3ff","#4dd8a6","#f7b267","#9be7ff","#8fbf87","#ffb27d"];
  const out = [];
  for (let i=0;i<n;i++) out.push(palette[i % palette.length]);
  return out;
}

// main update pipeline
async function updateAll(force=false) {
  try {
    const rows = await fetchCSV();
    latestRows = rows;
    const units = unitsMap(rows);
    updateKPIs(rows);
    fillFilter(units);
    fillTable(units);
    drawCharts(units);

    // update unit cards if selected
    const sel = document.getElementById("unitFilter").value || "Todas";
    fillUnitCards(units, sel);
  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);
  }
}

// debounce & events
let debounceTimer = null;
document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("refreshBtn").addEventListener("click", ()=> updateAll(true));
  document.getElementById("unitFilter").addEventListener("change", ()=>{
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(()=>{
      const units = unitsMap(latestRows);
      const sel = document.getElementById("unitFilter").value || "Todas";
      fillUnitCards(units, sel);
    }, 200);
  });

  // initial load
  updateAll();

  // auto refresh
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(()=> updateAll(true), AUTO_REFRESH_MS);
});
