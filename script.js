// script.js (corrigido)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjDEbxS9ieNObM4lVDYcZ_E9tzuDvf92I8e0VEJCrkByw2r9gHUiUsWWGkE65J97dkiO0Ind8GEoju/pub?gid=308040371&single=true&output=csv";

let chartLeads = null, chartDirects = null, chartConversao = null;

// canvases (pegamos os elementos assim que o DOM estiver carregado)
const chartLeadsCanvas = () => document.getElementById('chartLeads');
const chartDirectsCanvas = () => document.getElementById('chartDirects');
const chartConversaoCanvas = () => document.getElementById('chartConversao');

async function loadCSV() {
  const res = await fetch(SHEET_URL + "&cacheKill=" + Date.now());
  const text = await res.text();
  // usa PapaParse (já carregado no HTML)
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function preencherUnidades(data) {
  const select = document.getElementById("filter-units");
  // evitar re-preencher duplicado
  if (select.options.length > 1) return;
  const unidades = Array.from(new Set(data.map(i => (i.UNIDADE || i.Unidade || i.unidade || "").trim()).filter(Boolean)));
  select.innerHTML = `<option value="">Todas</option>`;
  unidades.forEach(u => select.innerHTML += `<option value="${u}">${u}</option>`);
}

function filtrar(data) {
  const unidade = document.getElementById("filter-units").value;
  if (!unidade) return data;
  return data.filter(d => {
    const valor = (d.UNIDADE || d.Unidade || d.unidade || "").trim();
    return valor === unidade;
  });
}

function safeNum(v) { return v === undefined || v === null || v === "" ? 0 : Number(String(v).replace(",", ".")); }

function atualizarCards(d) {
  const leads = d.reduce((a,b) => a + safeNum(b.LEADS || b.Leads || b.leads), 0);
  const directs = d.reduce((a,b) => a + safeNum(b.DIRECTS || b.DirecTS || b.directs), 0);
  const respostas = d.reduce((a,b) => a + safeNum(b.RESPOSTAS || b.Respostas || b.respostas), 0);

  const conv = directs > 0 ? ((respostas / directs) * 100).toFixed(1) : "0.0";

  document.getElementById("total-leads").innerText = leads;
  document.getElementById("total-directs").innerText = directs;
  document.getElementById("total-respostas").innerText = respostas;
  document.getElementById("conversao-direct").innerText = conv + "%";
}

function criarGraficos(d) {
  // labels — tenta usar campo DATA ou Dia; se não existir, usa índice
  const labels = d.map((row, i) => (row.DATA || row.Data || row.data || (`Dia ${i+1}`)));
  const leads = d.map(r => safeNum(r.LEADS || r.Leads || r.leads));
  const directs = d.map(r => safeNum(r.DIRECTS || r.Directs || r.directs));
  const conv = d.map(r => {
    const dr = safeNum(r.DIRECTS || r.Directs || r.directs);
    const rs = safeNum(r.RESPOSTAS || r.Respostas || r.respostas);
    return dr > 0 ? Number(((rs / dr) * 100).toFixed(1)) : 0;
  });

  // destruir charts existentes
  if (chartLeads) { chartLeads.destroy(); chartLeads = null; }
  if (chartDirects) { chartDirects.destroy(); chartDirects = null; }
  if (chartConversao) { chartConversao.destroy(); chartConversao = null; }

  // cria novos
  chartLeads = new Chart(chartLeadsCanvas(), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Leads', data: leads }] },
    options: { maintainAspectRatio: false }
  });

  chartDirects = new Chart(chartDirectsCanvas(), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Directs', data: directs, tension: 0.3 }] },
    options: { maintainAspectRatio: false }
  });

  chartConversao = new Chart(chartConversaoCanvas(), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Conversão %', data: conv, tension: 0.3 }] },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
}

async function atualizar() {
  try {
    const dadosBrutos = await loadCSV();
    preencherUnidades(dadosBrutos);
    const filtrado = filtrar(dadosBrutos);
    atualizarCards(filtrado);
    criarGraficos(filtrado);
  } catch (err) {
    console.error("Erro ao atualizar dashboard:", err);
  }
}

// eventos
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById("filter-units").addEventListener("change", atualizar);
  document.getElementById("reload-btn").addEventListener("click", atualizar);

  // primeira carga
  atualizar();

  // auto refresh a cada 20s
  setInterval(atualizar, 20_000);
});
