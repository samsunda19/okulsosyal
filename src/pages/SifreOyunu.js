import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, updateDoc, increment } from "firebase/firestore";
import { skoruPaylas } from "./skorPaylas";

const ALF = ['A','B','C','Ç','D','E','F','G','Ğ','H','I','İ','J','K','L','M','N','O','Ö','P','R','S','Ş','T','U','Ü','V','Y','Z'];

function alfIdx(h) {
  return ALF.indexOf((h || '').toUpperCase());
}

function sezarSifrele(metin, kaydir, yon) {
  const n = ALF.length;
  return metin.toUpperCase().split('').map(ch => {
    const i = alfIdx(ch);
    if (i === -1) return ch;
    const yi = yon === 'ileri' ? (i + kaydir) % n : (i - kaydir + n) % n;
    return ALF[yi];
  }).join('');
}

function cozumYonu(yon) {
  return yon === 'ileri' ? 'geri' : 'ileri';
}

const ISLEMLER = [
  { tr: 'İKİ BÖLÜ İKİ', sonuc: 1 },
  { tr: 'BİR ÇARPI İKİ', sonuc: 2 },
  { tr: 'ÜÇ ÇARPI BİR', sonuc: 3 },
  { tr: 'İKİ ÇARPI İKİ', sonuc: 4 },
  { tr: 'DÖRT ARTI BİR', sonuc: 5 },
  { tr: 'ÜÇ ÇARPI İKİ', sonuc: 6 },
  { tr: 'ONİKİ BÖLÜ İKİ', sonuc: 6 },
  { tr: 'ALTI ARTI BİR', sonuc: 7 },
  { tr: 'ONDÖRT BÖLÜ İKİ', sonuc: 7 },
  { tr: 'ONALTI BÖLÜ İKİ', sonuc: 8 },
  { tr: 'ONSEKİZ BÖLÜ İKİ', sonuc: 9 },
  { tr: 'BEŞ ÇARPI İKİ', sonuc: 10 },
  { tr: 'ONBİR ARTI SIFIR', sonuc: 11 },
  { tr: 'YEDİ ÇARPI İKİ', sonuc: 14 },
  { tr: 'BEŞ ÇARPI ÜÇ', sonuc: 15 },
  { tr: 'ONBEŞ ARTI BİR', sonuc: 16 },
  { tr: 'YEDİ ARTI ON', sonuc: 17 },
  { tr: 'ONALTI ARTI İKİ', sonuc: 18 },
  { tr: 'YİRMİ EKSİ BİR', sonuc: 19 },
  { tr: 'DÖRT ÇARPI BEŞ', sonuc: 20 },
  { tr: 'ONBİR ARTI ON', sonuc: 21 },
  { tr: 'YİRMİ ARTI İKİ', sonuc: 22 },
  { tr: 'YİRMİDOKUZ EKSİ ALTI', sonuc: 23 },
  { tr: 'YİRMİSEKİZ EKSİ DÖRT', sonuc: 24 },
  { tr: 'BEŞ ÇARPI BEŞ', sonuc: 25 },
  { tr: 'DÖRT ARTI YİRMİİKİ', sonuc: 26 },
  { tr: 'DOKUZ ÇARPI ÜÇ', sonuc: 27 },
  { tr: 'YİRMİDOKUZ EKSİ BİR', sonuc: 28 },
  { tr: 'YİRMİBEŞ ARTI DÖRT', sonuc: 29 },
];

