import { parseOfxBuffer, parseOfxDate } from './ofx-parser';
import { LedgerType } from '../../common/enums/ledger-type.enum';

const SAMPLE_OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260315120000[-3:BRT]
<TRNAMT>-150.50
<FITID>ABC123
<MEMO>PIX ENVIADO JOAO
<NAME>PIX JOAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260320
<TRNAMT>2000.00
<FITID>XYZ999
<NAME>TED RECEBIDA
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe('ofx-parser', () => {
  it('parseOfxDate handles YYYYMMDD and datetime', () => {
    expect(parseOfxDate('20260315')).toBe('2026-03-15');
    expect(parseOfxDate('20260315120000[-3:BRT]')).toBe('2026-03-15');
  });

  it('parses SGML OFX stmttrn with income and expense', () => {
    const rows = parseOfxBuffer(Buffer.from(SAMPLE_OFX, 'utf8'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fitId: 'ABC123',
      date: '2026-03-15',
      amount: 150.5,
      type: LedgerType.EXPENSE,
      title: 'PIX JOAO',
    });
    expect(rows[0].description).toContain('PIX ENVIADO');
    expect(rows[1]).toMatchObject({
      fitId: 'XYZ999',
      date: '2026-03-20',
      amount: 2000,
      type: LedgerType.INCOME,
      title: 'TED RECEBIDA',
    });
  });

  it('parses XML-style closed STMTTRN', () => {
    const xml = `<?xml version="1.0"?>
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260101</DTPOSTED>
<TRNAMT>-10.00</TRNAMT>
<FITID>F1</FITID>
<NAME>Cafe</NAME>
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
    const rows = parseOfxBuffer(Buffer.from(xml, 'utf8'));
    expect(rows).toHaveLength(1);
    expect(rows[0].fitId).toBe('F1');
    expect(rows[0].type).toBe(LedgerType.EXPENSE);
    expect(rows[0].amount).toBe(10);
  });
});
