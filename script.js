// script.js - adaptado à estrutura real do CSV
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjDEbxS9ieNObM4lVDYcZ_E9tzuDvf92I8e0VEJCrkByw2r9gHUiUsWWGkE65J97dkiO0Ind8GEoju/pub?gid=308040371&single=true&output=csv";

let chartDirects = null;
let chartRespostas = null;
let chartConv = null;
let latestData = [];

// util
function num(v){ v = v === undefined || v === null || v === "" ? 0 : v; return Number(String(v).replace(",",".") || 0); }
function fmtPerc(v){ return isNaN(v) ? "0%" : (Number(v).toFixed(1) + "%"); }

// fetch + parse
async function fetchData(){
  const res = await fetch(CSV_URL + "&t=" + Date.now());
  const txt = await res.text();
  const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function aggregateTotals(rows){
  const totals = { Directs:0, Respostas:0, Agendamentos:0, Comparecimentos:0, Vendas:0 };
  rows.forEach(r => {
    totals.Directs += num(r.Directs);
    totals.Respostas += num(r.Respostas);
    totals.Agendamentos += num(r.Agendamentos);
    totals.Comparecimentos += num(r.Comparecimentos);
    totals.Vendas += num(r.Vendas);
  });
  return totals;
}

function unitTotalsMap(rows){
  const map = {};
  rows.forEach(r => {
    const u = (r.Unidade || "").trim() || "Sem Unidade";
    if(!map[u]) map[u] = { Unidade: u, Directs:0, Respostas:0, Agendamentos:0, Comparecimentos:0, Vendas:0 };
    map[u].Directs += num(r.Directs);
    map[u].Respostas += num(r.Respostas);
    map[u].Agendamentos += num(r.Agendamentos);
    map[u].Comparecimentos += num(r.Comparecimentos);
    map[u].Vendas += num(r.Vendas);
  });
  return Object.values(map);
}

// update UI
function fillTotalsUI(totals){
  document.getElementById("card-directs-total").innerText = totals.Directs;
  document.getElementById("card-respostas-total").innerText = totals.Respostas;
  document.getElementById("card-agendamentos-total").innerText = totals.Agendamentos;
  document.getElementById("card-comparecimentos-total").innerText = totals.Comparecimentos;
  document.getElementById("card-vendas-total").innerText = totals.Vendas;

  const convDirect = totals.Directs > 0 ? (totals.Respostas / totals.Directs) * 100 : 0;
  document.getElementById("card-conv-direct-total").innerText = fmtPerc(convDirect);
}

// unit UI
function fillUnitUI(unitTotals, unitSelected){
  if(!unitSelected || unitSelected === "TODAS"){
    // limpa unit cards
    document.getElementById("card-directs-unit").innerText = 0;
    document.getElementById("card-respostas-unit").innerText = 0;
    document.getElementById("card-agendamentos-unit").innerText = 0;
    document.getElementById("card-comparecimentos-unit").innerText = 0;
    document.getElementById("card-vendas-unit").innerText = 0;
    document.getElementById("card-conv-direct-unit").innerText = "0%";
    return;
  }
  const u = unitTotals.find(x => x.Unidade === unitSelected);
  if(!u){
    document.getElementById("card-directs-unit").innerText = 0;
    document.getElementById("card-respostas-unit").innerText = 0;
    document.getElementById("card-agendamentos-unit").innerText = 0;
    document.getElementById("card-comparecimentos-unit").innerText = 0;
    document.getElementById("card-vendas-unit").innerText = 0;
    document.getElementById("card-conv-direct-unit").innerText = "0%";
    return;
  }
  document.getElementById("card-directs-unit").innerText = u.Directs;
  document.getElementById("card-respostas-unit").innerText = u.Respostas;
  document.getElementById("card-agendamentos-unit").innerText = u.Agendamentos;
  document.getElementById("card-comparecimentos-unit").innerText = u.Comparecimentos;
  document.getElementById("card-vendas-unit").innerText = u.Vendas;
  const conv = u.Directs>0 ? (u.Respostas / u.Directs) * 100 : 0;
  document.getElementById("card-conv-direct-unit").innerText = fmtPerc(conv);
}

// fill filter
function fillFilter(unitTotals){
  const sel = document.getElementById("unitFilter");
  const current = sel.value || "TODAS";
  sel.innerHTML = "";
  sel.innerHTML += `<option value="TODAS">Todas Unidades</option>`;
  unitTotals.forEach(u => {
    sel.innerHTML += `<option value="${u.Unidade}">${u.Unidade}</option>`;
  });
  // restore selection if still exists
  if([...sel.options].some(o => o.value === current)) sel.value = current;
}

// fill table
function fillTable(unitTotals){
  const tbody = document.querySelector("#tableUnits tbody");
  tbody.innerHTML = "";
  // sort desc by Directs
  unitTotals.sort((a,b) => b.Directs - a.Directs);
  unitTotals.forEach(u => {
    const conv = u.Directs > 0 ? ((u.Respostas / u.Directs) * 100).toFixed(1) : "0.0";
    const row = `<tr>
      <td>${u.Unidade}</td>
      <td>${u.Directs}</td>
      <td>${u.Respostas}</td>
      <td>${u.Agendamentos}</td>
      <td>${u.Comparecimentos}</td>
      <td>${u.Vendas}</td>
      <td>${conv}%</td>
    </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// charts
function drawCharts(unitTotals){
  const labels = unitTotals.map(u => u.Unidade);
  const dataDirects = unitTotals.map(u => u.Directs);
  const dataRespostas = unitTotals.map(u => u.Respostas);
  const dataConv = unitTotals.map(u => u.Directs>0 ? Number(((u.Respostas / u.Directs)*100).toFixed(1)) : 0);

  const ctxD = document.getElementById("chartDirects").getContext("2d");
  const ctxR = document.getElementById("chartRespostas").getContext("2d");
  const ctxC = document.getElementById("chartConv").getContext("2d");

  if(chartDirects) chartDirects.destroy();
  if(chartRespostas) chartRespostas.destroy();
  if(chartConv) chartConv.destroy();

  chartDirects = new Chart(ctxD, {
    type: "bar",
    data:{ labels, datasets:[{ label:"Directs", data:dataDirects, backgroundColor: "#00c4d9" }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}}
  });

  chartRespostas = new Chart(ctxR, {
    type: "bar",
    data:{ labels, datasets:[{ label:"Respostas", data:dataRespostas, backgroundColor: "#5be37a" }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}}
  });

  chartConv = new Chart(ctxC, {
    type: "line",
    data:{ labels, datasets:[{ label:"Conv Direct %", data:dataConv, borderColor:"#ffd166", backgroundColor:"#ffd166", tension:0.25, fill:false }]},
    options:{ maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true } } }
  });
}

// main update
async function updateAll(){
  try{
    const rows = await fetchData();
    latestData = rows; // keep for debugging
    // aggregate
    const totals = aggregateTotals(rows);
    const units = unitTotalsMap(rows);

    fillTotalsUI(totals);
    fillFilter(units);

    const selected = document.getElementById("unitFilter").value || "TODAS";
    const unitToShow = selected === "TODAS" ? null : selected;
    fillUnitUI(units, unitToShow);
    fillTable(units);
    drawCharts(units);
  }catch(err){
    console.error("Erro ao atualizar dados:", err);
  }
}

// events
document.getElementById("btnRefresh").addEventListener("click", updateAll);
document.getElementById("unitFilter").addEventListener("change", () => {
  // when user changes filter, recompute UI using already-loaded data (avoid new fetch)
  const units = unitTotalsMap(latestData);
  const selected = document.getElementById("unitFilter").value || "TODAS";
  fillUnitUI(units, selected === "TODAS" ? null : selected);
  // update table and charts to reflect filter (table shows all units always)
  // user requested totals per unit + totals geral; charts & table remain showing all units
});

// initial load + auto-refresh
updateAll();
// auto every 30s
setInterval(updateAll, 30_000);
