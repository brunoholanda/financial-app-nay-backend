import { BadRequestException } from '@nestjs/common';
import { LedgerType } from '../../common/enums/ledger-type.enum';

export type ParsedOfxTransaction = {
  fitId: string;
  date: string;
  amount: number;
  type: LedgerType;
  title: string;
  description: string | null;
};

const STMTTRN_RE = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
const TAG_RE = /<([A-Z0-9.]+)>([^<\r\n]*)/gi;

function stripBom(raw: string): string {
  return raw.replace(/^\uFEFF/, '');
}

function normalizeOfxText(raw: string): string {
  let s = stripBom(raw);
  // OFX 1.x often has bare tags without closing; normalize common closings
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return s;
}

function tagMap(block: string): Record<string, string> {
  const map: Record<string, string> = {};
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(block)) !== null) {
    const key = m[1].toUpperCase();
    const val = m[2].trim();
    if (val && map[key] === undefined) {
      map[key] = val;
    }
  }
  return map;
}

/** OFX DTPOSTED: YYYYMMDD or YYYYMMDDHHMMSS[.XXX][:tz] */
export function parseOfxDate(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  const y = digits.slice(0, 4);
  const mo = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  const iso = `${y}-${mo}-${d}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (
    dt.getFullYear() !== Number(y) ||
    dt.getMonth() + 1 !== Number(mo) ||
    dt.getDate() !== Number(d)
  ) {
    return null;
  }
  return iso;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function buildTitle(map: Record<string, string>): {
  title: string;
  description: string | null;
} {
  const name = map.NAME?.trim() || map.PAYEE?.trim() || '';
  const memo = map.MEMO?.trim() || '';
  if (name && memo && name !== memo) {
    return {
      title: name.slice(0, 200),
      description: memo.slice(0, 2000),
    };
  }
  const title = (name || memo || map.TRNTYPE || 'Movimentação OFX').slice(
    0,
    200,
  );
  return { title, description: null };
}

function ensureClosedStmtTrn(text: string): string {
  // Some BR banks omit </STMTTRN>; split by <STMTTRN> and close before next
  if (/<\/STMTTRN>/i.test(text)) return text;
  const parts = text.split(/<STMTTRN>/i);
  if (parts.length <= 1) return text;
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const cut = chunk.search(
      /<STMTTRN>|<LEDGERBAL>|<BANKTRANLIST>|<\/BANKTRANLIST>/i,
    );
    const body = cut >= 0 ? chunk.slice(0, cut) : chunk;
    const rest = cut >= 0 ? chunk.slice(cut) : '';
    out += `<STMTTRN>${body}</STMTTRN>${rest}`;
  }
  return out;
}

function extractStmtTrnBlocks(text: string): string[] {
  const normalized = ensureClosedStmtTrn(text);
  const blocks: string[] = [];
  STMTTRN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STMTTRN_RE.exec(normalized)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

export function parseOfxBuffer(buffer: Buffer): ParsedOfxTransaction[] {
  let text: string;
  try {
    text = normalizeOfxText(buffer.toString('utf8'));
  } catch {
    throw new BadRequestException('Não foi possível ler o arquivo OFX.');
  }

  if (!/<OFX/i.test(text) && !/<STMTTRN/i.test(text)) {
    throw new BadRequestException(
      'Arquivo não parece ser OFX válido (tag OFX/STMTTRN ausente).',
    );
  }

  const blocks = extractStmtTrnBlocks(text);
  if (blocks.length === 0) {
    throw new BadRequestException(
      'Nenhuma movimentação (STMTTRN) encontrada no OFX.',
    );
  }

  const rows: ParsedOfxTransaction[] = [];
  const seenFit = new Set<string>();

  for (const block of blocks) {
    const map = tagMap(block);
    const fitId = (map.FITID || map.REFNUM || '').trim();
    if (!fitId) {
      continue;
    }
    if (seenFit.has(fitId)) {
      continue;
    }
    const date = map.DTPOSTED ? parseOfxDate(map.DTPOSTED) : null;
    const signed = map.TRNAMT ? parseAmount(map.TRNAMT) : null;
    if (!date || signed === null) {
      continue;
    }
    const type = signed > 0 ? LedgerType.INCOME : LedgerType.EXPENSE;
    const amount = Math.round(Math.abs(signed) * 100) / 100;
    if (amount < 0.01) continue;
    const { title, description } = buildTitle(map);
    seenFit.add(fitId);
    rows.push({
      fitId: fitId.slice(0, 128),
      date,
      amount,
      type,
      title: title.length >= 2 ? title : 'Movimentação OFX',
      description,
    });
  }

  if (rows.length === 0) {
    throw new BadRequestException(
      'Nenhuma movimentação válida encontrada no OFX (FITID/data/valor).',
    );
  }

  rows.sort(
    (a, b) => a.date.localeCompare(b.date) || a.fitId.localeCompare(b.fitId),
  );
  return rows;
}
