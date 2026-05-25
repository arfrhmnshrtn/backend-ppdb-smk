import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

/**
 * Service untuk men-generate PDF dari HTML string menggunakan Puppeteer.
 *
 * Kenapa Puppeteer?
 * - Menggunakan Chromium headless → rendering CSS dan layout 100% akurat.
 * - Support @media print, Google Fonts, SVG, gradient, dsb.
 * - Output PDF berkualitas tinggi, siap cetak, dan konsisten di semua OS.
 * - Alternatif seperti pdfkit/jspdf tidak support full CSS rendering.
 */
@Injectable()
export class PdfGeneratorService {
  /**
   * Generate buffer PDF dari HTML string.
   * @param html - HTML string lengkap (termasuk <html>, <head>, <body>)
   * @returns Buffer berisi data PDF
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    let browser: puppeteer.Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      // Set HTML content dan tunggu font/gambar dimuat
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
      });

      // Generate PDF ukuran A4 portrait
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          bottom: '0mm',
          left: '0mm',
          right: '0mm',
        },
      });

      // Puppeteer mengembalikan Uint8Array, konversi ke Buffer Node.js
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Gagal generate PDF:', error);
      throw new InternalServerErrorException(
        'Gagal membuat file PDF kartu pendaftaran',
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