const KELIMELER = [
  { kelime: 'KEDİ',   harfler: ['K','E','D','İ'] },
  { kelime: 'OKUL',   harfler: ['O','K','U','L'] },
  { kelime: 'ANNE',   harfler: ['A','N','N','E'] },
  { kelime: 'ELMA',   harfler: ['E','L','M','A'] },
  { kelime: 'MASA',   harfler: ['M','A','S','A'] },
  { kelime: 'KUZU',   harfler: ['K','U','Z','U'] },
  { kelime: 'UZAY',   harfler: ['U','Z','A','Y'] },
  { kelime: 'BALIK',  harfler: ['B','A','L','I','K'] },
  { kelime: 'KALEM',  harfler: ['K','A','L','E','M'] },
  { kelime: 'ÇANTA',  harfler: ['Ç','A','N','T','A'] },
  { kelime: 'ARABA',  harfler: ['A','R','A','B','A'] },
  { kelime: 'KÖPEK',  harfler: ['K','Ö','P','E','K'] },
  { kelime: 'KOVAN',  harfler: ['K','O','V','A','N'] },
  { kelime: 'TAVUK',  harfler: ['T','A','V','U','K'] },
  { kelime: 'BULUT',  harfler: ['B','U','L','U','T'] },
  { kelime: 'ÇIÇEK',  harfler: ['Ç','I','Ç','E','K'] },
  { kelime: 'DENİZ',  harfler: ['D','E','N','İ','Z'] },
  { kelime: 'FENER',  harfler: ['F','E','N','E','R'] },
  { kelime: 'LİMON',  harfler: ['L','İ','M','O','N'] },
  { kelime: 'HAVUÇ',  harfler: ['H','A','V','U','Ç'] },
  { kelime: 'KANAT',  harfler: ['K','A','N','A','T'] },
  { kelime: 'YILAN',  harfler: ['Y','I','L','A','N'] },
  { kelime: 'ÇOCUK',  harfler: ['Ç','O','C','U','K'] },
  { kelime: 'TÜRKÜ',  harfler: ['T','Ü','R','K','Ü'] },
  { kelime: 'BALON',  harfler: ['B','A','L','O','N'] },
  { kelime: 'ORMAN',  harfler: ['O','R','M','A','N'] },
  { kelime: 'ASLAN',  harfler: ['A','S','L','A','N'] },
  { kelime: 'NEHİR',  harfler: ['N','E','H','İ','R'] },
  { kelime: 'KÖPRÜ',  harfler: ['K','Ö','P','R','Ü'] },
  { kelime: 'DEFTER', harfler: ['D','E','F','T','E','R'] },
];

function islemBul(sira) {
  const uygun = ISLEMLER.filter(i => i.sonuc === sira);
  if (!uygun.length) return null;
  return uygun[Math.floor(Math.random() * uygun.length)];
}

function oyunUret() {
  let deneme = 0;
  while (deneme < 100) {
    deneme++;
    const kelimeObj = KELIMELER[Math.floor(Math.random() * KELIMELER.length)];
    const kaydir = Math.floor(Math.random() * 3) + 1;
    const yon = Math.random() < 0.5 ? 'ileri' : 'geri';
    const cozYon = cozumYonu(yon);
    const sorular = [];
    let gecerli = true;
    for (const harf of kelimeObj.harfler) {
      const sira = alfIdx(harf) + 1;
      const islem = islemBul(sira);
      if (!islem) { gecerli = false; break; }
      const sifreli = sezarSifrele(islem.tr, kaydir, yon);
      sorular.push({ sifreli, dogruHarf: harf, sira, islemTr: islem.tr });
    }
    if (gecerli) return { kelimeObj, kaydir, yon, cozYon, sorular };
  }
  return oyunUret();
}

const kapsayici = {
  position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
  background: "#0f0f1a", zIndex: 500, display: "flex", flexDirection: "column"
};

