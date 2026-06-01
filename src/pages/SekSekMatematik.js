import React, { useState, useRef, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { skoruPaylas } from "./skorPaylas";

// Zorluk ayarlari
const ZORLUKLAR = {
  kolay:  { ad: "Kolay",  islemler: ["+", "-"], maxSayi: 10,  hiz: 2.2, renk: "#10b981" },
  orta:   { ad: "Orta",   islemler: ["+", "-", "x"], maxSayi: 20, hiz: 2.8, renk: "#f59e0b" },
  zor:    { ad: "Zor",    islemler: ["+", "-", "x", ":"], maxSayi: 50, hiz: 3.4, renk: "#ef4444" }
};

function soruUret(zorluk) {
  const z = ZORLUKLAR[zorluk];
  const islem = z.islemler[Math.floor(Math.random() * z.islemler.length)];
  let a, b, cevap;
  if (islem === "+") {
    a = 1 + Math.floor(Math.random() * z.maxSayi);
    b = 1 + Math.floor(Math.random() * z.maxSayi);
    cevap = a + b;
  } else if (islem === "-") {
    a = 1 + Math.floor(Math.random() * z.maxSayi);
    b = 1 + Math.floor(Math.random() * a);
    cevap = a - b;
  } else if (islem === "x") {
    a = 2 + Math.floor(Math.random() * 8);
    b = 2 + Math.floor(Math.random() * 8);
    cevap = a * b;
  } else {
    b = 2 + Math.floor(Math.random() * 8);
    cevap = 1 + Math.floor(Math.random() * 9);
    a = b * cevap;
  }
  const gosterilen = islem === "x" ? "×" : islem === ":" ? "÷" : islem;
  // 3 secenek: dogru + 2 yanlis
  const secenekler = new Set([cevap]);
  while (secenekler.size < 3) {
    const sapma = cevap + (Math.floor(Math.random() * 7) - 3);
    if (sapma >= 0 && sapma !== cevap) secenekler.add(sapma);
  }
  const dizi = Array.from(secenekler).sort(() => Math.random() - 0.5);
  return { metin: `${a} ${gosterilen} ${b} = ?`, cevap, secenekler: dizi };
}

function SekSekMatematik({ onKapat, baslangicZorluk }) {
  const [durum, setDurum] = useState("zorlukSec"); // zorlukSec | oyun | soru | bitti
  const [zorluk, setZorluk] = useState(baslangicZorluk || null);
  const [puan, setPuan] = useState(0);
  const [can, setCan] = useState(3);
  const [soru, setSoru] = useState(null);
  const [mesaj, setMesaj] = useState("");
  const [paylasildi, setPaylasildi] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [yorum, setYorum] = useState("");

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const oyunDurumu = useRef(null);
  const tuslar = useRef({ sol: false, sag: false });

  // Oyun fizigi sabitleri
  const YERCEKIMI = 0.7;
  const ZEMIN_Y = 280;

  const oyunBaslat = (z) => {
    setZorluk(z);
    setPuan(0);
    setCan(3);
    setDurum("oyun");
    oyunDurumu.current = {
      x: 60, y: ZEMIN_Y, vy: 0, zeminde: true,
      engeller: [],
      mesafe: 0,
      sonrakiEngel: 300,
      sonrakiKapi: 700,
      kapi: null,
      kamera: 0,
      hiz: ZORLUKLAR[z].hiz
    };
  };

  const zipla = useCallback(() => {
    const o = oyunDurumu.current;
    if (o && o.zeminde) { o.vy = -16; o.zeminde = false; }
  }, []);

  // Klavye
  useEffect(() => {
    const down = (e) => {
      if (e.key === "ArrowLeft") tuslar.current.sol = true;
      if (e.key === "ArrowRight") tuslar.current.sag = true;
      if (e.key === "ArrowUp" || e.key === " ") { e.preventDefault(); zipla(); }
    };
    const up = (e) => {
      if (e.key === "ArrowLeft") tuslar.current.sol = false;
      if (e.key === "ArrowRight") tuslar.current.sag = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [zipla]);

  // Oyun dongusu
  useEffect(() => {
    if (durum !== "oyun") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    const dongu = () => {
      const o = oyunDurumu.current;
      if (!o) return;

      // Yatay hareket (otomatik ileri + tuslar)
      let hareket = o.hiz;
      if (tuslar.current.sol) hareket -= 2;
      if (tuslar.current.sag) hareket += 2;
      o.mesafe += hareket;
      o.kamera = o.mesafe;

      // Zicplama fizigi
      o.vy += YERCEKIMI;
      o.y += o.vy;
      if (o.y >= ZEMIN_Y) { o.y = ZEMIN_Y; o.vy = 0; o.zeminde = true; }

      // Engel uret
      if (o.mesafe > o.sonrakiEngel) {
        o.engeller.push({ x: o.mesafe + W, tip: Math.random() > 0.5 ? "kutu" : "diken" });
        o.sonrakiEngel = o.mesafe + 250 + Math.random() * 200;
      }

      // Kapi uret
      if (!o.kapi && o.mesafe > o.sonrakiKapi) {
        o.kapi = { x: o.mesafe + W };
      }

      // Kapiya ulasinca soru ac
      if (o.kapi && (o.kapi.x - o.kamera) < 100) {
        setSoru(soruUret(zorluk));
        setDurum("soru");
        return;
      }

      // Carpisma kontrolu (oyuncu x sabit ~60 ekranda)
      const oyuncuEkranX = 60;
      for (const eng of o.engeller) {
        const ekranX = eng.x - o.kamera;
        if (ekranX > oyuncuEkranX - 25 && ekranX < oyuncuEkranX + 25) {
          // Oyuncu yere yakinsa ve zicplamamissa carpti
          if (o.y > ZEMIN_Y - 35) {
            setCan(c => {
              const yeni = c - 1;
              if (yeni <= 0) { setDurum("bitti"); }
              return yeni;
            });
            eng.x = -9999; // bu engeli kaldir
            setMesaj("Çarptın! 💥");
            setTimeout(() => setMesaj(""), 800);
          }
        }
      }

      // ===== CIZIM =====
      ctx.clearRect(0, 0, W, H);
      // Gokyuzu
      ctx.fillStyle = "#1a1a3e";
      ctx.fillRect(0, 0, W, H);
      // Yildizlar
      ctx.fillStyle = "#ffffff22";
      for (let i = 0; i < 20; i++) {
        const sx = (i * 137 - o.kamera * 0.2) % W;
        ctx.fillRect(sx < 0 ? sx + W : sx, 20 + (i * 23) % 100, 2, 2);
      }
      // Zemin
      ctx.fillStyle = "#2d2d4a";
      ctx.fillRect(0, ZEMIN_Y + 30, W, H - ZEMIN_Y - 30);
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, ZEMIN_Y + 30); ctx.lineTo(W, ZEMIN_Y + 30); ctx.stroke();

      // Engeller
      for (const eng of o.engeller) {
        const ekranX = eng.x - o.kamera;
        if (ekranX < -50 || ekranX > W + 50) continue;
        if (eng.tip === "kutu") {
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(ekranX - 18, ZEMIN_Y, 36, 30);
          ctx.fillStyle = "#92400e";
          ctx.fillRect(ekranX - 18, ZEMIN_Y, 36, 6);
        } else {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.moveTo(ekranX - 16, ZEMIN_Y + 30);
          ctx.lineTo(ekranX, ZEMIN_Y);
          ctx.lineTo(ekranX + 16, ZEMIN_Y + 30);
          ctx.fill();
        }
      }

      // Kapi
      if (o.kapi) {
        const ekranX = o.kapi.x - o.kamera;
        if (ekranX > -60 && ekranX < W + 60) {
          ctx.fillStyle = "#7c3aed";
          ctx.fillRect(ekranX - 30, ZEMIN_Y - 80, 60, 110);
          ctx.fillStyle = "#a78bfa";
          ctx.font = "30px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("?", ekranX, ZEMIN_Y - 30);
        }
      }

      // Oyuncu (basit karakter)
      const py = o.y;
      ctx.fillStyle = "#4f46e5";
      ctx.fillRect(oyuncuEkranX - 15, py - 30, 30, 60);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(oyuncuEkranX, py - 38, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(oyuncuEkranX - 6, py - 40, 3, 3);
      ctx.fillRect(oyuncuEkranX + 3, py - 40, 3, 3);

      animRef.current = requestAnimationFrame(dongu);
    };

    animRef.current = requestAnimationFrame(dongu);
    return () => cancelAnimationFrame(animRef.current);
  }, [durum, zorluk]);

  const cevapla = (secim) => {
    if (secim === soru.cevap) {
      setPuan(p => p + 10);
      setMesaj("Doğru! +10 ✨");
      const o = oyunDurumu.current;
      if (o) {
        o.kapi = null;
        o.sonrakiKapi = o.mesafe + 600 + Math.random() * 300;
      }
      setTimeout(() => { setMesaj(""); setDurum("oyun"); }, 700);
    } else {
      setCan(c => {
        const yeni = c - 1;
        if (yeni <= 0) { setTimeout(() => setDurum("bitti"), 500); }
        return yeni;
      });
      setMesaj("Yanlış! 💔");
      setTimeout(() => {
        setMesaj("");
        const o = oyunDurumu.current;
        if (o && can - 1 > 0) {
          o.kapi = null;
          o.sonrakiKapi = o.mesafe + 400;
          setDurum("oyun");
        }
      }, 900);
    }
  };

  // Puani kaydet
  useEffect(() => {
    if (durum === "bitti" && puan > 0) {
      (async () => {
        try {
          const userRef = doc(db, "users", auth.currentUser.uid);
          await updateDoc(userRef, { oyunPuani: increment(puan) });
        } catch (e) { console.error(e); }
      })();
    }
  }, [durum]); // eslint-disable-line react-hooks/exhaustive-deps

  const paylas = async () => {
    setPaylasiliyor(true);
    try {
      await skoruPaylas({
        oyunAdi: "Sek Sek Matematik",
        ikon: "🦘",
        puan: puan,
        altYazi: ZORLUKLAR[zorluk].ad + " seviye",
        renk: ZORLUKLAR[zorluk].renk,
        yorum: yorum
      });
      setPaylasildi(true);
    } catch (e) {
      alert("Paylaşılamadı: " + e.message);
    }
    setPaylasiliyor(false);
  };

  // ===== EKRANLAR =====
  if (durum === "zorlukSec") {
    return (
      <div style={kapsayici}>
        <div style={ustBar}>
          <h2 style={{ color: "#f0e6d3", fontSize: "18px", fontFamily: "Georgia, serif", margin: 0, flex: 1 }}>🦘 Sek Sek Matematik</h2>
          <button onClick={onKapat} style={kapatBtn}>✕</button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <p style={{ color: "#888", marginBottom: "30px", textAlign: "center", fontFamily: "Georgia, serif" }}>Zorluk seç ve başla!<br/><span style={{ fontSize: "12px" }}>← → hareket · ↑ veya boşluk zıpla</span></p>
          {Object.entries(ZORLUKLAR).map(([key, z]) => (
            <button key={key} onClick={() => oyunBaslat(key)}
              style={{ width: "240px", padding: "18px", marginBottom: "14px", background: "#1a1a2e", color: z.renk, border: `2px solid ${z.renk}`, borderRadius: "14px", cursor: "pointer", fontSize: "17px", fontWeight: "600", fontFamily: "Georgia, serif" }}>
              {z.ad}
              <div style={{ fontSize: "11px", color: "#666", marginTop: "4px", fontWeight: "normal" }}>
                {z.islemler.map(i => i === "x" ? "×" : i === ":" ? "÷" : i).join(" ")} · 1-{z.maxSayi}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (durum === "bitti") {
    return (
      <div style={kapsayici}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px" }}>
          <div style={{ fontSize: "50px", marginBottom: "20px" }}>🏁</div>
          <h2 style={{ color: "#f0e6d3", fontFamily: "Georgia, serif", fontSize: "24px", marginBottom: "20px" }}>Oyun Bitti!</h2>
          <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "30px 50px", textAlign: "center", marginBottom: "30px" }}>
            <div style={{ fontSize: "48px", color: "#f59e0b", fontWeight: "bold" }}>{puan}</div>
            <div style={{ fontSize: "12px", color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>puan</div>
          </div>
          <button onClick={() => setDurum("zorlukSec")}
            style={{ padding: "14px 32px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "600", marginBottom: "12px", width: "220px" }}>
            Tekrar Oyna
          </button>
          {!paylasildi && puan > 0 && (
            <input type="text" value={yorum} onChange={e => setYorum(e.target.value)} maxLength={100}
              placeholder="Bir şeyler yaz (isteğe bağlı)"
              style={{ width: "220px", padding: "10px 14px", marginBottom: "10px", background: "#1a1a2e", color: "#f0e6d3", border: "1px solid #333", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", fontFamily: "Georgia, serif" }} />
          )}
          <button onClick={paylas} disabled={paylasildi || paylasiliyor || puan === 0}
            style={{ padding: "12px 32px", background: paylasildi ? "#10b981" : "#1a1a2e", color: paylasildi ? "white" : (puan === 0 ? "#555" : "#7c3aed"), border: paylasildi ? "none" : `2px solid ${puan === 0 ? "#333" : "#7c3aed"}`, borderRadius: "12px", cursor: (paylasildi || puan === 0) ? "default" : "pointer", fontSize: "14px", fontWeight: "600", width: "220px", marginBottom: "12px" }}>
            {paylasildi ? "✓ Paylaşıldı" : paylasiliyor ? "Paylaşılıyor..." : "📢 Akışta Paylaş"}
          </button>
          <button onClick={onKapat}
            style={{ padding: "12px 32px", background: "#222", color: "#888", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px", width: "220px" }}>
            Kapat
          </button>
        </div>
      </div>
    );
  }

  // oyun + soru ekrani (canvas hep render)
  return (
    <div style={kapsayici}>
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a2e" }}>
        <span style={{ fontSize: "14px", color: "#ef4444" }}>{"❤️".repeat(Math.max(0, can))}</span>
        <span style={{ fontSize: "13px", color: "#f59e0b" }}>⭐ {puan}</span>
        <button onClick={onKapat} style={{ background: "none", border: "none", color: "#555", fontSize: "18px", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px", position: "relative" }}>
        <canvas ref={canvasRef} width={640} height={340}
          style={{ maxWidth: "100%", borderRadius: "12px", border: "1px solid #2d2d4a", background: "#1a1a3e" }} />

        {mesaj && (
          <div style={{ position: "absolute", top: "20px", left: "50%", transform: "translateX(-50%)", background: "#000a", color: "white", padding: "8px 20px", borderRadius: "20px", fontSize: "16px", fontWeight: "600" }}>
            {mesaj}
          </div>
        )}

        {durum === "soru" && soru && (
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "#0f0f1aee", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: "12px" }}>
            <div style={{ fontSize: "12px", color: "#f59e0b", letterSpacing: "3px", marginBottom: "16px", textTransform: "uppercase" }}>⭐ Soru Kapısı</div>
            <p style={{ fontSize: "36px", color: "#f0e6d3", marginBottom: "30px", fontFamily: "Georgia, serif", fontWeight: "bold" }}>{soru.metin}</p>
            <div style={{ display: "flex", gap: "14px" }}>
              {soru.secenekler.map((s, i) => (
                <button key={i} onClick={() => cevapla(s)}
                  style={{ width: "80px", height: "80px", fontSize: "28px", background: "#1a1a2e", color: "#c8bfb0", border: "2px solid #4f46e5", borderRadius: "16px", cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: "bold" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobil kontroller */}
      <div style={{ padding: "12px 20px", display: "flex", gap: "10px", borderTop: "1px solid #1a1a2e" }}>
        <button
          onTouchStart={() => tuslar.current.sol = true} onTouchEnd={() => tuslar.current.sol = false}
          onMouseDown={() => tuslar.current.sol = true} onMouseUp={() => tuslar.current.sol = false}
          style={kontrolBtn}>←</button>
        <button onClick={zipla} style={{ ...kontrolBtn, flex: 2, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white" }}>⬆ ZIPLA</button>
        <button
          onTouchStart={() => tuslar.current.sag = true} onTouchEnd={() => tuslar.current.sag = false}
          onMouseDown={() => tuslar.current.sag = true} onMouseUp={() => tuslar.current.sag = false}
          style={kontrolBtn}>→</button>
      </div>
    </div>
  );
}

const kapsayici = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#0f0f1a", zIndex: 500, display: "flex", flexDirection: "column" };
const ustBar = { padding: "20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #222" };
const kapatBtn = { background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer" };
const kontrolBtn = { flex: 1, padding: "16px", background: "#1a1a2e", color: "#888", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "20px", fontWeight: "600", userSelect: "none" };

export default SekSekMatematik;