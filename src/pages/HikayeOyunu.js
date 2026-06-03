import React, { useState, useRef, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, increment, collection, getDocs, query, where } from "firebase/firestore";
import { skoruPaylas } from "./skorPaylas";
import SekSekMatematik from "./SekSekMatematik";
import Sudoku from "./Sudoku";
import IslemOyunu from "./IslemOyunu";
import SifreOyunu from "./SifreOyunu";

function SoruSayfasi({ sayfa, soruNo, onCevap }) {
  const [secilen, setSecilen] = useState(null);
  const [sonuc, setSonuc] = useState(null);
  const [deneme, setDeneme] = useState(0);

  const cevapla = (idx) => {
    if (sonuc === "dogru") return;
    const yeniDeneme = deneme + 1;
    setDeneme(yeniDeneme);
    setSecilen(idx);
    if (idx === sayfa.dogru) {
      const puan = Math.max(1, 4 - yeniDeneme);
      setSonuc("dogru");
      onCevap(puan);
    } else {
      setSonuc("yanlis");
      setTimeout(() => { setSecilen(null); setSonuc(null); }, 1500);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"30px 24px" }}>
      <div style={{ fontSize:"12px", color:"#f59e0b", letterSpacing:"3px", marginBottom:"20px", textTransform:"uppercase" }}>
        ⭐ Soru {soruNo}
      </div>
      <p style={{ fontSize:"20px", color:"#f0e6d3", textAlign:"center", maxWidth:"320px", lineHeight:1.6, marginBottom:"32px", fontStyle:"italic", fontFamily:"Georgia, serif" }}>
        "{sayfa.soru}"
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:"12px", width:"100%", maxWidth:"300px" }}>
        {sayfa.secenekler.map((s, i) => (
          <button key={i} onClick={() => cevapla(i)} disabled={sonuc === "dogru"}
            style={{
              padding:"14px 20px", borderRadius:"12px",
              border: secilen === i ? (sonuc === "dogru" ? "2px solid #10b981" : "2px solid #ef4444") : "1px solid #333",
              background: secilen === i ? (sonuc === "dogru" ? "#001a0f" : "#1a0000") : "#1a1a2e",
              color: secilen === i ? (sonuc === "dogru" ? "#10b981" : "#ef4444") : "#c8bfb0",
              fontSize:"15px", cursor:"pointer", fontFamily:"Georgia, serif", textAlign:"left", transition:"all 0.2s"
            }}>
            {String.fromCharCode(65+i)}) {s}
          </button>
        ))}
      </div>
      {sonuc === "dogru" && <p style={{ marginTop:"20px", fontSize:"15px", color:"#10b981", textAlign:"center" }}>✅ Harika! +{Math.max(1, 4 - deneme)} puan kazandın!</p>}
      {sonuc === "yanlis" && <p style={{ marginTop:"20px", fontSize:"14px", color:"#f59e0b", textAlign:"center" }}>❌ Tekrar dene!</p>}
    </div>
  );
}

