import zlib from 'zlib';

/*
|--------------------------------------------------------------------------
| Report Export Writers (CSV, XLSX, PDF)
|--------------------------------------------------------------------------
|
| Dependency-free writers so exports work on any machine that can run the
| API. Each writer receives the same report object:
|
|   { title, subtitle, generatedAt, filtersText, columns: [{ key, label,
|     type }], rows: [...], summary: [{ label, value }] }
|
*/

const cellText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 16);
  }

  return String(value);
};

/*
|--------------------------------------------------------------------------
| CSV
|--------------------------------------------------------------------------
*/

function csvEscape(value) {
  let text = cellText(value);

  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv(report) {
  const lines = [];

  lines.push(csvEscape(report.title));
  lines.push(csvEscape(`Generated ${cellText(report.generatedAt)}`));

  if (report.filtersText) {
    lines.push(csvEscape(`Filters: ${report.filtersText}`));
  }

  lines.push('');
  lines.push(report.columns.map((column) => csvEscape(column.label)).join(','));

  for (const row of report.rows) {
    lines.push(report.columns.map((column) => csvEscape(row[column.key])).join(','));
  }

  if (report.summary?.length) {
    lines.push('');
    lines.push('Summary,');

    for (const item of report.summary) {
      lines.push(`${csvEscape(item.label)},${csvEscape(item.value)}`);
    }
  }

  // UTF-8 BOM so Excel opens Sinhala/Tamil names correctly.
  return Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8');
}

/*
|--------------------------------------------------------------------------
| ZIP container (used by XLSX)
|--------------------------------------------------------------------------
*/

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { time, day };
}

export function createZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuffer, end]);
}

/*
|--------------------------------------------------------------------------
| XLSX
|--------------------------------------------------------------------------
*/

