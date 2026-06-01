import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { skoruPaylas } from "./skorPaylas";

const IKI_BASAMAK = () => 10 + Math.floor(Math.random() * 90); // 10-99

function sorulariUret() {
  const sorular = [];
  // 5 toplama
  for (let i = 0; i < 5; i++) {
    const a = IKI_BASAMAK(), b = IKI_BASAMAK();
    sorular.push({ a, b, islem: "+", cevap: a + b });
  }
  // 5 cikarma (sonuc negatif olmasin)
  for (let i = 0; i < 5; i++) {
    let a = IKI_BASAMAK(), b = IKI_BASAMAK();
    if (b > a) [a, b] = [b, a];
    sorular.push({ a, b, islem: "-", cevap: a - b });
  }
  // Karistir
  for (let k = sorular.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [sorular[k], sorular[r]] = [sorular[r], sorular[k]];
  }
  return sorular;
}

function IslemOyunu({ onKapat }) {
  const [durum, setDurum] = useState("oyun"); // oyun | bitti
  const [sorular, setSorular] = useState(() => sorulariUret());
  const [cevaplar, setCevaplar] = useState(Array(10).fill(""));
  const [secili, setSecili] = useState(null);
  const [puan, setPuan] = useState(0);
  const [sonuclar, setSonuclar] = useState(null); // kontrol sonrasi: [true/false]
  const [paylasildi, setPaylasildi] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [yorum, setYorum] = useState("");

  const yenidenBasla = () => {
    setSorular(sorulariUret());
    setCevaplar(Array(10).fill(""));
    setSecili(null);
    setPuan(0);
    setSonuclar(null);
    setPaylasildi(false);
    setYorum("");
    setDurum("oyun");
  };

  const rakamGir = (rakam) => {
    if (secili === null) return;
    setCevaplar(prev => {
      const yeni = [...prev];
      if (yeni[secili].length < 4) yeni[secili] = yeni[secili] + rakam;
      return yeni;
    });
  };

  const sil = () => {
    if (secili === null) return;
    setCevaplar(prev => {
      const yeni = [...prev];
      yeni[secili] = yeni[secili].slice(0, -1);
      return yeni;
    });
  };

  // Klavye
  useEffect(() => {
    if (durum !== "oyun") return;
    const handler = (e) => {
      if (e.key >= "0" && e.key <= "9") rakamGir(e.key);
      if (e.key === "Backspace" || e.key === "Delete") sil();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [durum, secili]); // eslint-disable-line react-hooks/exhaustive-deps

  const hepsiDolu = cevaplar.every(c => c !== "");

  const kontrolEt = () => {
    const sonuc = sorular.map((s, i) => parseInt(cevaplar[i]) === s.cevap);
    const dogruSayisi = sonuc.filter(Boolean).length;
    setSonuclar(sonuc);
    setPuan(dogruSayisi * 2);
    setTimeout(() => setDurum("bitti"), 1200);
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
        oyunAdi: "İşlem Ustası",
        ikon: "➕",
        puan: puan,
        altYazi: "Toplama & Çıkarma",
        renk: "#10b981",
        yorum: yorum
      });
      setPaylasildi(true);
    } catch (e) {
      alert("Paylaşılamadı: " + e.message);
    }
    setPaylasiliyor(false);
  };

  if (durum === "bitti") {
    return (
      <div style={kapsayici}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px" }}>
          <div style={{ fontSize: "50px", marginBottom: "20px" }}>{puan >= 16 ? "🌟" : puan >= 10 ? "👍" : "📚"}</div>
          <h2 style={{ color: "#f0e6d3", fontFamily: "Georgia, serif", fontSize: "24px", marginBottom: "20px" }}>Bitti!</h2>
          <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "30px 50px", textAlign: "center", marginBottom: "20px" }}>
            <div style={{ fontSize: "48px", color: "#f59e0b", fontWeight: "bold" }}>{puan}</div>
            <div style={{ fontSize: "12px", color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>/ 20 puan</div>
            <div style={{ fontSize: "13px", color: "#10b981", marginTop: "8px" }}>{puan / 2} / 10 doğru</div>
          </div>
          <button onClick={yenidenBasla}
            style={{ padding: "14px 32px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "600", marginBottom: "12px", width: "220px" }}>
            Yeni Sayfa
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

  // OYUN
  return (
    <div style={kapsayici}>
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a2e" }}>
        <button onClick={onKapat} style={{ background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer" }}>✕</button>
        <span style={{ fontSize: "14px", color: "#f0e6d3", fontFamily: "Georgia, serif" }}>➕ İşlem Ustası</span>
        <span style={{ fontSize: "13px", color: "#f59e0b" }}>{cevaplar.filter(c => c !== "").length}/10</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", maxWidth: "420px", margin: "0 auto" }}>
          {sorular.map((s, i) => {
            const seciliMi = secili === i;
            let renk = "#1a1a2e", border = "1px solid #333", yazi = "#f0e6d3";
            if (sonuclar) {
              if (sonuclar[i]) { renk = "#001a0f"; border = "2px solid #10b981"; yazi = "#10b981"; }
              else { renk = "#1a0000"; border = "2px solid #ef4444"; yazi = "#ef4444"; }
            } else if (seciliMi) {
              border = "2px solid #7c3aed";
            }
            return (
              <div key={i} onClick={() => !sonuclar && setSecili(i)}
                style={{ background: renk, border, borderRadius: "12px", padding: "12px", cursor: sonuclar ? "default" : "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "20px", color: "#f0e6d3", fontFamily: "Georgia, serif", fontWeight: "bold", marginBottom: "6px" }}>
                  {s.a} {s.islem} {s.b}
                </div>
                <div style={{ fontSize: "22px", color: yazi, fontFamily: "Georgia, serif", fontWeight: "bold", minHeight: "28px", borderTop: "1px solid #444", paddingTop: "4px" }}>
                  {cevaplar[i] || "?"}
                  {sonuclar && !sonuclar[i] && <span style={{ fontSize: "13px", color: "#10b981", display: "block" }}>✓ {s.cevap}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rakam tuslari */}
      {!sonuclar && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", maxWidth: "340px", margin: "0 auto 10px" }}>
            {[1,2,3,4,5,6,7,8,9,0].map(r => (
              <button key={r} onClick={() => rakamGir(String(r))}
                style={{ width: "40px", height: "44px", fontSize: "19px", background: "#1a1a2e", color: "#c8bfb0", border: "2px solid #4f46e5", borderRadius: "10px", cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: "bold" }}>
                {r}
              </button>
            ))}
            <button onClick={sil}
              style={{ width: "40px", height: "44px", fontSize: "18px", background: "#1a1a2e", color: "#ef4444", border: "2px solid #ef4444", borderRadius: "10px", cursor: "pointer" }}>
              ⌫
            </button>
          </div>
          <button onClick={kontrolEt} disabled={!hepsiDolu}
            style={{ width: "100%", padding: "14px", background: hepsiDolu ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "#1a1a2e", color: hepsiDolu ? "white" : "#555", border: "none", borderRadius: "12px", cursor: hepsiDolu ? "pointer" : "not-allowed", fontSize: "15px", fontWeight: "600" }}>
            {hepsiDolu ? "✓ Kontrol Et" : "Tüm soruları çöz"}
          </button>
        </div>
      )}
    </div>
  );
}

const kapsayici = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#0f0f1a", zIndex: 500, display: "flex", flexDirection: "column" };

export default IslemOyunu;