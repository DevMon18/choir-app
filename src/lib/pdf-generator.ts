import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { WaiverContent, DEFAULT_WAIVER_CONTENT } from './waiver-types';

export { type WaiverContent, DEFAULT_WAIVER_CONTENT };

interface GenerateCombinedWaiverPdfInput {
  templatePdfBuffer?: Buffer | Uint8Array;
  title: string;
  waiverContent?: WaiverContent;
}

/**
 * Word wraps text for pdf-lib text drawing.
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Combines an uploaded Activity Letter PDF (Page 1) with the official
 * Choir Activity Consent & Waiver template (Page 2), formatted as an elegant,
 * formal organizational letterhead agreement document.
 */
export async function generateCombinedWaiverPdf({
  templatePdfBuffer,
  title,
  waiverContent = DEFAULT_WAIVER_CONTENT,
}: GenerateCombinedWaiverPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // If a source Activity Letter PDF is provided, copy ONLY Page 0
  if (templatePdfBuffer && templatePdfBuffer.length > 0) {
    try {
      const srcDoc = await PDFDocument.load(templatePdfBuffer);
      if (srcDoc.getPageCount() > 0) {
        const [copiedPage] = await pdfDoc.copyPages(srcDoc, [0]);
        pdfDoc.addPage(copiedPage);
      }
    } catch (err) {
      console.error('[pdf-generator] Error copying template page:', err);
    }
  }

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Formal Executive Color Palette
  const primaryGreen = rgb(0.043, 0.302, 0.141); // #0b4d24
  const goldAccent = rgb(0.74, 0.58, 0.28);     // #bc9447
  const charcoalText = rgb(0.15, 0.18, 0.20);   // #262e33
  const mutedText = rgb(0.42, 0.46, 0.48);      // #6b757a
  const borderGray = rgb(0.82, 0.84, 0.85);     // #d1d6d9
  const tableHeaderBg = rgb(0.96, 0.97, 0.96);  // #f5f7f5

  // Create official Waiver Page (Standard A4 dimensions: 595.28 x 841.89)
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const margin = 46;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Load Choir Collective Logo if available
  let logoImage: any = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'collective-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBuffer);
    }
  } catch (err) {
    console.error('[pdf-generator] Logo load warning:', err);
  }

  // 1. Formal Executive Letterhead Header
  let headerTextX = margin;
  if (logoImage) {
    page.drawImage(logoImage, {
      x: margin,
      y: y - 36,
      width: 36,
      height: 36,
    });
    headerTextX = margin + 46;
  }

  page.drawText('CHOIR COLLECTIVE', {
    x: headerTextX,
    y: y - 12,
    size: 15,
    font: fontBold,
    color: primaryGreen,
  });

  page.drawText('OFFICIAL PARENTAL CONSENT & LIABILITY RELEASE FORM', {
    x: headerTextX,
    y: y - 24,
    size: 8,
    font: fontBold,
    color: goldAccent,
  });

  page.drawText('Activity Documentation & Verification Record', {
    x: headerTextX,
    y: y - 35,
    size: 7.5,
    font: fontOblique,
    color: mutedText,
  });

  // Right-aligned Date / Form Ref
  page.drawText('FORM REF: CC-WVR-2026', {
    x: margin + contentWidth - 115,
    y: y - 12,
    size: 8,
    font: fontBold,
    color: mutedText,
  });
  page.drawText(`DATE: ____________________`, {
    x: margin + contentWidth - 115,
    y: y - 24,
    size: 7.5,
    font: fontRegular,
    color: mutedText,
  });

  y -= 46;

  // Horizontal Letterhead Rule
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1.5,
    color: primaryGreen,
  });

  page.drawLine({
    start: { x: margin, y: y - 3 },
    end: { x: margin + contentWidth, y: y - 3 },
    thickness: 0.75,
    color: goldAccent,
  });

  y -= 22;

  // 2. Subject Line & Activity Title
  page.drawText('SUBJECT: PARENTAL CONSENT, MEDICAL AUTHORIZATION & LIABILITY RELEASE', {
    x: margin,
    y,
    size: 10.5,
    font: fontBold,
    color: primaryGreen,
  });

  y -= 15;

  page.drawText(`ACTIVITY TITLE: ${title.toUpperCase()}`, {
    x: margin,
    y,
    size: 9.5,
    font: fontBold,
    color: charcoalText,
  });

  y -= 16;

  // 3. Header Subtitle / Acknowledgement Recital
  const headerNote = waiverContent.headerNote || DEFAULT_WAIVER_CONTENT.headerNote!;
  const noteLines = wrapText(headerNote, contentWidth, fontOblique, 8.5);
  for (const line of noteLines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 8.5,
      font: fontOblique,
      color: mutedText,
    });
    y -= 12;
  }

  y -= 10;

  // Helper for drawing formal legal clauses
  const drawClause = (titleText?: string, bodyText?: string) => {
    if (!titleText && !bodyText) return;
    if (titleText) {
      page.drawText(titleText.toUpperCase(), {
        x: margin,
        y,
        size: 9,
        font: fontBold,
        color: primaryGreen,
      });
      y -= 13;
    }
    if (bodyText) {
      const lines = wrapText(bodyText, contentWidth, fontRegular, 8.5);
      for (const line of lines) {
        page.drawText(line, {
          x: margin,
          y,
          size: 8.5,
          font: fontRegular,
          color: charcoalText,
        });
        y -= 11.5;
      }
    }
    y -= 8;
  };

  // Section 1
  drawClause(
    waiverContent.clause1Title || DEFAULT_WAIVER_CONTENT.clause1Title,
    waiverContent.clause1Text || DEFAULT_WAIVER_CONTENT.clause1Text
  );

  // Section 2
  drawClause(
    waiverContent.clause2Title || DEFAULT_WAIVER_CONTENT.clause2Title,
    waiverContent.clause2Text || DEFAULT_WAIVER_CONTENT.clause2Text
  );

  // Section 3: Medical Authorization Wording
  drawClause(
    waiverContent.clause3Title || DEFAULT_WAIVER_CONTENT.clause3Title,
    waiverContent.clause3Text || DEFAULT_WAIVER_CONTENT.clause3Text
  );

  // Section 3: Formal Medical Disclosures Table
  const tableHeight = 48;
  const tableY = y - tableHeight;

  page.drawRectangle({
    x: margin,
    y: tableY,
    width: contentWidth,
    height: tableHeight,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: borderGray,
    borderWidth: 0.75,
  });

  page.drawRectangle({
    x: margin,
    y: tableY + 24,
    width: contentWidth,
    height: 24,
    color: tableHeaderBg,
  });

  page.drawLine({
    start: { x: margin, y: tableY + 24 },
    end: { x: margin + contentWidth, y: tableY + 24 },
    thickness: 0.75,
    color: borderGray,
  });

  page.drawText('Allergies / Medical Conditions:', {
    x: margin + 10,
    y: tableY + 31,
    size: 8,
    font: fontBold,
    color: primaryGreen,
  });
  page.drawText('___________________________________', {
    x: margin + 160,
    y: tableY + 31,
    size: 8,
    font: fontRegular,
    color: borderGray,
  });
  page.drawText('[   ]  No known allergies', {
    x: margin + 350,
    y: tableY + 31,
    size: 7.5,
    font: fontOblique,
    color: mutedText,
  });

  page.drawText('Current Routine Medications:', {
    x: margin + 10,
    y: tableY + 8,
    size: 8,
    font: fontBold,
    color: primaryGreen,
  });
  page.drawText('___________________________________', {
    x: margin + 160,
    y: tableY + 8,
    size: 8,
    font: fontRegular,
    color: borderGray,
  });
  page.drawText('[   ]  No current medications', {
    x: margin + 350,
    y: tableY + 8,
    size: 7.5,
    font: fontOblique,
    color: mutedText,
  });

  y = tableY - 14;

  // Section 4
  drawClause(
    waiverContent.clause4Title || DEFAULT_WAIVER_CONTENT.clause4Title,
    waiverContent.clause4Text || DEFAULT_WAIVER_CONTENT.clause4Text
  );

  // Section 5
  drawClause(
    waiverContent.clause5Title || DEFAULT_WAIVER_CONTENT.clause5Title,
    waiverContent.clause5Text || DEFAULT_WAIVER_CONTENT.clause5Text
  );

  // Special Instructions if provided
  if (waiverContent.specialInstructions && waiverContent.specialInstructions.trim()) {
    drawClause('SPECIAL INSTRUCTIONS & VENUE RULES', waiverContent.specialInstructions.trim());
  }

  // 4. Formal Contract Execution & Digital Signature Block
  const sigSectionY = margin + 110;

  page.drawLine({
    start: { x: margin, y: sigSectionY + 12 },
    end: { x: margin + contentWidth, y: sigSectionY + 12 },
    thickness: 1,
    color: primaryGreen,
  });

  page.drawText('IN WITNESS WHEREOF / EXECUTION OF RELEASE', {
    x: margin,
    y: sigSectionY,
    size: 9,
    font: fontBold,
    color: primaryGreen,
  });

  const sigBlockY = sigSectionY - 12;

  // Left Column (Details)
  page.drawText('Participant Full Name:', {
    x: margin,
    y: sigBlockY - 14,
    size: 8,
    font: fontBold,
    color: mutedText,
  });
  page.drawText('____________________________', {
    x: margin + 120,
    y: sigBlockY - 14,
    size: 8.5,
    font: fontRegular,
    color: borderGray,
  });

  page.drawText('Parent / Guardian Name:', {
    x: margin,
    y: sigBlockY - 32,
    size: 8,
    font: fontBold,
    color: mutedText,
  });
  page.drawText('____________________________', {
    x: margin + 120,
    y: sigBlockY - 32,
    size: 8.5,
    font: fontRegular,
    color: borderGray,
  });

  page.drawText('Execution Date & Time:', {
    x: margin,
    y: sigBlockY - 50,
    size: 8,
    font: fontBold,
    color: mutedText,
  });
  page.drawText('____________________________', {
    x: margin + 120,
    y: sigBlockY - 50,
    size: 8.5,
    font: fontRegular,
    color: borderGray,
  });

  // Right Column (Signature Box)
  const rightColX = margin + contentWidth - 220;
  const rightColWidth = 220;

  page.drawText('Parent / Guardian Digital Signature:', {
    x: rightColX,
    y: sigBlockY - 14,
    size: 8,
    font: fontBold,
    color: mutedText,
  });

  page.drawRectangle({
    x: rightColX,
    y: sigBlockY - 65,
    width: rightColWidth,
    height: 44,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: borderGray,
    borderWidth: 0.75,
  });

  page.drawText('(Signature Required Upon Member Signing)', {
    x: rightColX + 16,
    y: sigBlockY - 44,
    size: 7.5,
    font: fontOblique,
    color: rgb(0.6, 0.6, 0.6),
  });

  page.drawLine({
    start: { x: rightColX + 12, y: sigBlockY - 56 },
    end: { x: rightColX + rightColWidth - 12, y: sigBlockY - 56 },
    thickness: 0.75,
    color: primaryGreen,
  });

  page.drawText('(Official Digital Signature Record)', {
    x: rightColX + 38,
    y: sigBlockY - 76,
    size: 7,
    font: fontOblique,
    color: mutedText,
  });

  // 5. Formal Document Footer
  const footerY = margin - 14;
  page.drawLine({
    start: { x: margin, y: footerY + 12 },
    end: { x: margin + contentWidth, y: footerY + 12 },
    thickness: 0.5,
    color: borderGray,
  });

  page.drawText('Choir Collective Official Activity Documentation  •  Page 2 of 2  •  Confidential & Legal Record', {
    x: margin,
    y: footerY,
    size: 7.5,
    font: fontOblique,
    color: mutedText,
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