function xmlEscape(value) {
  return cellText(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function columnName(index) {
  let name = '';
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function xlsxCell(value, reference, style = 0, forceText = false) {
  const styleAttribute = style ? ` s="${style}"` : '';

  if (!forceText && typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  }

  if (value === null || value === undefined || value === '') {
    return `<c r="${reference}"${styleAttribute}/>`;
  }

  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function sheetXml(rows, columnWidths, freezeRow = null) {
  const cols = columnWidths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const pane =
    freezeRow !== null
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : '';

  const body = rows
    .map((row, rowIndex) => {
      const cells = row.cells
        .map((cell, columnIndex) =>
          xlsxCell(cell, `${columnName(columnIndex)}${rowIndex + 1}`, row.style || 0, row.text)
        )
        .join('');

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData></worksheet>`;
}

export function toXlsx(report) {
  const headerRowIndex = 4;

  const dataRows = [
    { cells: [report.title], style: 2 },
    { cells: [`Generated ${cellText(report.generatedAt)}`] },
    { cells: [report.filtersText ? `Filters: ${report.filtersText}` : 'Filters: none'] },
    { cells: [] },
    { cells: report.columns.map((column) => column.label), style: 1, text: true },
    ...report.rows.map((row) => ({
      cells: report.columns.map((column) => {
        const value = row[column.key];

        if (column.type === 'number' || column.type === 'currency') {
          const number = Number(value);

          return Number.isFinite(number) && value !== null && value !== '' ? number : value;
        }

        return value;
      })
    }))
  ];

  const widths = report.columns.map((column) => {
    const longest = report.rows
      .slice(0, 500)
      .reduce((max, row) => Math.max(max, cellText(row[column.key]).length), column.label.length);

    return Math.min(Math.max(longest + 2, 10), 60);
  });

  const summaryRows = [
    { cells: ['Summary', 'Value'], style: 1, text: true },
    ...(report.summary || []).map((item) => ({
      cells: [item.label, item.value]
    }))
  ];

  const files = [
    {
      name: '[Content_Types].xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'
    },
    {
      name: '_rels/.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'
    },
    {
      name: 'docProps/core.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(report.title)}</dc:title><dc:creator>High Street (PVT) Ltd.</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`
    },
    {
      name: 'xl/workbook.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets></workbook>'
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
    },
    {
      name: 'xl/styles.xml',
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2933"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: sheetXml(dataRows, widths, headerRowIndex + 1)
    },
    {
      name: 'xl/worksheets/sheet2.xml',
      data: sheetXml(summaryRows, [40, 30])
    }
  ];

  return createZip(files);
}

/*
|--------------------------------------------------------------------------
| PDF
|--------------------------------------------------------------------------
|
| Minimal PDF 1.4 writer using the standard Helvetica fonts (WinAnsi).
| Produces an A4 landscape document with a title block, summary and a
| paginated table with repeated column headings and page numbers.
|
*/

// Approximate Helvetica glyph widths (per 1000 units) for text fitting.
const NARROW = new Set(['i', 'l', 'j', 't', 'f', 'r', 'I', '.', ',', ':', ';', "'", '|', '!', ' ']);
const WIDE = new Set(['m', 'w', 'M', 'W', '@', '%']);

function textWidth(text, size) {
  let units = 0;

  for (const character of text) {
    if (NARROW.has(character)) {
      units += 300;
    } else if (WIDE.has(character)) {
      units += 850;
    } else if (character >= 'A' && character <= 'Z') {
      units += 650;
    } else if (character >= '0' && character <= '9') {
      units += 556;
    } else {
      units += 520;
    }
  }

  return (units / 1000) * size;
}

function toWinAnsi(text) {
  return cellText(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}

function pdfString(text) {
  return `(${toWinAnsi(text).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')})`;
}

function fitText(text, width, size) {
  let value = toWinAnsi(text);

  if (textWidth(value, size) <= width) {
    return value;
  }

  while (value.length > 1 && textWidth(`${value}...`, size) > width) {
    value = value.slice(0, -1);
  }

  return `${value}...`;
}

export function toPdf(report) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  const tableSize = 7.5;
  const rowHeight = 14;

  // Column widths proportional to content (capped), filling the page.
    const display = (column, value) => {
    if (
      (column.type === 'currency' || (column.type === 'number' && Math.abs(Number(value)) >= 10000)) &&
      value !== '' &&
      value !== null &&
      Number.isFinite(Number(value))
    ) {
      return Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
    }

    return value;
  };

  const weights = report.columns.map((column) => {
    const longest = report.rows
      .slice(0, 300)
      .reduce((max, row) => Math.max(max, toWinAnsi(display(column, row[column.key])).length), column.label.length);

    return Math.min(Math.max(longest + 1, 6), 38);
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const widths = weights.map((weight) => (weight / totalWeight) * usableWidth);

  const pages = [];
  let commands = [];
  let y = 0;

  const text = (value, x, top, size = 9, bold = false, color = '0.11 0.14 0.17') =>
    commands.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg ${x.toFixed(2)} ${(pageHeight - top).toFixed(2)} Td ${pdfString(value)} Tj ET`
    );

  const rect = (x, top, width, height, color) =>
    commands.push(
      `${color} rg ${x.toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`
    );

  const drawHeaderRow = () => {
    rect(margin, y, usableWidth, rowHeight + 2, '0.12 0.16 0.20');

    let x = margin + 3;

    report.columns.forEach((column, index) => {
      text(fitText(column.label, widths[index] - 6, tableSize), x, y + 10.5, tableSize, true, '1 1 1');
      x += widths[index];
    });

    y += rowHeight + 2;
  };

  const startPage = (first) => {
    commands = [];

    rect(0, 0, pageWidth, 6, '0.79 0.63 0.36');

    if (first) {
      text('HIGH STREET (PVT) LTD.', margin, 30, 8, true, '0.54 0.42 0.21');
      text(report.title, margin, 50, 16, true);
      text(`Generated ${cellText(report.generatedAt)}`, margin, 66, 8.5, false, '0.35 0.38 0.42');

      y = 80;

      if (report.filtersText) {
        text(fitText(`Filters: ${report.filtersText}`, usableWidth, 8.5), margin, y, 8.5, false, '0.35 0.38 0.42');
        y += 14;
      }

      if (report.summary?.length) {
        y += 4;
        const boxWidth = usableWidth / 4;

        report.summary.slice(0, 8).forEach((item, index) => {
          const column = index % 4;
          const row = Math.floor(index / 4);
          const boxX = margin + column * boxWidth;
          const boxTop = y + row * 34;

          rect(boxX + 2, boxTop, boxWidth - 4, 30, '0.96 0.95 0.92');
          text(fitText(item.label, boxWidth - 14, 7), boxX + 8, boxTop + 11, 7, false, '0.35 0.38 0.42');
          text(fitText(item.value, boxWidth - 14, 11), boxX + 8, boxTop + 25, 11, true);
        });

        y += Math.ceil(Math.min(report.summary.length, 8) / 4) * 34 + 8;
      }
    } else {
      text(report.title, margin, 28, 10, true);
      y = 40;
    }

    drawHeaderRow();
  };

  startPage(true);

  if (!report.rows.length) {
    text('No records match the selected filters.', margin, y + 16, 10, false, '0.35 0.38 0.42');
  }

  report.rows.forEach((row, rowIndex) => {
    if (y + rowHeight > pageHeight - margin) {
      pages.push(commands);
      startPage(false);
    }

    if (rowIndex % 2 === 0) {
      rect(margin, y, usableWidth, rowHeight, '0.97 0.97 0.96');
    }

    let x = margin + 3;

    report.columns.forEach((column, index) => {
      text(fitText(display(column, row[column.key]), widths[index] - 6, tableSize), x, y + 10, tableSize);
      x += widths[index];
    });

    y += rowHeight;
  });

  pages.push(commands);

  // Assemble objects.
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject(null);
  const pagesId = addObject(null);
  const fontRegular = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontBold = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];

  pages.forEach((pageCommands, index) => {
    const footer = `BT /F1 7 Tf 0.45 0.48 0.52 rg ${margin} 18 Td ${pdfString(
      `High Street (PVT) Ltd. - ${report.title}`
    )} Tj ET BT /F1 7 Tf 0.45 0.48 0.52 rg ${pageWidth - margin - 60} 18 Td ${pdfString(
      `Page ${index + 1} of ${pages.length}`
    )} Tj ET`;

    const stream = Buffer.from([...pageCommands, footer].join('\n'), 'latin1');
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`);

    pageIds.push(
      addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    );
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const infoId = addObject(
    `<< /Title ${pdfString(report.title)} /Producer (High Street Reports) /Creator (High Street (PVT) Ltd.) >>`
  );

  let output = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];

  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, 'latin1');

  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(output, 'latin1');
}

export const EXPORT_FORMATS = {
  csv: {
    contentType: 'text/csv; charset=utf-8',
    extension: 'csv',
    writer: toCsv
  },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    writer: toXlsx
  },
  pdf: {
    contentType: 'application/pdf',
    extension: 'pdf',
    writer: toPdf
  }
};
