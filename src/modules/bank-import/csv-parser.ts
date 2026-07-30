import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import type { ParsedOfxTransaction } from './ofx-parser';

function stripBom(buf: Buffer): Buffer {
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3);
  }
  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2);
  }
  // UTF-16 BE BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.subarray(2);
  }
  return buf;
}

function decodeCsvBuffer(buffer: Buffer): string {
  const raw = stripBom(buffer);
  // UTF-16 LE (Excel export do app): many NULs in odd positions
  if (raw.length >= 4 && raw[1] === 0 && raw[3] === 0) {
    return raw.toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return stripBom(buffer).toString('utf16le');
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const le = Buffer.alloc(stripBom(buffer).length);
    const be = stripBom(buffer);
    for (let i = 0; i + 1 < be.length; i += 2) {
      le[i] = be[i + 1];
      le[i + 1] = be[i];
    }
    return le.toString('utf16le');
  }
  return raw.toString('utf8');
}

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function detectDelimiter(sampleLine: string): ';' | ',' | '\t' {
  const counts = {
    ';': (sampleLine.match(/;/g) || []).length,
    ',': (sampleLine.match(/,/g) || []).length,
    '\t': (sampleLine.match(/\t/g) || []).length,
  };
  if (counts['\t'] > counts[';'] && counts['\t'] > counts[',']) return '\t';
  if (counts[';'] >= counts[',']) return ';';
  return ',';
}

