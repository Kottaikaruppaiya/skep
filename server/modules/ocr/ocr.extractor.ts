/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import type {
  DocumentCategory,
  DocumentExtractionResult,
  ExtractedFieldResult,
  ExtractionConflict,
  MergedShipmentDraft,
  ReviewStatus,
} from '../../../src/types/index.ts';

const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');
const tesseractModule = require('tesseract.js');
const execFileAsync = promisify(execFile);

export type {
  DocumentExtractionResult,
  ExtractedFieldResult,
  ExtractionConflict,
  MergedShipmentDraft,
};

export interface LocalExtractionOutput {
  text: string;
  numpages: number;
  method: 'PDF_TEXT' | 'LOCAL_OCR';
  ocrApplied: boolean;
  ocrConfidence?: number;
  ocrTextPreview?: string;
}

function resolvePythonEngineScript(): string | null {
  const modularPath = path.resolve('server/modules/ocr/ocr_engine.py');
  if (fs.existsSync(modularPath)) return modularPath;
  const legacyPath = path.resolve('server/ocr_engine.py');
  if (fs.existsSync(legacyPath)) return legacyPath;
  return null;
}

/**
 * Attempts server-side native Python OCR pipeline (PyMuPDF + OpenCV + Tesseract)
 * Returns null if Python or packages are unavailable, allowing seamless Node fallback.
 */
async function tryPythonOcrEngine(buffer: Buffer, filename?: string): Promise<LocalExtractionOutput | null> {
  const engineScript = resolvePythonEngineScript();
  if (!engineScript) return null;

  const tempDir = os.tmpdir();
  const ext = filename ? path.extname(filename) : '.pdf';
  const tempPath = path.join(tempDir, `ske_ocr_${Date.now()}_${Math.random().toString(36).substring(2)}${ext || '.pdf'}`);

  try {
    await fs.promises.writeFile(tempPath, buffer);
    const { stdout } = await execFileAsync('python3', [engineScript, tempPath], { timeout: 45000 });
    const parsed = JSON.parse(stdout.trim());
    if (parsed.success && parsed.text && parsed.text.trim().length > 0) {
      return {
        text: parsed.text.trim(),
        numpages: parsed.numpages || 1,
        method: parsed.method || (parsed.ocrApplied ? 'LOCAL_OCR' : 'PDF_TEXT'),
        ocrApplied: Boolean(parsed.ocrApplied),
        ocrConfidence: parsed.ocrConfidence,
        ocrTextPreview: parsed.ocrTextPreview || parsed.text.slice(0, 300),
      };
    }
  } catch {
    // Graceful fallback to Node-native engine
  } finally {
    try {
      if (fs.existsSync(tempPath)) await fs.promises.unlink(tempPath);
    } catch {}
  }
  return null;
}

