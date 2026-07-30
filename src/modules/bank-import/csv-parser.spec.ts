import {
  parseCsvAmount,
  parseCsvBuffer,
  parseCsvDate,
  splitCsvLine,
} from './csv-parser';
import { LedgerType } from '../../common/enums/ledger-type.enum';

describe('csv-parser', () => {
  it('splitCsvLine respects quotes and delimiter', () => {
    expect(splitCsvLine('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd']);
  });

  it('parseCsvDate accepts BR and ISO', () => {
    expect(parseCsvDate('15/03/2026')).toBe('2026-03-15');
    expect(parseCsvDate('2026-03-15')).toBe('2026-03-15');
  });

  it('parseCsvAmount handles BR currency', () => {
    expect(parseCsvAmount('R$ 1.234,56')).toBe(1234.56);
    expect(parseCsvAmount('-150,50')).toBe(-150.5);
    expect(parseCsvAmount('(10,00)')).toBe(-10);
  });

  it('parses bank-style CSV with signed amount', () => {
    const csv = `Data;Histórico;Valor
15/03/2026;PIX JOAO;-150,50
20/03/2026;TED RECEBIDA;2000,00
`;
    const rows = parseCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: '2026-03-15',
      amount: 150.5,
      type: LedgerType.EXPENSE,
      title: 'PIX JOAO',
    });
    expect(rows[1]).toMatchObject({
      date: '2026-03-20',
      amount: 2000,
      type: LedgerType.INCOME,
      title: 'TED RECEBIDA',
    });
    expect(rows[0].fitId.startsWith('csv:')).toBe(true);
  });

  it('parses debit/credit columns and explicit id', () => {
    const csv = `Date,Description,Debit,Credit,Id
2026-01-01,Cafe,10.00,,F1
2026-01-02,Salario,,5000.00,F2
`;
    const rows = parseCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fitId: 'F1',
      type: LedgerType.EXPENSE,
      amount: 10,
      title: 'Cafe',
    });
    expect(rows[1]).toMatchObject({
      fitId: 'F2',
      type: LedgerType.INCOME,
      amount: 5000,
    });
  });

  it('skips sep= hint from Excel', () => {
    const csv = `sep=;
Data;Título;Valor;Tipo
01/02/2026;Aluguel;1200,00;Despesa
`;
    const rows = parseCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe(LedgerType.EXPENSE);
    expect(rows[0].title).toBe('Aluguel');
  });
});
