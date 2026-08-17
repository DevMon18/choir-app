import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DEFAULT_WAIVER_CONTENT, WaiverContent } from './waiver-types';

export interface GenerateSignedPdfInput {
  templatePdfBuffer: Buffer | Uint8Array;
  signaturePngBase64: string; // Base64 or Data URL
  signerPrintedName: string;
  signerRelationship?: string;
  memberName?: string;
  additionalNames?: string[];
  signedAtDate: string;
  verificationId: string;
  knownAllergies?: string;
  noAllergies?: boolean;
  currentMedications?: string;
  noMedications?: boolean;
  waiverContent?: WaiverContent;
}

/**
 * Word-wraps text identically to pdf-generator.ts wrapText() so we can
 * simulate the cursor-Y after each drawClause call without re-rendering.
 */
function simulateWrap(text: string, maxWidth: number, font: any, fontSize: number): number {
  const words = text.split(' ');
  let lines = 1;
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines++;
      currentLine = word;
    }
  }
  return lines;
}

/**
 * Simulates the Y-cursor drop from a drawClause call (title + body text).
 * Mirrors the exact logic in pdf-generator.ts drawClause().
 */
function simulateClauseHeight(
  titleText: string | undefined,
  bodyText: string | undefined,
  contentWidth: number,
  font: any,
  fontBold: any
): number {
  let drop = 0;
  if (!titleText && !bodyText) return drop;
  if (titleText) {
    drop += 13; // title drawText + y -= 13
  }
  if (bodyText) {
    const lineCount = simulateWrap(bodyText, contentWidth, font, 8.5);
    drop += lineCount * 11.5; // y -= 11.5 per line
  }
  drop += 8; // y -= 8 at end of drawClause
  return drop;
}

/**
 * Stamps member/parent signature graphic, actual medical choices, and vertical
 * participant list onto the PDF template. Dynamically computes tableY by
 * replaying the same text-layout math as pdf-generator.ts so coordinates
 * are always correct regardless of waiver clause lengths.
 */
