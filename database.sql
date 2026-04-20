CREATE DATABASE IF NOT EXISTS controle_pcs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE controle_pcs;

CREATE TABLE IF NOT EXISTS clinicas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  endereco VARCHAR(255) NULL,
  telefone VARCHAR(50) NULL,
  contato VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pcs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  clinica_id INT NOT NULL,
  patrimonio VARCHAR(100) NOT NULL,
  modelo VARCHAR(150) NULL,
  numero_serie VARCHAR(150) NULL,
  descricao TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pc_clinica FOREIGN KEY (clinica_id) REFERENCES clinicas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ordens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pc_id INT NOT NULL,
  tipo_atendimento VARCHAR(50) NOT NULL,
  quantidade_recebida INT NOT NULL DEFAULT 1,
  servico TEXT NOT NULL,
  observacoes TEXT NULL,
  status ENUM('pendente_peca','sem_acao','pendente_analise','em_execucao','finalizado') NOT NULL DEFAULT 'pendente_analise',
  prioridade ENUM('baixa','media','alta') NOT NULL DEFAULT 'media',
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ordem_pc FOREIGN KEY (pc_id) REFERENCES pcs(id) ON DELETE CASCADE
);

INSERT INTO clinicas (nome, endereco, telefone, contato) VALUES
('Clínica Modelo Centro', 'Rua Exemplo, 100', '(11) 1111-1111', 'Maria'),
('Clínica Modelo Norte', 'Av. Exemplo, 200', '(11) 2222-2222', 'João');

INSERT INTO pcs (clinica_id, patrimonio, modelo, numero_serie, descricao) VALUES
(1, 'PC-001', 'Dell OptiPlex', 'SERIE-001', 'Computador da recepção'),
(2, 'PC-002', 'Lenovo ThinkCentre', 'SERIE-002', 'Computador novo para inauguração');

INSERT INTO ordens (pc_id, tipo_atendimento, quantidade_recebida, servico, observacoes, status, prioridade) VALUES
(1, 'ajuste', 1, 'Verificar lentidão, troca de SSD e instalação do Windows.', 'Aguardando chegada do SSD para finalizar.', 'pendente_peca', 'alta'),
(2, 'inauguracao', 1, 'Instalar Windows e programas internos da empresa.', 'Sem pendências no momento.', 'em_execucao', 'media');
