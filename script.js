const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSjDEbxS9ieNObM4lVDYcZ_E9tzuDvf92I8e0VEJCrkByw2r9gHUiUsWWGkE65J97dkiO0Ind8GEoju/pub?gid=308040371&single=true&output=csv";

let dados = [];
let chartsCriados = [];

/* ============================
   Carregar CSV
============================ */
function carregarDados(callback) {
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        complete: function(results) {
            dados = results.data.filter(x => x.Unidade);
            preencherUnidades();
            callback();
        }
    });
}

/* ============================
   Preencher Select de Unidades
============================ */
function preencherUnidades() {
    const select = document.getElementById("unidadeSelect");
    select.innerHTML = "<option value='Todas'>Todas</option>";

    dados.forEach(row => {
        const opt = document.createElement("option");
        opt.value = row.Unidade;
        opt.textContent = row.Unidade;
        select.appendChild(opt);
    });
}

/* ============================
   Atualizar Dashboard
============================ */
function atualizarDashboard() {
    const unidade = document.getElementById("unidadeSelect").value;

    let filtrado = unidade === "Todas"
        ? dados
        : dados.filter(x => x.Unidade === unidade);

    let somar = campo => filtrado.reduce((acc, row) => acc + Number(row[campo] || 0), 0);

    const directs = somar("Directs");
    const respostas = somar("Respostas");
    const agend = somar("Agendamentos");
    const comp = somar("Comparecimentos");
    const vendas = somar("Vendas");

    document.getElementById("directs").innerText = directs;
    document.getElementById("respostas").innerText = respostas;
    document.getElementById("agendamentos").innerText = agend;
    document.getElementById("comparecimentos").innerText = comp;
    document.getElementById("vendas").innerText = vendas;

    const conv = directs > 0 ? ((respostas / directs) * 100).toFixed(1) : 0;
    document.getElementById("conversao").innerText = conv + "%";

    atualizarGraficos(filtrado);
}

/* ============================
   Gráficos
============================ */
function atualizarGraficos(linhas) {

    chartsCriados.forEach(c => c.destroy());
    chartsCriados = [];

    const labels = linhas.map(l => l.Unidade);
    const respostas = linhas.map(l => Number(l.Respostas));
    const agend = linhas.map(l => Number(l.Agendamentos));

    const ctx1 = document.getElementById("chartRespostas").getContext("2d");
    const ctx2 = document.getElementById("chartAgendamentos").getContext("2d");

    chartsCriados.push(
        new Chart(ctx1, {
            type: "bar",
            data: { labels, datasets: [{ label: "Respostas", data: respostas }] },
            options: { responsive: true, maintainAspectRatio: false }
        })
    );

    chartsCriados.push(
        new Chart(ctx2, {
            type: "bar",
            data: { labels, datasets: [{ label: "Agendamentos", data: agend }] },
            options: { responsive: true, maintainAspectRatio: false }
        })
    );
}

/* ============================
   Inicialização
============================ */
document.getElementById("btnAtualizar").addEventListener("click", atualizarDashboard);

carregarDados(() => {
    atualizarDashboard();
});
