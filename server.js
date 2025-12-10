const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");

const app = express();
const PORT = 4000;

// Banco de dados
const DB_PATH = path.join(__dirname, "db", "lojinha.db");
const db = new sqlite3.Database(DB_PATH);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // serve index.html, css, js

// Inicializa tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    quantidade REAL NOT NULL,
    categoria TEXT,
    ativo INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    hora TEXT NOT NULL,
    total REAL NOT NULL,
    itens TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    cliente TEXT,
    documento TEXT,
    total REAL NOT NULL,
    criada_em TEXT NOT NULL,
    FOREIGN KEY (venda_id) REFERENCES vendas(id)
  )`);
});

// ---------------- ROTAS API ---------------- //

// Listar produtos ativos
app.get("/api/produtos", (req, res) => {
  db.all("SELECT * FROM produtos WHERE ativo=1 ORDER BY nome", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Criar novo produto
app.post("/api/produtos", (req, res) => {
  const { nome, preco, quantidade, categoria } = req.body;
  db.run(
    "INSERT INTO produtos (nome, preco, quantidade, categoria, ativo) VALUES (?, ?, ?, ?, 1)",
    [nome, preco, quantidade, categoria],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Registrar venda
app.post("/api/vender", (req, res) => {
  const { cliente, documento, itens } = req.body;

  if (!itens || itens.length === 0) {
    return res.status(400).json({ error: "Nenhum item enviado" });
  }

  const data = new Date();
  const dataStr = data.toISOString().split("T")[0];
  const horaStr = data.toTimeString().split(" ")[0];

  let total = 0;

  db.serialize(() => {
    const stmtUpdate = db.prepare("UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?");

    // Atualiza o estoque e calcula total
    itens.forEach(item => {
      // Certifique-se que item.quantidade e item.id são números
      const qtd = Number(item.quantidade);
      const id = Number(item.id);

      total += qtd * Number(item.preco);

      stmtUpdate.run(qtd, id, function(err) {
        if (err) {
          console.error("Erro ao atualizar estoque:", err.message);
        } else if (this.changes === 0) {
          console.warn(`Produto ID ${id} não foi atualizado. Verifique se o ID existe.`);
        }
      });
    });

    stmtUpdate.finalize(err => {
      if (err) {
        console.error("Erro ao finalizar statement:", err.message);
        return res.status(500).json({ error: err.message });
      }

      // Insere a venda
      db.run(
        "INSERT INTO vendas (data, hora, total, itens) VALUES (?, ?, ?, ?)",
        [dataStr, horaStr, total, JSON.stringify(itens)],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const vendaId = this.lastID;

          // Insere a nota
          db.run(
            "INSERT INTO notas (venda_id, cliente, documento, total, criada_em) VALUES (?, ?, ?, ?, ?)",
            [vendaId, cliente, documento, total, new Date().toISOString()],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ status: "ok", vendaId, notaId: this.lastID });
            }
          );
        }
      );
    });
  });
});

// Listar notas
app.get("/api/notas", (req, res) => {
  db.all("SELECT * FROM notas ORDER BY criada_em DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Relatórios simples
app.get("/api/relatorio", (req, res) => {
  db.all("SELECT data, SUM(total) as total_dia, COUNT(*) as qtd FROM vendas GROUP BY data ORDER BY data DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ------------------------------------------ //

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});