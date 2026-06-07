// ===== 2025-2026 EGITIM YILI HAFTA TAKVIMI =====
// Gercek MEB takvimi: tarih araliklari + ara tatiller.
// Her ogretim haftasinin Pazartesi baslangic tarihi (YYYY-MM-DD) ve hafta no.
// Tatiller ayri isaretli. Bir tarih verilince hangi haftaya denk geldigini bulur.

// Hafta baslangici (Pazartesi) -> hafta no. Tatil haftalari "tatil" alani ile.
export const HAFTA_TAKVIMI = [
  { no: 1,  bas: "2025-09-08", bit: "2025-09-12" },
  { no: 2,  bas: "2025-09-15", bit: "2025-09-19" },
  { no: 3,  bas: "2025-09-22", bit: "2025-09-26" },
  { no: 4,  bas: "2025-09-29", bit: "2025-10-03" },
  { no: 5,  bas: "2025-10-06", bit: "2025-10-10" },
  { no: 6,  bas: "2025-10-13", bit: "2025-10-17" },
  { no: 7,  bas: "2025-10-20", bit: "2025-10-24" },
  { no: 8,  bas: "2025-10-27", bit: "2025-10-31" },
  { no: 9,  bas: "2025-11-03", bit: "2025-11-07" },
  { tatil: "1. Ara Tatil", bas: "2025-11-10", bit: "2025-11-14" },
  { no: 10, bas: "2025-11-17", bit: "2025-11-21" },
  { no: 11, bas: "2025-11-24", bit: "2025-11-28" },
  { no: 12, bas: "2025-12-01", bit: "2025-12-05" },
  { no: 13, bas: "2025-12-08", bit: "2025-12-12" },
  { no: 14, bas: "2025-12-15", bit: "2025-12-19" },
  { no: 15, bas: "2025-12-22", bit: "2025-12-26" },
  { no: 16, bas: "2025-12-29", bit: "2026-01-02" },
  { no: 17, bas: "2026-01-05", bit: "2026-01-09" },
  { no: 18, bas: "2026-01-12", bit: "2026-01-16" },
  { tatil: "Yari Yil Tatili", bas: "2026-01-19", bit: "2026-01-30" },
  { no: 19, bas: "2026-02-02", bit: "2026-02-06" },
  { no: 20, bas: "2026-02-09", bit: "2026-02-13" },
  { no: 21, bas: "2026-02-16", bit: "2026-02-20" },
  { no: 22, bas: "2026-02-23", bit: "2026-02-27" },
  { no: 23, bas: "2026-03-02", bit: "2026-03-06" },
  { no: 24, bas: "2026-03-09", bit: "2026-03-13" },
  { tatil: "2. Ara Tatil", bas: "2026-03-16", bit: "2026-03-20" },
  { no: 25, bas: "2026-03-23", bit: "2026-03-27" },
  { no: 26, bas: "2026-03-30", bit: "2026-04-03" },
  { no: 27, bas: "2026-04-06", bit: "2026-04-10" },
  { no: 28, bas: "2026-04-13", bit: "2026-04-17" },
  { no: 29, bas: "2026-04-20", bit: "2026-04-24" },
  { no: 30, bas: "2026-04-27", bit: "2026-05-01" },
  { no: 31, bas: "2026-05-04", bit: "2026-05-08" },
  { no: 32, bas: "2026-05-11", bit: "2026-05-15" },
  { no: 33, bas: "2026-05-18", bit: "2026-05-22" },
  { no: 34, bas: "2026-05-25", bit: "2026-05-29" },
  { no: 35, bas: "2026-06-01", bit: "2026-06-05" },
  { no: 36, bas: "2026-06-08", bit: "2026-06-12" },
  { no: 37, bas: "2026-06-15", bit: "2026-06-19" },
  { no: 38, bas: "2026-06-22", bit: "2026-06-26" }
];

// Verilen tarih (Date) -> { haftaNo } veya { tatil } veya null (yil disi/haftasonu plan yok)
export function tariheGoreHafta(tarih) {
  const gun = new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
  for (const h of HAFTA_TAKVIMI) {
    const bas = new Date(h.bas + "T00:00:00");
    const bit = new Date(h.bit + "T23:59:59");
    if (gun >= bas && gun <= bit) {
      if (h.tatil) return { tatil: h.tatil };
      return { haftaNo: h.no };
    }
  }
  return null; // hafta sonu veya egitim yili disi
}