const Modal = {
  open(id) {
    document.getElementById(id).classList.add("active");
  },
  close(id) {
    document.getElementById(id).classList.remove("active");
    if (id === "modal-form") Form.reset();
  },
};

const Transaction = {
  all: JSON.parse(localStorage.getItem("dev.finances:data")) || [],
  toDeleteIndex: null,

  save(t) {
    const editId = document.getElementById("edit-id").value;
    if (editId !== "") {
      this.all[editId] = t;
    } else {
      this.all.push(t);
    }
    App.reload();
    Modal.close("modal-form");
  },

  prepDelete(index) {
    this.toDeleteIndex = index;
    Modal.open("modal-delete");
  },

  confirmDelete() {
    if (this.toDeleteIndex !== null) {
      this.all.splice(this.toDeleteIndex, 1);
      this.toDeleteIndex = null;
      App.reload();
      Modal.close("modal-delete");
    }
  },

  getFiltered() {
    const filter = document.getElementById("period-filter").value;
    if (filter === "all") return this.all;
    const now = new Date();
    return this.all.filter((t) => {
      const tDate = new Date(t.dateRaw);
      if (filter === "custom") {
        const from = new Date(document.getElementById("date-from").value);
        const to = new Date(document.getElementById("date-to").value);
        return (
          (!isNaN(from) ? tDate >= from : true) &&
          (!isNaN(to) ? tDate <= to : true)
        );
      }
      return Math.ceil(Math.abs(now - tDate) / 864e5) <= Number(filter);
    });
  },
};

const Form = {
  description: document.getElementById("description"),
  amount: document.getElementById("amount"),
  date: document.getElementById("date"),
  category: document.getElementById("category"),
  editId: document.getElementById("edit-id"),

  edit(index) {
    const t = Transaction.all[index];
    this.description.value = t.description;
    this.amount.value = Math.abs(t.amount).toFixed(2);
    this.date.value = t.dateRaw;
    this.category.value = t.isOther ? "Outro" : t.category;
    if (t.isOther) {
      document.getElementById("other-group").style.display = "block";
      document.getElementById("other-category").value = t.category;
    }
    document.querySelector(
      `input[name="type"][value="${t.amount > 0 ? "income" : "expense"}"]`
    ).checked = true;
    this.editId.value = index;
    document.getElementById("modal-title").innerText = "Editar Transação";
    Modal.open("modal-form");
  },

  reset() {
    document.getElementById("form").reset();
    this.editId.value = "";
    document.getElementById("modal-title").innerText = "Nova Transação";
    document.getElementById("other-group").style.display = "none";
    this.date.valueAsDate = new Date();
  },

  cancel() {
    Modal.close("modal-form");
  },
};

const Utils = {
  maskCurrency(value) {
    value = value.replace(/\D/g, "");
    return (Number(value) / 100).toFixed(2);
  },
  formatCurrency(value) {
    const [locale, currency] = document
      .getElementById("currency-select")
      .value.split("|");
    return Number(value).toLocaleString(locale, {
      style: "currency",
      currency,
    });
  },
};

const Export = {
  pdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const data = Transaction.getFiltered();
    
    const primaryColor = [73, 170, 38]; 
    const darkColor = [45, 51, 65];    

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text("TGF ", 15, 20);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Contábil", 33, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Relatório de Controle Financeiro", 15, 28);
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 15, 33);

    const tableRows = data.map(t => [
      t.description,
      Utils.formatCurrency(t.amount),
      t.category,
      t.dateDisplay
    ]);

    const totalValue = data.reduce((acc, t) => acc + t.amount, 0);
    const footerRow = [
      { content: 'Saldo Disponível', styles: { fontStyle: 'bold', halign: 'left' } },
      { content: Utils.formatCurrency(totalValue), styles: { fontStyle: 'bold', halign: 'center' } },
      { content: '', colSpan: 2 }
    ];

    doc.autoTable({
      startY: 40,
      head: [['Descrição', 'Valor', 'Categoria', 'Data']],
      body: [...tableRows, footerRow],
      headStyles: { 
        fillColor: darkColor, 
        textColor: [255, 255, 255],
        halign: 'left' 
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' }, 
        2: { halign: 'left' },
        3: { halign: 'left' }
      },
      didParseCell: function (data) {
        if (data.section === 'head' && data.column.index === 1) {
            data.cell.styles.halign = 'center';
        }
        if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.fillColor = [240, 240, 240];
        }
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 15, right: 15 }
    });

    doc.save("Relatorio_TGF_Contabil.pdf");
  },

  csv() {
    const data = Transaction.getFiltered();
    let csv = "Descrição,Valor,Categoria,Data\n";
    data.forEach(
      (t) =>
        (csv += `"${t.description}",${t.amount},"${t.category}",${t.dateDisplay}\n`)
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "financas.csv";
    link.click();
  },
};