function HikayeOyunu({ onKapat, karanlikMod }) {
  const [aktifHikaye, setAktifHikaye] = useState(null);
  const [sayfaNo, setSayfaNo] = useState(0);
  const [puanlar, setPuanlar] = useState([]);
  const [soruSayaci, setSoruSayaci] = useState(0);
  const [bitti, setBitti] = useState(false);
  const [soruCevaplandi, setSoruCevaplandi] = useState(false);
  const [hikayeler, setHikayeler] = useState([]);
  const [paylasildi, setPaylasildi] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [yorum, setYorum] = useState("");
  const [ekran, setEkran] = useState("kategoriler"); // kategoriler | siniflar | hikayeler
  const [secilenSinif, setSecilenSinif] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const oyunRef = useRef(null);
  const okumaRef = useRef(null);
  const touchStartY = useRef(null);
  const wheelZamani = useRef(0);
  const soruCevaplandıRef = useRef(false);
  const sayfaNoRef = useRef(0);
  const aktifHikayeRef = useRef(null);

  useEffect(() => {
    hikayeGetir();
    // Oyun acikken arka plan (akis) kaymasin
    const eskiOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = eskiOverflow; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hikayeGetir = async () => {
    try {
      const q = query(collection(db, "hikayeler"), where("aktif", "==", true));
      const snapshot = await getDocs(q);
      const yediGunOnce = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const liste = snapshot.docs
        .map(d => ({ ...d.data(), firestoreId: d.id }))
        .filter(h => {
          const hikayeZamani = (h.tarih?.seconds || 0) * 1000;
          // Tarihi olmayan eski hikayeler gosterilsin, 7 gunden yeniler gosterilsin
          return !hikayeZamani || hikayeZamani >= yediGunOnce;
        });
      setHikayeler(liste);
    } catch (err) {
      console.error("Hikayeler yüklenemedi:", err);
    }
    setYukleniyor(false);
  };

  useEffect(() => { soruCevaplandıRef.current = soruCevaplandi; }, [soruCevaplandi]);
  useEffect(() => { sayfaNoRef.current = sayfaNo; }, [sayfaNo]);
  useEffect(() => { aktifHikayeRef.current = aktifHikaye; }, [aktifHikaye]);

  const sonrakiSayfaRef = useRef(null);
  const oncekiSayfaRef = useRef(null);

  const sonrakiSayfa = () => {
    const hikaye = aktifHikayeRef.current;
    const no = sayfaNoRef.current;
    if (!hikaye) return;
    const mevcut = hikaye.sayfalar[no];
    if (mevcut.tip === "soru" && !soruCevaplandıRef.current) return;
    const sonSayfa = hikaye.sayfalar.length - 1;
    if (no >= sonSayfa) {
      setBitti(true);
    } else {
      setSayfaNo(prev => prev + 1);
      setSoruCevaplandi(false);
      soruCevaplandıRef.current = false;
    }
  };

  const oncekiSayfa = () => {
    if (sayfaNoRef.current > 0) setSayfaNo(prev => prev - 1);
  };

  sonrakiSayfaRef.current = sonrakiSayfa;
  oncekiSayfaRef.current = oncekiSayfa;

  useEffect(() => {
    if (!aktifHikaye || bitti) return;
    const el = okumaRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const simdi = Date.now();
      if (simdi - wheelZamani.current < 700) return;
      const hikaye = aktifHikayeRef.current;
      const no = sayfaNoRef.current;
      if (hikaye) {
        const mevcut = hikaye.sayfalar[no];
        if (mevcut?.tip === "soru" && !soruCevaplandıRef.current) return;
      }
      wheelZamani.current = simdi;
      if (e.deltaY > 0) sonrakiSayfaRef.current();
      else oncekiSayfaRef.current();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [aktifHikaye, bitti]);

  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 50) sonrakiSayfa();
    else if (diff < -50) oncekiSayfa();
    touchStartY.current = null;
  };

  const hikayeBaslat = (hikaye) => {
    setAktifHikaye(hikaye);
    setSayfaNo(0);
    setPuanlar([]);
    setSoruSayaci(0);
    setBitti(false);
    setSoruCevaplandi(false);
    setPaylasildi(false);
    setYorum("");
  };

  const paylas = async (toplamPuan) => {
    setPaylasiliyor(true);
    try {
      await skoruPaylas({
        oyunAdi: aktifHikaye.baslik,
        ikon: "📖",
        puan: toplamPuan,
        altYazi: "Hikaye Okuma",
        renk: "#7c3aed",
        yorum: yorum
      });
      setPaylasildi(true);
    } catch (e) {
      alert("Paylaşılamadı: " + e.message);
    }
    setPaylasiliyor(false);
  };

  const soruCevapla = (puan) => {
    setPuanlar(prev => [...prev, puan]);
    setSoruSayaci(prev => prev + 1);
    setSoruCevaplandi(true);
    soruCevaplandıRef.current = true;
  };

  useEffect(() => {
    if (bitti && aktifHikaye) puanKaydet();
  }, [bitti]); // eslint-disable-line react-hooks/exhaustive-deps

  const puanKaydet = async () => {
    try {
      const toplam = puanlar.reduce((a, b) => a + b, 0);
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      const tamamlananlar = userDoc.data()?.tamamlananHikayeler || [];
      const hikayeKey = aktifHikaye.firestoreId || aktifHikaye.id;
      if (tamamlananlar.includes(hikayeKey)) return;
      await updateDoc(userRef, {
        oyunPuani: increment(toplam),
        tamamlananHikayeler: [...tamamlananlar, hikayeKey]
      });
    } catch (err) {
      console.error("Puan kaydedilemedi:", err);
    }
  };

  const toplamPuan = puanlar.reduce((a, b) => a + b, 0);
  const maxPuan = aktifHikaye ? aktifHikaye.sayfalar.filter(s => s.tip === "soru").length * 3 : 9;

  if (yukleniyor) {
    return (
      <div ref={oyunRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:"#888", fontFamily:"Georgia, serif" }}>Hikayeler yükleniyor...</p>
      </div>
    );
  }

  if (!aktifHikaye) {
    // Sinifa gore hikaye sayisi
    const sinifHikayeSayisi = (sinif) => hikayeler.filter(h => {
      const s = parseInt((h.seviye || "").match(/\d+/)?.[0]);
      return s === sinif;
    }).length;

    const sinifHikayeleri = secilenSinif
      ? hikayeler.filter(h => parseInt((h.seviye || "").match(/\d+/)?.[0]) === secilenSinif)
      : [];

    // MATEMATIK OYUNU
    if (ekran === "matematik") {
      return <SekSekMatematik onKapat={() => setEkran("kategoriler")} />;
    }

    // SUDOKU OYUNU
    if (ekran === "sudoku") {
      return <Sudoku onKapat={() => setEkran("kategoriler")} />;
    }

    // ISLEM OYUNU
    if (ekran === "islem") {
      return <IslemOyunu onKapat={() => setEkran("kategoriler")} />;
    }
    if (ekran === "sifre") {
      return <SifreOyunu onKapat={() => setEkran("kategoriler")} />;
    }

    // EKRAN 1: Oyun Kategorileri
    if (ekran === "kategoriler") {
      const oyunlar = [
        { id: "hikaye", ad: "Hikaye Okuma", ikon: "📖", renk: "#7c3aed", aktif: true, aciklama: "Hikayeleri oku, soruları cevapla" },
        { id: "matematik", ad: "Sek Sek Matematik", ikon: "🦘", renk: "#10b981", aktif: true, aciklama: "Engelleri geç, işlemleri çöz" },
        { id: "bilim", ad: "Bil Bakalım Ben Bilim", ikon: "🔬", renk: "#3b82f6", aktif: false, aciklama: "Fen ve doğa soruları" },
        { id: "sudoku", ad: "Sudoku", ikon: "🔢", renk: "#f59e0b", aktif: true, aciklama: "Sayıları yerleştir" },
        { id: "islem", ad: "İşlem Ustası", ikon: "➕", renk: "#10b981", aktif: true, aciklama: "Toplama ve çıkarma" },
        { id: "sifre", ad: "Sifreli Islem", ikon: "🔐", renk: "#7c3aed", aktif: true, aciklama: "Sezar sifresi coz, harfi bul, kelimeyi tamamla" }
      ];
      return (
        <div ref={oyunRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #222" }}>
            <button onClick={onKapat} style={{ background:"none", border:"none", color:"#888", fontSize:"20px", cursor:"pointer" }}>✕</button>
            <h2 style={{ color:"#f0e6d3", fontSize:"18px", fontFamily:"Georgia, serif", margin:0 }}>🎮 Oyunlar</h2>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
            {oyunlar.map(o => (
              <div key={o.id} onClick={() => { if (o.aktif) setEkran(o.id === "matematik" ? "matematik" : o.id === "sudoku" ? "sudoku" : o.id === "islem" ? "islem" : o.id === "sifre" ? "sifre" : "siniflar"); }}
                style={{ background:"#1a1a2e", borderRadius:"16px", padding:"20px", marginBottom:"14px", cursor: o.aktif ? "pointer" : "default", border:`1px solid ${o.aktif ? o.renk : "#2a2a3e"}`, opacity: o.aktif ? 1 : 0.55, display:"flex", alignItems:"center", gap:"16px", position:"relative" }}>
                <div style={{ fontSize:"36px" }}>{o.ikon}</div>
                <div style={{ flex:1 }}>
                  <h3 style={{ color:"#f0e6d3", fontSize:"17px", fontFamily:"Georgia, serif", margin:"0 0 4px" }}>{o.ad}</h3>
                  <p style={{ color:"#888", fontSize:"12px", margin:0 }}>{o.aciklama}</p>
                </div>
                {o.aktif ? (
                  <span style={{ color:o.renk, fontSize:"20px" }}>→</span>
                ) : (
                  <span style={{ background:"#2a2a3e", color:"#f59e0b", fontSize:"10px", padding:"4px 10px", borderRadius:"20px", letterSpacing:"1px", fontWeight:"600" }}>YAKINDA</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // EKRAN 2: Sinif Secimi
    if (ekran === "siniflar") {
      return (
        <div ref={oyunRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #222" }}>
            <button onClick={() => setEkran("kategoriler")} style={{ background:"none", border:"none", color:"#888", fontSize:"20px", cursor:"pointer" }}>←</button>
            <h2 style={{ color:"#f0e6d3", fontSize:"18px", fontFamily:"Georgia, serif", margin:0, flex:1 }}>📖 Sınıfını Seç</h2>
            <button onClick={onKapat} style={{ background:"none", border:"none", color:"#888", fontSize:"20px", cursor:"pointer" }}>✕</button>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:"12px" }}>
              {[1,2,3,4,5,6,7,8].map(s => {
                const sayi = sinifHikayeSayisi(s);
                return (
                  <div key={s} onClick={() => { setSecilenSinif(s); setEkran("hikayeler"); }}
                    style={{ background:"#1a1a2e", borderRadius:"16px", padding:"24px", cursor:"pointer", border:"1px solid #333", textAlign:"center" }}>
                    <div style={{ fontSize:"32px", color:"#7c3aed", fontWeight:"bold", fontFamily:"Georgia, serif" }}>{s}</div>
                    <div style={{ fontSize:"12px", color:"#888", marginTop:"4px" }}>{s}. Sınıf</div>
                    <div style={{ fontSize:"11px", color: sayi > 0 ? "#10b981" : "#555", marginTop:"6px" }}>
                      {sayi > 0 ? `${sayi} hikaye` : "boş"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // EKRAN 3: Hikaye Listesi (secilen sinif)
    return (
      <div ref={oyunRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #222" }}>
          <button onClick={() => setEkran("siniflar")} style={{ background:"none", border:"none", color:"#888", fontSize:"20px", cursor:"pointer" }}>←</button>
          <h2 style={{ color:"#f0e6d3", fontSize:"18px", fontFamily:"Georgia, serif", margin:0, flex:1 }}>📖 {secilenSinif}. Sınıf Hikayeleri</h2>
          <button onClick={onKapat} style={{ background:"none", border:"none", color:"#888", fontSize:"20px", cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
          {sinifHikayeleri.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#555" }}>
              <p style={{ fontSize:"40px" }}>📖</p>
              <p style={{ fontFamily:"Georgia, serif", color:"#888" }}>Bu sınıf için henüz hikaye yok.</p>
            </div>
          ) : (
            sinifHikayeleri.map((h, i) => (
              <div key={i} onClick={() => hikayeBaslat(h)}
                style={{ background:"#1a1a2e", borderRadius:"16px", padding:"20px", marginBottom:"16px", cursor:"pointer", border:"1px solid #333" }}>
                <div style={{ fontSize:"11px", color:"#f59e0b", letterSpacing:"2px", marginBottom:"8px", textTransform:"uppercase" }}>
                  {h.konu || "Hikaye"} · {h.seviye || ""}
                </div>
                <h3 style={{ color:"#f0e6d3", fontSize:"18px", fontFamily:"Georgia, serif", margin:"0 0 8px" }}>{h.baslik}</h3>
                <div style={{ fontSize:"12px", color:"#666" }}>
                  {h.sayfalar?.length} sayfa · {h.sayfalar?.filter(s => s.tip === "soru").length} soru
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (bitti) {
    return (
      <div ref={oyunRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"30px" }}>
        <div style={{ fontSize:"50px", marginBottom:"20px" }}>🎉</div>
        <h2 style={{ color:"#f0e6d3", fontFamily:"Georgia, serif", fontSize:"24px", marginBottom:"8px", textAlign:"center" }}>Hikaye Bitti!</h2>
        <p style={{ color:"#888", fontSize:"14px", marginBottom:"30px" }}>{aktifHikaye.baslik}</p>
        <div style={{ background:"#1a1a2e", borderRadius:"20px", padding:"30px 50px", textAlign:"center", marginBottom:"30px" }}>
          <div style={{ fontSize:"48px", color:"#f59e0b", fontWeight:"bold" }}>{toplamPuan}</div>
          <div style={{ fontSize:"12px", color:"#666", letterSpacing:"2px", textTransform:"uppercase", marginTop:"4px" }}>/ {maxPuan} puan</div>
          <div style={{ marginTop:"16px", fontSize:"14px", color: toplamPuan >= maxPuan * 0.8 ? "#10b981" : toplamPuan >= maxPuan * 0.5 ? "#f59e0b" : "#ef4444" }}>
            {toplamPuan >= maxPuan * 0.8 ? "🌟 Mükemmel!" : toplamPuan >= maxPuan * 0.5 ? "👍 İyi iş!" : "📚 Tekrar okuyabilirsin!"}
          </div>
        </div>
        <button onClick={() => { setAktifHikaye(null); setBitti(false); setEkran("hikayeler"); }}
          style={{ padding:"14px 32px", background:"linear-gradient(135deg, #4f46e5, #7c3aed)", color:"white", border:"none", borderRadius:"12px", cursor:"pointer", fontSize:"15px", fontWeight:"600", marginBottom:"12px", width:"200px" }}>
          Diğer Hikayeler
        </button>
        {!paylasildi && (
          <input type="text" value={yorum} onChange={e => setYorum(e.target.value)} maxLength={100}
            placeholder="Bir şeyler yaz (isteğe bağlı)"
            style={{ width:"200px", padding:"10px 14px", marginBottom:"10px", background:"#1a1a2e", color:"#f0e6d3", border:"1px solid #333", borderRadius:"10px", fontSize:"13px", boxSizing:"border-box", fontFamily:"Georgia, serif" }} />
        )}
        <button onClick={() => paylas(toplamPuan)} disabled={paylasildi || paylasiliyor}
          style={{ padding:"12px 32px", background: paylasildi ? "#10b981" : "#1a1a2e", color: paylasildi ? "white" : "#7c3aed", border: paylasildi ? "none" : "2px solid #7c3aed", borderRadius:"12px", cursor: paylasildi ? "default" : "pointer", fontSize:"14px", fontWeight:"600", width:"200px", marginBottom:"12px" }}>
          {paylasildi ? "✓ Paylaşıldı" : paylasiliyor ? "Paylaşılıyor..." : "📢 Akışta Paylaş"}
        </button>
        <button onClick={onKapat}
          style={{ padding:"12px 32px", background:"#222", color:"#888", border:"none", borderRadius:"12px", cursor:"pointer", fontSize:"14px", width:"200px" }}>
          Kapat
        </button>
      </div>
    );
  }

  const mevcutSayfa = aktifHikaye.sayfalar[sayfaNo];
  const soruMu = mevcutSayfa.tip === "soru";
  const metinSayfaNo = aktifHikaye.sayfalar.slice(0, sayfaNo + 1).filter(s => s.tip === "metin" || s.tip === "son").length;
  const toplamMetin = aktifHikaye.sayfalar.filter(s => s.tip === "metin" || s.tip === "son").length;

  return (
    <div ref={okumaRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column" }}>

      <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1a1a2e" }}>
        <button onClick={() => { setAktifHikaye(null); setEkran("hikayeler"); }} style={{ background:"none", border:"none", color:"#555", fontSize:"20px", cursor:"pointer" }}>←</button>
        <span style={{ fontSize:"12px", color:"#555" }}>{soruMu ? "🌟 Soru" : `${metinSayfaNo} / ${toplamMetin}`}</span>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <span style={{ fontSize:"12px", color:"#f59e0b" }}>⭐ {toplamPuan}</span>
          <button onClick={onKapat} style={{ background:"none", border:"none", color:"#555", fontSize:"18px", cursor:"pointer" }}>✕</button>
        </div>
      </div>

      <div style={{ height:"2px", background:"#1a1a2e" }}>
        <div style={{ height:"100%", background:"linear-gradient(90deg, #4f46e5, #7c3aed)", width:`${(sayfaNo / (aktifHikaye.sayfalar.length - 1)) * 100}%`, transition:"width 0.3s" }} />
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", overflowY:"auto" }}>
        {soruMu ? (
          <SoruSayfasi sayfa={mevcutSayfa} soruNo={soruSayaci + 1} onCevap={soruCevapla} />
        ) : (
          <>
            {mevcutSayfa.svg && <div dangerouslySetInnerHTML={{ __html: mevcutSayfa.svg || "" }} style={{ marginBottom:"24px" }} />}
            <p style={{ fontSize:"17px", color:"#e8dcc8", lineHeight:1.85, textAlign:"center", maxWidth:"340px", fontFamily:"Georgia, serif" }}>
              {mevcutSayfa.metin}
            </p>
          </>
        )}
      </div>

      <div style={{ padding:"16px 20px", display:"flex", gap:"10px", borderTop:"1px solid #1a1a2e" }}>
        {sayfaNo > 0 && (
          <button onClick={oncekiSayfa}
            style={{ flex:1, padding:"14px", background:"#1a1a2e", color:"#888", border:"none", borderRadius:"12px", cursor:"pointer", fontSize:"14px" }}>
            ← Geri
          </button>
        )}
        {(!soruMu || soruCevaplandi) ? (
          <button onClick={sonrakiSayfa}
            style={{ flex:2, padding:"14px", background:"linear-gradient(135deg, #4f46e5, #7c3aed)", color:"white", border:"none", borderRadius:"12px", cursor:"pointer", fontSize:"15px", fontWeight:"600" }}>
            {sayfaNo >= aktifHikaye.sayfalar.length - 1 ? "🎉 Bitir" : "Devam →"}
          </button>
        ) : (
          <div style={{ flex:2, padding:"14px", background:"#1a1a2e", color:"#555", borderRadius:"12px", textAlign:"center", fontSize:"13px" }}>
            Soruyu cevaplayın
          </div>
        )}
      </div>
    </div>
  );
}

export default HikayeOyunu;