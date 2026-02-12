export interface ExportColumn<T = Record<string, unknown>> {
  header: string;
  accessor: (row: T) => string | number;
  format?: 'currency' | 'date' | 'text';
}

export interface ExportConfig<T = Record<string, unknown>> {
  filename: string;
  title?: string;
  columns: ExportColumn<T>[];
  data: T[];
}

function formatCellValue(value: string | number, format?: string): string {
  if (value === null || value === undefined) return '';
  if (format === 'currency' && typeof value === 'number') {
    return new Intl.NumberFormat('ko-KR').format(value);
  }
  return String(value);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportToCSV<T>(config: ExportConfig<T>): void {
  const BOM = '\uFEFF';
  const headers = config.columns.map(c => escapeCSVField(c.header));

  const rows = config.data.map(row =>
    config.columns.map(col => {
      const val = col.accessor(row);
      const formatted = formatCellValue(val, col.format);
      return escapeCSVField(formatted);
    })
  );

  const csvContent = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${config.filename}.csv`);
}

export async function exportToExcel<T>(config: ExportConfig<T>): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(config.title || 'Sheet1');

  // 헤더 행
  const headerRow = sheet.addRow(config.columns.map(c => c.header));
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5614E' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } },
    };
  });
  headerRow.height = 28;

  // 데이터 행
  config.data.forEach((row) => {
    const values = config.columns.map(col => {
      const val = col.accessor(row);
      if (col.format === 'currency' && typeof val === 'number') return val;
      return formatCellValue(val, col.format);
    });

    const dataRow = sheet.addRow(values);

    config.columns.forEach((col, colIdx) => {
      if (col.format === 'currency') {
        const cell = dataRow.getCell(colIdx + 1);
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  });

  // 열 너비 자동 조정
  sheet.columns.forEach((column, idx) => {
    const header = config.columns[idx]?.header || '';
    let maxLen = header.length * 2;
    config.data.forEach(row => {
      const val = config.columns[idx]?.accessor(row);
      const str = formatCellValue(val as string | number, config.columns[idx]?.format);
      maxLen = Math.max(maxLen, str.length * 1.2);
    });
    column.width = Math.max(Math.min(maxLen + 4, 40), 10);
  });

  // 자동 필터
  if (config.data.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: config.columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${config.filename}.xlsx`);
}

export async function exportToPDF<T>(config: ExportConfig<T>): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { font: nanumGothicBase64 } = await import('@/lib/fonts/nanumgothic-normal');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // 한글 폰트 등록
  doc.addFileToVFS('NanumGothic-Regular.ttf', nanumGothicBase64);
  doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
  doc.setFont('NanumGothic');

  // 제목
  doc.setFontSize(16);
  doc.text(config.title || config.filename, 14, 15);

  // 내보내기 일시
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`내보내기 일시: ${new Date().toLocaleString('ko-KR')}`, 14, 22);
  doc.setTextColor(0);

  const head = [config.columns.map(c => c.header)];
  const body = config.data.map(row =>
    config.columns.map(col => formatCellValue(col.accessor(row), col.format))
  );

  autoTable(doc, {
    head,
    body,
    startY: 28,
    styles: {
      font: 'NanumGothic',
      fontStyle: 'normal',
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [229, 97, 78],
      textColor: 255,
      fontStyle: 'normal',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${config.filename}.pdf`);
}