let myChart;
const DOM = {
  tbody: document.querySelector("#transaction-body"),
  update() {
    const filtered = Transaction.getFiltered();
    const totals = filtered.reduce(
      (acc, t) => {
        t.amount > 0 ? (acc.incomes += t.amount) : (acc.expenses += t.amount);
        acc.total = acc.incomes + acc.expenses;
        return acc;
      },
      { incomes: 0, expenses: 0, total: 0 }
    );

    document.getElementById("incomeDisplay").innerHTML = Utils.formatCurrency(totals.incomes);
    document.getElementById("expenseDisplay").innerHTML = Utils.formatCurrency(totals.expenses);
    document.getElementById("totalDisplay").innerHTML = Utils.formatCurrency(totals.total);

    const card = document.getElementById("totalCard");
    totals.total < 0 ? card.classList.add("negative") : card.classList.remove("negative");

    this.tbody.innerHTML = "";
    filtered
      .sort((a, b) => new Date(b.dateRaw) - new Date(a.dateRaw))
      .forEach((t) => {
        const idx = Transaction.all.indexOf(t);
        const tr = document.createElement("tr");
        tr.innerHTML = `
              <td>${t.description}</td>
              <td class="${t.amount > 0 ? "income" : "expense"}">${Utils.formatCurrency(t.amount)}</td>
              <td><small>${t.category}</small></td>
              <td>${t.dateDisplay}</td>
              <td>
                  <i class="ph ph-pencil-simple edit-icon" onclick="Form.edit(${idx})"></i>
                  <i class="ph ph-trash delete-icon" onclick="Transaction.prepDelete(${idx})"></i>
              </td>
          `;
        this.tbody.appendChild(tr);
      });
  },
};

document.getElementById("form").onsubmit = (e) => {
  e.preventDefault();
  let amt = Number(document.getElementById("amount").value);
  if (document.querySelector('input[name="type"]:checked').value === "expense")
    amt = -Math.abs(amt);
  const isOther = document.getElementById("category").value === "Outro";
  Transaction.save({
    description: document.getElementById("description").value,
    amount: amt,
    category: isOther
      ? document.getElementById("other-category").value
      : document.getElementById("category").value,
    isOther,
    dateRaw: document.getElementById("date").value,
    dateDisplay: document.getElementById("date").value.split("-").reverse().join("/"),
  });
};

document.getElementById("confirm-delete-btn").onclick = () => Transaction.confirmDelete();
document.getElementById("amount").oninput = (e) => (e.target.value = Utils.maskCurrency(e.target.value));
document.getElementById("period-filter").onchange = (e) => {
  document.getElementById("custom-date-range").style.display = e.target.value === "custom" ? "flex" : "none";
  App.reload();
};
document.getElementById("currency-select").onchange = (e) => {
  localStorage.setItem("dev.finances:currency", e.target.value);
  App.reload();
};

const App = {
  init() {
    const curr = localStorage.getItem("dev.finances:currency");
    if (curr) document.getElementById("currency-select").value = curr;
    DOM.update();
    this.updateChart();
    localStorage.setItem("dev.finances:data", JSON.stringify(Transaction.all));
  },
  reload() {
    this.init();
  },
  updateChart() {
    const ctx = document.getElementById("myChart").getContext("2d");
    const dataMap = {};
    Transaction.getFiltered()
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        dataMap[t.category] = (dataMap[t.category] || 0) + Math.abs(t.amount);
      });
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(dataMap),
        datasets: [{
          data: Object.values(dataMap),
          backgroundColor: ["#12a454", "#e92929", "#363f5f", "#ffcc00", "#4cc9f0"],
          borderWidth: 0,
        }],
      },
      options: { maintainAspectRatio: false },
    });
  },
};

function checkCategory(val) {
  document.getElementById("other-group").style.display = val === "Outro" ? "block" : "none";
}
document.getElementById("date").valueAsDate = new Date();
App.init();