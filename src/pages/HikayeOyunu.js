import React, { useState, useRef, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

const HIKAYELER = [
  {
    id: "pamuk",
    baslik: "Minik Kuzu Pamuk",
    kategori: "Doğa & Hayvanlar",
    seviye: "2. Sınıf",
    sayfalar: [
      {
        tip: "metin",
        metin: "Yeşil tepelerin ardında, mis gibi çimen kokan geniş bir çayırda, Çoban Hasan ve koyunları yaşıyordu. Hasan her sabah güneş doğmadan uyanır, koyunlarını otlatmaya götürürdü. Onları çok severdi, her birinin adını ezbere bilirdi.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="90" x2="200" y2="90" stroke="#2a2a4a" stroke-width="1"/><ellipse cx="40" cy="30" rx="22" ry="12" fill="none" stroke="#555" stroke-width="1.2"/><ellipse cx="55" cy="25" rx="16" ry="10" fill="none" stroke="#555" stroke-width="1.2"/><path d="M0,90 Q50,50 100,90 Q150,50 200,90" fill="none" stroke="#3a3a5c" stroke-width="1.5"/><line x1="100" y1="90" x2="100" y2="60" stroke="#a0a0c0" stroke-width="2"/><circle cx="100" cy="55" r="8" fill="none" stroke="#a0a0c0" stroke-width="1.5"/><line x1="100" y1="68" x2="90" y2="78" stroke="#a0a0c0" stroke-width="1.5"/><line x1="100" y1="68" x2="110" y2="78" stroke="#a0a0c0" stroke-width="1.5"/><ellipse cx="50" cy="95" rx="18" ry="12" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="50" cy="83" r="8" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><ellipse cx="160" cy="98" rx="15" ry="10" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="160" cy="88" r="7" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="170" cy="25" r="12" fill="none" stroke="#f59e0b" stroke-width="1.2"/></svg>`
      },
      {
        tip: "metin",
        metin: "Sürünün en yaşlı ve en sakin koyununun adı Bulut'tu. Adı gibi bembeyazdı, adımları sessizdi. Hasan onu hep en önde yürütürdü çünkü diğer koyunlar Bulut'u görünce kendiliğinden peşinden giderdi.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="100" x2="200" y2="100" stroke="#2a2a4a" stroke-width="1"/><ellipse cx="90" cy="88" rx="32" ry="20" fill="none" stroke="#c8c8e0" stroke-width="1.8"/><circle cx="90" cy="68" r="14" fill="none" stroke="#c8c8e0" stroke-width="1.8"/><circle cx="85" cy="66" r="1.5" fill="#c8c8e0"/><circle cx="95" cy="66" r="1.5" fill="#c8c8e0"/><path d="M87,72 Q90,75 93,72" fill="none" stroke="#c8c8e0" stroke-width="1.2"/><line x1="70" y1="106" x2="68" y2="125" stroke="#c8c8e0" stroke-width="1.8"/><line x1="80" y1="108" x2="78" y2="125" stroke="#c8c8e0" stroke-width="1.8"/><line x1="100" y1="108" x2="102" y2="125" stroke="#c8c8e0" stroke-width="1.8"/><line x1="110" y1="106" x2="112" y2="125" stroke="#c8c8e0" stroke-width="1.8"/><ellipse cx="155" cy="95" rx="20" ry="13" fill="none" stroke="#555" stroke-width="1.2"/><circle cx="155" cy="82" r="9" fill="none" stroke="#555" stroke-width="1.2"/></svg>`
      },
      {
        tip: "metin",
        metin: "Bulut'un o yıl ilk kuzusu dünyaya gelmişti. Minicik, yünleri pamuk gibi beyaz, gözleri iri ve meraklıydı. Hasan kuzuyu görür görmez güldü ve 'Adın Pamuk olsun!' dedi. Pamuk o günden sonra çayırın neşesi oldu.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="105" x2="200" y2="105" stroke="#2a2a4a" stroke-width="1"/><ellipse cx="70" cy="92" rx="25" ry="16" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="70" cy="76" r="11" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><ellipse cx="130" cy="98" rx="17" ry="11" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="130" cy="87" r="8" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="130" cy="95" r="3" fill="none" stroke="#f59e0b" stroke-width="1.2"/><circle cx="126" cy="85" r="1.5" fill="#c8c8e0"/><circle cx="134" cy="85" r="1.5" fill="#c8c8e0"/><line x1="20" y1="85" x2="20" y2="60" stroke="#a0a0c0" stroke-width="2"/><circle cx="20" cy="55" r="7" fill="none" stroke="#a0a0c0" stroke-width="1.5"/></svg>`
      },
      {
        tip: "soru",
        soru: "Çoban Hasan'ın en sevdiği koyunun adı neydi?",
        secenekler: ["Pamuk", "Bulut", "Beyaz"],
        dogru: 1
      },
      {
        tip: "metin",
        metin: "Bir bahar sabahı Pamuk, rengarenk kelebeklerin peşinden koşmaya başladı. Önce birini kovaladı, sonra diğerini. Koşa koşa ahırdan, çayırdan, taş duvarın ötesine geçti. Durduğunda etrafına baktı — tanıdık hiçbir şey yoktu.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="100" x2="200" y2="100" stroke="#2a2a4a" stroke-width="1"/><path d="M60,30 Q50,20 55,35 Q60,25 65,35 Q70,20 60,30" fill="none" stroke="#888" stroke-width="1.2"/><path d="M100,20 Q90,10 95,25 Q100,15 105,25 Q110,10 100,20" fill="none" stroke="#888" stroke-width="1.2"/><ellipse cx="110" cy="88" rx="18" ry="12" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="110" cy="76" r="8" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="110" cy="85" r="2.5" fill="none" stroke="#f59e0b" stroke-width="1"/><rect x="155" y="70" width="45" height="30" fill="none" stroke="#444" stroke-width="1.2" rx="2"/><rect x="10" y="60" width="40" height="40" fill="none" stroke="#444" stroke-width="1.2"/><path d="M5,60 L30,40 L55,60" fill="none" stroke="#444" stroke-width="1.2"/></svg>`
      },
      {
        tip: "metin",
        metin: "Hasan akşam koyunları ahıra toplarken saydı: bir eksikti. Yüreği sıkıştı. 'Pamuk! Pamuk neredesin?' diye bağırdı. Sesi tepelere çarptı, geri döndü. Ama Pamuk'tan ses çıkmadı.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="100" x2="200" y2="100" stroke="#2a2a4a" stroke-width="1"/><line x1="100" y1="100" x2="100" y2="65" stroke="#a0a0c0" stroke-width="2"/><circle cx="100" cy="58" r="10" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><circle cx="96" cy="56" r="1.5" fill="#a0a0c0"/><circle cx="104" cy="56" r="1.5" fill="#a0a0c0"/><path d="M96,63 Q100,60 104,63" fill="none" stroke="#a0a0c0" stroke-width="1.2"/><line x1="88" y1="72" x2="76" y2="62" stroke="#a0a0c0" stroke-width="1.5"/><line x1="112" y1="72" x2="124" y2="62" stroke="#a0a0c0" stroke-width="1.5"/><ellipse cx="30" cy="92" rx="14" ry="9" fill="none" stroke="#555" stroke-width="1.2"/><ellipse cx="155" cy="92" rx="14" ry="9" fill="none" stroke="#555" stroke-width="1.2"/></svg>`
      },
      {
        tip: "metin",
        metin: "Hasan'ın sadık köpeği Karabaş hemen yanına geldi. Kulakları dikildi, burnu yere değdi. Pamuk'un küçük ayak izlerini kokladı ve hızla koşmaya başladı. Hasan da arkasından soluk soluğa koştu.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="105" x2="200" y2="105" stroke="#2a2a4a" stroke-width="1"/><ellipse cx="120" cy="93" rx="28" ry="16" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><circle cx="148" cy="88" r="12" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><path d="M140,78 Q135,65 145,70" fill="none" stroke="#a0a0c0" stroke-width="1.5"/><path d="M152,77 Q158,65 162,72" fill="none" stroke="#a0a0c0" stroke-width="1.5"/><circle cx="145" cy="85" r="2" fill="#a0a0c0"/><circle cx="153" cy="84" r="2" fill="#a0a0c0"/><path d="M92,93 Q80,83 85,75" fill="none" stroke="#a0a0c0" stroke-width="1.5"/><line x1="40" y1="90" x2="40" y2="65" stroke="#a0a0c0" stroke-width="1.5"/><circle cx="40" cy="59" r="7" fill="none" stroke="#a0a0c0" stroke-width="1.5"/></svg>`
      },
      {
        tip: "soru",
        soru: "Pamuk'u aramaya kim yardım etti?",
        secenekler: ["Kedi", "Karabaş", "Komşu"],
        dogru: 1
      },
      {
        tip: "metin",
        metin: "Karabaş onu dere kenarındaki büyük kayalığın dibinde buldu. Pamuk orada titreyerek bekliyordu. Karşıya geçememiş, geri dönememiş, sadece 'Meee!' diyebilmişti. Gözlerinden yaş geliyordu sanki.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><path d="M0,95 Q50,88 100,95 Q150,102 200,95" fill="none" stroke="#4a6a8a" stroke-width="2"/><path d="M0,100 Q50,93 100,100 Q150,107 200,100" fill="none" stroke="#4a6a8a" stroke-width="1.5"/><path d="M130,100 Q140,75 160,78 Q175,80 170,100" fill="none" stroke="#666" stroke-width="1.5"/><ellipse cx="55" cy="108" rx="16" ry="10" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="55" cy="98" r="7" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><ellipse cx="160" cy="88" rx="20" ry="12" fill="none" stroke="#a0a0c0" stroke-width="1.5"/><circle cx="178" cy="83" r="9" fill="none" stroke="#a0a0c0" stroke-width="1.5"/></svg>`
      },
      {
        tip: "metin",
        metin: "Hasan Pamuk'u görünce koştu, eğildi ve onu kucağına aldı. Pamuk Hasan'ın kollarında sakinleşti. Hasan 'Seni kaybetseydim ne yapardım küçük!' dedi ve Pamuk'un alnından öptü.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="110" x2="200" y2="110" stroke="#2a2a4a" stroke-width="1"/><line x1="90" y1="110" x2="90" y2="70" stroke="#a0a0c0" stroke-width="2"/><circle cx="90" cy="62" r="12" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><circle cx="85" cy="60" r="1.5" fill="#a0a0c0"/><circle cx="95" cy="60" r="1.5" fill="#a0a0c0"/><path d="M84,66 Q90,71 96,66" fill="none" stroke="#a0a0c0" stroke-width="1.5"/><path d="M90,80 Q70,85 65,95" fill="none" stroke="#a0a0c0" stroke-width="2"/><path d="M90,80 Q110,85 115,95" fill="none" stroke="#a0a0c0" stroke-width="2"/><ellipse cx="90" cy="95" rx="22" ry="14" fill="none" stroke="#c8c8e0" stroke-width="1.8"/><circle cx="90" cy="81" r="9" fill="none" stroke="#c8c8e0" stroke-width="1.8"/><circle cx="90" cy="92" r="3" fill="none" stroke="#f59e0b" stroke-width="1.2"/></svg>`
      },
      {
        tip: "metin",
        metin: "Eve dönerken Hasan bir şey düşündü. Ahıra varır varmaz küçük bir sandığı açtı ve içinden gümüş renkli minik bir çıngırak çıkardı. Pamuk'un boynuna nazikçe taktı. 'Artık nerede olduğunu hep bileceğim!' dedi.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><line x1="0" y1="105" x2="200" y2="105" stroke="#2a2a4a" stroke-width="1"/><line x1="80" y1="105" x2="80" y2="72" stroke="#a0a0c0" stroke-width="2"/><circle cx="80" cy="64" r="10" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><path d="M80,78 Q65,85 60,95" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><path d="M80,78 Q95,82 100,90" fill="none" stroke="#a0a0c0" stroke-width="1.8"/><ellipse cx="130" cy="92" rx="20" ry="13" fill="none" stroke="#c8c8e0" stroke-width="1.8"/><circle cx="130" cy="79" r="9" fill="none" stroke="#c8c8e0" stroke-width="1.8"/><circle cx="130" cy="88" r="5" fill="none" stroke="#f59e0b" stroke-width="2"/><rect x="15" y="85" width="30" height="20" fill="none" stroke="#666" stroke-width="1.2" rx="3"/><path d="M15,85 Q30,78 45,85" fill="none" stroke="#666" stroke-width="1.2"/></svg>`
      },
      {
        tip: "metin",
        metin: "Akşam güneş tepelerin ardına çekildi. Tüm koyunlar ahıra girdi, yerlerine yattı. Pamuk annesinin yanına sokuldu, Bulut onu ısıttı. Çıngırak hafifçe 'cıng' diye ses çıkardı ve sustu.",
        svg: `<svg width="200" height="130" viewBox="0 0 200 130"><rect x="20" y="50" width="160" height="80" fill="none" stroke="#555" stroke-width="1.5"/><path d="M10,50 L100,15 L190,50" fill="none" stroke="#555" stroke-width="1.5"/><ellipse cx="105" cy="112" rx="20" ry="11" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="105" cy="101" r="8" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><ellipse cx="130" cy="110" rx="14" ry="9" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="130" cy="101" r="6" fill="none" stroke="#c8c8e0" stroke-width="1.5"/><circle cx="130" cy="108" r="2.5" fill="none" stroke="#f59e0b" stroke-width="1"/></svg>`
      },
      {
        tip: "soru",
        soru: "Pamuk nerede bulundu?",
        secenekler: ["Ormanda", "Dere kenarında", "Dağda"],
        dogru: 1
      },
      {
        tip: "son",
        metin: "O gece rüzgar yoktu, yıldızlar parlaktı. Hasan ahırın kapısını kapatırken içeriden çıngırakların sesi geldi. Gülümsedi ve 'İyi geceler Pamuk' dedi. Uzaktan Pamuk'un 'Meee!' sesi duyuldu. 🌙",
        svg: `<svg width="200" height="120" viewBox="0 0 200 120"><path d="M175,18 Q165,28 168,40 Q180,35 185,22 Q182,15 175,18Z" fill="none" stroke="#f0e6d3" stroke-width="1.2"/><rect x="30" y="70" width="140" height="50" fill="none" stroke="#333" stroke-width="1.2"/><path d="M20,70 L100,40 L180,70" fill="none" stroke="#333" stroke-width="1.2"/><line x1="100" y1="120" x2="100" y2="92" stroke="#555" stroke-width="1.5"/><circle cx="100" cy="86" r="7" fill="none" stroke="#555" stroke-width="1.2"/></svg>`
      }
    ]
  }
];

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
  const oyunRef = useRef(null);
  const touchStartY = useRef(null);
  const wheelZamani = useRef(0);
  const soruCevaplandıRef = useRef(false);
  const sayfaNoRef = useRef(0);
  const aktifHikayeRef = useRef(null);

  // ref'leri sync tut
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
    const el = oyunRef.current;
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
  }, []);

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
      if (tamamlananlar.includes(aktifHikaye.id)) return;
      await updateDoc(userRef, {
        oyunPuani: increment(toplam),
        tamamlananHikayeler: [...tamamlananlar, aktifHikaye.id]
      });
    } catch (err) {
      console.error("Puan kaydedilemedi:", err);
    }
  };

  const toplamPuan = puanlar.reduce((a, b) => a + b, 0);

  if (!aktifHikaye) {
    return (
      <div ref={oyunRef} style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"20px", display:"flex", alignItems:"center", gap:"12px", borderBottom:"1px solid #222" }}>
          <button onClick={onKapat} style={{ background:"none", border:"none", color:"#888", fontSize:"20px", cursor:"pointer" }}>✕</button>
          <h2 style={{ color:"#f0e6d3", fontSize:"18px", fontFamily:"Georgia, serif", margin:0 }}>🎮 Hikaye Oyunları</h2>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
          {HIKAYELER.map(h => (
            <div key={h.id} onClick={() => hikayeBaslat(h)}
              style={{ background:"#1a1a2e", borderRadius:"16px", padding:"20px", marginBottom:"16px", cursor:"pointer", border:"1px solid #333" }}>
              <div style={{ fontSize:"11px", color:"#f59e0b", letterSpacing:"2px", marginBottom:"8px", textTransform:"uppercase" }}>{h.kategori} · {h.seviye}</div>
              <h3 style={{ color:"#f0e6d3", fontSize:"18px", fontFamily:"Georgia, serif", margin:"0 0 8px" }}>{h.baslik}</h3>
              <div style={{ fontSize:"12px", color:"#666" }}>12 sayfa · 3 soru · Max 9 puan</div>
            </div>
          ))}
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
          <div style={{ fontSize:"12px", color:"#666", letterSpacing:"2px", textTransform:"uppercase", marginTop:"4px" }}>/ 9 puan</div>
          <div style={{ marginTop:"16px", fontSize:"14px", color: toplamPuan >= 7 ? "#10b981" : toplamPuan >= 4 ? "#f59e0b" : "#ef4444" }}>
            {toplamPuan >= 7 ? "🌟 Mükemmel!" : toplamPuan >= 4 ? "👍 İyi iş!" : "📚 Tekrar okuyabilirsin!"}
          </div>
        </div>
        <button onClick={() => { setAktifHikaye(null); setBitti(false); }}
          style={{ padding:"14px 32px", background:"linear-gradient(135deg, #4f46e5, #7c3aed)", color:"white", border:"none", borderRadius:"12px", cursor:"pointer", fontSize:"15px", fontWeight:"600", marginBottom:"12px", width:"200px" }}>
          Diğer Hikayeler
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
    <div ref={oyunRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"#0f0f1a", zIndex:500, display:"flex", flexDirection:"column" }}>

      <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #1a1a2e" }}>
        <button onClick={onKapat} style={{ background:"none", border:"none", color:"#555", fontSize:"18px", cursor:"pointer" }}>✕</button>
        <span style={{ fontSize:"12px", color:"#555" }}>{soruMu ? "🌟 Soru" : `${metinSayfaNo} / ${toplamMetin}`}</span>
        <span style={{ fontSize:"12px", color:"#f59e0b" }}>⭐ {toplamPuan}</span>
      </div>

      <div style={{ height:"2px", background:"#1a1a2e" }}>
        <div style={{ height:"100%", background:"linear-gradient(90deg, #4f46e5, #7c3aed)", width:`${(sayfaNo / (aktifHikaye.sayfalar.length - 1)) * 100}%`, transition:"width 0.3s" }} />
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", overflowY:"auto", minHeight:0 }}>
        {soruMu ? (
          <SoruSayfasi sayfa={mevcutSayfa} soruNo={soruSayaci + 1} onCevap={soruCevapla} />
        ) : (
          <>
            <div dangerouslySetInnerHTML={{ __html: mevcutSayfa.svg || "" }} style={{ marginBottom:"24px" }} />
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