function SifreOyunu({ onKapat }) {
  const [oyun, setOyun] = useState(() => oyunUret());
  const [seciliKutu, setSeciliKutu] = useState(0);
  const [cevaplar, setCevaplar] = useState([]);
  const [hatalar, setHatalar] = useState([]);
  const [tamamlandi, setTamamlandi] = useState(false);
  const [puan, setPuan] = useState(0);
  const [yanlislar, setYanlislar] = useState(0);
  const [durum, setDurum] = useState("oyun");
  const [paylasildi, setPaylasildi] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [yorum, setYorum] = useState("");

  useEffect(() => {
    setCevaplar(new Array(oyun.sorular.length).fill(null));
    setHatalar(new Array(oyun.sorular.length).fill(false));
    setSeciliKutu(0);
    setTamamlandi(false);
  }, [oyun]);

  const harfSec = (harf) => {
    if (tamamlandi) return;
    const idx = seciliKutu;
    const dogru = oyun.sorular[idx].dogruHarf;
    const yeniCevaplar = [...cevaplar];
    const yeniHatalar = [...hatalar];

    if (harf === dogru) {
      yeniCevaplar[idx] = dogru;
      yeniHatalar[idx] = false;
      setCevaplar(yeniCevaplar);
      setHatalar(yeniHatalar);
      const sonraki = yeniCevaplar.findIndex((c, i) => i > idx && c === null);
      const ilkBos = yeniCevaplar.findIndex(c => c === null);
      if (sonraki !== -1) setSeciliKutu(sonraki);
      else if (ilkBos !== -1) setSeciliKutu(ilkBos);
      if (yeniCevaplar.every(c => c !== null)) {
        const dogruSayisi = yeniCevaplar.filter((c, i) => c === oyun.sorular[i].dogruHarf).length;
        const p = Math.max(0, dogruSayisi * 3 - yanlislar);
        setPuan(p);
        setTamamlandi(true);
        setTimeout(() => setDurum("bitti"), 800);
      }
    } else {
      yeniHatalar[idx] = true;
      setHatalar(yeniHatalar);
      setYanlislar(y => y + 1);
      setTimeout(() => {
        setHatalar(h => { const n = [...h]; n[idx] = false; return n; });
      }, 600);
    }
  };

  const sil = () => {
    if (tamamlandi) return;
    const yeni = [...cevaplar];
    yeni[seciliKutu] = null;
    setCevaplar(yeni);
  };

  const yeniOyun = () => {
    setOyun(oyunUret());
    setPuan(0);
    setYanlislar(0);
    setTamamlandi(false);
    setDurum("oyun");
    setPaylasildi(false);
    setYorum("");
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

  const paylas = async () => {
    setPaylasiliyor(true);
    try {
      await skoruPaylas({
        oyunAdi: "Sifreli Islem Oyunu",
        ikon: "🔐",
        puan,
        altYazi: "Sezar Sifresi",
        renk: "#7c3aed",
        yorum
      });
      setPaylasildi(true);
    } catch (e) { alert("Paylasilamadi: " + e.message); }
    setPaylasiliyor(false);
  };

  if (durum === "bitti") {
    const maxPuan = oyun.sorular.length * 3;
    return (
      <div style={kapsayici}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px" }}>
          <div style={{ fontSize: "60px", marginBottom: "16px" }}>
            {puan >= maxPuan * 0.8 ? "🌟" : puan >= maxPuan * 0.5 ? "👍" : "📚"}
          </div>
          <h2 style={{ color: "#f0e6d3", fontFamily: "Georgia, serif", fontSize: "26px", marginBottom: "8px" }}>Kelimeyi buldun!</h2>
          <div style={{ fontSize: "40px", letterSpacing: "8px", color: "#f59e0b", fontFamily: "Georgia, serif", fontWeight: "bold", marginBottom: "24px" }}>
            {oyun.kelimeObj.kelime}
          </div>
          <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "28px 56px", textAlign: "center", marginBottom: "28px" }}>
            <div style={{ fontSize: "56px", color: "#f59e0b", fontWeight: "bold" }}>{puan}</div>
            <div style={{ fontSize: "14px", color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>/ {maxPuan} puan</div>
            {yanlislar > 0 && <div style={{ fontSize: "13px", color: "#ef4444", marginTop: "8px" }}>-{yanlislar} yanlis deneme</div>}
          </div>
          <button onClick={yeniOyun}
            style={{ padding: "16px 36px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "17px", fontWeight: "600", marginBottom: "12px", width: "240px" }}>
            Yeni Oyun
          </button>
          {!paylasildi && puan > 0 && (
            <input type="text" value={yorum} onChange={e => setYorum(e.target.value)} maxLength={100}
              placeholder="Bir seyler yaz (istege bagli)"
              style={{ width: "240px", padding: "10px 14px", marginBottom: "10px", background: "#1a1a2e", color: "#f0e6d3", border: "1px solid #333", borderRadius: "10px", fontSize: "14px", boxSizing: "border-box", fontFamily: "Georgia, serif" }} />
          )}
          <button onClick={paylas} disabled={paylasildi || paylasiliyor || puan === 0}
            style={{ padding: "12px 32px", background: paylasildi ? "#10b981" : "#1a1a2e", color: paylasildi ? "white" : (puan === 0 ? "#555" : "#7c3aed"), border: paylasildi ? "none" : `2px solid ${puan === 0 ? "#333" : "#7c3aed"}`, borderRadius: "12px", cursor: (paylasildi || puan === 0) ? "default" : "pointer", fontSize: "15px", fontWeight: "600", width: "240px", marginBottom: "12px" }}>
            {paylasildi ? "✓ Paylasildi" : paylasiliyor ? "Paylasilıyor..." : "📢 Akista Paylas"}
          </button>
          <button onClick={onKapat}
            style={{ padding: "12px 32px", background: "#222", color: "#888", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "15px", width: "240px" }}>
            Kapat
          </button>
        </div>
      </div>
    );
  }

  const { kaydir, cozYon, sorular } = oyun;
  const cozAciklama = `Her harfi ${kaydir} ${cozYon === 'ileri' ? 'İLERİ' : 'GERİ'} kaydırarak çöz`;

  return (
    <div style={kapsayici}>
      {/* Üst bar */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a2e" }}>
        <button onClick={onKapat} style={{ background: "none", border: "none", color: "#888", fontSize: "22px", cursor: "pointer" }}>✕</button>
        <span style={{ fontSize: "16px", color: "#f0e6d3", fontFamily: "Georgia, serif" }}>🔐 Sifreli Islem</span>
        <button onClick={yeniOyun} style={{ background: "none", border: "1px solid #333", color: "#888", fontSize: "13px", padding: "5px 12px", borderRadius: "8px", cursor: "pointer" }}>Yeni</button>
      </div>

      {/* Sezar bilgisi */}
      <div style={{ padding: "10px 20px", background: "#1a1a2e", borderBottom: "1px solid #2a2a3e" }}>
        <p style={{ margin: 0, fontSize: "14px", color: "#f59e0b", textAlign: "center", letterSpacing: "1px", fontWeight: "600" }}>
          🔑 {cozAciklama}
        </p>
      </div>

      {/* Sorular */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {sorular.map((s, i) => {
          const secili = seciliKutu === i;
          const dolu = cevaplar[i] !== null;
          const hata = hatalar[i];
          let bordCol = "#333";
          if (secili) bordCol = "#7c3aed";
          if (dolu && !hata) bordCol = "#10b981";
          if (hata) bordCol = "#ef4444";

          return (
            <div key={i} onClick={() => !dolu && setSeciliKutu(i)}
              style={{ background: "#1a1a2e", border: `2px solid ${bordCol}`, borderRadius: "14px", padding: "16px 18px", marginBottom: "12px", cursor: dolu ? "default" : "pointer", display: "flex", alignItems: "center", gap: "14px", transition: "border-color 0.2s" }}>
              <div style={{ minWidth: "28px", fontSize: "16px", color: "#666", fontFamily: "Georgia, serif", fontWeight: "bold" }}>
                {i + 1}.
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 4px", fontSize: "16px", fontFamily: "monospace", color: "#c8bfb0", letterSpacing: "2px", wordBreak: "break-all" }}>
                  {s.sifreli}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>
                  çöz → hesapla → kaçıncı harf?
                </p>
              </div>
              <div style={{
                minWidth: "48px", height: "52px", borderRadius: "10px",
                background: hata ? "#1a0000" : dolu ? "#001a0f" : (secili ? "#1a1040" : "#111"),
                border: `2px solid ${hata ? "#ef4444" : dolu ? "#10b981" : (secili ? "#7c3aed" : "#333")}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "22px", fontWeight: "bold", fontFamily: "Georgia, serif",
                color: hata ? "#ef4444" : dolu ? "#10b981" : (secili ? "#a78bfa" : "#555"),
                transition: "all 0.15s"
              }}>
                {hata ? "✗" : (cevaplar[i] || (secili ? "?" : ""))}
              </div>
            </div>
          );
        })}

        {/* Alfabe referans */}
        <div style={{ background: "#1a1a2e", borderRadius: "10px", padding: "12px 16px", marginTop: "8px" }}>
          <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#555", letterSpacing: "1px" }}>ALFABE SIRASI</p>
          <p style={{ margin: 0, fontSize: "12px", color: "#666", lineHeight: "2", fontFamily: "monospace" }}>
            {ALF.map((h, i) => `${i + 1}=${h}`).join('  ')}
          </p>
        </div>
      </div>

      {/* Harf klavyesi */}
      <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #1a1a2e", background: "#0f0f1a" }}>
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#555", textAlign: "center", letterSpacing: "1px" }}>
          {tamamlandi ? "✅ TAMAMLANDI!" : `${seciliKutu + 1}. soru için harf seç`}
        </p>
        <div style={{ display: "flex", gap: "5px", justifyContent: "center", marginBottom: "5px", flexWrap: "wrap" }}>
          {ALF.slice(0, 15).map((h, i) => (
            <button key={i} onClick={() => harfSec(h)} disabled={tamamlandi}
              style={{ width: "40px", height: "46px", fontSize: "16px", fontWeight: "bold", background: "#1a1a2e", color: "#c8bfb0", border: "2px solid #4f46e5", borderRadius: "8px", cursor: tamamlandi ? "default" : "pointer", fontFamily: "Georgia, serif", opacity: tamamlandi ? 0.5 : 1 }}>
              {h}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "5px", justifyContent: "center", flexWrap: "wrap" }}>
          {ALF.slice(15).map((h, i) => (
            <button key={i} onClick={() => harfSec(h)} disabled={tamamlandi}
              style={{ width: "40px", height: "46px", fontSize: "16px", fontWeight: "bold", background: "#1a1a2e", color: "#c8bfb0", border: "2px solid #4f46e5", borderRadius: "8px", cursor: tamamlandi ? "default" : "pointer", fontFamily: "Georgia, serif", opacity: tamamlandi ? 0.5 : 1 }}>
              {h}
            </button>
          ))}
          <button onClick={sil} disabled={tamamlandi}
            style={{ width: "46px", height: "46px", fontSize: "18px", background: "#1a1a2e", color: "#ef4444", border: "2px solid #ef4444", borderRadius: "8px", cursor: "pointer", opacity: tamamlandi ? 0.5 : 1 }}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

export default SifreOyunu;