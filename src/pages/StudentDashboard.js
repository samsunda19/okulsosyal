import React, { useState, useEffect, useCallback, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, doc, getDoc, updateDoc, arrayUnion, arrayRemove, limit, startAfter } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";
import DM from "./DM";
import boslukResmi from "../background2.png";

const GONDERI_LIMIT = 20;

const KUFUR_LISTESI = [
  "amk", "aq", "amq", "amina", "amini", "amcik", "amcik", "anasini",
  "siktir", "siktiret", "sikim", "sikme", "siker", "sikiyim", "sikerim", "sikis",
  "siktigim", "sikilmis", "sikti", "sikiyo", "sikis", "sik",
  "orospu", "orusbu", "oruspu", "kahpe", "fahise", "fahise", "surtuk", "surtuk",
  "pic", "pic", "pust", "pust", "ibne", "ibne",
  "got", "got", "gotveren", "gotveren", "gotlek", "gotlek",
  "yarrak", "yarrag", "yarra", "yarak",
  "oc", "oc", "ananin", "ananı", "ananizin", "anasinin", "ananin",
  "babani", "babanin", "babani",
  "bacin", "bacini", "bacinin",
  "bok", "boktan", "bokunu",
  "salak", "aptal", "gerizekali", "gerizekali", "mal", "okuz", "okuz",
  "fuck", "fucking", "shit", "bitch", "asshole", "bastard"
];

const BILDIRIM_KATEGORILERI = [
  { id: "kufur", emoji: "💢", baslik: "Kotu soz / kufur", duygusal: true },
  { id: "hakaret_bana", emoji: "😢", baslik: "Bana hakaret ediyor / uzdu", duygusal: true },
  { id: "hakaret_baskasi", emoji: "🤬", baslik: "Baskasina hakaret / zorbalik", duygusal: true },
  { id: "uygunsuz", emoji: "🔞", baslik: "Uygunsuz icerik", duygusal: true },
  { id: "tehdit", emoji: "😡", baslik: "Tehdit ediyor", duygusal: true },
  { id: "yalan", emoji: "🚫", baslik: "Yalan bilgi / sahte icerik", duygusal: false },
  { id: "spam", emoji: "💬", baslik: "Spam", duygusal: false },
  { id: "diger", emoji: "😟", baslik: "Baska bir sebep", duygusal: true }
];

const ARKAPLANLAR = {
  varsayilan: { deger: "url(" + boslukResmi + ")", tip: "resim" },
  gokkusagi: { deger: "linear-gradient(135deg, #ff6b9d, #feca57, #48dbfb, #1dd1a1)", tip: "gradient" },
  uzay: { deger: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", tip: "gradient" },
  okyanus: { deger: "linear-gradient(135deg, #2193b0, #6dd5ed)", tip: "gradient" },
  gunbatimi: { deger: "linear-gradient(135deg, #fa709a, #fee140)", tip: "gradient" },
  orman: { deger: "linear-gradient(135deg, #134e5e, #71b280)", tip: "gradient" },
  pastel: { deger: "linear-gradient(135deg, #ffecd2, #fcb69f)", tip: "gradient" },
  morpembe: { deger: "linear-gradient(135deg, #667eea, #764ba2)", tip: "gradient" },
  neon: { deger: "linear-gradient(135deg, #00c9ff, #92fe9d)", tip: "gradient" },
  atesli: { deger: "linear-gradient(135deg, #ff512f, #f09819)", tip: "gradient" },
  lavanta: { deger: "linear-gradient(135deg, #c471f5, #fa71cd)", tip: "gradient" },
  kiraz: { deger: "linear-gradient(135deg, #eb3349, #f45c43)", tip: "gradient" },
  gece: { deger: "linear-gradient(135deg, #141e30, #243b55)", tip: "gradient" },
  ananas: { deger: "linear-gradient(135deg, #f7971e, #ffd200)", tip: "gradient" },
  buz: { deger: "linear-gradient(135deg, #74ebd5, #acb6e5)", tip: "gradient" }
};

const medyaTipiGetir = (url) => {
  if (!url) return null;
  if (url.includes("cloudflarestream.com")) return "stream";
  return "foto";
};

const MedyaGoster = React.memo(({ url }) => {
  const tip = medyaTipiGetir(url);
  if (tip === "stream") {
    const embedUrl = url.includes("/iframe") ? url : url.replace("/manifest/video.m3u8", "/iframe");
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginBottom: "8px", borderRadius: "8px", overflow: "hidden" }}>
        <iframe
          src={embedUrl}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title="video"
        />
      </div>
    );
  }
  const belgeUzantilari = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"];
  const belge = belgeUzantilari.some(u => url.toLowerCase().includes(u)) || url.includes("/belgeler/");
  if (belge) {
    const dosyaExt = url.split(".").pop().split("?")[0].toUpperCase();
    const dosyaAdi = dosyaExt;
    const indir = async () => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = dosyaAdi;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(url, "_blank");
      }
    };
    return (
      <div onClick={indir} style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "8px", padding: "8px 12px", background: "#e0e7ff", color: "#4f46e5", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
        📄 {dosyaAdi} ⬇️
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="gonderi"
      style={{ maxWidth: "100%", borderRadius: "8px", marginBottom: "8px", cursor: "pointer" }}
      onClick={() => {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer";
        const img = document.createElement("img");
        img.src = url;
        img.style.cssText = "max-width:90%;max-height:90vh;border-radius:12px;object-fit:contain";
        overlay.appendChild(img);
        overlay.onclick = () => document.body.removeChild(overlay);
        document.body.appendChild(overlay);
      }}
    />
  );
});

