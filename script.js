/* script.js - versão "premium" que replica a estrutura do modelo
   - Carrega CSV público (link da planilha)
   - Normaliza colunas case-insensitive
   - Preenche KPIs, filtros, tabelas e gráficos
   - Atualiza a cada 30s (cache-bust)
*/

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjDEbxS9ieNObM4lVDYcZ_E9tzuDvf92I8e0VEJCrkByw2r9gHUiUsWWGkE65J97dkiO0Ind8GEoju/pub?gid=308040371&single=true&output=csv";

let rowsLatest = [];
let chartDirects=null, chartRespostas=null, chartPie=null;
const AUTO_MS = 30_000;

// helpers
const toNum = v => {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/[^\d\-,.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
};

function getVal(r, names){
  for (const n of names){
    if (r[n] !== undefined) return r[n];
    if (r[n.toLowerCase()] !== undefined) return r[n.toLowerCase()];
    if (r[n.toUpperCase()] !== undefined) return r[n.toUpperCase()];
  }
  return "";
}

// fetch & parse
async function fetchData(){
  const url = CSV_URL + "&_=" + Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro ao baixar CSV: " + res.status);
  const txt = await res.text();
  if (window.Papa) {
    const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
    return parsed.data;
  }
  // fallback
  const lines = txt.trim().split("\n").map(l=>l.split(","));
  const headers = lines.shift().map(h=>h.trim());
  return lines.map(r => {
    const obj = {};
    headers.forEach((h,i)=> obj[h] = r[i] ? r[i].trim() : "");
    return obj;
  });
}

// aggregate totals
function totals(rows){
  return rows.reduce((acc,r)=>{
    acc.Directs += toNum(getVal(r, ["Directs","DIRECTS","directs"]));
    acc.Respostas += toNum(getVal(r, ["Respostas","RESPOSTAS","respostas"]));
    acc.Agendamentos += toNum(getVal(r, ["Agendamentos","AGENDAMENTOS","agendamentos"]));
    acc.Comparecimentos += toNum(getVal(r, ["Comparecimentos","COMPARECIMENTOS","comparecimentos"]));
    acc.Vendas += toNum(getVal(r, ["Vendas","VENDAS","vendas"]));
    return acc;
  }, {Directs:0,Respostas:0,Agendamentos:0,Comparecimentos:0,Vendas:0});
}

// units map
function unitsMap(rows){
  const map = {};
  rows.forEach(r=>{
    const unit = (getVal(r, ["Unidade","UNIDADE","unidade"]) || "Sem Unidade").trim();
    if (!map[unit]) map[unit] = {Unidade: unit, Directs:0, Respostas:0, Agendamentos:0, Comparecimentos:0, Vendas:0};
    map[unit].Directs += toNum(getVal(r, ["Directs"]));
    map[unit].Respostas += toNum(getVal(r, ["Respostas"]));
    map[unit].Agendamentos += toNum(getVal(r, ["Agendamentos"]));
    map[unit].Comparecimentos += toNum(getVal(r, ["Comparecimentos"]));
    map[unit].Vendas += toNum(getVal(r, ["Vendas"]));
  });
  return Object.values(map);
}

// UI fill functions
function renderTopKPIs(tot, avg){
  // list of KPI keys & labels matching the model
  const kpis = [
    {id:"kpi-directs-total", title:"Directs (Total)", value:tot.Directs, avg:avg.Directs},
    {id:"kpi-respostas-total", title:"Respostas (Total)", value:tot.Respostas, avg:avg.Respostas},
    {id:"kpi-agend-total", title:"Agendamentos (Total)", value:tot.Agendamentos, avg:avg.Agendamentos},
    {id:"kpi-comp-total", title:"Comparecimentos (Total)", value:tot.Comparecimentos, avg:avg.Comparecimentos},
    {id:"kpi-vendas-total", title:"Vendas (Total)", value:tot.Vendas, avg:avg.Vendas},
    {id:"kpi-conv-total", title:"Conversão (Respostas ÷ Directs)", value: tot.Directs>0 ? ((tot.Respostas/tot.Directs)*100).toFixed(1) + "%" : "0.0%", avg:0}
  ];

  // but we'll generate markup dynamically similar to sample: many small cards
  const top = document.getElementById("kpiTop");
  top.innerHTML = ""; // rebuild

  kpis.forEach(k=>{
    const el = document.createElement("div");
    el.className = "kpi";
    el.innerHTML = `<div class="title">${k.title}</div>
                    <div class="value">${k.value}</div>
                    <div class="sub" id="${k.id}-delta"></div>`;
    top.appendChild(el);
    // delta handled separately
  });

  // small unit KPIs area (placeholders)
  const small = document.getElementById("kpiSecond");
  small.innerHTML = "";
  const unitKeys = [
    {title:"Directs (Unidade)", id:"kpi-directs-unit"},
    {title:"Respostas (Unidade)", id:"kpi-respostas-unit"},
    {title:"Agendamentos (Unidade)", id:"kpi-agend-unit"},
    {title:"Comparecimentos (Unidade)", id:"kpi-comp-unit"},
    {title:"Vendas (Unidade)", id:"kpi-vendas-unit"},
    {title:"Conv. Direct % Unidade", id:"kpi-conv-unit"}
  ];
  unitKeys.forEach(u=>{
    const el = document.createElement("div");
    el.className = "kpi muted";
    el.innerHTML = `<div class="title">${u.title}</div><div class="value" id="${u.id}">-</div>`;
    small.appendChild(el);
  });
}

// fill filter select
function fillFilter(units){
  const sel = document.getElementById("unitFilter");
  const before = sel.value || "Todas";
  sel.innerHTML = `<option value="Todas">Todas Unidades</option>`;
  units.forEach(u=> sel.insertAdjacentHTML("beforeend", `<option value="${u.Unidade}">${u.Unidade}</option>`));
  if ([...sel.options].some(o=>o.value===before)) sel.value = before;
}

// fill table
function fillTable(units){
  const tbody = document.querySelector("#unitsTable tbody");
  tbody.innerHTML = "";
  units.sort((a,b)=>b.Directs - a.Directs).forEach(u=>{
    const conv = u.Directs>0 ? ((u.Respostas/u.Directs)*100).toFixed(1) : "0.0";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${u.Unidade}</td><td>${u.Directs}</td><td>${u.Respostas}</td><td>${u.Agendamentos}</td><td>${u.Comparecimentos}</td><td>${u.Vendas}</td><td>${conv}%</td>`;
    tbody.appendChild(tr);
  });
}

// draw charts
function drawCharts(units){
  // draw top10 bars
  const top = [...units].sort((a,b)=>b.Directs - a.Directs).slice(0,10);
  const labels = top.map(u=>u.Unidade);
  const dataDirects = top.map(u=>u.Directs);
  const dataRes = top.map(u=>u.Respostas);

  // direct bar
  const ctxD = document.getElementById("chartDirects").getContext("2d");
  if (chartDirects) chartDirects.destroy();
  chartDirects = new Chart(ctxD, {
    type:"bar",
    data:{labels,datasets:[{label:"Directs",data:dataDirects, backgroundColor: "#00b29f"}]},
    options:{maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{ticks:{autoSkip:false}}}}
  });

  // respostas bar
  const ctxR = document.getElementById("chartRespostas").getContext("2d");
  if (chartRespostas) chartRespostas.destroy();
  chartRespostas = new Chart(ctxR, {
    type:"bar",
    data:{labels,datasets:[{label:"Respostas",data:dataRes, backgroundColor: "#18e6b4"}]},
    options:{maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{ticks:{autoSkip:false}}}}
  });

  // pie - distribution (limit to 12)
  const pLabels = units.map(u=>u.Unidade).slice(0,12);
  const pData = units.map(u=>u.Respostas).slice(0,12);
  const ctxP = document.getElementById("chartPie").getContext("2d");
  if (chartPie) chartPie.destroy();
  chartPie = new Chart(ctxP, {
    type:"pie",
    data:{labels:pLabels,datasets:[{data:pData, backgroundColor: generateColors(pData.length)}]},
    options:{maintainAspectRatio:false, plugins:{legend:{position:"bottom"}}}
  });
}

function generateColors(n){
  const pal = ["#00b29f","#18e6b4","#2d8cff","#ffd166","#ff8fa3","#a178ff","#7de3ff","#4dd8a6","#f7b267","#9be7ff","#8fbf87","#ffb27d"];
  return Array.from({length:n}).map((_,i)=>pal[i%pal.length]);
}

// set unit cards when filter changes
function setUnitCards(units, selected){
  if (!selected || selected==="Todas"){
    // reset to dashes
    document.getElementById("kpi-directs-unit").innerText = "-";
    document.getElementById("kpi-respostas-unit").innerText = "-";
    document.getElementById("kpi-agend-unit").innerText = "-";
    document.getElementById("kpi-comp-unit").innerText = "-";
    document.getElementById("kpi-vendas-unit").innerText = "-";
    document.getElementById("kpi-conv-unit").innerText = "-";
    return;
  }
  const u = units.find(x=>x.Unidade===selected);
  if (!u) return setUnitCards(units, "Todas");
  document.getElementById("kpi-directs-unit").innerText = u.Directs;
  document.getElementById("kpi-respostas-unit").innerText = u.Respostas;
  document.getElementById("kpi-agend-unit").innerText = u.Agendamentos;
  document.getElementById("kpi-comp-unit").innerText = u.Comparecimentos;
  document.getElementById("kpi-vendas-unit").innerText = u.Vendas;
  const c = u.Directs>0 ? ((u.Respostas/u.Directs)*100).toFixed(1) : "0.0";
  document.getElementById("kpi-conv-unit").innerText = c + "%";
}

// master update
async function updateAll(force=false){
  try {
    const rows = await fetchData();
    rowsLatest = rows;
    const units = unitsMap(rows);
    const tot = totals(rows);
    const avg = units.length ? {
      Directs: Math.round(units.reduce((s,u)=>s+u.Directs,0)/units.length),
      Respostas: Math.round(units.reduce((s,u)=>s+u.Respostas,0)/units.length),
      Agendamentos: Math.round(units.reduce((s,u)=>s+u.Agendamentos,0)/units.length),
      Comparecimentos: Math.round(units.reduce((s,u)=>s+u.Comparecimentos,0)/units.length),
      Vendas: Math.round(units.reduce((s,u)=>s+u.Vendas,0)/units.length)
    } : {Directs:0,Respostas:0,Agendamentos:0,Comparecimentos:0,Vendas:0};

    // render KPI skeleton
    renderTopKPIs(tot, avg);
    fillFilter(units);
    fillTable(units);
    drawCharts(units);

    // reflect selected unit
    const selected = document.getElementById("unitFilter").value || "Todas";
    setUnitCards(units, selected);
  } catch (err){
    console.error("Erro ao atualizar dashboard:", err);
    // show minimal UI fallback
  }
}

// events & auto refresh
document.addEventListener("DOMContentLoaded", ()=>{
  document.getElementById("btnRefresh").addEventListener("click", ()=> updateAll(true));
  document.getElementById("unitFilter").addEventListener("change", ()=>{
    const units = unitsMap(rowsLatest);
    const sel = document.getElementById("unitFilter").value || "Todas";
    setUnitCards(units, sel);
  });

  // initial
  updateAll();

  // auto-refresh
  setInterval(()=> updateAll(true), AUTO_MS);
});
