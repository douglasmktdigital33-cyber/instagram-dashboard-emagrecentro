const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vSjDEbxS9ieNObM4lVDYcZ_E9tzuDvf92I8e0VEJCrkByw2r9gHUiUsWWGkE65J97dkiO0Ind8GEoju/pub?gid=308040371&single=true&output=csv";

let dados = [];
let chartResp, chartAg;

document.getElementById("atualizarBtn").addEventListener("click", atualizarDashboard);

Papa.parse(CSV_URL, {
    download: true,
    header: true,
    complete: function (results) {
        dados = results.data;
        preencherUnidades();
        atualizarDashboard();
    }
});

function preencherUnidades() {
    const select = document.getElementById("unidadeSelect");
    select.innerHTML = `<option value="Todas">Todas</option>`;

    dados.forEach(row => {
        if (row.Unidade) {
            select.innerHTML += `<option value="${row.Unidade}">${row.Unidade}</option>`;
        }
    });
}

function atualizarDashboard() {
    const unidade = document.getElementById("unidadeSelect").value;

    let filtrado = unidade === "Todas" ? dados : dados.filter(r => r.Unidade === unidade);

    const totalDiretos = soma(filtrado, "Directs");
    const totalRespostas = soma(filtrado, "Respostas");
    const totalAg = soma(filtrado, "Agendamentos");
    const totalComp = soma(filtrado, "Comparecimentos");
    const totalVendas = soma(filtrado, "Vendas");

    const conversao = totalDiretos > 0 ? ((totalRespostas / totalDiretos) * 100).toFixed(1) : 0;

    document.getElementById("cDiretos").innerText = totalDiretos;
    document.getElementById("cRespostas").innerText = totalRespostas;
    document.getElementById("cAgendamentos").innerText = totalAg;
    document.getElementById("cComparecimentos").innerText = totalComp;
    document.getElementById("cVendas").innerText = totalVendas;
    document.getElementById("cConversao").innerText = conversao + "%";

    atualizarGraficos();
}

function soma(arr, campo) {
    return arr.reduce((t, r) => t + (parseInt(r[campo]) || 0), 0);
}

function atualizarGraficos() {
    const labels = dados.map(r => r.Unidade);

    const respostas = dados.map(r => parseInt(r.Respostas) || 0);
    const agendamentos = dados.map(r => parseInt(r.Agendamentos) || 0);

    if (chartResp) chartResp.destroy();
    if (chartAg) chartAg.destroy();

    chartResp = new Chart(document.getElementById("chartRespostas"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Respostas",
                data: respostas,
                backgroundColor: "#2d8cff"
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    chartAg = new Chart(document.getElementById("chartAgendamentos"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Agendamentos",
                data: agendamentos,
                backgroundColor: "#41c29e"
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}
