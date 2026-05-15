/**
 * Helper untuk memformat tanggal ke format Indonesia (contoh: "Senin, 16 Juni 2026")
 */
export function formatTanggalIndonesia(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
