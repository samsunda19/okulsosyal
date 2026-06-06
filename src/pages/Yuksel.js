import React, { useState, useRef, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { skoruPaylas } from "./skorPaylas";

// ===== ODA TEMALARI (her kat farkli bir oda, donusumlu) =====
// zemin: alt seritteki esyalar, duvar: arka renk, esyalar: odadaki nesneler
const ODALAR = [
  { ad: "Oturma Odasi", duvar: "#fde68a", zemin: "#a16207", esyalar: ["🛋️", "📺", "🪴", "🖼️", "🕰️"] },
  { ad: "Mutfak", duvar: "#bbf7d0", zemin: "#15803d", esyalar: ["🍳", "🧊", "🍽️", "🫖", "🥖"] },
  { ad: "Kutuphane", duvar: "#ddd6fe", zemin: "#6d28d9", esyalar: ["📚", "🪑", "📖", "🕯️", "🗺️"] },
  { ad: "Oyun Odasi", duvar: "#fbcfe8", zemin: "#be185d", esyalar: ["🧸", "🎮", "🪁", "🎨", "⚽"] },
  { ad: "Hayvan Kati", duvar: "#fed7aa", zemin: "#c2410c", esyalar: ["🐕", "🐈", "🐢", "🐰", "🦜"] },
  { ad: "Bahce Kati", duvar: "#a7f3d0", zemin: "#047857", esyalar: ["🌳", "🌻", "🦋", "🐝", "🌷"] },
  { ad: "Bilim Lab", duvar: "#a5f3fc", zemin: "#0e7490", esyalar: ["🔬", "🧪", "🧲", "🔭", "⚗️"] },
  { ad: "Muzik Odasi", duvar: "#c7d2fe", zemin: "#4338ca", esyalar: ["🎹", "🎸", "🥁", "🎺", "🎤"] },
  { ad: "Spor Salonu", duvar: "#fecaca", zemin: "#b91c1c", esyalar: ["🏀", "🏓", "🥅", "🏋️", "⛹️"] },
  { ad: "Sanat Atolyesi", duvar: "#fef08a", zemin: "#a16207", esyalar: ["🎨", "🖌️", "🖼️", "✏️", "🌈"] },
  { ad: "Uzay Kati", duvar: "#1e1b4b", zemin: "#312e81", esyalar: ["🚀", "🛸", "🌟", "🪐", "👽"] },
  { ad: "Gozlemevi", duvar: "#0f172a", zemin: "#1e293b", esyalar: ["🔭", "🌙", "⭐", "☄️", "🌌"] }
];

// ===== SORU HAVUZU (70 soru) =====
const SORULAR = [
  // Bilmeceler
  { s: "Sarı sarı sandıklar, iç içe geçmiş halkalar. Bil bakalım bu nedir?", secenekler: ["Limon", "Ayva", "Portakal", "Muz"], dogru: "Portakal" },
  { s: "Eli var tutamaz, yolu var yürüyemez. Nedir bu?", secenekler: ["Saat", "Kapı", "Merdiven", "Yol"], dogru: "Saat" },
  { s: "İçer ama susamaz, yer ama doymaz. Nedir?", secenekler: ["İnsan", "Ateş", "Deniz", "Hayvan"], dogru: "Ateş" },
  { s: "Gece gelir gündüz kaybolur, gökyüzünde parlar. Nedir?", secenekler: ["Güneş", "Yıldız", "Bulut", "Rüzgar"], dogru: "Yıldız" },
  { s: "Dört ayağı var ama yürüyemez. Nedir?", secenekler: ["Masa", "Kedi", "At", "Kuş"], dogru: "Masa" },
  { s: "Kanadı var uçamaz, suda yüzer batmaz. Nedir?", secenekler: ["Balık", "Gemi", "Ördek", "Taş"], dogru: "Gemi" },
  { s: "Ağzı var dili yok, karnı doyar doymaz. Nedir?", secenekler: ["Fırın", "Mağara", "Kuyu", "Sepet"], dogru: "Fırın" },
  { s: "Yazın gelir kışın gider, kanatları renklidir. Nedir?", secenekler: ["Kuş", "Kelebek", "Arı", "Yaprak"], dogru: "Kelebek" },
  { s: "Hep yürür ama yerinden kımıldamaz. Nedir?", secenekler: ["Saat", "Nehir", "Rüzgar", "Yol"], dogru: "Saat" },
  { s: "Kara tahtada beyaz tohum, eken bilir biçen bilir. Nedir?", secenekler: ["Tebeşir", "Kalem", "Silgi", "Defter"], dogru: "Tebeşir" },
  { s: "Dışarı çıksa uzar, içeri girse kısalır. Nedir?", secenekler: ["Gölge", "İp", "Lastik", "Yol"], dogru: "Gölge" },
  { s: "Annesi onu doğurur, sonra annesini o doğurur. Nedir?", secenekler: ["Su ve buz", "Tavuk ve yumurta", "Ağaç ve tohum", "Bulut ve yağmur"], dogru: "Su ve buz" },
  { s: "Beş kardeştir, hepsi ayrı boyda, bir eldedirler. Nedir?", secenekler: ["Parmaklar", "Çizgiler", "Kalemler", "Taşlar"], dogru: "Parmaklar" },
  { s: "Yedi renkli köprü, yağmurdan sonra gökte. Nedir?", secenekler: ["Bulut", "Gökkuşağı", "Şimşek", "Güneş"], dogru: "Gökkuşağı" },
  { s: "Konuştukça azalır, sustukça çoğalır. Nedir?", secenekler: ["Sessizlik", "Zaman", "Para", "Yol"], dogru: "Sessizlik" },
  { s: "Beyaz tarla, kara tohum, parmakla ekilir. Nedir?", secenekler: ["Kitap/yazı", "Kar", "Un", "Şeker"], dogru: "Kitap/yazı" },
  { s: "Sabah dört ayaklı, öğlen iki, akşam üç ayaklı. Nedir?", secenekler: ["İnsan", "Masa", "Sandalye", "Hayvan"], dogru: "İnsan" },
  { s: "Çamuru var taşı yok, suyu var balığı yok. Nedir?", secenekler: ["Harita", "Resim", "Ayna", "Cam"], dogru: "Harita" },
  { s: "Vurdukça büyür, beslenmeyince ölür. Nedir?", secenekler: ["Ateş", "Balon", "Gölge", "Ses"], dogru: "Ateş" },
  { s: "Dalı var yaprağı yok, gövdesi var kökü yok. Nedir?", secenekler: ["Sehpa", "Sandalye", "Geyik boynuzu", "Merdiven"], dogru: "Geyik boynuzu" },

  // Mantık / zeka
  { s: "Bir çiftçinin 17 koyunu var, 9'u dışında hepsi ölmüş. Kaç koyun kalmış?", secenekler: ["8", "9", "17", "26"], dogru: "9" },
  { s: "Annesinin üç çocuğu var: biri Ayşe, biri Fatma, üçüncüsü kim?", secenekler: ["Hatice", "Zeynep", "Annesinin çocuğu", "Emine"], dogru: "Annesinin çocuğu" },
  { s: "Bir odada 3 mum vardı, 2'si söndü. Kaç mum kaldı?", secenekler: ["1", "2", "3", "0"], dogru: "2" },
  { s: "Bir tren saatte 60 km gidiyor. 60 km'yi kaç saatte gider?", secenekler: ["1 saat", "2 saat", "Yarım saat", "60 saat"], dogru: "1 saat" },
  { s: "İki baba iki oğul balığa gitti, 3 balık tuttular ve her birine 1 tane düştü. Nasıl?", secenekler: ["Dede-baba-oğul", "Yalan söylemişler", "İmkansız", "Balık bölünmüş"], dogru: "Dede-baba-oğul" },
  { s: "Hangisi diğerlerinden farklı?", secenekler: ["Elma", "Armut", "Havuç", "Muz"], dogru: "Havuç" },
  { s: "5, 10, 15, 20, ... sıradaki sayı kaç?", secenekler: ["22", "25", "30", "21"], dogru: "25" },
  { s: "2, 4, 8, 16, ... sıradaki sayı kaç?", secenekler: ["18", "24", "32", "20"], dogru: "32" },
  { s: "1, 1, 2, 3, 5, 8, ... sıradaki sayı kaç?", secenekler: ["11", "13", "10", "16"], dogru: "13" },
  { s: "Hangisi canlı değildir?", secenekler: ["Ağaç", "Kuş", "Taş", "Balık"], dogru: "Taş" },
  { s: "'KİTAP' kelimesinde kaç harf var?", secenekler: ["4", "5", "6", "3"], dogru: "5" },
  { s: "Pazartesiden 3 gün sonra hangi gün?", secenekler: ["Çarşamba", "Perşembe", "Cuma", "Salı"], dogru: "Perşembe" },
  { s: "Bir yılda kaç mevsim vardır?", secenekler: ["2", "3", "4", "5"], dogru: "4" },
  { s: "Hangisi en büyük?", secenekler: ["100", "99", "1000", "199"], dogru: "1000" },
  { s: "Bir dakikada kaç saniye vardır?", secenekler: ["30", "60", "100", "24"], dogru: "60" },
  { s: "Hangisi bir renk değildir?", secenekler: ["Mavi", "Kırmızı", "Masa", "Yeşil"], dogru: "Masa" },
  { s: "Ali'nin 5 kalemi vardı, 2 tane daha aldı, sonra 1 tanesini kaybetti. Kaç kalemi var?", secenekler: ["6", "7", "5", "8"], dogru: "6" },
  { s: "Bir haftada kaç gün vardır?", secenekler: ["5", "6", "7", "30"], dogru: "7" },
  { s: "Hangisi suda yüzer?", secenekler: ["Tahta", "Demir", "Taş", "Cam"], dogru: "Tahta" },
  { s: "Bir üçgenin kaç kenarı vardır?", secenekler: ["2", "3", "4", "5"], dogru: "3" },

  // Matematik (4 sik, celdiricili)
  { s: "7 + 8 = ?", secenekler: ["14", "15", "16", "13"], dogru: "15" },
  { s: "9 + 6 = ?", secenekler: ["15", "14", "16", "13"], dogru: "15" },
  { s: "12 - 5 = ?", secenekler: ["6", "7", "8", "5"], dogru: "7" },
  { s: "20 - 8 = ?", secenekler: ["11", "12", "13", "14"], dogru: "12" },
  { s: "6 x 7 = ?", secenekler: ["42", "48", "36", "40"], dogru: "42" },
  { s: "8 x 9 = ?", secenekler: ["72", "63", "81", "64"], dogru: "72" },
  { s: "5 x 6 = ?", secenekler: ["30", "25", "35", "36"], dogru: "30" },
  { s: "48 : 6 = ?", secenekler: ["7", "8", "9", "6"], dogru: "8" },
  { s: "63 : 9 = ?", secenekler: ["6", "7", "8", "9"], dogru: "7" },
  { s: "100 - 45 = ?", secenekler: ["55", "65", "45", "50"], dogru: "55" },
  { s: "25 + 25 = ?", secenekler: ["40", "50", "45", "55"], dogru: "50" },
  { s: "9 x 9 = ?", secenekler: ["81", "72", "90", "99"], dogru: "81" },
  { s: "14 + 17 = ?", secenekler: ["30", "31", "32", "29"], dogru: "31" },
  { s: "36 : 4 = ?", secenekler: ["8", "9", "7", "6"], dogru: "9" },
  { s: "7 x 8 = ?", secenekler: ["54", "56", "48", "64"], dogru: "56" },
  { s: "50 + 50 = ?", secenekler: ["90", "100", "110", "150"], dogru: "100" },
  { s: "13 - 7 = ?", secenekler: ["5", "6", "7", "4"], dogru: "6" },
  { s: "4 x 6 = ?", secenekler: ["20", "24", "28", "22"], dogru: "24" },
  { s: "72 : 8 = ?", secenekler: ["8", "9", "7", "6"], dogru: "9" },
  { s: "15 + 16 = ?", secenekler: ["30", "31", "32", "29"], dogru: "31" },
  { s: "3 x 9 = ?", secenekler: ["27", "24", "21", "29"], dogru: "27" },
  { s: "80 - 35 = ?", secenekler: ["45", "55", "35", "40"], dogru: "45" },
  { s: "6 x 6 = ?", secenekler: ["36", "30", "42", "32"], dogru: "36" },
  { s: "24 + 18 = ?", secenekler: ["40", "42", "44", "41"], dogru: "42" },
  { s: "45 : 5 = ?", secenekler: ["8", "9", "7", "10"], dogru: "9" },
  { s: "11 x 3 = ?", secenekler: ["33", "31", "36", "30"], dogru: "33" },
  { s: "60 - 24 = ?", secenekler: ["34", "36", "44", "26"], dogru: "36" },
  { s: "8 + 9 + 3 = ?", secenekler: ["19", "20", "21", "18"], dogru: "20" },
  { s: "100 : 10 = ?", secenekler: ["10", "100", "1", "20"], dogru: "10" },
  { s: "7 x 7 = ?", secenekler: ["42", "49", "56", "47"], dogru: "49" }
];
const TOPLAM_KAT = 100;

function karistir(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Kata gore oda sec (donusumlu)
function odaSec(kat) {
  return ODALAR[kat % ODALAR.length];
}

function Yuksel({ onKapat }) {
  const [durum, setDurum] = useState("giris");
  const [kat, setKat] = useState(0);
  const [can, setCan] = useState(3);
  const [soru, setSoru] = useState(null);
  const [secenekler, setSecenekler] = useState([]);
  const [mesaj, setMesaj] = useState("");
  const [rekor, setRekor] = useState(0);
  const [yeniRekor, setYeniRekor] = useState(false);
  const [paylasildi, setPaylasildi] = useState(false);
  const [paylasiliyor, setPaylasiliyor] = useState(false);
  const [yorum, setYorum] = useState("");
  const [cevapKilit, setCevapKilit] = useState(false);
  const [secilenIndex, setSecilenIndex] = useState(null);
  const [dogruIndex, setDogruIndex] = useState(null);
  const [yukseliyor, setYukseliyor] = useState(false); // asansor cikis animasyonu

  const havuzRef = useRef([]);
  const havuzIndexRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        setRekor(userDoc.data()?.yukselRekor || 0);
      } catch (e) {}
    })();
  }, []);

  const sonrakiSoru = useCallback(() => {
    if (havuzIndexRef.current >= havuzRef.current.length) {
      havuzRef.current = karistir(SORULAR);
      havuzIndexRef.current = 0;
    }
    const ham = havuzRef.current[havuzIndexRef.current];
    havuzIndexRef.current++;
    setSoru(ham);
    setSecenekler(karistir(ham.secenekler));
    setSecilenIndex(null);
    setDogruIndex(null);
    setCevapKilit(false);
  }, []);

  const oyunBaslat = () => {
    havuzRef.current = karistir(SORULAR);
    havuzIndexRef.current = 0;
    setKat(0);
    setCan(3);
    setYeniRekor(false);
    setPaylasildi(false);
    setYorum("");
    setDurum("oyun");
    sonrakiSoru();
  };

  const checkpointtenDevam = () => {
    const cp = Math.floor(kat / 10) * 10;
    setKat(cp);
    setCan(3);
    setYeniRekor(false);
    setPaylasildi(false);
    setYorum("");
    setDurum("oyun");
    sonrakiSoru();
  };

  const rekorKaydet = async (ulasilanKat) => {
    if (ulasilanKat > rekor) {
      setYeniRekor(true);
      setRekor(ulasilanKat);
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { yukselRekor: ulasilanKat });
      } catch (e) { console.error(e); }
    }
  };

  const cevapla = (secim, index) => {
    if (cevapKilit) return;
    setCevapKilit(true);
    setSecilenIndex(index);
    setDogruIndex(secenekler.indexOf(soru.dogru));

    if (secim === soru.dogru) {
      const yeniKat = kat + 1;
      setMesaj("Dogru! 🎉");
      // Asansor yukari cikis animasyonu
      setYukseliyor(true);
      setTimeout(() => {
        setMesaj("");
        setKat(yeniKat);
        setYukseliyor(false);
        if (yeniKat >= TOPLAM_KAT) {
          setDurum("final");
          rekorKaydet(yeniKat);
        } else {
          sonrakiSoru();
        }
      }, 700);
    } else {
      const kalanCan = can - 1;
      setMesaj("Yanlis! 💔");
      setTimeout(() => {
        setMesaj("");
        if (kalanCan <= 0) {
          setDurum("araEkran");
          rekorKaydet(kat);
        } else {
          setCan(kalanCan);
          sonrakiSoru();
        }
      }, 900);
    }
  };

  const paylas = async () => {
    setPaylasiliyor(true);
    try {
      await skoruPaylas({ oyunAdi: "Yuksel!", ikon: "🏢", puan: kat, altYazi: kat + ". kata cikti", renk: "#06b6d4", yorum: yorum });
      setPaylasildi(true);
    } catch (e) { alert("Paylasilamadi: " + e.message); }
    setPaylasiliyor(false);
  };

  const checkpoint = Math.floor(kat / 10) * 10;
  const oda = odaSec(kat);
  const ustOda = odaSec(kat + 1); // yukari cikinca gelecek oda

  // ===== ODA SAHNESI (tum ekran) =====
  // Yukari cikinca: mevcut oda ASAGI kayar, ust oda USTTEN iner (yukseldigimiz hissi)
  const tekOda = (odaVeri, etiketGoster) => (
    <div style={{ width: "100%", height: "100%", background: odaVeri.duvar, display: "flex", flexDirection: "column", position: "relative" }}>
      {etiketGoster && (
        <div style={{ position: "absolute", top: "8px", right: "10px", background: "rgba(0,0,0,0.5)", color: "white", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontFamily: "Georgia, serif", zIndex: 6 }}>
          {odaVeri.ad}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "16px", paddingBottom: "10px", flexWrap: "wrap" }}>
        {odaVeri.esyalar.map((e, i) => <span key={i} style={{ fontSize: "42px", filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.2))" }}>{e}</span>)}
      </div>
      <div style={{ height: "40px", background: odaVeri.zemin }} />
    </div>
  );

  const OdaSahne = ({ odaVeri, ustOdaVeri, animasyonAktif }) => (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Ust oda (yukari cikinca USTTEN iner) - sadece animasyonda gorunur */}
      {animasyonAktif && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", animation: "ustOdaIn 0.7s ease-out forwards" }}>
          {tekOda(ustOdaVeri, true)}
        </div>
      )}
      {/* Mevcut oda (yukari cikarken ASAGI kayar) */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", animation: animasyonAktif ? "mevcutOdaAsagi 0.7s ease-out forwards" : "none" }}>
        {tekOda(odaVeri, !animasyonAktif)}
      </div>

      {/* ASANSOR (solda, sabit - kabin sabit kalir, arka plan akar) */}
      <div style={{ position: "absolute", left: "12px", top: "10px", bottom: "10px", width: "70px", zIndex: 5 }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "78px", transform: "translateX(-50%)", background: "rgba(30,41,59,0.35)", borderRadius: "8px", border: "2px solid rgba(15,23,42,0.5)" }} />
        <div style={{ position: "absolute", left: "50%", bottom: "30px", transform: "translateX(-50%)", width: "60px", height: "70px", background: "linear-gradient(180deg, #475569, #334155)", borderRadius: "6px", border: "2px solid #fbbf24", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)", animation: animasyonAktif ? "asansorTitre 0.7s ease-in-out" : "asansorSalin 1.2s ease-in-out infinite" }}>
          <span style={{ fontSize: "34px" }}>🧑‍🚀</span>
        </div>
      </div>
    </div>
  );

  const Konfeti = () => (
    <>{[...Array(40)].map((_, i) => (
      <div key={i} style={{ position: "absolute", top: "-10px", left: (i * 2.5) + "%", width: "8px", height: "8px", borderRadius: i % 2 ? "50%" : "0", background: ["#fbbf24", "#06b6d4", "#ef4444", "#10b981", "#a855f7"][i % 5], animation: `dusus ${1 + (i % 4) * 0.4}s linear ${(i % 6) * 0.15}s infinite`, zIndex: 30 }} />
    ))}</>
  );

  const styleTag = (
    <style>{`
      @keyframes asansorSalin { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-4px); } }
      @keyframes asansorTitre { 0%,100% { transform: translateX(-50%) translateY(0); } 25% { transform: translateX(-52%) translateY(-2px); } 75% { transform: translateX(-48%) translateY(-2px); } }
      @keyframes mevcutOdaAsagi { 0% { transform: translateY(0); } 100% { transform: translateY(100%); } }
      @keyframes ustOdaIn { 0% { transform: translateY(-100%); } 100% { transform: translateY(0); } }
      @keyframes dusus { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(600px) rotate(720deg); opacity: 0; } }
      @keyframes roketUc { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(-450px) scale(0.2); opacity: 0; } }
      @keyframes gezegenBuyu { 0% { transform: scale(0.4); } 100% { transform: scale(1.2); } }
      @keyframes parla { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
    `}</style>
  );

  // ===== GIRIS =====
  if (durum === "giris") {
    return (
      <div style={kapsayici}>
        {styleTag}
        <div style={ustBar}>
          <h2 style={{ color: "#f0e6d3", fontSize: "20px", fontFamily: "Georgia, serif", margin: 0, flex: 1 }}>🏢 Yuksel!</h2>
          <button onClick={onKapat} style={kapatBtn}>✕</button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto" }}>
          <div style={{ fontSize: "64px", marginBottom: "4px" }}>🏢</div>
          <p style={{ color: "#c8bfb0", margin: "8px 0", textAlign: "center", fontFamily: "Georgia, serif", fontSize: "15px", lineHeight: 1.6 }}>
            Asansorle yuksel! Her dogru cevap seni bir ust kata cikarir.<br/>
            <span style={{ fontSize: "13px", color: "#888" }}>Her kat farkli bir oda! 100. kata cik, gezegene firla 🪐</span>
          </p>
          <div style={{ background: "#1a1a2e", borderRadius: "14px", padding: "12px 28px", margin: "14px 0", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#888", letterSpacing: "2px" }}>EN YUKSEK REKORUN</div>
            <div style={{ fontSize: "30px", color: "#06b6d4", fontWeight: "bold" }}>{rekor}. kat</div>
          </div>
          <p style={{ fontSize: "12px", color: "#666", marginBottom: "20px", textAlign: "center", maxWidth: "280px", lineHeight: 1.5 }}>
            3 canin var. Her 10 kat bir mola noktasi 📍 Canlarin biterse mola noktasindan devam edebilirsin.
          </p>
          <button onClick={oyunBaslat} style={{ padding: "16px 50px", background: "linear-gradient(135deg, #06b6d4, #3b82f6)", color: "white", border: "none", borderRadius: "14px", cursor: "pointer", fontSize: "18px", fontWeight: "700", fontFamily: "Georgia, serif", boxShadow: "0 4px 20px rgba(6,182,212,0.4)" }}>Basla 🚀</button>
        </div>
      </div>
    );
  }

  // ===== FINAL =====
  if (durum === "final") {
    return (
      <div style={{ ...kapsayici, background: "#0f0c29" }}>
        {styleTag}<Konfeti />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", overflow: "hidden" }}>
          {[...Array(30)].map((_, i) => <div key={i} style={{ position: "absolute", width: "3px", height: "3px", background: "white", borderRadius: "50%", top: (i * 37) % 100 + "%", left: (i * 53) % 100 + "%", animation: "parla " + (1 + (i % 3)) + "s infinite" }} />)}
          <div style={{ fontSize: "90px", animation: "gezegenBuyu 2s ease-out forwards" }}>🪐</div>
          <div style={{ fontSize: "54px", animation: "roketUc 2.2s ease-in forwards" }}>🚀</div>
          <h2 style={{ color: "#06b6d4", fontFamily: "Georgia, serif", fontSize: "28px", marginTop: "16px", textAlign: "center" }}>TEBRIKLER! 🎉</h2>
          <p style={{ color: "#f0e6d3", fontSize: "17px", textAlign: "center", marginTop: "8px", fontFamily: "Georgia, serif" }}>100. kata ulastin ve gezegene firladin!</p>
          {yeniRekor && <div style={{ color: "#fbbf24", fontSize: "16px", marginTop: "14px", fontWeight: "bold", animation: "parla 1s infinite" }}>⭐ YENI REKOR! ⭐</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "26px", width: "240px" }}>
            <button onClick={oyunBaslat} style={btnAna}>Tekrar Oyna</button>
            {!paylasildi && <input type="text" value={yorum} onChange={e => setYorum(e.target.value)} maxLength={100} placeholder="Bir sey yaz (istege bagli)" style={inputStil} />}
            <button onClick={paylas} disabled={paylasildi || paylasiliyor} style={btnPaylas(paylasildi)}>{paylasildi ? "✓ Paylasildi" : paylasiliyor ? "Paylasiliyor..." : "📢 Akista Paylas"}</button>
            <button onClick={onKapat} style={btnKapat}>Kapat</button>
          </div>
        </div>
      </div>
    );
  }

  // ===== ARA EKRAN =====
  if (durum === "araEkran") {
    return (
      <div style={kapsayici}>
        {styleTag}{yeniRekor && <Konfeti />}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px", position: "relative" }}>
          <div style={{ fontSize: "44px", marginBottom: "12px" }}>{yeniRekor ? "🎉" : "💔"}</div>
          <h2 style={{ color: "#f0e6d3", fontFamily: "Georgia, serif", fontSize: "22px", marginBottom: "8px", textAlign: "center" }}>{yeniRekor ? "Canlarin Bitti ama..." : "Canlarin Bitti!"}</h2>
          <div style={{ background: "#1a1a2e", borderRadius: "20px", padding: "24px 50px", textAlign: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "44px", color: "#06b6d4", fontWeight: "bold" }}>{kat}</div>
            <div style={{ fontSize: "12px", color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>kata ulastin</div>
          </div>
          {yeniRekor ? <div style={{ color: "#fbbf24", fontSize: "18px", marginBottom: "18px", fontWeight: "bold", animation: "parla 1s infinite" }}>⭐ YENI REKOR! ⭐</div> : <div style={{ color: "#888", fontSize: "13px", marginBottom: "18px" }}>Rekorun: {rekor}. kat</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "260px" }}>
            {checkpoint > 0 && <button onClick={checkpointtenDevam} style={{ ...btnAna, background: "linear-gradient(135deg, #10b981, #059669)" }}>📍 {checkpoint}. kattan devam et</button>}
            <button onClick={oyunBaslat} style={btnAna}>🔄 Bastan basla</button>
            {!paylasildi && kat > 0 && <input type="text" value={yorum} onChange={e => setYorum(e.target.value)} maxLength={100} placeholder="Bir sey yaz (istege bagli)" style={inputStil} />}
            <button onClick={paylas} disabled={paylasildi || paylasiliyor || kat === 0} style={btnPaylas(paylasildi, kat === 0)}>{paylasildi ? "✓ Paylasildi" : paylasiliyor ? "Paylasiliyor..." : "📢 Akista Paylas"}</button>
            <button onClick={onKapat} style={btnKapat}>Kapat</button>
          </div>
        </div>
      </div>
    );
  }

  // ===== OYUN EKRANI =====
  return (
    <div style={kapsayici}>
      {styleTag}
      {/* Ust bar */}
      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(15,15,26,0.7)", zIndex: 10 }}>
        <span style={{ fontSize: "15px" }}>{"❤️".repeat(Math.max(0, can))}{"🖤".repeat(Math.max(0, 3 - can))}</span>
        <span style={{ fontSize: "14px", color: "white", fontWeight: "bold", fontFamily: "Georgia, serif" }}>🏢 {kat}. kat</span>
        <button onClick={onKapat} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", fontSize: "18px", cursor: "pointer" }}>✕</button>
      </div>

      {/* Oda sahnesi - ust yari */}
      <div style={{ height: "42%", position: "relative", borderBottom: "3px solid #1e293b" }}>
        <OdaSahne odaVeri={oda} ustOdaVeri={ustOda} animasyonAktif={yukseliyor} />
        {mesaj && <div style={{ position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)", background: "#000d", color: "white", padding: "8px 22px", borderRadius: "20px", fontSize: "16px", fontWeight: "600", zIndex: 20, whiteSpace: "nowrap" }}>{mesaj}</div>}
      </div>

      {/* Soru alani - alt yari */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 20px", background: "#0f0f1a", overflowY: "auto" }}>
        {soru && (
          <>
            <div style={{ background: "#1a1a2e", borderRadius: "16px", padding: "18px", marginBottom: "14px", maxWidth: "440px", width: "100%" }}>
              <p style={{ fontSize: "18px", color: "#f0e6d3", textAlign: "center", margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.4 }}>{soru.s}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%", maxWidth: "440px" }}>
              {secenekler.map((sec, i) => {
                let arka = "#1a1a2e", kenar = "#3b82f6", renk = "#c8bfb0";
                if (cevapKilit) {
                  if (i === dogruIndex) { arka = "#065f46"; kenar = "#10b981"; renk = "white"; }
                  else if (i === secilenIndex) { arka = "#7f1d1d"; kenar = "#ef4444"; renk = "white"; }
                }
                return <button key={i} onClick={() => cevapla(sec, i)} disabled={cevapKilit} style={{ padding: "15px 12px", fontSize: "16px", background: arka, color: renk, border: `2px solid ${kenar}`, borderRadius: "14px", cursor: cevapKilit ? "default" : "pointer", fontFamily: "Georgia, serif", fontWeight: "600", minHeight: "56px", transition: "all 0.2s" }}>{sec}</button>;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const kapsayici = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#0f0f1a", zIndex: 500, display: "flex", flexDirection: "column" };
const ustBar = { padding: "20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #222" };
const kapatBtn = { background: "none", border: "none", color: "#888", fontSize: "20px", cursor: "pointer" };
const btnAna = { padding: "14px 32px", background: "linear-gradient(135deg, #06b6d4, #3b82f6)", color: "white", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "600", width: "100%" };
const inputStil = { width: "100%", padding: "10px 14px", background: "#1a1a2e", color: "#f0e6d3", border: "1px solid #333", borderRadius: "10px", fontSize: "13px", boxSizing: "border-box", fontFamily: "Georgia, serif" };
const btnKapat = { padding: "12px 32px", background: "#222", color: "#888", border: "none", borderRadius: "12px", cursor: "pointer", fontSize: "14px", width: "100%" };
function btnPaylas(paylasildi, pasif) {
  return { padding: "12px 32px", background: paylasildi ? "#10b981" : "#1a1a2e", color: paylasildi ? "white" : (pasif ? "#555" : "#06b6d4"), border: paylasildi ? "none" : `2px solid ${pasif ? "#333" : "#06b6d4"}`, borderRadius: "12px", cursor: (paylasildi || pasif) ? "default" : "pointer", fontSize: "14px", fontWeight: "600", width: "100%" };
}

export default Yuksel;