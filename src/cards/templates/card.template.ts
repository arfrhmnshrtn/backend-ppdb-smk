/**
 * Template HTML untuk Kartu Pendaftaran PPDB.
 * Desain modern, print-ready, ukuran A4 portrait.
 */

import * as fs from 'fs';
import * as path from 'path';

interface CardTemplateData {
  no_daftar: string;
  nama: string;
  foto: string | null;
  jurusan: string;
  nisn: string;
  asal_sekolah: string;
  alamat: string;
  tanggal_test: string;
  jam_test: string;
  lokasi_test: string;
}

export function generateCardHtml(data: CardTemplateData): string {
  // Placeholder foto jika belum ada
  const fotoHtml = data.foto
    ? `<img src="${data.foto}" alt="Foto Peserta" class="foto-peserta" />`
    : `<div class="foto-placeholder">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>Foto 3x4</span>
      </div>`;

  // Konversi logo ke base64 data URI agar Puppeteer bisa me-render
  const logoPath = path.join(process.cwd(), 'public', 'images', 'logo.png');
  let logoDataUri = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch {
    // Jika logo tidak ditemukan, gunakan string kosong (fallback)
    console.warn('Logo tidak ditemukan di:', logoPath);
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kartu Pendaftaran PPDB - ${data.nama}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: #fff;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .card-container {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 20mm 25mm;
      position: relative;
    }

    /* ========== HEADER ========== */
    /* ========== HEADER ========== */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 3px solid #1e40af;
  margin-bottom: 10px;
  text-align: center;
}

.logo-container {
  width: 95px;
  height: 95px;
  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: hidden;
}

.logo-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.header-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.header-text .school-name {
  font-size: 24px;
  font-weight: 800;
  color: #1e40af;
  text-transform: uppercase;
  letter-spacing: 1px;
  line-height: 1.2;
}

.header-text .school-subtitle {
  font-size: 12px;
  color: #475569;
  margin-top: 4px;
  font-weight: 600;
}