const GonderiKarti = React.memo(({
  g, listeAdi,
  kartArkaplan, kartYazi, kartIkincilYazi, karanlikMod,
  kullaniciFotolari, kullaniciArkadaslar, bildirdigim, yorumlar, acikYorumlar, yeniYorum,
  mevcutKullaniciUid,
  onProfilAc, onBegeni, onYorumToggle, onYorumYap, onYorumMetinDegis, onYorumSil,
  onGonderiSil, onBildirimBaslat
}) => {
  const [begeniAnimasyon, setBegeniAnimasyon] = useState(false);
  const begenenler = g.begenenler || [];
  const benBegendimMi = begenenler.includes(mevcutKullaniciUid);
  const benimPaylasimim = g.yazarUid === mevcutKullaniciUid;
  const bildirdimMi = bildirdigim.includes(g.id);
  const ogretmenPostu = listeAdi === "ogretmen";
  const kaldirildi = g.ogrenciSildi || g.veliKaldirdi || g.ogretmenKaldirdi || g.adminSildi;

  const handleBegeni = () => {
    if (!benBegendimMi) {
      setBegeniAnimasyon(true);
      setTimeout(() => setBegeniAnimasyon(false), 600);
    }
    onBegeni(g.id, begenenler, listeAdi);
  };

  return (
    <div style={{
      background: kartArkaplan,
      padding: "16px",
      borderRadius: "16px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      marginBottom: "12px",
      opacity: kaldirildi ? 0.75 : 1,
      border: karanlikMod ? "1px solid #374151" : "1px solid rgba(79,70,229,0.08)",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
    >
      <style>{`
        @keyframes kalp-patlat {
          0% { transform: scale(1); }
          30% { transform: scale(1.5); }
          60% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes zipla {
          0%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
          70% { transform: translateY(-2px); }
        }
        @keyframes parca-yuksel {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0.5); }
        }
      `}</style>

      {ogretmenPostu && (
        <div style={{ fontSize: "11px", color: "#4f46e5", background: "#e0e7ff", padding: "2px 8px", borderRadius: "6px", display: "block", marginBottom: "6px", width: "fit-content" }}>
          📋 Ogretmen Paylasimi
        </div>
      )}
      {kaldirildi ? (
        <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: kartIkincilYazi, fontStyle: "italic" }}>🗑️ Bu gonderi kaldirildi.</p>
      ) : (
        <>
          {g.icerik && (
            <p style={{ margin: "0 0 8px 0", fontSize: "15px", color: kartYazi }}>
              {ogretmenPostu ? g.icerik.split(/(\bhttps?:\/\/\S+)/g).map((parca, i) =>
                parca.match(/^https?:\/\//) ? (
                  <a key={i} href={parca} target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5", textDecoration: "underline" }}>{parca}</a>
                ) : parca
              ) : g.icerik}
            </p>
          )}
          {g.fotoUrl && <MedyaGoster url={g.fotoUrl} />}
        </>
      )}
      {bildirdimMi && (
        <div style={{ fontSize: "11px", color: "#92400e", background: "#fef3c7", padding: "3px 8px", borderRadius: "6px", display: "inline-block", marginBottom: "6px" }}>
          🚩 Bu icerigi bildirdin
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }} onClick={() => onProfilAc(g.yazarUid)}>
          {kullaniciFotolari[g.yazarUid] ? (
            <img src={kullaniciFotolari[g.yazarUid]} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" }} />
          ) : (
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "white", fontWeight: "700", flexShrink: 0 }}>
              {(g.yazar || "?")[0].toUpperCase()}
            </div>
          )}
          <small style={{ color: "#4f46e5", textDecoration: "underline" }}>
            {g.yazar}{kullaniciArkadaslar.includes(g.yazarUid) && " 👥"}
          </small>
          {g.tarih && (
            <small style={{ color: kartIkincilYazi, fontSize: "11px" }}>
              {new Date(g.tarih.seconds * 1000).toLocaleDateString("tr-TR")} {new Date(g.tarih.seconds * 1000).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </small>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {!kaldirildi && (
            <button onClick={handleBegeni}
              style={{
                padding: "4px 10px",
                background: benBegendimMi ? "#fee2e2" : (karanlikMod ? "#374151" : "#f3f4f6"),
                color: benBegendimMi ? "#ef4444" : kartIkincilYazi,
                border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                animation: begeniAnimasyon ? "kalp-patlat 0.6s ease" : "none",
                position: "relative"
              }}>
              {benBegendimMi ? "❤️" : "🤍"} {begenenler.length}
            </button>
          )}
          {!ogretmenPostu && !kaldirildi && (
            <button onClick={() => onYorumToggle(g.id)}
              style={{ padding: "4px 10px", background: "#e0e7ff", color: "#4f46e5", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
              💬 {yorumlar[g.id] ? yorumlar[g.id].length : ""} Yorum
            </button>
          )}
          {!benimPaylasimim && !bildirdimMi && !ogretmenPostu && (
            <button onClick={() => onBildirimBaslat("post", g.id, g.id, g.icerik, g.yazarUid, g.yazar, g.fotoUrl)}
              style={{ padding: "4px 10px", background: "#fef3c7", color: "#92400e", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
              🚩
            </button>
          )}
          {benimPaylasimim && !kaldirildi && (
            <button onClick={() => onGonderiSil(g.id, g.yazarUid)}
              style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
              Sil
            </button>
          )}
        </div>
      </div>
      {!ogretmenPostu && !kaldirildi && acikYorumlar[g.id] && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: karanlikMod ? "1px solid #374151" : "1px solid #f0f4ff" }}>
          {yorumlar[g.id] && yorumlar[g.id].map(y => {
            const benimYorumum = y.yazarUid === mevcutKullaniciUid;
            return (
              <div key={y.id} style={{ background: karanlikMod ? "#374151" : "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "6px", position: "relative", opacity: y.silindi ? 0.6 : 1 }}>
                {y.silindi ? (
                  <p style={{ margin: "0 0 4px", fontSize: "13px", fontStyle: "italic", color: kartIkincilYazi }}>🗑️ Bu yorum kaldirildi.</p>
                ) : (
                  <p style={{ margin: "0 0 4px", fontSize: "14px", paddingRight: "60px", color: kartYazi }}>{y.icerik}</p>
                )}
                <small onClick={() => onProfilAc(y.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline", fontSize: "12px" }}>{y.yazar}</small>
                <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "4px" }}>
                  {!benimYorumum && (
                    <button onClick={() => onBildirimBaslat("comment", y.id, g.id, y.icerik, y.yazarUid, y.yazar)}
                      style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>
                      🚩
                    </button>
                  )}
                  {benimYorumum && !y.silindi && (
                    <button onClick={() => onYorumSil(g.id, y.id)}
                      style={{ padding: "2px 8px", background: "#ef4444", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>
                      Sil
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <input type="text" placeholder="Yorum yaz..." value={yeniYorum[g.id] || ""}
              onChange={e => onYorumMetinDegis(g.id, e.target.value)}
              onKeyDown={e => e.key === "Enter" && onYorumYap(g.id)}
              style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "13px", background: karanlikMod ? "#374151" : "white", color: kartYazi }} />
            <button onClick={() => onYorumYap(g.id)}
              style={{ padding: "8px 14px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
              Gonder
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

function StudentDashboard() {
  const [gonderi, setGonderi] = useState("");
  const [gonderiler, setGonderiler] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [sonDoc, setSonDoc] = useState(null);
  const [dahaFazla, setDahaFazla] = useState(false);
  const [dahaFazlaYukleniyor, setDahaFazlaYukleniyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kullanici, setKullanici] = useState({ isim: "", arkadaslar: [], gelenIstekler: [], gidenIstekler: [], engellenenler: [], okul: "", ogretmenUid: null, ogretmenIsim: "" });
  const [karanlikMod, setKaranlikMod] = useState(false);
  const [arkaplanId, setArkaplanId] = useState("varsayilan");
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [yeniYorum, setYeniYorum] = useState({});
  const [hataMesaj, setHataMesaj] = useState("");
  const [bildirimModal, setBildirimModal] = useState(null);
  const [bildirimAdimi, setBildirimAdimi] = useState(1);
  const [secilenKategori, setSecilenKategori] = useState(null);
  const [digerSebep, setDigerSebep] = useState("");
  const [aramaMetni, setAramaMetni] = useState("");
  const [tumOgrenciler, setTumOgrenciler] = useState([]);
  const [aktifSekme, setAktifSekme] = useState("tumu");
  const [bildirdigim, setBildirdigim] = useState([]);
  const [ogretmenGonderiler, setOgretmenGonderiler] = useState([]);
  const [gorulmemisOgretmenPost, setGorulmemisOgretmenPost] = useState(0);
  const [kullaniciFotolari, setKullaniciFotolari] = useState({});
  const [secilenMedya, setSecilenMedya] = useState(null);
  const [medyaOnizleme, setMedyaOnizleme] = useState(null);
  const [medyaTip, setMedyaTip] = useState(null);
  const [medyaYukleniyor, setMedyaYukleniyor] = useState(false);
  const [aktifSekmeHover, setAktifSekmeHover] = useState(null);
  const arkadaslarRef = useRef([]);
  const sonDocRef = useRef(null);
  const dahaFazlaRef = useRef(false);
  const yukleniyor2Ref = useRef(false);
  const WORKER_URL = "https://zupii-photos.samsunda-yasamak.workers.dev";

  useEffect(() => {
    ilkYukle();
    const interval = setInterval(kullaniciBilgisiGetir, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleScroll = () => {
      if (yukleniyor2Ref.current || !dahaFazlaRef.current) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled >= total - 300) dahaFazlaGetir();
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ilkYukle = async () => {
    await kullaniciBilgisiGetir();
    ogrencileriGetir();
    bildirimleriGetir();
    await ilkGonderileriGetir();
  };

  const kullaniciBilgisiGetir = async () => {
    if (!auth.currentUser) return;
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const ogretmenUid = data.ogretmenUid || null;
      arkadaslarRef.current = data.arkadaslar || [];
      setKullanici({
        isim: data.isim || auth.currentUser.email,
        arkadaslar: data.arkadaslar || [],
        gelenIstekler: data.gelenIstekler || [],
        gidenIstekler: data.gidenIstekler || [],
        engellenenler: data.engellenenler || [],
        okul: data.okul || "",
        ogretmenUid: ogretmenUid,
        ogretmenIsim: data.ogretmenIsim || ""
      });
      setKaranlikMod(data.karanlikMod || false);
      setArkaplanId(data.arkaplan || "varsayilan");
      if (ogretmenUid) ogretmenGonderileriniGetir(ogretmenUid);
    }
  };

  const ilkGonderileriGetir = async () => {
    const q = query(collection(db, "posts"), orderBy("tarih", "desc"), limit(GONDERI_LIMIT));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => !g.ogrenciSildi && !g.veliKaldirdi && !g.ogretmenKaldirdi && !g.adminSildi);
    setGonderiler(liste);
    const sonSayfaDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    sonDocRef.current = sonSayfaDoc;
    setSonDoc(sonSayfaDoc);
    const daha = snapshot.docs.length === GONDERI_LIMIT;
    dahaFazlaRef.current = daha;
    setDahaFazla(daha);
  };

  const dahaFazlaGetir = async () => {
    if (yukleniyor2Ref.current || !sonDocRef.current) return;
    yukleniyor2Ref.current = true;
    setDahaFazlaYukleniyor(true);
    const q = query(collection(db, "posts"), orderBy("tarih", "desc"), startAfter(sonDocRef.current), limit(GONDERI_LIMIT));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => !g.ogrenciSildi && !g.veliKaldirdi && !g.ogretmenKaldirdi && !g.adminSildi);
    setGonderiler(prev => [...prev, ...liste]);
    const sonSayfaDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    sonDocRef.current = sonSayfaDoc;
    setSonDoc(sonSayfaDoc);
    const daha = snapshot.docs.length === GONDERI_LIMIT;
    dahaFazlaRef.current = daha;
    setDahaFazla(daha);
    yukleniyor2Ref.current = false;
    setDahaFazlaYukleniyor(false);
  };

  const gonderileriGetir = async () => { await ilkGonderileriGetir(); };

  const ogretmenGonderileriniGetir = async (ogretmenUid) => {
    const q = query(collection(db, "duyurular"), orderBy("tarih", "desc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.yazarUid === ogretmenUid && !g.adminSildi);
    setOgretmenGonderiler(liste);
    const gorulmusKey2 = "ogretmenGorulmusIds_" + auth.currentUser.uid;
    const gorulmusIds = JSON.parse(localStorage.getItem(gorulmusKey2) || "[]");
    const yeni = liste.filter(g => !gorulmusIds.includes(g.id));
    setGorulmemisOgretmenPost(yeni.length);
  };

  const ogretmenSekmeAc = () => {
    setAktifSekme("ogretmen");
    const anahtar = "ogretmenGorulmusIds_" + auth.currentUser.uid;
    const mevcutIds = JSON.parse(localStorage.getItem(anahtar) || "[]");
    const tumIds = ogretmenGonderiler.map(g => g.id);
    const yeniIds = [...new Set([...mevcutIds, ...tumIds])];
    localStorage.setItem(anahtar, JSON.stringify(yeniIds));
    setGorulmemisOgretmenPost(0);
  };

  const ogrencileriGetir = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const tumKullanicilar = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const ogrenciler = tumKullanicilar.filter(u => u.role === "student" && u.onaylandi !== false && u.id !== auth.currentUser.uid);
    setTumOgrenciler(ogrenciler);
    const fotolar = {};
    snapshot.docs.forEach(d => {
      const data = d.data();
      if (data.profilFotoUrl) fotolar[d.id] = data.profilFotoUrl;
    });
    setKullaniciFotolari(fotolar);
  };

  const bildirimleriGetir = async () => {
    const snapshot = await getDocs(collection(db, "reports"));
    const benimBildirimlerim = snapshot.docs.filter(d => d.data().bildirenUid === auth.currentUser.uid).map(d => d.data().postId);
    setBildirdigim(benimBildirimlerim);
  };

  const kufurKontrol = (metin) => {
    const kucukMetin = metin.toLowerCase();
    return KUFUR_LISTESI.some(kufur => kucukMetin.includes(kufur));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setYorumlar(prev => ({ ...prev, [postId]: liste }));
  };

  const yorumToggle = useCallback(async (postId) => {
    setAcikYorumlar(prev => {
      const acik = !prev[postId];
      if (acik) yorumlariGetir(postId);
      return { ...prev, [postId]: acik };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const yorumYap = useCallback(async (postId) => {
    setYeniYorum(prev => {
      const metin = prev[postId];
      if (!metin || !metin.trim()) return prev;
      if (KUFUR_LISTESI.some(k => metin.toLowerCase().includes(k))) {
        alert("⚠️ Yorumda uygunsuz kelimeler tespit edildi. Lutfen duzenleyin!");
        return prev;
      }
      addDoc(collection(db, "posts", postId, "comments"), {
        icerik: metin,
        yazar: auth.currentUser.displayName || auth.currentUser.email,
        yazarUid: auth.currentUser.uid,
        tarih: serverTimestamp(),
        silindi: false
      }).then(() => yorumlariGetir(postId));
      return { ...prev, [postId]: "" };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const yorumSil = useCallback(async (postId, yorumId) => {
    await updateDoc(doc(db, "posts", postId, "comments", yorumId), {
      silindi: true, silinmeTarihi: serverTimestamp(),
      silenUid: auth.currentUser.uid, silenRol: "student"
    });
    yorumlariGetir(postId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const medyaSec = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isFoto = f.type.startsWith("image/");
    if (!isVideo && !isFoto) { alert("Sadece foto veya video yukleyebilirsiniz!"); return; }
    const maxBoyut = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (f.size > maxBoyut) { alert(isVideo ? "Max 50MB!" : "Max 5MB!"); return; }
    setSecilenMedya(f);
    setMedyaTip(isVideo ? "video" : "foto");
    setMedyaOnizleme(URL.createObjectURL(f));
    e.target.value = "";
  };

  const medyaTemizle = () => { setSecilenMedya(null); setMedyaOnizleme(null); setMedyaTip(null); };

  const gonderiYap = async () => {
    if (!gonderi.trim() && !secilenMedya) return;
    if (gonderi.trim() && kufurKontrol(gonderi)) {
      setHataMesaj("⚠️ Paylasimda uygunsuz kelimeler tespit edildi. Lutfen duzenleyin!");
      setTimeout(() => setHataMesaj(""), 4000);
      return;
    }
    if (gonderi.trim() && /https?:\/\/\S+/.test(gonderi)) {
      setHataMesaj("⚠️ Paylasimda link paylasilamaz!");
      setTimeout(() => setHataMesaj(""), 4000);
      return;
    }
    setYukleniyor(true);
    let medyaUrl = null;
    if (secilenMedya) {
      try {
        setMedyaYukleniyor(true);
        const token = await auth.currentUser.getIdToken();
        if (medyaTip === "video") {
          const formData = new FormData();
          formData.append("file", secilenMedya, secilenMedya.name);
          const response = await fetch(WORKER_URL + "/upload-video", {
            method: "POST",
            headers: { "Authorization": "Bearer " + token },
            body: formData
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Video yuklenemedi");
          medyaUrl = data.embedUrl;
        } else {
          const ext = secilenMedya.name.split(".").pop();
          const key = "posts/" + auth.currentUser.uid + "_" + Date.now() + "." + ext;
          await fetch(WORKER_URL + "/upload/" + key, {
            method: "PUT",
            headers: { "Content-Type": secilenMedya.type, "Authorization": "Bearer " + token },
            body: secilenMedya
          });
          medyaUrl = WORKER_URL + "/photo/" + key;
        }
        setMedyaYukleniyor(false);
      } catch (err) {
        alert("Medya yuklenemedi: " + err.message);
        setYukleniyor(false);
        setMedyaYukleniyor(false);
        return;
      }
    }
    await addDoc(collection(db, "posts"), {
      icerik: gonderi,
      yazar: kullanici.isim || auth.currentUser.email,
      yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp(),
      begenenler: [],
      fotoUrl: medyaUrl,
      ogrenciSildi: false,
      veliKaldirdi: false,
      ogretmenKaldirdi: false,
      adminSildi: false
    });
    setGonderi("");
    medyaTemizle();
    await gonderileriGetir();
    setYukleniyor(false);
  };

  const gonderiSil = useCallback(async (id, yazarUid) => {
    if (yazarUid !== auth.currentUser.uid) return;
    await updateDoc(doc(db, "posts", id), {
      ogrenciSildi: true, silinmeTarihi: serverTimestamp(),
      silenUid: auth.currentUser.uid, silenRol: "student"
    });
    setGonderiler(prev => prev.filter(g => g.id !== id));
  }, []);

  const begeniToggle = useCallback(async (postId, begenenler, listeAdi) => {
    const benBegendimMi = begenenler && begenenler.includes(auth.currentUser.uid);
    const koleksiyon = listeAdi === "ogretmen" ? "duyurular" : "posts";
    if (benBegendimMi) {
      await updateDoc(doc(db, koleksiyon, postId), { begenenler: arrayRemove(auth.currentUser.uid) });
    } else {
      await updateDoc(doc(db, koleksiyon, postId), { begenenler: arrayUnion(auth.currentUser.uid) });
    }
    const guncelle = (liste) => liste.map(g => {
      if (g.id !== postId) return g;
      const yeniBegenenler = benBegendimMi
        ? (g.begenenler || []).filter(uid => uid !== auth.currentUser.uid)
        : [...(g.begenenler || []), auth.currentUser.uid];
      return { ...g, begenenler: yeniBegenenler };
    });
    if (listeAdi === "ogretmen") setOgretmenGonderiler(prev => guncelle(prev));
    else setGonderiler(prev => guncelle(prev));
  }, []);

  const bildirimBaslat = useCallback((tip, icerikId, postId, icerikMetni, yazarUid, yazar, fotoUrl) => {
    setBildirimModal({ tip, icerikId, postId, icerikMetni, yazarUid, yazar, fotoUrl });
    setBildirimAdimi(1);
    setSecilenKategori(null);
    setDigerSebep("");
  }, []);

  const bildirimGonder = async (iyiMisin = null) => {
    if (secilenKategori.id === "diger" && !digerSebep.trim()) { alert("Lutfen sebebinizi yazin!"); return; }
    await addDoc(collection(db, "reports"), {
      tip: bildirimModal.tip,
      icerikId: bildirimModal.icerikId,
      postId: bildirimModal.postId,
      icerikMetni: bildirimModal.icerikMetni,
      fotoUrl: bildirimModal.fotoUrl || null,
      yazarUid: bildirimModal.yazarUid,
      yazar: bildirimModal.yazar,
      bildirenUid: auth.currentUser.uid,
      bildiren: kullanici.isim || auth.currentUser.email,
      kategori: secilenKategori.baslik,
      kategoriId: secilenKategori.id,
      digerSebep: digerSebep,
      iyiMisin: iyiMisin,
      acil: iyiMisin === "yardim",
      tarih: serverTimestamp(),
      okundu: false, veliGordu: false, veliSildi: false,
      ogretmenGordu: false, ogretmenSildi: false, adminaIletti: false
    });
    setBildirdigim(prev => [...prev, bildirimModal.postId]);
    setBildirimModal(null);
    alert("✅ Bildirimin alindi! Veli ve ogretmenlerin bilgilendirildi.");
  };

  const onYorumMetinDegisCallback = useCallback((postId, val) => {
    setYeniYorum(prev => ({ ...prev, [postId]: val }));
  }, []);

  const onProfilAcCallback = useCallback((uid) => setSecilenProfil(uid), []);

  const normalize = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

  const aramaSonuclari = aramaMetni.trim()
    ? tumOgrenciler.filter(k => {
        const arama = aramaMetni.toLowerCase();
        const isimEsl = (k.isim || "").toLowerCase().includes(arama);
        const ayniOkul = kullanici.okul && k.okul && normalize(kullanici.okul) === normalize(k.okul);
        const engellenmemis = !kullanici.engellenenler.includes(k.id);
        return isimEsl && ayniOkul && engellenmemis;
      })
    : [];

  const filtrelenmisGonderiler = aktifSekme === "arkadaslar"
    ? gonderiler.filter(g => kullanici.arkadaslar.includes(g.yazarUid))
    : gonderiler.filter(g => !kullanici.engellenenler.includes(g.yazarUid));

  let arkaplanStili = {};
  if (arkaplanId === "ozel") {
    const ozelKayit = localStorage.getItem("ozelArkaplan_" + auth.currentUser.uid);
    if (ozelKayit) {
      arkaplanStili = { backgroundImage: "url(" + ozelKayit + ")", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed", backgroundRepeat: "no-repeat" };
    } else {
      arkaplanStili = { backgroundImage: ARKAPLANLAR.varsayilan.deger, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed", backgroundRepeat: "no-repeat" };
    }
  } else {
    const aktifArkaplan = ARKAPLANLAR[arkaplanId] || ARKAPLANLAR.varsayilan;
    arkaplanStili = { backgroundImage: aktifArkaplan.deger, backgroundSize: aktifArkaplan.tip === "resim" ? "cover" : "auto", backgroundPosition: "center", backgroundAttachment: "fixed", backgroundRepeat: "no-repeat" };
  }

  const kartArkaplan = karanlikMod ? "#1f2937" : "white";
  const kartYazi = karanlikMod ? "#f3f4f6" : "#111827";
  const kartIkincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";

  const gonderiKartiProps = React.useMemo(() => ({
    kartArkaplan, kartYazi, kartIkincilYazi, karanlikMod,
    kullaniciFotolari,
    kullaniciArkadaslar: arkadaslarRef.current,
    bildirdigim, yorumlar, acikYorumlar, yeniYorum,
    mevcutKullaniciUid: auth.currentUser.uid,
    onProfilAc: onProfilAcCallback,
    onBegeni: begeniToggle,
    onYorumToggle: yorumToggle,
    onYorumYap: yorumYap,
    onYorumMetinDegis: onYorumMetinDegisCallback,
    onYorumSil: yorumSil,
    onGonderiSil: gonderiSil,
    onBildirimBaslat: bildirimBaslat
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [kartArkaplan, kartYazi, kartIkincilYazi, karanlikMod, kullaniciFotolari, bildirdigim, yorumlar, acikYorumlar, yeniYorum]);

  const sekmeStil = (sekmeId) => ({
    flex: 1,
    padding: "10px",
    background: aktifSekme === sekmeId
      ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
      : aktifSekmeHover === sekmeId
        ? (karanlikMod ? "#4b5563" : "#d1d5db")
        : (karanlikMod ? "#374151" : "#e5e7eb"),
    color: aktifSekme === sekmeId ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"),
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
    position: "relative",
    transition: "all 0.2s ease",
    transform: aktifSekme === sekmeId ? "scale(1.03)" : "scale(1)",
    boxShadow: aktifSekme === sekmeId ? "0 4px 12px rgba(79,70,229,0.3)" : "none",
    animation: aktifSekme === sekmeId ? "zipla 0.4s ease" : "none",
  });

  return (
    <div style={{ minHeight: "100vh", ...arkaplanStili }}>
      <style>{`
        @keyframes zipla {
          0%, 100% { transform: scale(1.03) translateY(0); }
          40% { transform: scale(1.03) translateY(-3px); }
          70% { transform: scale(1.03) translateY(-1px); }
        }
        @keyframes gradient-kayma {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

        {secilenProfil && (
          <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => { setSecilenProfil(null); kullaniciBilgisiGetir(); }} mevcutKullaniciRol="student" />
        )}

        {bildirimModal && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
            <div style={{ background: "white", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "400px", maxHeight: "85vh", overflowY: "auto" }}>
              {bildirimAdimi === 1 && (
                <>
                  <h3 style={{ marginBottom: "8px" }}>🚩 Bildirme Sebebi</h3>
                  <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>Bu icerigi neden bildiriyorsun?</p>
                  {BILDIRIM_KATEGORILERI.map(k => (
                    <button key={k.id} onClick={() => { setSecilenKategori(k); if (k.duygusal) { setBildirimAdimi(2); } else { bildirimGonder(null); } }}
                      style={{ width: "100%", padding: "12px", marginBottom: "8px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", cursor: "pointer", textAlign: "left", fontSize: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{k.emoji}</span><span>{k.baslik}</span>
                    </button>
                  ))}
                  <button onClick={() => setBildirimModal(null)} style={{ width: "100%", padding: "10px", background: "#e5e7eb", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "8px" }}>Iptal</button>
                </>
              )}
              {bildirimAdimi === 2 && secilenKategori?.id === "diger" && (
                <>
                  <h3 style={{ marginBottom: "12px" }}>😟 Baska sebep</h3>
                  <textarea value={digerSebep} onChange={e => setDigerSebep(e.target.value)} placeholder="Sebebini yazabilirsin..."
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", minHeight: "80px", boxSizing: "border-box", marginBottom: "12px", fontFamily: "inherit" }} />
                  <button onClick={() => setBildirimAdimi(3)} style={{ width: "100%", padding: "10px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", marginBottom: "8px" }}>Devam Et</button>
                  <button onClick={() => setBildirimModal(null)} style={{ width: "100%", padding: "10px", background: "#e5e7eb", border: "none", borderRadius: "8px", cursor: "pointer" }}>Iptal</button>
                </>
              )}
              {((bildirimAdimi === 2 && secilenKategori?.id !== "diger") || bildirimAdimi === 3) && (
                <>
                  <h3 style={{ marginBottom: "8px" }}>💙 Sen iyi misin?</h3>
                  <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>Bunu okumak seni nasil etkiledi?</p>
                  <button onClick={() => bildirimGonder("iyi")} style={{ width: "100%", padding: "12px", marginBottom: "8px", background: "#d1fae5", color: "#065f46", border: "none", borderRadius: "10px", cursor: "pointer", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>😊 Iyiyim, sadece bildirmek istedim</button>
                  <button onClick={() => bildirimGonder("uzgun")} style={{ width: "100%", padding: "12px", marginBottom: "8px", background: "#fef3c7", color: "#92400e", border: "none", borderRadius: "10px", cursor: "pointer", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>😟 Biraz uzuldum</button>
                  <button onClick={() => bildirimGonder("yardim")} style={{ width: "100%", padding: "12px", marginBottom: "8px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: "10px", cursor: "pointer", textAlign: "left", fontSize: "14px", fontWeight: "600" }}>😢 Cok uzuldum, yardim istiyorum</button>
                  {bildirimAdimi === 2 && <button onClick={() => setBildirimModal(null)} style={{ width: "100%", padding: "10px", background: "#e5e7eb", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "8px" }}>Iptal</button>}
                </>
              )}
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", background: karanlikMod ? "rgba(31,41,55,0.92)" : "rgba(255,255,255,0.92)", padding: "12px 16px", borderRadius: "16px", backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(79,70,229,0.12)" }}>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", background: "linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            🌌 Galaksim
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span onClick={() => setSecilenProfil(auth.currentUser.uid)} style={{ fontSize: "14px", color: "#4f46e5", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
              {kullaniciFotolari[auth.currentUser.uid] ? (
                <img src={kullaniciFotolari[auth.currentUser.uid]} alt="" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover", border: "2px solid #4f46e5" }} />
              ) : (
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "white", fontWeight: "700" }}>
                  {(kullanici.isim || "?")[0].toUpperCase()}
                </div>
              )}
              {kullanici.isim}
            </span>
            <button onClick={() => signOut(auth)} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cikis</button>
          </div>
        </div>

        {/* ARAMA */}
        <div style={{ background: karanlikMod ? "rgba(31,41,55,0.92)" : "rgba(255,255,255,0.92)", padding: "12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginBottom: "16px", backdropFilter: "blur(8px)" }}>
          <input type="text" placeholder="🔍 Ayni okuldan arkadas ara..." value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", boxSizing: "border-box", background: karanlikMod ? "#374151" : "white", color: kartYazi }} />
          {aramaMetni.trim() && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ fontSize: "12px", color: kartIkincilYazi, margin: "0 0 8px" }}>{aramaSonuclari.length} sonuc bulundu</p>
              {aramaSonuclari.slice(0, 8).map(k => (
                <div key={k.id} onClick={() => { setSecilenProfil(k.id); setAramaMetni(""); }}
                  style={{ padding: "8px 10px", background: karanlikMod ? "#374151" : "#f9fafb", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {kullaniciFotolari[k.id] ? (
                      <img src={kullaniciFotolari[k.id]} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "white", fontWeight: "700", flexShrink: 0 }}>
                        {(k.isim || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p style={{ margin: "0", fontSize: "13px", fontWeight: "600", color: kartYazi }}>{k.isim || "Isimsiz"}</p>
                      {k.sinif && <p style={{ margin: "0", fontSize: "11px", color: kartIkincilYazi }}>📚 {k.sinif}</p>}
                    </div>
                  </div>
                  {kullanici.arkadaslar.includes(k.id) && <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Arkadas</span>}
                  {kullanici.gidenIstekler.includes(k.id) && <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Istek gonderildi</span>}
                  {kullanici.gelenIstekler.includes(k.id) && <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 6px", borderRadius: "4px", fontSize: "10px" }}>Istegi var</span>}
                  {!kullanici.arkadaslar.includes(k.id) && !kullanici.gidenIstekler.includes(k.id) && !kullanici.gelenIstekler.includes(k.id) && k.okul && kullanici.okul && k.okul.trim().toLowerCase() === kullanici.okul.trim().toLowerCase() && (
                    <button onClick={async (e) => { e.stopPropagation(); await updateDoc(doc(db, "users", k.id), { gelenIstekler: arrayUnion(auth.currentUser.uid) }); await updateDoc(doc(db, "users", auth.currentUser.uid), { gidenIstekler: arrayUnion(k.id) }); setKullanici(prev => ({ ...prev, gidenIstekler: [...prev.gidenIstekler, k.id] })); }}
                      style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", border: "none", cursor: "pointer", fontWeight: "600" }}>
                      + Ekle
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEKMELER */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          {[
            { id: "tumu", label: "🌍 Tumu", badge: 0 },
            { id: "arkadaslar", label: "👥 Arkadaslar", badge: kullanici.gelenIstekler.length },
            { id: "ogretmen", label: "🏫 Ogretmenim", badge: gorulmemisOgretmenPost }
          ].map(({ id, label, badge }) => (
            <button key={id}
              onClick={() => id === "ogretmen" ? ogretmenSekmeAc() : setAktifSekme(id)}
              onMouseEnter={() => setAktifSekmeHover(id)}
              onMouseLeave={() => setAktifSekmeHover(null)}
              style={sekmeStil(id)}>
              {label}
              {badge > 0 && (
                <span style={{ position: "absolute", top: "-6px", right: "-6px", background: "#ef4444", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ARKADAS İSTEKLERİ */}
        {aktifSekme === "arkadaslar" && kullanici.gelenIstekler.length > 0 && (
          <div style={{ background: kartArkaplan, padding: "12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "14px", color: kartYazi, margin: "0 0 10px" }}>📬 Bekleyen Istekler ({kullanici.gelenIstekler.length})</h3>
            {kullanici.gelenIstekler.map(uid => {
              const istekciKisi = tumOgrenciler.find(o => o.id === uid);
              if (!istekciKisi) return null;
              return (
                <div key={uid} style={{ padding: "8px 10px", background: karanlikMod ? "#374151" : "#f9fafb", borderRadius: "8px", marginBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p onClick={() => setSecilenProfil(uid)} style={{ margin: "0", fontSize: "13px", fontWeight: "600", color: kartYazi, cursor: "pointer" }}>👋 {istekciKisi.isim}</p>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={async () => {
                      await updateDoc(doc(db, "users", auth.currentUser.uid), { gelenIstekler: arrayRemove(uid), arkadaslar: arrayUnion(uid) });
                      await updateDoc(doc(db, "users", uid), { gidenIstekler: arrayRemove(auth.currentUser.uid), arkadaslar: arrayUnion(auth.currentUser.uid) });
                      setKullanici(prev => ({ ...prev, gelenIstekler: prev.gelenIstekler.filter(u => u !== uid), arkadaslar: [...prev.arkadaslar, uid] }));
                    }} style={{ padding: "3px 10px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>✓ Kabul</button>
                    <button onClick={async () => {
                      await updateDoc(doc(db, "users", auth.currentUser.uid), { gelenIstekler: arrayRemove(uid) });
                      await updateDoc(doc(db, "users", uid), { gidenIstekler: arrayRemove(auth.currentUser.uid) });
                      setKullanici(prev => ({ ...prev, gelenIstekler: prev.gelenIstekler.filter(u => u !== uid) }));
                    }} style={{ padding: "3px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>✕ Reddet</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GONDERI KUTUSU */}
        {aktifSekme !== "ogretmen" && (
          <div style={{ background: karanlikMod ? "rgba(31,41,55,0.92)" : "rgba(255,255,255,0.92)", padding: "20px", borderRadius: "16px", boxShadow: "0 4px 16px rgba(79,70,229,0.1)", marginBottom: "24px", backdropFilter: "blur(8px)" }}>
            <textarea placeholder="Ne dusunuyorsun?" value={gonderi} onChange={e => setGonderi(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e0e7ff", fontSize: "15px", resize: "vertical", minHeight: "80px", boxSizing: "border-box", background: karanlikMod ? "#374151" : "#f8f7ff", color: kartYazi }} />
            {hataMesaj && <div style={{ marginTop: "8px", padding: "8px 12px", background: "#fee2e2", color: "#ef4444", borderRadius: "8px", fontSize: "13px" }}>{hataMesaj}</div>}
            {medyaOnizleme && (
              <div style={{ marginTop: "10px", position: "relative", display: "inline-block" }}>
                {medyaTip === "video" ? (
                  <video src={medyaOnizleme} controls style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
                ) : (
                  <img src={medyaOnizleme} alt="onizleme" style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
                )}
                <button onClick={medyaTemizle} style={{ position: "absolute", top: "4px", right: "4px", background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>✕</button>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px", alignItems: "center" }}>
              <label style={{ padding: "10px 16px", background: karanlikMod ? "#374151" : "#f3f4f6", color: kartYazi, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}>
                📷 Foto/Video
                <input type="file" accept="image/*,video/*" onChange={medyaSec} style={{ display: "none" }} />
              </label>
              <button onClick={gonderiYap} disabled={yukleniyor || medyaYukleniyor}
                style={{
                  padding: "10px 24px",
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899)",
                  backgroundSize: "200% 200%",
                  animation: "gradient-kayma 3s ease infinite",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: "700",
                  boxShadow: "0 4px 12px rgba(79,70,229,0.3)"
                }}>
                {medyaYukleniyor ? "Yukleniyor..." : yukleniyor ? "Paylasiliyor..." : "✨ Paylas"}
              </button>
            </div>
          </div>
        )}

        {/* OGRETMEN SEKMESI */}
        {aktifSekme === "ogretmen" && (
          <div>
            {kullanici.ogretmenIsim && (
              <div style={{ background: "#e0e7ff", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#3730a3", fontWeight: "600" }}>👩‍🏫 Ogretmenin: {kullanici.ogretmenIsim}</p>
              </div>
            )}
            {ogretmenGonderiler.length === 0 ? (
              <div style={{ background: kartArkaplan, padding: "20px", borderRadius: "12px", textAlign: "center", color: kartIkincilYazi }}>
                <p>Ogretmenin henuz paylasim yapmadi.</p>
              </div>
            ) : (
              ogretmenGonderiler.map(g => <GonderiKarti key={g.id} g={g} listeAdi="ogretmen" {...gonderiKartiProps} />)
            )}
          </div>
        )}

        {/* ANA AKIS */}
        {aktifSekme !== "ogretmen" && (
          <div>
            {filtrelenmisGonderiler.length === 0 && aktifSekme === "arkadaslar" && (
              <div style={{ background: kartArkaplan, padding: "20px", borderRadius: "12px", textAlign: "center", color: kartIkincilYazi }}>
                <p>Henuz arkadasin yok veya arkadaslarin paylasim yapmadi.</p>
              </div>
            )}
            {filtrelenmisGonderiler.map(g => <GonderiKarti key={g.id} g={g} listeAdi="normal" {...gonderiKartiProps} />)}
            {dahaFazlaYukleniyor && (
              <div style={{ textAlign: "center", padding: "20px", color: kartIkincilYazi, fontSize: "13px" }}>Yukleniyor...</div>
            )}
            {!dahaFazla && gonderiler.length > 0 && aktifSekme !== "arkadaslar" && (
              <div style={{ textAlign: "center", padding: "20px", color: kartIkincilYazi, fontSize: "12px" }}>Tum paylasimlar gosterildi</div>
            )}
          </div>
        )}
      </div>

      <DM kullaniciIsim={kullanici.isim} arkadaslar={kullanici.arkadaslar} karanlikMod={karanlikMod} />
    </div>
  );
}

export default StudentDashboard;