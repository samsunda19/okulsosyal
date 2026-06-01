import { db, auth } from "../firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

const WORKER_URL = "https://zupii-photos.samsunda-yasamak.workers.dev";

// Canvas ile skor karti gorseli uretir, dataURL doner
export function skorKartiUret({ oyunAdi, ikon, puan, altYazi, renk }) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");

  // Arka plan (gradyan benzeri - duz katmanlar)
  ctx.fillStyle = "#0f0f1a";
  ctx.fillRect(0, 0, 600, 400);
  ctx.fillStyle = "#1a1a3e";
  ctx.fillRect(0, 0, 600, 200);

  // Yildizlar
  ctx.fillStyle = "#ffffff33";
  for (let i = 0; i < 30; i++) {
    const x = (i * 97) % 600;
    const y = (i * 53) % 180;
    ctx.fillRect(x, y, 2, 2);
  }

  // Cerceve
  ctx.strokeStyle = renk || "#7c3aed";
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 576, 376);

  // Ikon
  ctx.font = "60px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(ikon || "🎮", 300, 110);

  // Oyun adi
  ctx.fillStyle = "#f0e6d3";
  ctx.font = "bold 28px Georgia, serif";
  ctx.fillText(oyunAdi || "Oyun", 300, 160);

  // Puan kutusu
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(180, 200, 240, 120);
  ctx.strokeStyle = renk || "#7c3aed";
  ctx.lineWidth = 2;
  ctx.strokeRect(180, 200, 240, 120);

  // Puan
  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 64px Georgia, serif";
  ctx.fillText(String(puan), 300, 275);
  ctx.fillStyle = "#888";
  ctx.font = "16px sans-serif";
  ctx.fillText("PUAN", 300, 305);

  // Alt yazi
  if (altYazi) {
    ctx.fillStyle = "#aaa";
    ctx.font = "16px sans-serif";
    ctx.fillText(altYazi, 300, 350);
  }

  // Zupii logosu
  ctx.fillStyle = renk || "#7c3aed";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("zupii", 300, 378);

  return canvas;
}

// Skor kartini R2'ye yukler + post olusturur
export async function skoruPaylas({ oyunAdi, ikon, puan, altYazi, renk, yorum }) {
  const token = await auth.currentUser.getIdToken();
  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
  const isim = userDoc.data()?.isim || "Bir ogrenci";

  // Gorsel uret
  const canvas = skorKartiUret({ oyunAdi, ikon, puan, altYazi, renk });
  const blob = await new Promise(res => canvas.toBlob(res, "image/png"));

  // R2'ye yukle
  const key = "posts/" + auth.currentUser.uid + "_skor_" + Date.now() + ".png";
  await fetch(WORKER_URL + "/upload/" + key, {
    method: "PUT",
    headers: { "Content-Type": "image/png", "Authorization": "Bearer " + token },
    body: blob
  });
  const fotoUrl = WORKER_URL + "/photo/" + key;

  // Post olustur
  await addDoc(collection(db, "posts"), {
    icerik: yorum && yorum.trim() ? yorum.trim() : "",
    yazar: isim,
    yazarUid: auth.currentUser.uid,
    tarih: serverTimestamp(),
    begenenler: [],
    fotoUrl: fotoUrl,
    ogrenciSildi: false,
    veliKaldirdi: false,
    ogretmenKaldirdi: false,
    adminSildi: false
  });
}