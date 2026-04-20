require('dotenv').config();
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const pool = require('./config/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.flash = req.query.msg || null;
  next();
});

app.get('/', async (req, res) => {
  try {
    const [statsRows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM clinicas) AS clinicas,
        (SELECT COUNT(*) FROM pcs) AS pcs,
        (SELECT COUNT(*) FROM ordens WHERE status <> 'finalizado') AS abertas,
        (SELECT COUNT(*) FROM ordens WHERE status = 'finalizado') AS finalizadas
    `);

    const [orders] = await pool.query(`
      SELECT o.*, c.nome AS clinica_nome, p.patrimonio, p.modelo
      FROM ordens o
      INNER JOIN pcs p ON p.id = o.pc_id
      INNER JOIN clinicas c ON c.id = p.clinica_id
      ORDER BY FIELD(o.status, 'pendente_peca', 'sem_acao', 'pendente_analise', 'em_execucao', 'finalizado'), o.id DESC
    `);

    const grouped = {
      pendente_peca: [],
      sem_acao: [],
      pendente_analise: [],
      em_execucao: [],
      finalizado: []
    };

    for (const order of orders) {
      grouped[order.status].push(order);
    }

    res.render('dashboard', {
      stats: statsRows[0],
      grouped
    });
  } catch (error) {
    res.status(500).send('Erro ao carregar dashboard: ' + error.message);
  }
});

app.get('/clinicas', async (req, res) => {
  const [clinicas] = await pool.query('SELECT * FROM clinicas ORDER BY nome ASC');
  res.render('clinicas', { clinicas });
});

app.post('/clinicas', async (req, res) => {
  const { nome, endereco, telefone, contato } = req.body;
  if (!nome) return res.redirect('/clinicas?msg=Informe o nome da clínica');
  await pool.query(
    'INSERT INTO clinicas (nome, endereco, telefone, contato) VALUES (?, ?, ?, ?)',
    [nome, endereco || null, telefone || null, contato || null]
  );
  res.redirect('/clinicas?msg=Clínica cadastrada com sucesso');
});

app.get('/pcs', async (req, res) => {
  const [clinicas] = await pool.query('SELECT id, nome FROM clinicas ORDER BY nome');
  const [pcs] = await pool.query(`
    SELECT p.*, c.nome AS clinica_nome
    FROM pcs p
    INNER JOIN clinicas c ON c.id = p.clinica_id
    ORDER BY p.id DESC
  `);
  res.render('pcs', { clinicas, pcs });
});

app.post('/pcs', async (req, res) => {
  const { clinica_id, patrimonio, modelo, numero_serie, descricao } = req.body;
  if (!clinica_id || !patrimonio) {
    return res.redirect('/pcs?msg=Selecione a clínica e informe o patrimônio');
  }
  await pool.query(
    'INSERT INTO pcs (clinica_id, patrimonio, modelo, numero_serie, descricao) VALUES (?, ?, ?, ?, ?)',
    [clinica_id, patrimonio, modelo || null, numero_serie || null, descricao || null]
  );
  res.redirect('/pcs?msg=Equipamento cadastrado com sucesso');
});

app.post('/pcs/:id/delete', async (req, res) => {
  await pool.query('DELETE FROM pcs WHERE id = ?', [req.params.id]);
  res.redirect('/pcs?msg=Equipamento excluído com sucesso');
});

app.get('/ordens', async (req, res) => {
  const [ordens] = await pool.query(`
    SELECT o.*, c.nome AS clinica_nome, p.patrimonio, p.modelo
    FROM ordens o
    INNER JOIN pcs p ON p.id = o.pc_id
    INNER JOIN clinicas c ON c.id = p.clinica_id
    ORDER BY o.id DESC
  `);
  res.render('ordens', { ordens });
});

app.get('/ordens/nova', async (req, res) => {
  const [pcs] = await pool.query(`
    SELECT p.id, p.patrimonio, p.modelo, c.nome AS clinica_nome
    FROM pcs p
    INNER JOIN clinicas c ON c.id = p.clinica_id
    ORDER BY c.nome, p.patrimonio
  `);
  res.render('nova-ordem', { pcs });
});

app.post('/ordens', async (req, res) => {
  const { pc_id, tipo_atendimento, quantidade_recebida, servico, observacoes, status, prioridade } = req.body;
  if (!pc_id || !servico) {
    return res.redirect('/ordens/nova?msg=Selecione o equipamento e informe o serviço');
  }
  await pool.query(`
    INSERT INTO ordens (pc_id, tipo_atendimento, quantidade_recebida, servico, observacoes, status, prioridade)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    pc_id,
    tipo_atendimento || 'ajuste',
    Number(quantidade_recebida || 1),
    servico,
    observacoes || null,
    status || 'pendente_analise',
    prioridade || 'media'
  ]);
  res.redirect('/?msg=Ordem criada com sucesso');
});

app.get('/ordens/:id/editar', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT o.*, c.nome AS clinica_nome, p.patrimonio
    FROM ordens o
    INNER JOIN pcs p ON p.id = o.pc_id
    INNER JOIN clinicas c ON c.id = p.clinica_id
    WHERE o.id = ?
  `, [req.params.id]);

  if (!rows.length) return res.redirect('/ordens?msg=Ordem não encontrada');
  res.render('editar-ordem', { ordem: rows[0] });
});

app.post('/ordens/:id/editar', async (req, res) => {
  const { tipo_atendimento, quantidade_recebida, servico, observacoes, status, prioridade } = req.body;
  await pool.query(`
    UPDATE ordens
    SET tipo_atendimento = ?, quantidade_recebida = ?, servico = ?, observacoes = ?, status = ?, prioridade = ?
    WHERE id = ?
  `, [
    tipo_atendimento,
    Number(quantidade_recebida || 1),
    servico,
    observacoes || null,
    status,
    prioridade,
    req.params.id
  ]);
  res.redirect('/?msg=Ordem atualizada com sucesso');
});

app.post('/ordens/:id/delete', async (req, res) => {
  await pool.query('DELETE FROM ordens WHERE id = ?', [req.params.id]);
  res.redirect('/ordens?msg=Ordem excluída com sucesso');
});

app.get('/ordens/:id/relatorio', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT o.*, c.nome AS clinica_nome, c.endereco, c.telefone, c.contato,
           p.patrimonio, p.modelo, p.numero_serie, p.descricao
    FROM ordens o
    INNER JOIN pcs p ON p.id = o.pc_id
    INNER JOIN clinicas c ON c.id = p.clinica_id
    WHERE o.id = ?
  `, [req.params.id]);

  if (!rows.length) return res.status(404).send('Ordem não encontrada');
  res.render('relatorio', { item: rows[0] });
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
  console.log('Na rede local, use o IP da máquina servidor, por exemplo: http://192.168.0.10:' + PORT);
});
