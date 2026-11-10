import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateChange, calculateKPIs, filterTransactions, generateCSV, Transaction, FiadoRecord, calculateFiadoKPIs, filterFiados } from './feiracash.ts';

test('calculateChange returns correct change and denominations', () => {
  const result = calculateChange(23.50, 50.00);
  assert.equal(result.isValid, true);
  assert.equal(result.change, 26.50);
  
  // 26.50 should be 1x R$ 20, 1x R$ 5, 1x R$ 1, 1x R$ 0.50
  assert.equal(result.breakdown.length, 4);
  assert.equal(result.breakdown[0].value, 20);
  assert.equal(result.breakdown[1].value, 5);
  assert.equal(result.breakdown[2].value, 1);
  assert.equal(result.breakdown[3].value, 0.50);
});

test('calculateChange handles exact amount', () => {
  const result = calculateChange(15.00, 15.00);
  assert.equal(result.isValid, true);
  assert.equal(result.change, 0);
  assert.equal(result.breakdown.length, 0);
});

test('calculateKPIs computes correct totals, balance, ticket medio and breakdown', () => {
  const mockTxs: Transaction[] = [
    { id: '1', type: 'recebimento', description: 'Pastel + Caldo', amount: 30, category: 'Alimentação', paymentMethod: 'pix', date: '2026-11-06T10:00:00Z' },
    { id: '2', type: 'recebimento', description: 'Hortifruti', amount: 50, category: 'Hortifruti', paymentMethod: 'dinheiro', date: '2026-11-06T10:30:00Z' },
    { id: '3', type: 'recebimento', description: 'Queijo', amount: 40, category: 'Laticínios', paymentMethod: 'debito', date: '2026-11-06T11:00:00Z' },
    { id: '4', type: 'pagamento', description: 'Gelo e sacolas', amount: 25, category: 'Insumos', paymentMethod: 'dinheiro', date: '2026-11-06T09:00:00Z' }
  ];

  const kpis = calculateKPIs(mockTxs);
  assert.equal(kpis.totalRecebimentos, 120);
  assert.equal(kpis.totalPagamentos, 25);
  assert.equal(kpis.saldoLiquido, 95);
  assert.equal(kpis.totalOperacoes, 4);
  assert.equal(kpis.ticketMedio, 40); // 120 / 3
  assert.equal(kpis.breakdown.pix, 30);
  assert.equal(kpis.breakdown.dinheiro, 50);
  assert.equal(kpis.breakdown.debito, 40);
  assert.equal(kpis.breakdown.credito, 0);
});

test('filterTransactions filters by type and search query', () => {
  const mockTxs: Transaction[] = [
    { id: '1', type: 'recebimento', description: 'Pastel de Carne', amount: 12, category: 'Alimentação', paymentMethod: 'pix', date: '2026-11-06T10:00:00Z' },
    { id: '2', type: 'recebimento', description: 'Caldo de cana', amount: 8, category: 'Bebidas', paymentMethod: 'dinheiro', date: '2026-11-06T10:15:00Z' },
    { id: '3', type: 'pagamento', description: 'Gasolina', amount: 50, category: 'Transporte', paymentMethod: 'dinheiro', date: '2026-11-06T08:00:00Z' }
  ];

  const onlyReceb = filterTransactions(mockTxs, { type: 'recebimento' });
  assert.equal(onlyReceb.length, 2);

  const searchPastel = filterTransactions(mockTxs, { query: 'carne' });
  assert.equal(searchPastel.length, 1);
  assert.equal(searchPastel[0].id, '1');
});

test('generateCSV generates valid CSV text', () => {
  const mockTxs: Transaction[] = [
    { id: 'TX-101', type: 'recebimento', description: 'Venda de Morangos', amount: 15.50, category: 'Frutas', paymentMethod: 'pix', date: '2026-11-06T10:00:00Z' }
  ];
  const csv = generateCSV(mockTxs);
  assert.ok(csv.includes('ID;Data/Hora;Tipo;Descricao;Categoria;Forma_Pagamento;Valor_BRL'));
  assert.ok(csv.includes('TX-101'));
  assert.ok(csv.includes('15,50'));
  assert.ok(csv.includes('PIX'));
});

test('calculateFiadoKPIs correctly aggregates pending and paid debts', () => {
  const fiados: FiadoRecord[] = [
    { id: 'FD-1', clienteNome: 'Seu Zé', valor: 45.0, status: 'pendente', date: '2026-11-10T10:00:00Z', descricao: '3x Pastel' },
    { id: 'FD-2', clienteNome: 'Dona Maria', valor: 60.0, status: 'pendente', date: '2026-11-10T11:00:00Z', descricao: '2x Queijo' },
    { id: 'FD-3', clienteNome: 'Seu Zé', valor: 15.0, status: 'pendente', date: '2026-11-10T12:00:00Z', descricao: '1x Doce' },
    { id: 'FD-4', clienteNome: 'Jorge', valor: 30.0, status: 'pago', date: '2026-11-09T10:00:00Z', descricao: 'Caldo' }
  ];

  const kpis = calculateFiadoKPIs(fiados);
  assert.equal(kpis.totalPendente, 120.0);
  assert.equal(kpis.totalPago, 30.0);
  assert.equal(kpis.clientesPendentes, 2); // Seu Zé and Dona Maria (unique)
  assert.equal(kpis.countPendentes, 3);
  assert.equal(kpis.countPagos, 1);
});

test('filterFiados filters by status and client query', () => {
  const fiados: FiadoRecord[] = [
    { id: 'FD-1', clienteNome: 'Seu Zé', clienteTelefone: '11999991111', valor: 45.0, status: 'pendente', date: '2026-11-10T10:00:00Z', descricao: 'Pastéis' },
    { id: 'FD-2', clienteNome: 'Dona Maria', valor: 60.0, status: 'pago', date: '2026-11-10T11:00:00Z', descricao: 'Queijo' }
  ];

  const pendentes = filterFiados(fiados, { status: 'pendente' });
  assert.equal(pendentes.length, 1);
  assert.equal(pendentes[0].clienteNome, 'Seu Zé');

  const buscaTel = filterFiados(fiados, { query: '99999' });
  assert.equal(buscaTel.length, 1);
});