.header-text .school-address {
  font-size: 10px;
  color: #64748b;
  margin-top: 6px;
}

    .sub-header {
      text-align: center;
      padding: 14px 0;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 28px;
    }

    .sub-header h1 {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .sub-header .subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
      letter-spacing: 0.5px;
    }

    /* ========== BODY ========== */
    .body-section {
      display: flex;
      gap: 32px;
      margin-bottom: 36px;
    }

    .foto-section {
      flex-shrink: 0;
    }

    .foto-peserta {
      width: 120px;
      height: 160px;
      object-fit: cover;
      border: 2px solid #cbd5e1;
      border-radius: 8px;
    }

    .foto-placeholder {
      width: 120px;
      height: 160px;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #f8fafc;
    }

    .foto-placeholder span {
      font-size: 10px;
      color: #94a3b8;
      font-weight: 500;
    }

    .info-section {
      flex: 1;
    }

    .info-table {
      width: 100%;
      border-collapse: collapse;
    }

    .info-table tr {
      border-bottom: 1px solid #f1f5f9;
    }

    .info-table td {
      padding: 10px 0;
      font-size: 13px;
      vertical-align: top;
    }

    .info-table td:first-child {
      width: 140px;
      color: #64748b;
      font-weight: 500;
    }

    .info-table td:nth-child(2) {
      width: 16px;
      color: #94a3b8;
      text-align: center;
    }

    .info-table td:last-child {
      color: #1e293b;
      font-weight: 600;
    }

    /* ========== JADWAL TEST ========== */
    .schedule-section {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 36px;
    }

    .schedule-section h2 {
      font-size: 14px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .schedule-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }

    .schedule-item {
      text-align: center;
    }

    .schedule-item .label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .schedule-item .value {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
    }

    /* ========== CATATAN ========== */
    .notes-section {
      margin-bottom: 40px;
      padding: 16px 20px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
    }

    .notes-section h3 {
      font-size: 11px;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .notes-section ul {
      padding-left: 16px;
    }

    .notes-section li {
      font-size: 10.5px;
      color: #78350f;
      margin-bottom: 4px;
      line-height: 1.5;
    }

    /* ========== TTD ========== */
    .signature-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
    }

    .signature-box {
      text-align: center;
      width: 200px;
    }

    .signature-box .sig-city {
      font-size: 11px;
      color: #475569;
      margin-bottom: 4px;
    }

    .signature-box .sig-title {
      font-size: 11px;
      color: #475569;
      margin-bottom: 60px;
    }

    .signature-box .sig-line {
      border-top: 1px solid #1e293b;
      padding-top: 6px;
    }

    .signature-box .sig-name {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
    }

    .signature-box .sig-nip {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    /* ========== FOOTER ========== */
    .footer {
      position: absolute;
      bottom: 15mm;
      left: 25mm;
      right: 25mm;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    @media print {
      body { background: #fff; }
      .card-container {
        padding: 15mm 20mm;
      }
    }
  </style>
</head>
<body>
  <div class="card-container">

    <!-- HEADER SEKOLAH -->
<div class="header">
  <div class="logo-container">
    <img src="${logoDataUri}" alt="Logo Sekolah" />
  </div>

  <div class="header-text">
    <div class="school-name">SMK NEGERI 1 SIMPANG PEMATANG</div>

    <div class="school-subtitle">
      PENERIMAAN PESERTA DIDIK BARU (PPDB)
    </div>

    <div class="school-address">
      Kabupaten Mesuji, Provinsi Lampung
    </div>
  </div>
</div>

    <!-- SUB HEADER -->
    <div class="sub-header">
      <h1>Kartu Pendaftaran</h1>
      <div class="subtitle">Penerimaan Peserta Didik Baru (PPDB) Tahun Ajaran 2026/2027</div>
    </div>

    <!-- DATA PESERTA -->
    <div class="body-section">
      <div class="foto-section">
        ${fotoHtml}
      </div>
      <div class="info-section">
        <table class="info-table">
          <tr>
            <td>No. Pendaftaran</td>
            <td>:</td>
            <td>${data.no_daftar}</td>
          </tr>
          <tr>
            <td>Nama Lengkap</td>
            <td>:</td>
            <td>${data.nama}</td>
          </tr>
          <tr>
            <td>NISN</td>
            <td>:</td>
            <td>${data.nisn}</td>
          </tr>
          <tr>
            <td>Asal Sekolah</td>
            <td>:</td>
            <td>${data.asal_sekolah}</td>
          </tr>
          <tr>
            <td>Alamat</td>
            <td>:</td>
            <td>${data.alamat}</td>
          </tr>
          <tr>
            <td>Jurusan Pilihan</td>
            <td>:</td>
            <td>${data.jurusan}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- JADWAL TEST -->
    <div class="schedule-section">
      <h2>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2" stroke-linecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Jadwal Test Minat &amp; Bakat
      </h2>
      <div class="schedule-grid">
        <div class="schedule-item">
          <div class="label">Tanggal</div>
          <div class="value">${data.tanggal_test}</div>
        </div>
        <div class="schedule-item">
          <div class="label">Jam</div>
          <div class="value">${data.jam_test}</div>
        </div>
        <div class="schedule-item">
          <div class="label">Lokasi</div>
          <div class="value">${data.lokasi_test}</div>
        </div>
      </div>
    </div>

    <!-- CATATAN PENTING -->
    <div class="notes-section">
      <h3>⚠ Catatan Penting</h3>
      <ul>
        <li>Hadir 30 menit sebelum test dimulai.</li>
        <li>Membawa kartu pendaftaran ini dalam bentuk cetak.</li>
        <li>Membawa alat tulis (pensil 2B, penghapus, pulpen).</li>
        <li>Berpakaian rapi dan sopan.</li>
        <li>Kartu ini tidak dapat dipindahtangankan.</li>
      </ul>
    </div>

    <!-- TANDA TANGAN -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="sig-city">Kab. Contoh, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div class="sig-title">Ketua Panitia PPDB</div>
        <div class="sig-line">
          <div class="sig-name">Nama Panitia, S.Pd.</div>
          <div class="sig-nip">NIP. 19XX0101 202001 1 001</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      Dokumen ini dicetak secara otomatis oleh Sistem PPDB Online SMK Negeri 1 Contoh &mdash; ${new Date().getFullYear()}
    </div>

  </div>
</body>
</html>`;
}
