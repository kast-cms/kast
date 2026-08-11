import { parseCsv, toCsvRow } from './csv.util';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('/a,/b,PERMANENT\n/c,/d,TEMPORARY')).toEqual([
      ['/a', '/b', 'PERMANENT'],
      ['/c', '/d', 'TEMPORARY'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('"/a,x","/b ""q""",PERMANENT')).toEqual([['/a,x', '/b "q"', 'PERMANENT']]);
  });

  it('drops fully blank lines and tolerates CRLF', () => {
    expect(parseCsv('/a,/b\r\n\r\n/c,/d\r\n')).toEqual([
      ['/a', '/b'],
      ['/c', '/d'],
    ]);
  });
});

describe('toCsvRow', () => {
  it('quotes values containing delimiters', () => {
    expect(toCsvRow(['/a', 'b,c', true, 5])).toBe('/a,"b,c",true,5');
  });
});