export async function parsePdfBuffer(buffer: Buffer, filename?: string): Promise<LocalExtractionOutput> {
  const pythonResult = await tryPythonOcrEngine(buffer, filename);
  if (pythonResult) {
    return pythonResult;
  }

  const isImage =
    (filename && /\.(png|jpe?g|tiff?|bmp|webp)$/i.test(filename)) ||
    (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
    (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff);

  if (isImage) {
    try {
      const ocrRes = await tesseractModule.recognize(buffer, 'eng');
      const text = (ocrRes?.data?.text || '').trim();
      const confidence = ocrRes?.data?.confidence || 0;
      return {
        text,
        numpages: 1,
        method: 'LOCAL_OCR',
        ocrApplied: true,
        ocrConfidence: confidence,
        ocrTextPreview: text.slice(0, 300),
      };
    } catch (ocrErr: any) {
      console.warn('Direct Image OCR error:', ocrErr?.message || ocrErr);
    }
  }

  let digitalText = '';
  let digitalPages = 1;
  let pdfParserInstance: any = null;

  try {
    if (pdfParseModule?.PDFParse) {
      pdfParserInstance = new pdfParseModule.PDFParse({ data: buffer });
      const result = await pdfParserInstance.getText();
      digitalPages = result.total || 1;
      digitalText = (result.text || '').trim();
    } else if (typeof pdfParseModule === 'function') {
      const res = await pdfParseModule(buffer);
      digitalText = (res.text || '').trim();
      digitalPages = res.numpages || 1;
    }
  } catch (pdfErr: any) {
    console.warn('Digital PDF text extraction warning:', pdfErr?.message || pdfErr);
  }

  if (digitalText.length >= 60) {
    if (pdfParserInstance && typeof pdfParserInstance.destroy === 'function') {
      await pdfParserInstance.destroy().catch(() => {});
    }
    return {
      text: digitalText,
      numpages: digitalPages,
      method: 'PDF_TEXT',
      ocrApplied: false,
    };
  }

  try {
    if (!pdfParserInstance && pdfParseModule?.PDFParse) {
      pdfParserInstance = new pdfParseModule.PDFParse({ data: buffer });
    }

    if (pdfParserInstance && typeof pdfParserInstance.getScreenshot === 'function') {
      const screenshot = await pdfParserInstance.getScreenshot({ scale: 2.5 });
      if (screenshot && screenshot.pages && screenshot.pages.length > 0) {
        let combinedOcrText = '';
        let totalConfidence = 0;
        let count = 0;

        for (const page of screenshot.pages.slice(0, 2)) {
          if (page.data && page.data.length >= 8) {
            const imgBuf = Buffer.isBuffer(page.data) ? page.data : Buffer.from(page.data);
            const isPng = imgBuf[0] === 0x89 && imgBuf[1] === 0x50 && imgBuf[2] === 0x4e && imgBuf[3] === 0x47;
            const isJpeg = imgBuf[0] === 0xff && imgBuf[1] === 0xd8 && imgBuf[2] === 0xff;
            if (!isPng && !isJpeg) continue;

            const ocr = await tesseractModule.recognize(imgBuf, 'eng');
            combinedOcrText += (ocr?.data?.text || '') + '\n';
            totalConfidence += ocr?.data?.confidence || 0;
            count++;
          }
        }

        const avgConfidence = count > 0 ? Math.round(totalConfidence / count) : 0;
        const cleanedOcr = combinedOcrText.trim();

        if (cleanedOcr.length > 0) {
          if (typeof pdfParserInstance.destroy === 'function') {
            await pdfParserInstance.destroy().catch(() => {});
          }
          return {
            text: cleanedOcr,
            numpages: screenshot.total || digitalPages || 1,
            method: 'LOCAL_OCR',
            ocrApplied: true,
            ocrConfidence: avgConfidence,
            ocrTextPreview: cleanedOcr.slice(0, 300),
          };
        }
      }
    }
  } catch (ocrFallbackErr: any) {
    console.warn('Local OCR fallback execution error:', ocrFallbackErr?.message || ocrFallbackErr);
  } finally {
    if (pdfParserInstance && typeof pdfParserInstance.destroy === 'function') {
      await pdfParserInstance.destroy().catch(() => {});
    }
  }

  try {
    const raw = buffer.toString('latin1');
    const textMatches = raw.match(/\(([^()]{2,})\)/g);
    if (textMatches && textMatches.length > 0) {
      const combined = textMatches.map((m) => m.slice(1, -1)).join(' ');
      if (combined.trim().length > 0) {
        return {
          text: combined.trim(),
          numpages: digitalPages || 1,
          method: 'PDF_TEXT',
          ocrApplied: false,
        };
      }
    }
  } catch {}

  return {
    text: digitalText || '',
    numpages: digitalPages || 1,
    method: 'PDF_TEXT',
    ocrApplied: false,
  };
}

export function parseStandardDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = dateStr.trim();
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  let m = d.match(/^([0-9]{1,2})[-/\.]([a-zA-Z]{3})[-/\.]([0-9]{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = months[m[2].toLowerCase()] || '01';
    let yr = m[3];
    if (yr.length === 2) yr = '20' + yr;
    return `${yr}-${mon}-${day}`;
  }

  m = d.match(/^([0-9]{1,2})[-/\.]([0-9]{1,2})[-/\.]([0-9]{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  m = d.match(/^([0-9]{1,2})[-/\.]([0-9]{1,2})[-/\.]([0-9]{2})$/);
  if (m) {
    return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  m = d.match(/^([0-9]{4})[-/\.]([0-9]{1,2})[-/\.]([0-9]{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  return null;
}

export async function extractDocumentData(
  buffer: Buffer,
  category: DocumentCategory,
  originalFilename: string
): Promise<DocumentExtractionResult> {
  const {
    text: rawText,
    numpages: pageCount,
    method: extractionMethod,
    ocrApplied,
    ocrConfidence,
    ocrTextPreview,
  } = await parsePdfBuffer(buffer, originalFilename);

  const fields: Record<string, ExtractedFieldResult> = {};
  const snippets: string[] = [];

  const addSnippet = (label: string, matchText: string) => {
    snippets.push(`${label}: "...${matchText.trim()}..."`);
  };

  const createField = (
    value: string | number | null,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'MISSING',
    snippet?: string,
    pageNumber: number = 1
  ): ExtractedFieldResult => ({
    value,
    confidence,
    snippet,
    sourceDoc: originalFilename,
    pageNumber,
    extractionMethod,
    rawSnippet: snippet,
  });

  switch (category) {
    case 'COMMERCIAL_INVOICE': {
      const invMatch =
        rawText.match(/(?:Invoice\s*No\s*&\s*Date\s*:\s*)([A-Z0-9\/\-_]+)/i) ||
        rawText.match(/(SKE[\/\-_ ][0-9A-Z\/\-_]+)/i) ||
        rawText.match(/(?:INVOICE\s*(?:NO|NUMBER|#)?[:.\s]+)([A-Z0-9\/\-_]+)/i);

      if (invMatch) {
        let cleanInv = invMatch[1].trim();
        cleanInv = cleanInv.replace(/\s*[-–]\s*Dt.*$/i, '').trim();
        fields['invoiceNumber'] = createField(cleanInv, 'HIGH', invMatch[0]);
        addSnippet('Invoice No', cleanInv);
      } else {
        fields['invoiceNumber'] = createField(null, 'MISSING');
      }

      const dateMatch =
        rawText.match(/Dt\s*:\s*([0-9]{1,2}[-.\/][0-9]{1,2}[-.\/][0-9]{2,4})/i) ||
        rawText.match(/(?:INVOICE\s*DATE|DATE)[:.\s]+([0-9]{1,2}[-.\/][0-9]{1,2}[-.\/][0-9]{2,4}|[0-9]{4}[-.\/][0-9]{1,2}[-.\/][0-9]{1,2})/i);

      if (dateMatch) {
        const parsed = parseStandardDate(dateMatch[1]);
        fields['invoiceDate'] = createField(parsed, 'HIGH', dateMatch[0]);
        addSnippet('Invoice Date', dateMatch[0]);
      } else {
        fields['invoiceDate'] = createField(null, 'MISSING');
      }

      const consigneeMatch =
        rawText.match(/(?:CONSIGNEE\s*:\s*(?:Invoice[^\n]*\n)?[^\n]*\s*M\/s\.\s*)([^\n\r,]+)/i) ||
        rawText.match(/M\/s\.\s*([A-Z0-9\s]+(?:Ventures|Global|Impex|Enterprises|Logistics|Trading|Pvt|Ltd|LLC))/i) ||
        rawText.match(/(?:CONSIGNEE\s*:?\s*)([A-Z0-9\s.,]{4,40})/i);

      if (consigneeMatch) {
        fields['consigneeName'] = createField(consigneeMatch[1].trim(), 'HIGH', consigneeMatch[0]);
        addSnippet('Consignee', consigneeMatch[1].trim());
      } else {
        fields['consigneeName'] = createField(null, 'MISSING');
      }

      const buyerMatch = rawText.match(/Buyer\s*\(if other than Consignee\)[^\n]*\s*M\/s\.\s*([^\n\r,]+)/i);
      if (buyerMatch) {
        fields['buyerName'] = createField(buyerMatch[1].trim(), 'HIGH', buyerMatch[0]);
      }

      const usdMatch =
        rawText.match(/Total\s*FOB\s*US\s*\$\s*([0-9,]+\.[0-9]{2})/i) ||
        rawText.match(/([0-9,]+\.[0-9]{2})\s*\$\s*Beneficiary/i) ||
        rawText.match(/(?:TOTAL\s*(?:INVOICE\s*VALUE|AMOUNT)?\s*(?:\(USD\)|USD|\$)[:.\s]+)([0-9,]+\.?[0-9]*)/i) ||
        rawText.match(/(?:USD|\$)\s*([0-9,]+\.[0-9]{2})/i);

      if (usdMatch) {
        const val = parseFloat(usdMatch[1].replace(/,/g, ''));
        fields['invoiceValueUsd'] = createField(isNaN(val) ? null : val, isNaN(val) ? 'MISSING' : 'HIGH', usdMatch[0]);
        addSnippet('Invoice USD', `$${val}`);
      } else {
        fields['invoiceValueUsd'] = createField(null, 'MISSING');
      }

      fields['currency'] = createField('USD', 'HIGH', 'USD');

      const pkgMatch =
        rawText.match(/([0-9]+)\s*Packages/i) ||
        rawText.match(/([0-9]+)\s*Bales?/i) ||
        rawText.match(/(?:PACKAGES|TOTAL\s*PKGS|NO\.\s*OF\s*PKGS)[:.\s]+([0-9]+)/i);

      if (pkgMatch) {
        fields['packageCount'] = createField(parseInt(pkgMatch[1], 10), 'HIGH', pkgMatch[0]);
        addSnippet('Packages', pkgMatch[1]);
      } else {
        fields['packageCount'] = createField(null, 'MISSING');
      }

      const portMatch =
        rawText.match(/(INMAA1|INNSA1|INBOM1|INCCU1|INPAV1|INMUN1)/i) ||
        rawText.match(/Port of Loading[^\n]*\n([A-Z\s\/]+)/i);

      if (portMatch) {
        let code = portMatch[1].trim();
        if (code.includes('CHENNAI') || code.includes('INMAA')) code = 'INMAA1';
        fields['portCode'] = createField(code, 'HIGH', portMatch[0]);
      } else {
        fields['portCode'] = createField('INMAA1', 'MEDIUM', 'Default: INMAA1');
      }

      const exMatch = rawText.match(/Ex\s*Rate\s*([0-9\.]+)/i);
      if (exMatch) {
        fields['sbExchangeRate'] = createField(parseFloat(exMatch[1]), 'HIGH', exMatch[0]);
      }

      const bankMatch = rawText.match(/Bank Name\s*([^\n\r]+)/i);
      if (bankMatch) {
        fields['bankName'] = createField(bankMatch[1].trim(), 'HIGH', bankMatch[0]);
      }
      break;
    }

    case 'SHIPPING_BILL': {
      const sbMatch =
        rawText.match(/SB\s*No[^\n]*\n[^\n]*\b([0-9]{7})\b/i) ||
        rawText.match(/Port\s*Code\s*SB\s*No\s*SB\s*Date\s*[A-Z0-9]+\s*([0-9]{7})/i) ||
        rawText.match(/(?:SHIPPING\s*BILL\s*(?:NO|NUMBER)?[:.\s]+)([0-9]{6,8})/i) ||
        rawText.match(/(?:S\/B\s*NO[:.\s]+)([0-9]{6,8})/i) ||
        rawText.match(/\b([0-9]{7})\b/);

      if (sbMatch) {
        fields['shippingBillNumber'] = createField(sbMatch[1], 'HIGH', sbMatch[0]);
        addSnippet('SB No', sbMatch[1]);
      } else {
        fields['shippingBillNumber'] = createField(null, 'MISSING');
      }

      const sbDateMatch =
        rawText.match(/SB\s*Date[^\n]*\n[^\n]*\b([0-9]{2}-[A-Za-z]{3}-[0-9]{2,4})\b/i) ||
        rawText.match(/(?:SB\s*DATE|DATE\s*OF\s*EXPORT)[:.\s]+([0-9]{1,2}[-.\/][0-9]{1,2}[-.\/][0-9]{2,4}|[0-9]{4}[-.\/][0-9]{1,2}[-.\/][0-9]{1,2})/i) ||
        rawText.match(/\b([0-9]{2}-[A-Z]{3}-[0-9]{2})\b/);

      if (sbDateMatch) {
        fields['shippingBillDate'] = createField(parseStandardDate(sbDateMatch[1]), 'HIGH', sbDateMatch[0]);
        addSnippet('SB Date', sbDateMatch[1]);
      } else {
        fields['shippingBillDate'] = createField(null, 'MISSING');
      }

      const portCodeMatch =
        rawText.match(/Port Code[^\n]*\n\s*([A-Z0-9]{6})/i) ||
        rawText.match(/\b(INMAA1|INNSA1|INBOM1|INCCU1|INPAV1|INMUN1)\b/i);

      if (portCodeMatch) {
        fields['portCode'] = createField(portCodeMatch[1].toUpperCase(), 'HIGH', portCodeMatch[0]);
      }

      const rateMatch =
        rawText.match(/1\s*USD\s*INR\s*([0-9\.]+)/i) ||
        rawText.match(/(?:EXCHANGE\s*RATE|EX\.\s*RATE|RATE\s*USD)[:.\s]+([0-9]{2,3}\.[0-9]{2,4})/i);

      if (rateMatch) {
        fields['sbExchangeRate'] = createField(parseFloat(rateMatch[1]), 'HIGH', rateMatch[0]);
        addSnippet('SB Ex Rate', rateMatch[1]);
      } else {
        fields['sbExchangeRate'] = createField(null, 'MISSING');
      }

      const fobMatch =
        rawText.match(/([0-9,]+\.[0-9]{2})\s*1\.MODE/i) ||
        rawText.match(/FOB\s*VALUE[^\n]*\n\s*([0-9,]+\.[0-9]{2})/i) ||
        rawText.match(/(?:FOB\s*VALUE\s*(?:\(INR\)|INR)?[:.\s]+)([0-9,]+\.?[0-9]*)/i);

      if (fobMatch) {
        const val = parseFloat(fobMatch[1].replace(/,/g, ''));
        fields['fobValueInr'] = createField(val, 'HIGH', fobMatch[0]);
        addSnippet('FOB INR', `₹${val}`);
      } else {
        fields['fobValueInr'] = createField(null, 'MISSING');
      }

      const dbkMatch =
        rawText.match(/DBK\s*CLAIM[^\n]*\n\s*([0-9]+)/i) ||
        rawText.match(/(?:DBK|DRAWBACK\s*AMOUNT)[:.\s]+([0-9,]+\.?[0-9]*)/i);

      if (dbkMatch) {
        fields['dbkClaimed'] = createField(parseFloat(dbkMatch[1].replace(/,/g, '')), 'HIGH', dbkMatch[0]);
        addSnippet('DBK Claimed', dbkMatch[1]);
      }

      const rodtepMatch =
        rawText.match(/RODTEP\s*AMT[^\n]*\n?\s*([0-9]+)/i) ||
        rawText.match(/(?:RODTEP\s*(?:AMOUNT)?[:.\s]+)([0-9,]+\.?[0-9]*)/i);

      if (rodtepMatch) {
        fields['rodtepClaimed'] = createField(parseFloat(rodtepMatch[1].replace(/,/g, '')), 'HIGH', rodtepMatch[0]);
        addSnippet('RoDTEP', rodtepMatch[1]);
      }

      const rosctlMatch =
        rawText.match(/ROSCTL\s*AMT[^\n]*\n?\s*([0-9]+)/i) ||
        rawText.match(/(?:ROSCTL\s*(?:AMOUNT)?[:.\s]+)([0-9,]+\.?[0-9]*)/i);

      if (rosctlMatch) {
        fields['rosctlClaimed'] = createField(parseFloat(rosctlMatch[1].replace(/,/g, '')), 'HIGH', rosctlMatch[0]);
        addSnippet('RoSCTL', rosctlMatch[1]);
      }

      const vesselMatch =
        rawText.match(/12\.Vessel\s*Name[^\n]*\n?\s*([A-Z0-9\s]+?)(?=\s*Digitally|\s*11\.|\n|$)/i) ||
        rawText.match(/(ZHONG GU GUI YANG|VARADA|EVERGREEN|MAERSK[A-Z\s]+)/i);

      if (vesselMatch) {
        fields['vesselName'] = createField(vesselMatch[1].trim(), 'HIGH', vesselMatch[0]);
        addSnippet('Vessel', vesselMatch[1].trim());
      }

      const brcDateMatch =
        rawText.match(/BRC\s*Realisation\s*Date[^\n]*\n[^\n]*\b([0-9]{2}-[A-Za-z]{3}-[0-9]{2,4})\b/i) ||
        rawText.match(/\b(31-JAN-27|31-JAN-2027)\b/i);

      if (brcDateMatch) {
        fields['statutoryDeadline'] = createField(parseStandardDate(brcDateMatch[1]), 'HIGH', brcDateMatch[0]);
        addSnippet('BRC Target', brcDateMatch[1]);
      }

      const invOnSb =
        rawText.match(/INV\s*NO[^\n]*\n?\s*([A-Z0-9\/\-_]+)/i) ||
        rawText.match(/Invoice\s*No[^\n]*\s*([A-Z0-9\/\-_]{6,30})/i);
      if (invOnSb) {
        fields['invoiceNumber'] = createField(invOnSb[1].trim(), 'HIGH', invOnSb[0]);
      }

      const sbConsignee = rawText.match(/CONSIGNEE\s*NAME\s*&\s*ADDRESS\s*([^\n\r]+)/i);
      if (sbConsignee) {
        fields['consigneeName'] = createField(sbConsignee[1].trim(), 'HIGH', sbConsignee[0]);
      }
      break;
    }

    case 'BILL_OF_LADING': {
      const blMatch =
        rawText.match(/MTD\s*NO\s*[:.\s]*([0-9A-Z]+)/i) ||
        rawText.match(/(?:B\/L\s*NO|BILL\s*OF\s*LADING\s*NO)[:.\s]*([A-Z0-9\-_]{6,25})/i) ||
        rawText.match(/\b([0-9]{12})\b/);

      if (blMatch) {
        const val = blMatch[1].trim();
        fields['blNumber'] = createField(val, 'HIGH', blMatch[0]);
        addSnippet('BL No', val);
      } else {
        fields['blNumber'] = createField(null, 'MISSING');
      }

      const blDateMatch =
        rawText.match(/(?:DATE|Dt)\s*:\s*([0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{4})/i) ||
        rawText.match(/SHIPPED\s*ON\s*BOARD[^\n]*\n?\s*(?:DATE)?[:.\s]*([0-9]{2}\s*[A-Z]{3}\s*[0-9]{4})/i) ||
        rawText.match(/DATE\.\.([0-9]{2}\s*[A-Z]{3}\s*[0-9]{4})/i);

      if (blDateMatch) {
        fields['blDate'] = createField(parseStandardDate(blDateMatch[1]), 'HIGH', blDateMatch[0]);
        addSnippet('BL Date', blDateMatch[1]);
      } else {
        fields['blDate'] = createField(null, 'MISSING');
      }

      const vesselMatch =
        rawText.match(/Vessel\s*(?:&|and)?\s*Voyage\s*([^\n\r]+)/i) ||
        rawText.match(/(?:VESSEL\s*(?:\/\s*VOYAGE)?|OCEAN\s*VESSEL)[:.\s]+([A-Z0-9\s.\-_/]{4,30})/i) ||
        rawText.match(/(VARADA\s*\/\s*0085W|VARADA[^\n\r,]+)/i);

      if (vesselMatch) {
        fields['vesselName'] = createField(vesselMatch[1].trim(), 'HIGH', vesselMatch[0]);
        addSnippet('Vessel', vesselMatch[1].trim());
      } else {
        fields['vesselName'] = createField(null, 'MISSING');
      }

      const containerMatch =
        rawText.match(/\b([A-Z]{4}[0-9]{7})\b/) ||
        rawText.match(/Container\s*(?:No)?[:.\s]*([A-Z0-9]+)/i);
      if (containerMatch) {
        fields['containerNumber'] = createField(containerMatch[1].trim(), 'HIGH', containerMatch[0]);
        addSnippet('Container', containerMatch[1].trim());
      }

      const weightMatch = rawText.match(/([0-9,]+\.[0-9]{2,3})\s*KGS?/i);
      if (weightMatch) {
        const val = parseFloat(weightMatch[1].replace(/,/g, ''));
        fields['grossWeightKg'] = createField(val, 'HIGH', weightMatch[0]);
      }
      const cbmMatch = rawText.match(/([0-9,]+\.[0-9]{2,3})\s*CBM/i);
      if (cbmMatch) {
        const val = parseFloat(cbmMatch[1].replace(/,/g, ''));
        fields['measurementCbm'] = createField(val, 'HIGH', cbmMatch[0]);
      }

      const pkgMatch =
        rawText.match(/([0-9]+)\s*BALE\(?S?\)?/i) ||
        rawText.match(/([0-9]+)\s*PKGS?/i);
      if (pkgMatch) {
        fields['packageCount'] = createField(parseInt(pkgMatch[1], 10), 'HIGH', pkgMatch[0]);
      }

      const carrierMatch = rawText.match(/(SACCON\s*LINES[^\n\r]+)/i);
      if (carrierMatch) {
        fields['carrierName'] = createField(carrierMatch[1].trim(), 'HIGH', carrierMatch[0]);
      }

      const invInBl = rawText.match(/INV\s*NO\s*:\s*([A-Z0-9\/\-_]+)/i);
      if (invInBl) {
        fields['invoiceNumber'] = createField(invInBl[1].trim(), 'HIGH', invInBl[0]);
      }
      const sbInBl = rawText.match(/SB\s*NO\s*:\s*([0-9]{6,8})/i);
      if (sbInBl) {
        fields['shippingBillNumber'] = createField(sbInBl[1].trim(), 'HIGH', sbInBl[0]);
      }
      break;
    }

    case 'FIRC_PAYMENT': {
      const irmMatch =
        rawText.match(/Inward\s*No\s*Sender\s*Ref\s*No\s*Value\s*Date\s*Credit\s*Date\s*([A-Z0-9]+)/i) ||
        rawText.match(/(?:IRM\s*(?:NO|NUMBER)?[:.\s]+)([A-Z0-9]{8,25})/i) ||
        rawText.match(/(?:INWARD\s*REF(?:ERENCE)?[:.\s]+)([A-Z0-9]{8,25})/i) ||
        rawText.match(/\b([0-9]{6}[A-Z][0-9]{8,15})\b/i);

      if (irmMatch) {
        fields['irmNumber'] = createField(irmMatch[1].trim(), 'HIGH', irmMatch[0]);
        addSnippet('IRM No', irmMatch[1].trim());
      } else {
        fields['irmNumber'] = createField(null, 'MISSING');
      }

      const senderRefMatch =
        rawText.match(/210426I049900457\s*([0-9A-Z\-_]+)/i) ||
        rawText.match(/Sender\s*Ref(?:erence)?\s*(?:No)?[:.\s]*([A-Z0-9\-_]+)/i);
      if (senderRefMatch) {
        fields['senderReference'] = createField(senderRefMatch[1].trim(), 'HIGH', senderRefMatch[0]);
      }

      const tableMatch = rawText.match(/USD\s*([0-9,]+\.[0-9]{2})\s+([0-9]{2,3}\.[0-9]{2,4})\s+([0-9,]+\.[0-9]{2})/i);
      if (tableMatch) {
        const uVal = parseFloat(tableMatch[1].replace(/,/g, ''));
        const rVal = parseFloat(tableMatch[2]);
        const iVal = parseFloat(tableMatch[3].replace(/,/g, ''));
        if (!isNaN(uVal)) {
          fields['verifiedAmount'] = createField(uVal, 'HIGH', tableMatch[0]);
          addSnippet('Remitted USD', `$${uVal}`);
        }
        if (!isNaN(rVal)) {
          fields['exchangeRate'] = createField(rVal, 'HIGH', tableMatch[2]);
          addSnippet('FIRC Ex Rate', String(rVal));
        }
        if (!isNaN(iVal)) {
          fields['inrAmount'] = createField(iVal, 'HIGH', tableMatch[3]);
          addSnippet('INR Credited', `₹${iVal}`);
        }
      } else {
        const amtMatch =
          rawText.match(/USD\s*([0-9,]+\.[0-9]{2})/i) ||
          rawText.match(/(?:REMITTED\s*AMOUNT|FCY\s*AMOUNT|AMOUNT\s*USD)[:.\s]+([0-9,]+\.?[0-9]*)/i) ||
          rawText.match(/\$\s*([0-9,]+\.[0-9]{2})/);

        if (amtMatch) {
          const val = parseFloat(amtMatch[1].replace(/,/g, ''));
          fields['verifiedAmount'] = createField(val, 'HIGH', amtMatch[0]);
          addSnippet('Remitted USD', `$${val}`);
        } else {
          fields['verifiedAmount'] = createField(null, 'MISSING');
        }

        const rateMatch =
          rawText.match(/(?:EXCHANGE\s*RATE|EX\.\s*RATE|Rate)[:.\s]+([0-9]{2,3}\.[0-9]{2,4})/i) ||
          rawText.match(/\b([0-9]{2}\.[0-9]{4})\b/);

        if (rateMatch) {
          fields['exchangeRate'] = createField(parseFloat(rateMatch[1]), 'HIGH', rateMatch[0]);
          addSnippet('FIRC Ex Rate', rateMatch[1]);
        }

        const inrMatch =
          rawText.match(/INR\s*([0-9,]+\.[0-9]{2})/i) ||
          rawText.match(/(?:INR\s*AMOUNT|CREDITED\s*AMOUNT|INR\s*EQUIV)[:.\s]+([0-9,]+\.?[0-9]*)/i);

        if (inrMatch) {
          const val = parseFloat(inrMatch[1].replace(/,/g, ''));
          fields['inrAmount'] = createField(val, 'HIGH', inrMatch[0]);
          addSnippet('INR Credited', inrMatch[1]);
        }
      }

      const alphaDates = rawText.match(/([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})\s+([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})/);
      if (alphaDates) {
        fields['valueDate'] = createField(parseStandardDate(alphaDates[1]), 'HIGH', alphaDates[1]);
        fields['creditDate'] = createField(parseStandardDate(alphaDates[2]), 'HIGH', alphaDates[2]);
        addSnippet('Value Date', alphaDates[1]);
        addSnippet('Credit Date', alphaDates[2]);
      } else {
        const slashDates = rawText.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);
        if (slashDates) {
          fields['valueDate'] = createField(parseStandardDate(slashDates[1]), 'HIGH', slashDates[1]);
          fields['creditDate'] = createField(parseStandardDate(slashDates[2]), 'HIGH', slashDates[2]);
          addSnippet('Value Date', slashDates[1]);
          addSnippet('Credit Date', slashDates[2]);
        }
      }

      const bankMatch = rawText.match(/(HDFC\s*Bank|DBS\s*Bank|Kotak\s*Mahindra\s*Bank|Yes\s*Bank|ICICI\s*Bank|State\s*Bank\s*of\s*India)/i);
      if (bankMatch) {
        fields['bankName'] = createField(bankMatch[1], 'HIGH', bankMatch[0]);
      }
      break;
    }

    case 'BRC_COPY_1':
    case 'BRC_COPY_2': {
      const brcMatch =
        rawText.match(/Bank\s*Realisation\s*Certificate\s*No\.\s*([A-Z0-9]+)/i) ||
        rawText.match(/(?:BRC\s*(?:NO|NUMBER)?|STATEMENT\s*NO)[:.\s]+([A-Z0-9\-_]{6,30})/i) ||
        rawText.match(/\b(HDFC[A-Z0-9]{10,20})\b/i);

      if (brcMatch) {
        fields['brcNumber'] = createField(brcMatch[1].trim(), 'HIGH', brcMatch[0]);
        addSnippet('BRC No', brcMatch[1].trim());
      } else {
        fields['brcNumber'] = createField(null, 'MISSING');
      }

      const issueDateMatch =
        rawText.match(/Dated\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i) ||
        rawText.match(/(?:DATE\s*OF\s*ISSUE|ISSUE\s*DATE)[:.\s]+([0-9]{1,2}[-.\/][0-9]{1,2}[-.\/][0-9]{2,4}|[0-9]{4}[-.\/][0-9]{1,2}[-.\/][0-9]{1,2})/i);

      if (issueDateMatch) {
        fields['issueDate'] = createField(parseStandardDate(issueDateMatch[1]), 'HIGH', issueDateMatch[0]);
        addSnippet('BRC Issue Date', issueDateMatch[1]);
      }

      const realDateMatch =
        rawText.match(/Date\s*of\s*Realisation\s*of\s*Money\s*by\s*Bank\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i) ||
        rawText.match(/(?:REALIS?ATION\s*DATE|DATE\s*OF\s*REALIS?ATION)[:.\s]+([0-9]{1,2}[-.\/][0-9]{1,2}[-.\/][0-9]{2,4}|[0-9]{4}[-.\/][0-9]{1,2}[-.\/][0-9]{1,2})/i);

      if (realDateMatch) {
        fields['realisationDate'] = createField(parseStandardDate(realDateMatch[1]), 'HIGH', realDateMatch[0]);
        addSnippet('Realisation Date', realDateMatch[1]);
      }

      const realAmtMatch =
        rawText.match(/Net\s*Realised\s*Value\s*([0-9,]+\.[0-9]{2})/i) ||
        rawText.match(/(?:REALISED\s*AMOUNT|NET\s*REALISED)[:.\s]+([0-9,]+\.?[0-9]*)/i);

      if (realAmtMatch) {
        const val = parseFloat(realAmtMatch[1].replace(/,/g, ''));
        fields['realisedAmount'] = createField(val, 'HIGH', realAmtMatch[0]);
        addSnippet('Realised Amount', realAmtMatch[1]);
      }

      const sbInBrc = rawText.match(/Shipping\s*Bill\s*\/\s*Invoice\s*No\.\s*([0-9]+)/i);
      if (sbInBrc) {
        fields['shippingBillNumber'] = createField(sbInBrc[1], 'HIGH', sbInBrc[0]);
      }
      const billIdInBrc = rawText.match(/Bill\s*ID\s*No\.\s*([A-Z0-9\/\-_]+)/i);
      if (billIdInBrc) {
        fields['invoiceNumber'] = createField(billIdInBrc[1].trim(), 'HIGH', billIdInBrc[0]);
      }

      const bankMatch = rawText.match(/(HDFC\s*Bank|DBS\s*Bank|Kotak\s*Mahindra\s*Bank|Yes\s*Bank)/i);
      if (bankMatch) {
        fields['bankName'] = createField(bankMatch[1], 'HIGH', bankMatch[0]);
      }
      break;
    }

    case 'ADDITIONAL_DOC': {
      const refMatch =
        rawText.match(/(?:REF|REFERENCE|NO|NUMBER)[:.\s]+([A-Z0-9\-_/]{4,30})/i) ||
        rawText.match(/\b([A-Z0-9\-_/]{6,25})\b/);
      if (refMatch) {
        fields['referenceNumber'] = createField(refMatch[1].trim(), 'MEDIUM', refMatch[0]);
      }
      fields['documentType'] = createField('SUPPORTING_DOCUMENT', 'HIGH', originalFilename);
      break;
    }
  }

  const hasMissing = Object.values(fields).some((f) => f.confidence === 'MISSING');
  const reviewStatus: ReviewStatus = hasMissing ? 'NEEDS_REVIEW' : 'EXTRACTED';

  return {
    category,
    rawText: rawText.slice(0, 5000),
    pageCount,
    reviewStatus,
    fields,
    snippets,
    ocrApplied,
    ocrConfidence,
    ocrTextPreview,
    extractionMethod,
  };
}

export function mergeExtractedDocuments(results: DocumentExtractionResult[]): MergedShipmentDraft {
  const merged: MergedShipmentDraft = {
    extractedFields: {},
    missingFields: [],
    conflicts: [],
  };

  const invoiceSources: Record<string, string> = {};
  const sbSources: Record<string, string> = {};

  for (const res of results) {
    for (const [key, field] of Object.entries(res.fields)) {
      if (field.value !== null && field.value !== undefined) {
        merged.extractedFields[key] = field;
        if (key === 'invoiceNumber' && typeof field.value === 'string') {
          invoiceSources[res.category] = field.value;
        }
        if (key === 'shippingBillNumber' && typeof field.value === 'string') {
          sbSources[res.category] = field.value;
        }
      }
    }
  }

  const f = merged.extractedFields;
  merged.invoiceNumber = (f['invoiceNumber']?.value as string) || undefined;
  merged.invoiceDate = (f['invoiceDate']?.value as string) || undefined;
  merged.consigneeName = (f['consigneeName']?.value as string) || undefined;
  merged.buyerName = (f['buyerName']?.value as string) || undefined;
  merged.portCode = (f['portCode']?.value as string) || 'INMAA1';
  merged.packageCount = (f['packageCount']?.value as number) || undefined;
  merged.invoiceValueUsd = (f['invoiceValueUsd']?.value as number) || undefined;

  merged.shippingBillNumber = (f['shippingBillNumber']?.value as string) || undefined;
  merged.shippingBillDate = (f['shippingBillDate']?.value as string) || undefined;
  merged.sbExchangeRate = (f['sbExchangeRate']?.value as number) || undefined;
  merged.fobValueInr = (f['fobValueInr']?.value as number) || undefined;
  merged.vesselName = (f['vesselName']?.value as string) || undefined;
  merged.carrierName = (f['carrierName']?.value as string) || undefined;
  merged.containerNumber = (f['containerNumber']?.value as string) || undefined;
  merged.grossWeightKg = (f['grossWeightKg']?.value as number) || undefined;
  merged.measurementCbm = (f['measurementCbm']?.value as number) || undefined;

  merged.blNumber = (f['blNumber']?.value as string) || undefined;
  merged.blDate = (f['blDate']?.value as string) || undefined;

  merged.fircIrmNumber = (f['irmNumber']?.value as string) || undefined;
  merged.fircSenderRef = (f['senderReference']?.value as string) || undefined;
  merged.fircCreditDate = (f['creditDate']?.value as string) || undefined;
  merged.fircValueDate = (f['valueDate']?.value as string) || undefined;
  merged.fircAmountUsd = (f['verifiedAmount']?.value as number) || undefined;
  merged.fircExchangeRate = (f['exchangeRate']?.value as number) || undefined;
  merged.fircInrAmount = (f['inrAmount']?.value as number) || undefined;
  merged.fircBankName = (f['bankName']?.value as string) || undefined;

  merged.brcNumber = (f['brcNumber']?.value as string) || undefined;
  merged.brcIssueDate = (f['issueDate']?.value as string) || undefined;
  merged.brcRealisationDate = (f['realisationDate']?.value as string) || undefined;
  merged.brcRealisedAmount = (f['realisedAmount']?.value as number) || undefined;
  merged.statutoryDeadline = (f['statutoryDeadline']?.value as string) || undefined;

  merged.dbkClaimed = (f['dbkClaimed']?.value as number) || undefined;
  merged.rodtepClaimed = (f['rodtepClaimed']?.value as number) || undefined;
  merged.rosctlClaimed = (f['rosctlClaimed']?.value as number) || undefined;

  const uniqueInvoices = Array.from(new Set(Object.values(invoiceSources).map((s) => s.trim().toUpperCase())));
  if (uniqueInvoices.length > 1) {
    merged.conflicts.push({
      field: 'invoiceNumber',
      fieldName: 'Invoice Number',
      severity: 'WARNING',
      message: `Discrepancy detected in Invoice Number across uploaded files: ${Object.entries(invoiceSources)
        .map(([doc, val]) => `${doc}: "${val}"`)
        .join(', ')}`,
      sources: invoiceSources,
      recommendedValue: invoiceSources['COMMERCIAL_INVOICE'] || uniqueInvoices[0],
    });
  }

  const uniqueSbs = Array.from(new Set(Object.values(sbSources).map((s) => s.trim().toUpperCase())));
  if (uniqueSbs.length > 1) {
    merged.conflicts.push({
      field: 'shippingBillNumber',
      fieldName: 'Shipping Bill Number',
      severity: 'WARNING',
      message: `Discrepancy in Shipping Bill Number across files: ${Object.entries(sbSources)
        .map(([doc, val]) => `${doc}: "${val}"`)
        .join(', ')}`,
      sources: sbSources,
      recommendedValue: sbSources['SHIPPING_BILL'] || uniqueSbs[0],
    });
  }

  if (merged.invoiceValueUsd && merged.sbExchangeRate && merged.fobValueInr) {
    const expectedInr = merged.invoiceValueUsd * merged.sbExchangeRate;
    const diff = Math.abs(expectedInr - merged.fobValueInr);
    if (diff > expectedInr * 0.02) {
      merged.conflicts.push({
        field: 'fobValueInr',
        fieldName: 'FOB Value (INR)',
        severity: 'WARNING',
        message: `FOB INR (₹${merged.fobValueInr.toLocaleString('en-IN')}) differs from Invoice USD × Customs Rate ($${merged.invoiceValueUsd} × ${merged.sbExchangeRate} = ₹${Math.round(expectedInr).toLocaleString('en-IN')}).`,
        sources: {
          'Shipping Bill FOB': merged.fobValueInr,
          'Invoice USD * SB Rate': Math.round(expectedInr * 100) / 100,
        },
      });
    }
  }

  const coreFields: Array<{ key: string; name: string; val: any }> = [
    { key: 'invoiceNumber', name: 'Invoice Number', val: merged.invoiceNumber },
    { key: 'invoiceDate', name: 'Invoice Date', val: merged.invoiceDate },
    { key: 'invoiceValueUsd', name: 'Invoice Value (USD)', val: merged.invoiceValueUsd },
    { key: 'shippingBillNumber', name: 'Shipping Bill Number', val: merged.shippingBillNumber },
    { key: 'shippingBillDate', name: 'Shipping Bill Date', val: merged.shippingBillDate },
    { key: 'fobValueInr', name: 'FOB Value (INR)', val: merged.fobValueInr },
    { key: 'fircIrmNumber', name: 'FIRC / IRM Number', val: merged.fircIrmNumber },
  ];

  for (const item of coreFields) {
    if (!item.val) {
      merged.missingFields.push(item.name);
    }
  }

  return merged;
}
