/**
 * Professional Excel & SpreadsheetML Generator for Coretax Accounting
 * Generates styled Microsoft Excel (.xls / .xlsx compliant) workbooks without external libraries.
 */

window.CoretaxExport = {
  // Export an array of objects or table to Excel XML Spreadsheet
  exportToExcel: function(filename, sheetName, title, companyInfo, headers, data, totals) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#002B49"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CompanyStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#002B49" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TextLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="TextCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="Currency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalStyle">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#002B49"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetName || 'Laporan'}">
  <Table ss:DefaultColumnWidth="120">
`;

    // Title & Header rows
    xml += `   <Row ss:Height="24">
    <Cell ss:MergeAcross="${headers.length - 1}" ss:StyleID="TitleStyle"><Data ss:Type="String">${escapeXml(title || 'LAPORAN KEUANGAN')}</Data></Cell>
   </Row>\n`;

    if (companyInfo) {
      xml += `   <Row ss:Height="18">
    <Cell ss:MergeAcross="${headers.length - 1}" ss:StyleID="CompanyStyle"><Data ss:Type="String">Entitas: ${escapeXml(companyInfo.name || '')} | NPWP: ${escapeXml(companyInfo.npwp || '')}</Data></Cell>
   </Row>\n`;
    }

    xml += `   <Row ss:Height="10"></Row>\n`; // Blank space

    // Column Headers
    xml += `   <Row ss:Height="22">\n`;
    headers.forEach(h => {
      xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h.label)}</Data></Cell>\n`;
    });
    xml += `   </Row>\n`;

    // Data rows
    data.forEach(row => {
      xml += `   <Row ss:Height="18">\n`;
      headers.forEach(h => {
        const val = row[h.key];
        const isNum = typeof val === 'number' || (!isNaN(val) && val !== '' && val !== null && h.type === 'number');
        const styleId = h.align === 'center' ? 'TextCenter' : (isNum ? 'Currency' : 'TextLeft');
        const dataType = isNum ? 'Number' : 'String';
        const displayVal = val === null || val === undefined ? '' : val;

        xml += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="${dataType}">${isNum ? Number(displayVal) : escapeXml(String(displayVal))}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;
    });

    // Total row if supplied
    if (totals) {
      xml += `   <Row ss:Height="22">\n`;
      headers.forEach((h, idx) => {
        if (totals[h.key] !== undefined) {
          xml += `    <Cell ss:StyleID="TotalStyle"><Data ss:Type="Number">${Number(totals[h.key])}</Data></Cell>\n`;
        } else if (idx === 0) {
          xml += `    <Cell ss:StyleID="TotalStyle"><Data ss:Type="String">TOTAL</Data></Cell>\n`;
        } else {
          xml += `    <Cell ss:StyleID="TotalStyle"><Data ss:Type="String"></Data></Cell>\n`;
        }
      });
      xml += `   </Row>\n`;
    }

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (filename || 'Laporan-Akuntansi') + '.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Print current page or element with Coretax Header
  printReport: function(title, entity) {
    const printHeader = document.getElementById('print-header-area');
    if (printHeader && entity) {
      printHeader.innerHTML = `
        <div class="print-header">
          <h2>${entity.name || 'PT PERUSAHAAN'}</h2>
          <p>NPWP: ${entity.npwp || '-'} | KPP: ${entity.kpp || '-'}</p>
          <h3 style="margin-top: 8px; font-size: 13pt; text-decoration: underline;">${title || 'LAPORAN KEUANGAN'}</h3>
          <p style="font-size: 8.5pt; color: #555;">Dicetak pada: ${new Date().toLocaleString('id-ID')} | Sistem Akuntansi Terpadu Coretax</p>
        </div>
      `;
    }
    window.print();
  }
};

function escapeXml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
