export interface Transaction {
  id: string;
  type: 'recebimento' | 'pagamento';
  description: string;
  amount: number;
  category: string;
  paymentMethod: 'dinheiro' | 'pix' | 'debito' | 'credito' | 'outro';
  date: string; // ISO string
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
}

export interface KPIResult {
  totalRecebimentos: number;
  totalPagamentos: number;
  saldoLiquido: number;
  totalOperacoes: number;
  ticketMedio: number;
  breakdown: {
    dinheiro: number;
    pix: number;
    debito: number;
    credito: number;
    outro: number;
  };
}

export function calculateChange(total: number, received: number) {
  if (received < total || total <= 0) {
    return {
      change: 0,
      isValid: received >= total,
      breakdown: []
    };
  }
  const change = Math.round((received - total) * 100) / 100;
  
  // Calculate breakdown for change in Brazilian Real denominations
  const denominations = [100, 50, 20, 10, 5, 2, 1, 0.50, 0.25, 0.10, 0.05];
  let remaining = Math.round(change * 100);
  const breakdown: Array<{ value: number; count: number; label: string }> = [];

  for (const denom of denominations) {
    const denomCents = Math.round(denom * 100);
    if (remaining >= denomCents) {
      const count = Math.floor(remaining / denomCents);
      remaining %= denomCents;
      const isNote = denom >= 2;
      breakdown.push({
        value: denom,
        count,
        label: `${count}x ${isNote ? 'Nota' : 'Moeda'} de R$ ${denom.toFixed(2).replace('.', ',')}`
      });
    }
  }

  return {
    change,
    isValid: true,
    breakdown
  };
}

export function calculateKPIs(transactions: Transaction[]): KPIResult {
  let totalRecebimentos = 0;
  let totalPagamentos = 0;
  let countRecebimentos = 0;
  const breakdown = {
    dinheiro: 0,
    pix: 0,
    debito: 0,
    credito: 0,
    outro: 0
  };

  for (const tx of transactions) {
    if (tx.type === 'recebimento') {
      totalRecebimentos += tx.amount;
      countRecebimentos += 1;
      if (breakdown[tx.paymentMethod] !== undefined) {
        breakdown[tx.paymentMethod] += tx.amount;
      } else {
        breakdown.outro += tx.amount;
      }
    } else if (tx.type === 'pagamento') {
      totalPagamentos += tx.amount;
    }
  }

  const saldoLiquido = Math.round((totalRecebimentos - totalPagamentos) * 100) / 100;
  const ticketMedio = countRecebimentos > 0 ? Math.round((totalRecebimentos / countRecebimentos) * 100) / 100 : 0;

  return {
    totalRecebimentos: Math.round(totalRecebimentos * 100) / 100,
    totalPagamentos: Math.round(totalPagamentos * 100) / 100,
    saldoLiquido,
    totalOperacoes: transactions.length,
    ticketMedio,
    breakdown: {
      dinheiro: Math.round(breakdown.dinheiro * 100) / 100,
      pix: Math.round(breakdown.pix * 100) / 100,
      debito: Math.round(breakdown.debito * 100) / 100,
      credito: Math.round(breakdown.credito * 100) / 100,
      outro: Math.round(breakdown.outro * 100) / 100
    }
  };
}

export function filterTransactions(
  transactions: Transaction[],
  filters: {
    type?: string;
    paymentMethod?: string;
    query?: string;
    period?: string;
  }
): Transaction[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  return transactions.filter(tx => {
    if (filters.type && filters.type !== 'todos' && tx.type !== filters.type) {
      return false;
    }
    if (filters.paymentMethod && filters.paymentMethod !== 'todos' && tx.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    if (filters.query) {
      const q = filters.query.toLowerCase().trim();
      const matchDesc = tx.description.toLowerCase().includes(q);
      const matchCat = tx.category.toLowerCase().includes(q);
      const matchItems = tx.items?.some(it => it.name.toLowerCase().includes(q));
      if (!matchDesc && !matchCat && !matchItems) return false;
    }
    if (filters.period && filters.period !== 'todos') {
      const txDateStr = tx.date.split('T')[0];
      if (filters.period === 'hoje' && txDateStr !== todayStr) {
        return false;
      }
      if (filters.period === 'ultimos7dias') {
        const diffMs = now.getTime() - new Date(tx.date).getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      }
    }
    return true;
  });
}

export function generateCSV(transactions: Transaction[]): string {
  const headers = ['ID', 'Data/Hora', 'Tipo', 'Descricao', 'Categoria', 'Forma_Pagamento', 'Valor_BRL'];
  const rows = transactions.map(tx => {
    const d = new Date(tx.date);
    const dateFormatted = d.toLocaleString('pt-BR');
    const valorFormatted = tx.amount.toFixed(2).replace('.', ',');
    const cleanDesc = `"${tx.description.replace(/"/g, '""')}"`;
    return [tx.id, dateFormatted, tx.type.toUpperCase(), cleanDesc, tx.category, tx.paymentMethod.toUpperCase(), valorFormatted].join(';');
  });
  return [headers.join(';'), ...rows].join('\r\n');
}
