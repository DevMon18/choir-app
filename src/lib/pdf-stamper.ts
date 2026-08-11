import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export interface GenerateSignedPdfInput {
  templatePdfBuffer: Buffer | Uint8Array;
  signaturePngBase64: string; // Base64 or Data URL (data:image/png;base64,...)
  signerPrintedName: string;
  signerRelationship?: string;
  memberName?: string;
  additionalNames?: string[];
  signedAtDate: string;
  verificationId: string;
}

/**
 * Stamps member/parent signature graphic OVER the printed name line
 * on the PDF template, styled with Choir Collective branding & colors.
 */
export async function generateSignedPdf({
  templatePdfBuffer,
  signaturePngBase64,
  signerPrintedName,
  signerRelationship = 'Self (18+)',
  memberName,
  additionalNames = [],
  signedAtDate,
  verificationId,
}: GenerateSignedPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templatePdfBuffer);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Clean base64 signature image data
  let cleanBase64 = signaturePngBase64;
  if (cleanBase64.includes('base64,')) {
    cleanBase64 = cleanBase64.split('base64,')[1];
  }
  const pngBytes = Buffer.from(cleanBase64, 'base64');
  const signatureImage = await pdfDoc.embedPng(pngBytes);

  // Load Choir Collective Logo from public directory
  let logoImage: any = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'collective-logo.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBuffer);
    }
  } catch (err) {
    console.error('[pdf-stamper] Warning: Could not load choir logo:', err);
  }

  const pages = pdfDoc.getPages();
  let page = pages[pages.length - 1];

  const { width, height } = page.getSize();

  // App Theme Colors
  const primaryGreen = rgb(0.043, 0.302, 0.141); // #0b4d24
  const goldAccent = rgb(0.772, 0.627, 0.349);   // #c5a059
  const creamBg = rgb(0.98, 0.973, 0.957);        // #faf8f4
  const darkText = rgb(0.12, 0.15, 0.12);
  const mutedText = rgb(0.35, 0.4, 0.35);

  const margin = 40;
  const boxX = margin;
  const boxY = 35;
  const boxWidth = width - margin * 2;
  const boxHeight = 160;

  // Check if last page has enough vertical space; if not, append a new page
  if (height < boxY + boxHeight + 20) {
    page = pdfDoc.addPage([width, height]);
  }

  // Draw Background Card Frame
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: creamBg,
    borderColor: primaryGreen,
    borderWidth: 1.5,
  });

  // Top Header Banner in Primary Deep Green
  const headerHeight = 28;
  page.drawRectangle({
    x: boxX,
    y: boxY + boxHeight - headerHeight,
    width: boxWidth,
    height: headerHeight,
    color: primaryGreen,
  });

  // Gold Accent Strip under Header
  page.drawRectangle({
    x: boxX,
    y: boxY + boxHeight - headerHeight - 2,
    width: boxWidth,
    height: 2,
    color: goldAccent,
  });

  // Embed Choir Logo in Header Banner
  let headerTextX = boxX + 12;
  if (logoImage) {
    const logoDims = logoImage.scale(0.04);
    const logoY = boxY + boxHeight - headerHeight + (headerHeight - Math.min(logoDims.height, 20)) / 2;
    page.drawImage(logoImage, {
      x: boxX + 8,
      y: logoY,
      width: Math.min(logoDims.width, 20),
      height: Math.min(logoDims.height, 20),
    });
    headerTextX = boxX + 34;
  }

  // Header Title
  page.drawText('CHOIR COLLECTIVE — DIGITAL SIGNATURE & CONSENT RECORD', {
    x: headerTextX,
    y: boxY + boxHeight - 18,
    size: 8.5,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  // Content Column 1: Details
  const textX = boxX + 16;
  let currentY = boxY + boxHeight - 44;

  // Member Account
  if (memberName) {
    page.drawText('Member Account:', {
      x: textX,
      y: currentY,
      size: 8.5,
      font: helveticaBold,
      color: mutedText,
    });
    page.drawText(memberName, {
      x: textX + 120,
      y: currentY,
      size: 9,
      font: helveticaFont,
      color: darkText,
    });
    currentY -= 15;
  }

  // Signer Name
  page.drawText('Signer Printed Name:', {
    x: textX,
    y: currentY,
    size: 8.5,
    font: helveticaBold,
    color: mutedText,
  });
  page.drawText(signerPrintedName, {
    x: textX + 120,
    y: currentY,
    size: 9.5,
    font: helveticaBold,
    color: primaryGreen,
  });

  // Relationship
  currentY -= 15;
  page.drawText('Relationship to Member:', {
    x: textX,
    y: currentY,
    size: 8.5,
    font: helveticaBold,
    color: mutedText,
  });
  page.drawText(signerRelationship, {
    x: textX + 120,
    y: currentY,
    size: 9,
    font: helveticaBold,
    color: goldAccent,
  });

  // Dependents List if present
  if (additionalNames && additionalNames.length > 0) {
    currentY -= 15;
    page.drawText('Dependents Covered:', {
      x: textX,
      y: currentY,
      size: 8.5,
      font: helveticaBold,
      color: mutedText,
    });
    page.drawText(additionalNames.join(', '), {
      x: textX + 120,
      y: currentY,
      size: 8.5,
      font: helveticaFont,
      color: darkText,
    });
  }

  // Date & Audit Ref
  currentY -= 15;
  page.drawText(`Date Signed: ${signedAtDate}`, {
    x: textX,
    y: currentY,
    size: 8.5,
    font: helveticaFont,
    color: mutedText,
  });

  page.drawText(`Audit Ref: ${verificationId.substring(0, 18)}...`, {
    x: textX,
    y: boxY + 10,
    size: 7.5,
    font: helveticaFont,
    color: rgb(0.55, 0.55, 0.55),
  });

  // Signature Line & Overlap (Right Side)
  const sigLineY = boxY + 30;
  const sigLineX = boxX + boxWidth - 180;
  const sigLineWidth = 165;

  // Signature Label
  page.drawText('Signature of Signer / Guardian:', {
    x: sigLineX,
    y: sigLineY + 36,
    size: 8.5,
    font: helveticaBold,
    color: mutedText,
  });

  // Draw Signature Base Line in Primary Green
  page.drawLine({
    start: { x: sigLineX, y: sigLineY },
    end: { x: sigLineX + sigLineWidth, y: sigLineY },
    thickness: 1,
    color: primaryGreen,
  });

  // Printed Name Subtitle Below Line
  page.drawText(`${signerPrintedName} (${signerRelationship})`, {
    x: sigLineX + 4,
    y: sigLineY - 11,
    size: 7.5,
    font: helveticaFont,
    color: mutedText,
  });

  // Stamp Signature PNG Graphic DIRECTLY OVER the Signature Line
  const sigImageDims = signatureImage.scale(0.35);
  const imgWidth = Math.min(sigImageDims.width, 155);
  const imgHeight = Math.min(sigImageDims.height, 40);

  page.drawImage(signatureImage, {
    x: sigLineX + (sigLineWidth - imgWidth) / 2,
    y: sigLineY - 4, // Overlaps line directly
    width: imgWidth,
    height: imgHeight,
  });

  return await pdfDoc.save();
}