export async function generateSignedPdf({
  templatePdfBuffer,
  signaturePngBase64,
  signerPrintedName,
  signerRelationship = 'Parent / Guardian',
  memberName,
  additionalNames = [],
  signedAtDate,
  verificationId,
  knownAllergies,
  noAllergies,
  currentMedications,
  noMedications,
  waiverContent = DEFAULT_WAIVER_CONTENT,
}: GenerateSignedPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(templatePdfBuffer);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Clean base64 signature image data
  let cleanBase64 = signaturePngBase64;
  if (cleanBase64.includes('base64,')) {
    cleanBase64 = cleanBase64.split('base64,')[1];
  }
  const pngBytes = Buffer.from(cleanBase64, 'base64');
  const signatureImage = await pdfDoc.embedPng(pngBytes);

  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1]; // Page 2 (Consent & Waiver)
  const { width, height } = page.getSize();

  // --- Match EXACT constants from pdf-generator.ts ---
  const margin = 46;
  const contentWidth = width - margin * 2;

  // Color palette (matches generator)
  const primaryGreen = rgb(0.043, 0.302, 0.141);
  const goldAccent = rgb(0.74, 0.58, 0.28);  // eslint-disable-line @typescript-eslint/no-unused-vars
  const darkText = rgb(0.12, 0.15, 0.12);
  const mutedText = rgb(0.42, 0.46, 0.48);
  const white = rgb(1, 1, 1);
  const tableHeaderBg = rgb(0.96, 0.97, 0.96);
  const borderGray = rgb(0.82, 0.84, 0.85);

  // Build complete list of all covered participants (Primary Member + Siblings)
  const allParticipants: string[] = [];
  if (memberName && memberName.trim()) {
    allParticipants.push(memberName.trim());
  }
  if (additionalNames && additionalNames.length > 0) {
    additionalNames.forEach((n) => {
      const trimmed = n ? n.trim() : '';
      if (trimmed && !allParticipants.includes(trimmed)) {
        allParticipants.push(trimmed);
      }
    });
  }

  // ============================================================
  // 1. STAMP HEADER DATE (Page 2 top-right)
  // In generator: y starts at height - margin. Date drawn at y-24.
  // Header block drops y by 46 total then 3 more lines => date at ~height-margin-24
  // ============================================================
  page.drawRectangle({
    x: width - 180,
    y: height - margin - 28,
    width: 148,
    height: 14,
    color: white,
  });
  page.drawText(`DATE: ${signedAtDate}`, {
    x: width - 175,
    y: height - margin - 26,
    size: 8,
    font: helveticaBold,
    color: primaryGreen,
  });

  // ============================================================
  // 2. DYNAMICALLY COMPUTE tableY by simulating the generator's Y cursor
  //
  // Generator flow (page 2):
  //   y = height - margin                 (795.28 - 46 = 749.28 for A4)
  //   y -= 46  (header block)             → 703.28
  //   y -= 22  (after horizontal rule)    → 681.28
  //   subject line y, y -= 15            → 666.28
  //   activity title y, y -= 16          → 650.28
  //   headerNote lines * 12, y -= 10     → variable
  //   y -= 10  (extra gap)
  //   drawClause(clause1)
  //   drawClause(clause2)
  //   drawClause(clause3)
  //   tableY = y - tableHeight (48)
  // ============================================================
  let y = height - margin;

  // Header block
  y -= 46;
  // After two horizontal lines
  y -= 22;
  // Subject line
  y -= 15;
  // Activity title (we don't know the actual title used; simulate 1 line)
  y -= 16;
  // headerNote wrap
  const headerNote = waiverContent.headerNote ?? DEFAULT_WAIVER_CONTENT.headerNote ?? '';
  const headerNoteLines = simulateWrap(headerNote, contentWidth, helveticaOblique, 8.5);
  y -= headerNoteLines * 12;
  // Extra gap after note block
  y -= 10;

  // Clause 1
  y -= simulateClauseHeight(
    waiverContent.clause1Title ?? DEFAULT_WAIVER_CONTENT.clause1Title,
    waiverContent.clause1Text ?? DEFAULT_WAIVER_CONTENT.clause1Text,
    contentWidth, helveticaFont, helveticaBold
  );

  // Clause 2
  y -= simulateClauseHeight(
    waiverContent.clause2Title ?? DEFAULT_WAIVER_CONTENT.clause2Title,
    waiverContent.clause2Text ?? DEFAULT_WAIVER_CONTENT.clause2Text,
    contentWidth, helveticaFont, helveticaBold
  );

  // Clause 3
  y -= simulateClauseHeight(
    waiverContent.clause3Title ?? DEFAULT_WAIVER_CONTENT.clause3Title,
    waiverContent.clause3Text ?? DEFAULT_WAIVER_CONTENT.clause3Text,
    contentWidth, helveticaFont, helveticaBold
  );

  // tableY = y - tableHeight
  const tableHeight = 48;
  const tableY = y - tableHeight;

  // ============================================================
  // STAMP Section 3 Medical Authorization Table
  // ============================================================

  // --- Allergies Row: top half of table (tableY + 24 to tableY + 48) ---
  const allergyY = tableY + 31; // label baseline inside top row

  // Overwrite the underline field and original checkbox in top row
  page.drawRectangle({
    x: margin + 155,
    y: allergyY - 4,
    width: 188,
    height: 14,
    color: tableHeaderBg,
  });
  page.drawRectangle({
    x: margin + 347,
    y: allergyY - 4,
    width: contentWidth - 347 + margin,
    height: 14,
    color: tableHeaderBg,
  });

  if (noAllergies) {
    page.drawText('None reported', {
      x: margin + 160,
      y: allergyY,
      size: 8,
      font: helveticaOblique,
      color: mutedText,
    });
    page.drawText('[ X ]  No known allergies', {
      x: margin + 352,
      y: allergyY,
      size: 8,
      font: helveticaBold,
      color: primaryGreen,
    });
  } else {
    page.drawText(knownAllergies?.trim() || 'None reported', {
      x: margin + 160,
      y: allergyY,
      size: 8,
      font: helveticaFont,
      color: darkText,
    });
    page.drawText('[   ]  No known allergies', {
      x: margin + 352,
      y: allergyY,
      size: 7.5,
      font: helveticaOblique,
      color: mutedText,
    });
  }

  // --- Medications Row: bottom half of table (tableY to tableY + 24) ---
  const medY = tableY + 8; // label baseline inside bottom row

  // Overwrite the underline field and original checkbox in bottom row
  page.drawRectangle({
    x: margin + 155,
    y: medY - 4,
    width: 188,
    height: 14,
    color: white,
  });
  page.drawRectangle({
    x: margin + 347,
    y: medY - 4,
    width: contentWidth - 347 + margin,
    height: 14,
    color: white,
  });

  if (noMedications) {
    page.drawText('None reported', {
      x: margin + 160,
      y: medY,
      size: 8,
      font: helveticaOblique,
      color: mutedText,
    });
    page.drawText('[ X ]  No current medications', {
      x: margin + 352,
      y: medY,
      size: 8,
      font: helveticaBold,
      color: primaryGreen,
    });
  } else {
    page.drawText(currentMedications?.trim() || 'None reported', {
      x: margin + 160,
      y: medY,
      size: 8,
      font: helveticaFont,
      color: darkText,
    });
    page.drawText('[   ]  No current medications', {
      x: margin + 352,
      y: medY,
      size: 7.5,
      font: helveticaOblique,
      color: mutedText,
    });
  }

  // ============================================================
  // 3. STAMP Section 6 — IN WITNESS WHEREOF Execution Block
  //
  // Generator uses:
  //   sigSectionY = margin + 110  (46 + 110 = 156)
  //   sigBlockY   = sigSectionY - 12  (144)
  //   Left col fields at sigBlockY - 14, -32, -50
  //   Right col at rightColX = margin + contentWidth - 220 (329.28)
  //   Sig box: y = sigBlockY - 65, height = 44
  // ============================================================
  const sigSectionY = margin + 110; // 156
  const sigBlockY = sigSectionY - 12; // 144
  const rightColX = margin + contentWidth - 220;
  const rightColWidth = 220;
  const leftColCoverWidth = 165; // Safe width covering underline up to rightColX (162 -> 327)

  // --- Participant Full Name(s) ---
  // Cover the underline area cleanly
  page.drawRectangle({
    x: margin + 116,
    y: sigBlockY - 26,
    width: leftColCoverWidth,
    height: 22,
    color: white,
  });

  const participantsSummary = allParticipants.join(', ');
  const maxParticipantWidth = leftColCoverWidth - 6;

  // Adaptive font size based on participant count & string length
  let pFontSize = 8;
  if (allParticipants.length > 2 || participantsSummary.length > 30) {
    pFontSize = 7;
  }

  // Word wrap within left column
  const pWords = participantsSummary.split(' ');
  const pLines: string[] = [];
  let curPLine = '';

  for (const w of pWords) {
    const testLine = curPLine ? `${curPLine} ${w}` : w;
    const testWidth = helveticaBold.widthOfTextAtSize(testLine, pFontSize);
    if (testWidth <= maxParticipantWidth) {
      curPLine = testLine;
    } else {
      if (curPLine) pLines.push(curPLine);
      curPLine = w;
    }
  }
  if (curPLine) pLines.push(curPLine);

  // Draw lines cleanly inside participant slot
  if (pLines.length === 1) {
    page.drawText(pLines[0], {
      x: margin + 122,
      y: sigBlockY - 14,
      size: pFontSize,
      font: helveticaBold,
      color: primaryGreen,
    });
  } else if (pLines.length === 2) {
    page.drawText(pLines[0], {
      x: margin + 122,
      y: sigBlockY - 10,
      size: pFontSize,
      font: helveticaBold,
      color: primaryGreen,
    });
    page.drawText(pLines[1], {
      x: margin + 122,
      y: sigBlockY - 18,
      size: pFontSize,
      font: helveticaBold,
      color: primaryGreen,
    });
  } else {
    // 3 lines for very long family lists
    let curY = sigBlockY - 9;
    for (let i = 0; i < Math.min(pLines.length, 3); i++) {
      page.drawText(pLines[i], {
        x: margin + 122,
        y: curY,
        size: 6.5,
        font: helveticaBold,
        color: primaryGreen,
      });
      curY -= 7.5;
    }
  }

  // --- Parent / Guardian Name ---
  page.drawRectangle({
    x: margin + 116,
    y: sigBlockY - 36,
    width: leftColCoverWidth + 12,
    height: 14,
    color: white,
  });
  page.drawText(`${signerPrintedName} (${signerRelationship})`, {
    x: margin + 122,
    y: sigBlockY - 32,
    size: 8,
    font: helveticaBold,
    color: primaryGreen,
  });

  // --- Execution Date & Audit Code ---
  page.drawRectangle({
    x: margin + 116,
    y: sigBlockY - 54,
    width: leftColCoverWidth + 12,
    height: 14,
    color: white,
  });
  page.drawText(`${signedAtDate}  (Ref: ${verificationId.substring(0, 8)})`, {
    x: margin + 122,
    y: sigBlockY - 50,
    size: 7.5,
    font: helveticaFont,
    color: darkText,
  });

  // --- Clear signature box content and draw actual signature PNG ---
  page.drawRectangle({
    x: rightColX,
    y: sigBlockY - 65,
    width: rightColWidth,
    height: 44,
    color: rgb(0.99, 0.99, 0.99),
    borderColor: borderGray,
    borderWidth: 0.75,
  });

  // Draw the signature image centered inside the box
  const sigImageDims = signatureImage.scale(0.35);
  const imgWidth = Math.min(sigImageDims.width, rightColWidth - 20);
  const imgHeight = Math.min(sigImageDims.height, 36);

  page.drawImage(signatureImage, {
    x: rightColX + (rightColWidth - imgWidth) / 2,
    y: sigBlockY - 60,
    width: imgWidth,
    height: imgHeight,
  });

  return await pdfDoc.save();
}
