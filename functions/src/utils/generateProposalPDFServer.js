const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const { numberToWords } = require('./numberToWords');
const fetch = require('node-fetch');

async function generateProposalPDFBuffer({ 
  companySettings, 
  lead,
  lineItems, 
  totals, 
  specialTerms,
  opportunityTitle 
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 14;
  const CONTENT_W = PAGE_W - (MARGIN * 2);

  const COLOR_DARK       = [26,  26,  46];
  const COLOR_MID_GREY   = [60, 60, 60];
  const COLOR_LIGHT_GREY = [240, 240, 240];
  const COLOR_WHITE      = [255, 255, 255];
  const COLOR_ACCENT     = [99,  102, 241];

  const loadLogoAsBase64 = async (url) => {
    try {
      if (url.startsWith('/')) {
        // Local path not resolvable from Cloud Functions easily
        return null;
      }
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = await response.buffer();
      const contentType = response.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  };

  let logoDataUrl = null;
  if (companySettings?.company?.logoUrl) {
    logoDataUrl = await loadLogoAsBase64(companySettings.company.logoUrl);
  }

  // --- BLOCK 1: Header Bar ---
  doc.setFillColor(...COLOR_DARK);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...COLOR_WHITE);
  doc.text('PROPOSAL', MARGIN, 17);

  if (logoDataUrl) {
    try {
      const formatMatch = logoDataUrl.match(/data:image\/([a-zA-Z]*);/);
      let format = 'PNG';
      if (formatMatch && formatMatch[1]) {
        const ext = formatMatch[1].toUpperCase();
        if (ext === 'JPEG' || ext === 'JPG') format = 'JPEG';
        else if (ext === 'WEBP') format = 'WEBP';
      }
      // Fixed dims for server
      const renderW = 35;
      const renderH = 20;
      const renderX = PAGE_W - MARGIN - renderW;
      const renderY = 4 + (20 - renderH) / 2;

      doc.addImage(logoDataUrl, format, renderX, renderY, renderW, renderH);
    } catch (e) {
      console.warn("Failed to embed logo into PDF:", e);
      doc.setFontSize(11);
      doc.text(companySettings?.company?.name || 'Company Name', PAGE_W - MARGIN - 35, 17);
    }
  } else {
    doc.setFontSize(11);
    doc.text(companySettings?.company?.name || 'Company Name', PAGE_W - MARGIN - 35, 17);
  }

  let currentY = 28;

  // --- BLOCK 2: Proposal Meta Row ---
  function formatPdfDate(dateStr) {
    if (!dateStr) return 'N/A';
    // If it's a Firestore Timestamp, handle it
    if (dateStr && dateStr.toDate) {
      dateStr = dateStr.toDate().toISOString().split('T')[0];
    } else if (dateStr instanceof Date) {
      dateStr = dateStr.toISOString().split('T')[0];
    }
    if (typeof dateStr !== 'string') return 'N/A';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }

  const p = lead.proposal || {};
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MID_GREY);
  doc.text(`Creation Date: ${formatPdfDate(p.creationDate)}   Expiry Date: ${formatPdfDate(p.expiryDate)}   Payment Terms: ${p.paymentTerms || 'N/A'}`, MARGIN, currentY);
  
  currentY += 4.5;
  doc.text(`Delivery/Completion: ${p.deliveryCompletion || 'N/A'}`, MARGIN, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_DARK);
  doc.text(`To: ${p.to || lead.clientName || 'Client'}`, MARGIN, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Dear ${p.dear || 'Sir/Madam'},`, MARGIN, currentY);

  currentY += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MID_GREY);
  const introText = "As per your requirement, We are pleased to submit our formal proposal and look forward to strengthen our relationship by providing the latest and most cost-effective products and solutions.";
  doc.text(introText, MARGIN, currentY, { maxWidth: CONTENT_W });

  const introLines = doc.splitTextToSize(introText, CONTENT_W).length;
  currentY += (introLines * 4.5) + 3;
  
  doc.setDrawColor(...COLOR_ACCENT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
  
  currentY += 4;

  // --- BLOCK 3: BILLING TO Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_DARK);
  doc.text('BILLING TO', MARGIN, currentY);

  currentY += 4;

  doc.autoTable({
    startY: currentY,
    head: [['Name', 'Company', 'Address', 'Pincode', 'Contact Info', 'GST No.']],
    body: [[
      lead.clientName || 'N/A',
      lead.companyName || 'N/A',
      `${lead.address || 'N/A'}\n${lead.city || 'N/A'}`,
      `${lead.city || 'N/A'}-\n${lead.pincode || 'N/A'}`,
      (lead.phoneNumber || '').split(',').join('\n'),
      lead.gstNo || 'N/A'
    ]],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: COLOR_DARK, textColor: COLOR_WHITE, fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 32 },
      2: { cellWidth: 40 },
      3: { cellWidth: 20 },
      4: { cellWidth: 36 },
      5: { cellWidth: 'auto' }
    },
    margin: { left: MARGIN, right: MARGIN }
  });

  currentY = doc.lastAutoTable.finalY + 4;
  if (lead.website) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MID_GREY);
    doc.text(`Web: ${lead.website}`, MARGIN, currentY);
    currentY += 4;
  }

  // --- BLOCK 4: PROPOSAL DETAILS Table ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_DARK);
  doc.text('PROPOSAL DETAILS', MARGIN, currentY);

  currentY += 4;

  const fmtNum = (n) => Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const tableBody = lineItems.map((item, idx) => [
    idx + 1,
    item.description || 'Item Description',
    `Rs ${fmtNum(item.unitPrice)}`,
    item.qty || 1,
    `Rs ${fmtNum(item.amount)}`,
  ]);

  doc.autoTable({
    startY: currentY,
    head: [['S.No', 'Item & Description', 'Unit Price', 'Qty', 'Amount']],
    body: tableBody,
    headStyles: { fillColor: COLOR_DARK, textColor: COLOR_WHITE, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5, textColor: COLOR_DARK },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    styles: { cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 32, halign: 'right' }
    },
    margin: { left: MARGIN, right: MARGIN }
  });

  currentY = doc.lastAutoTable.finalY + 4;

  // --- BLOCK 5: Totals Block ---
  const totalsBody = [];
  totalsBody.push(['Sub-Total', `Rs ${fmtNum(totals.subTotal)}`]);
  
  if (!totals.useIgst) {
    totalsBody.push(['CGST (9%)', `Rs ${fmtNum(totals.cgst)}`]);
    totalsBody.push(['SGST (9%)', `Rs ${fmtNum(totals.sgst)}`]);
  } else {
    totalsBody.push(['IGST (18%)', `Rs ${fmtNum(totals.igst)}`]);
  }
  totalsBody.push(['Total', `Rs ${fmtNum(totals.grandTotal)}`]);

  doc.autoTable({
    startY: currentY,
    margin: { left: PAGE_W - MARGIN - 82 },
    body: totalsBody,
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fontSize: 9 },
      1: { cellWidth: 32, halign: 'right', fontSize: 9 }
    },
    styles: { lineWidth: 0.1, lineColor: [220, 220, 220] },
    willDrawCell: function (data) {
      if (data.row.index === totalsBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 10;
        data.cell.styles.fillColor = COLOR_LIGHT_GREY;
      }
    }
  });

  currentY = doc.lastAutoTable.finalY + 4;
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MID_GREY);
  doc.text(`Amount in Words: ${numberToWords(totals.grandTotal)}`, MARGIN, currentY, { maxWidth: CONTENT_W });

  currentY += 6;

  // --- BLOCK 6: Special Terms & Conditions ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_DARK);
  doc.text('SPECIAL TERMS & CONDITIONS', MARGIN, currentY);
  
  currentY += 4;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const specialTermsText = specialTerms || 'Not specified.';
  doc.text(specialTermsText, MARGIN, currentY, { maxWidth: CONTENT_W });
  
  const linesCount = doc.splitTextToSize(specialTermsText, CONTENT_W).length;
  currentY += (linesCount * 5) + 4;
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
  
  currentY += 6;

  if (currentY > PAGE_H - 60) {
    doc.addPage();
    currentY = MARGIN;
  }

  // --- BLOCK 7: Footer: Payment Info + Company Details ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PAYMENT INFORMATION', MARGIN, currentY);
  doc.text('COMPANY DETAILS', MARGIN + 95, currentY);

  currentY += 5;
  
  doc.setFont('helvetica', 'normal');
  
  // Left: Payment
  const payment = companySettings?.payment || {};
  let leftY = currentY;

  const addLeftText = (txt) => {
    doc.text(txt, MARGIN, leftY, { maxWidth: 85 });
    leftY += doc.splitTextToSize(txt, 85).length * 4;
  };

  addLeftText(`Bank: ${payment.bankName || 'N/A'}`);
  addLeftText(`Account Name: ${payment.accountName || 'N/A'}`);
  addLeftText(`Account No.: ${payment.accountNumber || 'N/A'}`);
  addLeftText(`IFSC Code: ${payment.ifscCode || 'N/A'}`);
  addLeftText(`UPI No.: ${payment.upiNumber || 'N/A'}`);

  // Right: Company
  const comp = companySettings?.company || {};
  let rightY = currentY;

  const addRightText = (txt, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(txt, MARGIN + 95, rightY, { maxWidth: 85 });
    rightY += doc.splitTextToSize(txt, 85).length * 4;
  };

  addRightText(`${comp.name || 'N/A'}`, true);
  addRightText(`${comp.addressLine1 || 'N/A'}, ${comp.addressLine2 || ''}`);
  addRightText(`Pincode: ${comp.pincode || 'N/A'}`);
  
  const phones = Array.isArray(comp.phoneNumbers) ? comp.phoneNumbers.join(', ') : (comp.phoneNumbers || 'N/A');
  addRightText(`Phone: ${phones}`);
  addRightText(`Web: ${comp.website || 'N/A'}`);
  addRightText(`GST No: ${comp.gstNumber || 'N/A'}`);

  currentY = Math.max(leftY, rightY) + 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);

  // Footer caption
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('This is a system generated proposal and does not require a physical signature.', PAGE_W / 2, PAGE_H - 6, { align: 'center' });

  // --- BLOCK 8: Return Buffer ---
  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = { generateProposalPDFBuffer };