/** Parse uma linha CSV respeitando aspas. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

type ColKind =
  | 'date'
  | 'title'
  | 'amount'
  | 'debit'
  | 'credit'
  | 'type'
  | 'id'
  | 'description';

const HEADER_ALIASES: Record<ColKind, string[]> = {
  date: [
    'data',
    'date',
    'dt',
    'data lancamento',
    'data do lancamento',
    'dtposted',
    'posted',
    'data movimento',
    'data mov',
  ],
  title: [
    'titulo',
    'title',
    'historico',
    'descricao',
    'description',
    'lancamento',
    'nome',
    'name',
    'memo',
    'payee',
    'estabelecimento',
  ],
  amount: [
    'valor',
    'amount',
    'valor r',
    'quantia',
    'vlr',
    'trnamt',
    'valor lancamento',
  ],
  debit: ['debito', 'debit', 'saida', 'despesa', 'valor debito'],
  credit: ['credito', 'credit', 'entrada', 'receita', 'valor credito'],
  type: ['tipo', 'type', 'natureza', 'dc', 'c d'],
  id: [
    'id',
    'fitid',
    'fit id',
    'identificador',
    'ref',
    'referencia',
    'documento',
    'n documento',
    'num documento',
  ],
  description: [
    'observacao',
    'observacoes',
    'notes',
    'complemento',
    'detalhe',
    'detalhes',
  ],
};

function mapHeaders(headers: string[]): Partial<Record<ColKind, number>> {
  const map: Partial<Record<ColKind, number>> = {};
  headers.forEach((h, idx) => {
    const n = normalizeHeader(h);
    if (!n || n === 'sep') return;
    for (const [kind, aliases] of Object.entries(HEADER_ALIASES) as [
      ColKind,
      string[],
    ][]) {
      if (map[kind] !== undefined) continue;
      if (aliases.includes(n)) {
        map[kind] = idx;
        break;
      }
    }
  });
  return map;
}

export function parseCsvDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const br = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (br) {
    const d = br[1].padStart(2, '0');
    const m = br[2].padStart(2, '0');
    const y = br[3];
    const iso = `${y}-${m}-${d}`;
    const dt = new Date(`${iso}T12:00:00`);
    if (
      !Number.isNaN(dt.getTime()) &&
      dt.getFullYear() === Number(y) &&
      dt.getMonth() + 1 === Number(m) &&
      dt.getDate() === Number(d)
    ) {
      return iso;
    }
  }
  // YYYYMMDD
  const compact = s.replace(/[^0-9]/g, '');
  if (compact.length === 8) {
    const y = compact.slice(0, 4);
    const m = compact.slice(4, 6);
    const d = compact.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function parseCsvAmount(raw: string): number | null {
  let s = raw.trim().replace(/\u00a0/g, ' ').replace(/\s/g, '');
  if (!s) return null;
  s = s.replace(/^R\$\s*/i, '');
  // (1.234,56) → negative
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  // 1.234,56 (BR) vs 1,234.56 (US)
  if (/\d,\d{2}$/.test(s) || (s.includes('.') && s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.'))) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\d\.\d{2}$/.test(s) && s.includes(',')) {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n === 0) return null;
  const abs = Math.round(Math.abs(n) * 100) / 100;
  return neg ? -abs : abs;
}

function parseType(raw: string, signedAmount: number | null): LedgerType | null {
  const n = normalizeHeader(raw);
  if (
    n === 'receita' ||
    n === 'income' ||
    n === 'credito' ||
    n === 'credit' ||
    n === 'c' ||
    n === 'entrada' ||
    n === '+'
  ) {
    return LedgerType.INCOME;
  }
  if (
    n === 'despesa' ||
    n === 'expense' ||
    n === 'debito' ||
    n === 'debit' ||
    n === 'd' ||
    n === 'saida' ||
    n === '-'
  ) {
    return LedgerType.EXPENSE;
  }
  if (signedAmount !== null) {
    return signedAmount > 0 ? LedgerType.INCOME : LedgerType.EXPENSE;
  }
  return null;
}

function syntheticFitId(parts: string[]): string {
  const hash = createHash('sha256')
    .update(parts.join('|'), 'utf8')
    .digest('hex')
    .slice(0, 40);
  return `csv:${hash}`.slice(0, 128);
}

export function parseCsvBuffer(buffer: Buffer): ParsedOfxTransaction[] {
  let text: string;
  try {
    text = decodeCsvBuffer(buffer);
  } catch {
    throw new BadRequestException('Não foi possível ler o arquivo CSV.');
  }
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  // Skip Excel sep=; hint
  let start = 0;
  if (lines[0] && /^sep\s*=/i.test(lines[0].trim())) {
    start = 1;
  }
  if (lines.length - start < 2) {
    throw new BadRequestException(
      'CSV precisa de cabeçalho e ao menos uma linha de dados.',
    );
  }

  const headerLine = lines[start];
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCsvLine(headerLine, delimiter);
  const col = mapHeaders(headers);

  if (col.date === undefined) {
    throw new BadRequestException(
      'CSV sem coluna de data. Use cabeçalhos como: Data, Título/Histórico, Valor (ou Débito/Crédito).',
    );
  }
  if (
    col.amount === undefined &&
    col.debit === undefined &&
    col.credit === undefined
  ) {
    throw new BadRequestException(
      'CSV sem coluna de valor. Use Valor, ou Débito e Crédito.',
    );
  }
  if (col.title === undefined && col.description === undefined) {
    throw new BadRequestException(
      'CSV sem coluna de descrição/título. Use Título, Histórico ou Descrição.',
    );
  }

  const rows: ParsedOfxTransaction[] = [];
  const seenFit = new Set<string>();

  for (let i = start + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter);
    const dateRaw = cells[col.date!] ?? '';
    const date = parseCsvDate(dateRaw);
    if (!date) continue;

    let signed: number | null = null;
    if (col.amount !== undefined) {
      signed = parseCsvAmount(cells[col.amount] ?? '');
    } else {
      const debit = col.debit !== undefined ? parseCsvAmount(cells[col.debit] ?? '') : null;
      const credit =
        col.credit !== undefined ? parseCsvAmount(cells[col.credit] ?? '') : null;
      if (credit !== null && credit !== 0) {
        signed = Math.abs(credit);
      } else if (debit !== null && debit !== 0) {
        signed = -Math.abs(debit);
      }
    }
    if (signed === null || signed === 0) continue;

    const typeRaw = col.type !== undefined ? cells[col.type] ?? '' : '';
    const type = parseType(typeRaw, signed);
    if (!type) continue;

    const titleSrc =
      (col.title !== undefined ? cells[col.title] : '') ||
      (col.description !== undefined ? cells[col.description] : '') ||
      '';
    const title = titleSrc.trim().slice(0, 200) || 'Movimentação CSV';
    if (title.length < 2) continue;

    let description: string | null = null;
    if (
      col.description !== undefined &&
      col.title !== undefined &&
      col.description !== col.title
    ) {
      const d = (cells[col.description] ?? '').trim();
      if (d && d !== title) description = d.slice(0, 2000);
    }

    const amount = Math.round(Math.abs(signed) * 100) / 100;
    if (amount < 0.01) continue;

    const idRaw =
      col.id !== undefined ? (cells[col.id] ?? '').trim() : '';
    const fitId = idRaw
      ? idRaw.slice(0, 128)
      : syntheticFitId([
          date,
          type,
          amount.toFixed(2),
          title.toLowerCase(),
          description?.toLowerCase() ?? '',
        ]);

    if (seenFit.has(fitId)) continue;
    seenFit.add(fitId);

    rows.push({
      fitId,
      date,
      amount,
      type,
      title: title.length >= 2 ? title : 'Movimentação CSV',
      description,
    });
  }

  if (rows.length === 0) {
    throw new BadRequestException(
      'Nenhuma linha válida no CSV (verifique data, valor e título).',
    );
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.fitId.localeCompare(b.fitId));
  return rows;
}
