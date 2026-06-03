// 5651 log kaydi - Worker'a gonderir, Worker gercek IP'yi ekleyip Firebase'e yazar.
// Tarayici asla dogrudan log yazmaz (delil degeri icin).

const WORKER_URL = "https://zupii-photos.samsunda-yasamak.workers.dev";

export async function logKaydet(token, { uid, islem, detay }) {
  try {
    await fetch(WORKER_URL + "/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ uid, islem, detay: detay || "" })
    });
  } catch (err) {
    // Log atilamazsa kullaniciyi engelleme, sadece sessizce gec
    console.error("Log kaydedilemedi:", err);
  }
}