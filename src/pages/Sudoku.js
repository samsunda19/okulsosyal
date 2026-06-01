import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { skoruPaylas } from "./skorPaylas";

// Zorluga gore acilan (bos) hucre sayisi
const ZORLUKLAR = {
  kolay: { ad: "Kolay", bos: 32, renk: "#10b981" },
  orta:  { ad: "Orta",  bos: 45, renk: "#f59e0b" },
  zor:   { ad: "Zor",   bos: 54, renk: "#ef4444" }
};

// ===== Klasik 9x9 sudoku uretici =====
function gecerliMi(grid, satir, sutun, sayi) {
  for (let i = 0; i < 9; i++) {
    if (grid[satir][i] === sayi) return false;
    if (grid[i][sutun] === sayi) return false;
  }
  const bs = Math.floor(satir / 3) * 3, bsu = Math.floor(sutun / 3) * 3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (grid[bs + i][bsu + j] === sayi) return false;
  return true;
}

function cozumDoldur(grid) {
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (grid[i][j] === 0) {
        const sayilar = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
        for (const s of sayilar) {
          if (gecerliMi(grid, i, j, s)) {
            grid[i][j] = s;
            if (cozumDoldur(grid)) return true;
            grid[i][j] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function bulmacaUret(bosSayisi) {
  const cozum = Array.from({ length: 9 }, () => Array(9).fill(0));
  cozumDoldur(cozum);
  const verilen = cozum.map(s => [...s]);
  // Rastgele hucreleri bosalt
  let kaldirilan = 0;
  const hucreler = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) hucreler.push([i, j]);
  hucreler.sort(() => Math.random() - 0.5);
  for (const [i, j] of hucreler) {
    if (kaldirilan >= bosSayisi) break;
    if (verilen[i][j] !== 0) { verilen[i][j] = 0; kaldirilan++; }
  }
  return { cozum, verilen };
}

function Sudoku({ onKapat, baslangicZorluk }) {
  const [durum, setDurum] = useState("zorlukSec");
  const [zorluk, setZorluk] = useState(baslangicZorluk || null);
  const [cozum, setCozum] = useState([]);
  const [verilen, setVerilen] = useState([]);
  const [tahta, setTahta] = useState([]);
  const [secili, setSecili] = useState(null);
  const [puan, setPuan] = useState(0);
  const [paylasildi, setPaylasildi] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [yorum, setYorum] = useState("");

  const oyunBaslat = (z) => {
    const { cozum: c, verilen: v } = bulmacaUret(ZORLUKLAR[z].bos);
    setZorluk(z);
    setCozum(c);
    setVerilen(v);
    setTahta(v.map(s => [...s]));
    setSecili(null);
    setPuan(0);
    setDurum("oyun");
  };

  const hucreSec = (i, j) => {
    if (verilen[i][j] !== 0) return;
    setSecili({ i, j });
  };

  const sayiGir = (sayi) => {
    if (!secili) return;
    const yeni = tahta.map(s => [...s]);
    yeni[secili.i][secili.j] = sayi;
    setTahta(yeni);
  };

  const sil = () => {
    if (!secili) return;
    const yeni = tahta.map(s => [...s]);
    yeni[secili.i][secili.j] = 0;
    setTahta(yeni);
  };

  useEffect(() => {
    if (durum !== "oyun") return;
    const handler = (e) => {
      const sayi = parseInt(e.key);
      if (sayi >= 1 && sayi <= 9) sayiGir(sayi);
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") sil();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [durum, secili, tahta]); // eslint-disable-line react-hooks/exhaustive-deps

  const dolu = tahta.length > 0 && tahta.every(s => s.every(v => v !== 0));
  const dogruMu = dolu && tahta.every((s, i) => s.every((v, j) => v === cozum[i][j]));

  const kontrolEt = () => {
    if (dogruMu) {
      const kazanilan = ZORLUKLAR[zorluk].bos; // bos sayisi kadar puan
      setPuan(kazanilan);
      setDurum("bitti");
    } else {
      alert("Henüz doğru değil, tekrar bak! 🤔");
    }
  };

  const paylas = async () => {
    setPaylasiliyor(true);
    try {
      await skoruPaylas({
        oyunAdi: "Sudoku",
        ikon: "🔢",
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

  // ===== EKRANLAR =====
  if (durum === "zorlukSec") {
    return (
      <div style={kapsayici}>
        <div style={ustBar}>
          <h2 style={{ color: "#f0e6d3", fontSize: "18px", fontFamily: "Georgia, serif", margin: 0, flex: 1 }}>🔢 Sudoku</h2>
          <button onClick={onKapat} style={kapatBtn}>✕</button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <p style={{ color: "#888", marginBottom: "30px", textAlign: "center", fontFamily: "Georgia, serif" }}>
            Her satır, sütun ve 3×3 kutuda<br/>1-9 sayıları tekrar etmemeli!
          </p>
          {Object.entries(ZORLUKLAR).map(([key, z]) => (
            <button key={key} onClick={() => oyunBaslat(key)}
              style={{ width: "240px", padding: "18px", marginBottom: "14px", background: "#1a1a2e", color: z.renk, border: `2px solid ${z.renk}`, borderRadius: "14px", cursor: "pointer", fontSize: "17px", fontWeight: "600", fontFamily: "Georgia, serif" }}>
              {z.ad}
              <div style={{ fontSize: "11px", color: "#666", marginTop: "4px", fontWeight: "normal" }}>
                {81 - z.bos} dolu · {z.bos} boş
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
          <div style={{ fontSize: "50px", marginBottom: "20px" }}>🎉</div>
          <h2 style={{ color: "#f0e6d3", fontFamily: "Georgia, serif", fontSize: "24px", marginBottom: "20px" }}>Tebrikler!</h2>
          <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "30px 50px", textAlign: "center", marginBottom: "30px" }}>
            <div style={{ fontSize: "48px", color: "#f59e0b", fontWeight: "bold" }}>+{puan}</div>
            <div style={{ fontSize: "12px", color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>puan</div>
          </div>
          <button onClick={() => setDurum("zorlukSec")}
            style={{ padding: "14px 32px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "600", marginBottom: "12px", width: "220px" }}>
            Yeni Bulmaca
          </button>
          {!paylasildi && (
            <input type="text" value={yorum} onChange={e => setYorum(e.target.value)} maxLength={100}
              placeholder="Bir şeyler yaz (isteğe bağlı)"
              style={{ width: "220px", padding: "10px 14px", marginBottom: "10px", background: "#1a1a2e", color: "#f0e6d3", border: "1px solid #333", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", fontFamily: "Georgia, serif" }} />
          )}
          <button onClick={paylas} disabled={paylasildi || paylasiliyor}
            style={{ padding: "12px 32px", background: paylasildi ? "#10b981" : "#1a1a2e", color: paylasildi ? "white" : "#7c3aed", border: paylasildi ? "none" : "2px solid #7c3aed", borderRadius: "12px", cursor: paylasildi ? "default" : "pointer", fontSize: "14px", fontWeight: "600", width: "220px", marginBottom: "12px" }}>
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
  const hucreBoyut = 34;

  return (
    <div style={kapsayici}>
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a2e" }}>
        <button onClick={() => setDurum("zorlukSec")} style={{ background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer" }}>←</button>
        <span style={{ fontSize: "13px", color: "#888" }}>{ZORLUKLAR[zorluk].ad}</span>
        <button onClick={onKapat} style={{ background: "none", border: "none", color: "#555", fontSize: "18px", cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
        {/* 9x9 Izgara - 3x3 bloklu */}
        <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(9, " + hucreBoyut + "px)", background: "#7c3aed", padding: "3px", borderRadius: "8px", marginBottom: "20px", gap: "1px" }}>
          {tahta.map((satir, i) =>
            satir.map((v, j) => {
              const verilenHucre = verilen[i][j] !== 0;
              const seciliHucre = secili && secili.i === i && secili.j === j;
              let cakisma = false;
              if (v !== 0 && !verilenHucre) {
                for (let k = 0; k < 9; k++) {
                  if (k !== j && tahta[i][k] === v) cakisma = true;
                  if (k !== i && tahta[k][j] === v) cakisma = true;
                }
                const bs = Math.floor(i / 3) * 3, bsu = Math.floor(j / 3) * 3;
                for (let a = 0; a < 3; a++)
                  for (let b = 0; b < 3; b++) {
                    const ri = bs + a, rj = bsu + b;
                    if ((ri !== i || rj !== j) && tahta[ri][rj] === v) cakisma = true;
                  }
              }
              // 3x3 blok ayrimi icin kalin parlak kenarlik
              const sagBlok = (j % 3 === 2 && j !== 8) ? "4px solid #a78bfa" : "none";
              const altBlok = (i % 3 === 2 && i !== 8) ? "4px solid #a78bfa" : "none";
              return (
                <div key={`${i}-${j}`} onClick={() => hucreSec(i, j)}
                  style={{
                    width: hucreBoyut + "px", height: hucreBoyut + "px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: verilenHucre ? "#0f0f1a" : seciliHucre ? "#7c3aed" : "#1a1a2e",
                    color: verilenHucre ? "#999" : cakisma ? "#ef4444" : "#f0e6d3",
                    fontSize: "18px", fontWeight: "bold",
                    cursor: verilenHucre ? "default" : "pointer",
                    fontFamily: "Georgia, serif", userSelect: "none",
                    borderRight: sagBlok, borderBottom: altBlok, boxSizing: "border-box"
                  }}>
                  {v !== 0 ? v : ""}
                </div>
              );
            })
          )}
        </div>

        {/* Sayi tuslari 1-9 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", maxWidth: "340px" }}>
          {[1,2,3,4,5,6,7,8,9].map(sayi => (
            <button key={sayi} onClick={() => sayiGir(sayi)}
              style={{ width: "40px", height: "44px", fontSize: "19px", background: "#1a1a2e", color: "#c8bfb0", border: "2px solid #4f46e5", borderRadius: "10px", cursor: "pointer", fontFamily: "Georgia, serif", fontWeight: "bold" }}>
              {sayi}
            </button>
          ))}
          <button onClick={sil}
            style={{ width: "40px", height: "44px", fontSize: "18px", background: "#1a1a2e", color: "#ef4444", border: "2px solid #ef4444", borderRadius: "10px", cursor: "pointer" }}>
            ⌫
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a2e" }}>
        <button onClick={kontrolEt} disabled={!dolu}
          style={{ width: "100%", padding: "14px", background: dolu ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : "#1a1a2e", color: dolu ? "white" : "#555", border: "none", borderRadius: "12px", cursor: dolu ? "pointer" : "not-allowed", fontSize: "15px", fontWeight: "600" }}>
          {dolu ? "✓ Kontrol Et" : "Tüm kutuları doldur"}
        </button>
      </div>
    </div>
  );
}

const kapsayici = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#0f0f1a", zIndex: 500, display: "flex", flexDirection: "column" };
const ustBar = { padding: "20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #222" };
const kapatBtn = { background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer" };

export default Sudoku;