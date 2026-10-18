/*
 * Planilha .xlsx mínima, montada no navegador: um ZIP sem compressão com o
 * XML do SpreadsheetML. O relatório só grava texto, número e data, e as
 * bibliotecas de planilha conhecidas pesam no bundle (a mais popular no npm
 * está parada com falhas conhecidas). Texto entra como string literal
 * (inlineStr), nunca como fórmula.
 */

export type XlsxDate = { serial: number; format: "date" | "datetime" };
export type XlsxCell = string | number | XlsxDate | null;

export type XlsxSheet = {
  name: string;
  /** Largura de cada coluna, em caracteres. */
  columnWidths: number[];
  /** A primeira linha é o cabeçalho: sai em negrito e fica congelada. */
  rows: XlsxCell[][];
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NS =
  "http://schemas.openxmlformats.org/package/2006/relationships";

// Limite do Excel por célula; um log de erro inteiro pode passar disso.
const MAX_CELL_TEXT = 32_767;
const MAX_SHEET_NAME = 31;

// Índices de cellXfs em STYLES_XML.
const STYLE_HEADER = 1;
const STYLE_DATETIME = 2;
const STYLE_DATE = 3;

const STYLES_XML = `${XML_HEADER}<styleSheet xmlns="${MAIN_NS}">\
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>\
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>\
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>\
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
<cellXfs count="4">\
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>\
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
</cellXfs>\
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>\
</styleSheet>`;

// Só os caracteres que o XML 1.0 aceita; o resto (controles vindos de log,
// por exemplo) deixaria o arquivo inválido e o Excel recusaria abrir.
const INVALID_XML_CHARS = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

function escapeXml(text: string) {
  return text
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let name = "";

  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }

  return name;
}

function textCell(ref: string, text: string, style: number) {
  const styleAttribute = style ? ` s="${style}"` : "";

  return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXml(
    text.slice(0, MAX_CELL_TEXT),
  )}</t></is></c>`;
}

function cellXml(cell: XlsxCell, ref: string, isHeader: boolean) {
  if (cell === null) {
    return "";
  }

  if (typeof cell === "string") {
    return textCell(ref, cell, isHeader ? STYLE_HEADER : 0);
  }

  if (typeof cell === "number") {
    return Number.isFinite(cell)
      ? `<c r="${ref}"><v>${cell}</v></c>`
      : textCell(ref, String(cell), 0);
  }

  const style = cell.format === "date" ? STYLE_DATE : STYLE_DATETIME;
  return `<c r="${ref}" s="${style}"><v>${cell.serial}</v></c>`;
}

function worksheetXml(sheet: XlsxSheet) {
  const columns = sheet.columnWidths.length
    ? `<cols>${sheet.columnWidths
        .map(
          (width, index) =>
            `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
        )
        .join("")}</cols>`
    : "";
  const rows = sheet.rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, columnIndex) =>
            cellXml(
              cell,
              `${columnName(columnIndex)}${rowIndex + 1}`,
              rowIndex === 0,
            ),
          )
          .join("")}</row>`,
    )
    .join("");

  return `${XML_HEADER}<worksheet xmlns="${MAIN_NS}">\
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>\
${columns}<sheetData>${rows}</sheetData></worksheet>`;
}

function sheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, MAX_SHEET_NAME);
}

function workbookFiles(sheets: XlsxSheet[]) {
  const sheetEntries = sheets.map((sheet, index) => ({
    path: `xl/worksheets/sheet${index + 1}.xml`,
    content: worksheetXml(sheet),
  }));

  return [
    {
      path: "[Content_Types].xml",
      content: `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
<Default Extension="xml" ContentType="application/xml"/>\
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\
${sheetEntries
  .map(
    (entry) =>
      `<Override PartName="/${entry.path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join("")}</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL_NS}">\
<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>\
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `${XML_HEADER}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheets
        .map(
          (sheet, index) =>
            `<sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
        )
        .join("")}</sheets></workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `${XML_HEADER}<Relationships xmlns="${PACKAGE_REL_NS}">${sheets
        .map(
          (_, index) =>
            `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
        )
        .join("")}<Relationship Id="rId${sheets.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`,
    },
    { path: "xl/styles.xml", content: STYLES_XML },
    ...sheetEntries,
  ];
}

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

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

// 01/01/1980, a primeira data que o ZIP representa; o Excel não usa.
const ZIP_DOS_DATE = (1 << 5) | 1;

/** ZIP com as entradas gravadas sem compressão ("stored"). */
function zipStored(files: { path: string; data: Uint8Array }[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(12, ZIP_DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    localParts.push(new Uint8Array(local.buffer), name, file.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(14, ZIP_DOS_DATE, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let position = 0;

  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }

  return output;
}

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function buildXlsx(sheets: XlsxSheet[]) {
  const encoder = new TextEncoder();

  return zipStored(
    workbookFiles(sheets).map((file) => ({
      path: file.path,
      data: encoder.encode(file.content),
    })),
  );
}
