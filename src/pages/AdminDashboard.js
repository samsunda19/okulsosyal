import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, orderBy, query, updateDoc, serverTimestamp, getDoc, addDoc, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

const WORKER_URL = process.env.REACT_APP_WORKER_URL;

const MedyaGoster = ({ url }) => {
  if (!url) return null;
  if (url.includes("cloudflarestream.com")) {
    const embedUrl = url.includes("/iframe") ? url : url.replace("/manifest/video.m3u8", "/iframe");
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginTop: "8px", borderRadius: "8px", overflow: "hidden" }}>
        <iframe src={embedUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title="video" />
      </div>
    );
  }
  return (
    <img src={url} alt="gonderi" style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "8px", cursor: "pointer" }}
      onClick={() => window.open(url, "_blank")} />
  );
};

function AdminDashboard() {
  const [gonderiler, setGonderiler] = useState([]);
  const [kullaniciler, setKullaniciler] = useState({});
  const [bekleyenler, setBekleyenler] = useState([]);
  const [bildirimler, setBildirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");
  const [aramaMetni, setAramaMetni] = useState("");
  const [gonderiArama, setGonderiArama] = useState("");
  const [secilenKullanici, setSecilenKullanici] = useState(null);
  const [yonetimAcik, setYonetimAcik] = useState(false);
  const [secilenOgrenciler, setSecilenOgrenciler] = useState([]);
  const [secilenCocuk, setSecilenCocuk] = useState("");
  const [kaydetYukleniyor, setKaydetYukleniyor] = useState(false);
  const [sinifAramaMetni, setSinifAramaMetni] = useState("");
  const [cocukAramaMetni, setCocukAramaMetni] = useState("");
  const [karanlikMod, setKaranlikMod] = useState(() => localStorage.getItem("adminKaranlikMod") === "true");
  const [postDetay, setPostDetay] = useState({});
  const [acikBildirimPost, setAcikBildirimPost] = useState({});

  // AI Asistan state
  const [mesajlar, setMesajlar] = useState([]);
  const [girdi, setGirdi] = useState("");
  const [asistanYukleniyor, setAsistanYukleniyor] = useState(false);
  const [bekleyenHikaye, setBekleyenHikaye] = useState(null);
  const [hikayeKaydetYukleniyor, setHikayeKaydetYukleniyor] = useState(false);
  const [kayitliHikayeler, setKayitliHikayeler] = useState([]);
  const mesajSonuRef = useRef(null);

  const bg = karanlikMod ? "#111827" : "#f9fafb";
  const kartBg = karanlikMod ? "#1f2937" : "white";
  const yaziRenk = karanlikMod ? "#f3f4f6" : "#111827";
  const ikincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";
  const inputBg = karanlikMod ? "#374151" : "white";
  const borderRenk = karanlikMod ? "#374151" : "#e5e7eb";

  useEffect(() => { verileriGetir(); }, []);

  useEffect(() => {
    if (mesajSonuRef.current) mesajSonuRef.current.scrollIntoView({ behavior: "smooth" });
  }, [mesajlar]);

  const verileriGetir = async () => {
    const postSnapshot = await getDocs(collection(db, "posts"));
    const tumPosts = postSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    tumPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    setGonderiler(tumPosts);

    const userSnapshot = await getDocs(collection(db, "users"));
    const tumKullaniciler = {};
    const bekleyenListesi = [];
    userSnapshot.docs.forEach(d => {
      const data = { id: d.id, ...d.data() };
      tumKullaniciler[d.id] = data;
      if (data.role === "student" && data.onaylandi === false && !data.reddedildi) bekleyenListesi.push(data);
    });
    setKullaniciler(tumKullaniciler);
    setBekleyenler(bekleyenListesi);

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setBildirimler(tumReports.filter(r => r.adminaIletti === true && !r.adminSildi));

    // Hikayeleri getir + 2 aydan eski olanlari tamamen sil
    const hikayeSnapshot = await getDocs(collection(db, "hikayeler"));
    const ikiAyOnce = Date.now() - (60 * 24 * 60 * 60 * 1000);
    const aktifHikayeler = [];
    for (const d of hikayeSnapshot.docs) {
      const h = { firestoreId: d.id, ...d.data() };
      const hikayeZamani = (h.tarih?.seconds || 0) * 1000;
      if (hikayeZamani && hikayeZamani < ikiAyOnce) {
        // 2 aydan eski - tamamen sil
        await deleteDoc(doc(db, "hikayeler", d.id));
      } else {
        aktifHikayeler.push(h);
      }
    }
    aktifHikayeler.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    setKayitliHikayeler(aktifHikayeler);

    setYukleniyor(false);
  };

  // ===== AI ASISTAN =====
  const SISTEM_PROMPT = `Sen Zupii adlı Türk çocuk eğitim platformunun yönetici asistanısın. Admin ve öğretmenlere yardım edersin.

Yapabileceklerin:
- Çocuklar için hikaye/oyun içeriği üretmek
- Ödev, soru, etkinlik hazırlamak
- Duyuru, metin yazmak ve düzenlemek
- Genel sorulara yardımcı olmak

Dil Türkçe, sade ve samimi olsun. Çocuklara yönelik içerikte şiddet, korku, olumsuzluk olmasın.

ÖNEMLI - HIKAYE ÜRETIMI:
Kullanıcı OYUN/HIKAYE üretmeni isterse (örn "kedilerle ilgili hikaye üret"), cevabının SONUNA şu formatta özel bir blok ekle:

<<<HIKAYE_JSON>>>
{
  "baslik": "...",
  "seviye": "2. Sinif",
  "konu": "kediler",
  "sayfalar": [
    {"tip": "metin", "metin": "..."},
    {"tip": "soru", "soru": "...?", "secenekler": ["A", "B", "C"], "dogru": 0}
  ]
}
<<<HIKAYE_SON>>>

Kurallar: Sorular 3 şıklı olsun, "dogru" değeri 0/1/2. Kullanıcı sayfa sayısı ve soru aralığı belirtirse ona uy. Belirtmezse 12 sayfa, 3 soru yap. Hikaye JSON bloğundan önce kısa bir mesaj yaz ("İşte kedilerle ilgili hikaye hazır!" gibi).

Eğer kullanıcı hikaye/oyun ISTEMIYORSA (normal sohbet, soru, ödev metni vs.) bu bloğu HIC EKLEME, normal cevap ver.`;

  const asistanGonder = async () => {
    if (!girdi.trim() || asistanYukleniyor) return;
    if (!WORKER_URL) { alert("Worker URL bulunamadi! .env dosyasini kontrol edin."); return; }

    const yeniMesaj = { rol: "user", icerik: girdi };
    const guncelMesajlar = [...mesajlar, yeniMesaj];
    setMesajlar(guncelMesajlar);
    setGirdi("");
    setAsistanYukleniyor(true);
    setBekleyenHikaye(null);

    // Son 10 mesaji gonder (maliyet kontrolu)
    const sonMesajlar = guncelMesajlar.slice(-10).map(m => ({ role: m.rol, content: m.icerik }));

    try {
      const response = await fetch(WORKER_URL + "/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + await auth.currentUser.getIdToken()
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          system: SISTEM_PROMPT,
          messages: sonMesajlar
        })
      });

      const data = await response.json();
      let metin = data.content[0].text;

      // Hikaye JSON var mi kontrol et
      const hikayeMatch = metin.match(/<<<HIKAYE_JSON>>>([\s\S]*?)<<<HIKAYE_SON>>>/);
      if (hikayeMatch) {
        try {
          const hikaye = JSON.parse(hikayeMatch[1].trim());
          // Cevap siklarini karistir (Haiku hep B yapiyor)
          if (hikaye.sayfalar) {
            hikaye.sayfalar.forEach(s => {
              if (s.tip === "soru" && Array.isArray(s.secenekler) && typeof s.dogru === "number") {
                const dogruMetin = s.secenekler[s.dogru];
                // Fisher-Yates karistirma
                for (let k = s.secenekler.length - 1; k > 0; k--) {
                  const r = Math.floor(Math.random() * (k + 1));
                  [s.secenekler[k], s.secenekler[r]] = [s.secenekler[r], s.secenekler[k]];
                }
                s.dogru = s.secenekler.indexOf(dogruMetin);
              }
            });
          }
          setBekleyenHikaye(hikaye);
          metin = metin.replace(/<<<HIKAYE_JSON>>>[\s\S]*?<<<HIKAYE_SON>>>/, "").trim();
        } catch (e) {
          console.error("Hikaye JSON parse hatasi:", e);
        }
      }

      setMesajlar(prev => [...prev, { rol: "assistant", icerik: metin }]);
    } catch (err) {
      setMesajlar(prev => [...prev, { rol: "assistant", icerik: "❌ Hata: " + err.message }]);
    }
    setAsistanYukleniyor(false);
  };

  const hikayeKaydet = async () => {
    if (!bekleyenHikaye) return;
    setHikayeKaydetYukleniyor(true);
    try {
      const id = (bekleyenHikaye.baslik || "hikaye").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 30);
      const yeniDoc = await addDoc(collection(db, "hikayeler"), {
        ...bekleyenHikaye,
        id: id,
        olusturanUid: auth.currentUser.uid,
        tarih: serverTimestamp(),
        aktif: true
      });
      setKayitliHikayeler(prev => [{ firestoreId: yeniDoc.id, ...bekleyenHikaye, tarih: { seconds: Date.now() / 1000 } }, ...prev]);
      setBekleyenHikaye(null);
      setMesajlar(prev => [...prev, { rol: "assistant", icerik: "✅ Hikaye kaydedildi! Oyunlar bölümünde görünecek." }]);
    } catch (err) {
      alert("Kayıt hatası: " + err.message);
    }
    setHikayeKaydetYukleniyor(false);
  };

  const kayitliHikayeSil = async (firestoreId, baslik) => {
    if (!window.confirm(`"${baslik}" hikayesini tamamen silmek istediginizden emin misiniz?`)) return;
    try {
      await deleteDoc(doc(db, "hikayeler", firestoreId));
      setKayitliHikayeler(prev => prev.filter(h => h.firestoreId !== firestoreId));
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  };

  const hikayeKacGun = (tarih) => {
    if (!tarih?.seconds) return 0;
    return Math.floor((Date.now() - tarih.seconds * 1000) / (24 * 60 * 60 * 1000));
  };

  const sohbetTemizle = () => {
    if (mesajlar.length > 0 && !window.confirm("Sohbeti temizlemek istediginizden emin misiniz?")) return;
    setMesajlar([]);
    setBekleyenHikaye(null);
  };

  const handleSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      adminSildi: true, adminSildiTarihi: serverTimestamp(), adminSildiUid: auth.currentUser.uid
    });
    setGonderiler(prev => prev.map(g => g.id === gonderiId ? { ...g, adminSildi: true } : g));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    setYorumlar(prev => ({ ...prev, [postId]: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) }));
  };

  const yorumToggle = async (postId) => {
    const acik = !acikYorumlar[postId];
    setAcikYorumlar(prev => ({ ...prev, [postId]: acik }));
    if (acik && !yorumlar[postId]) await yorumlariGetir(postId);
  };

  const yorumSil = async (postId, yorumId) => {
    if (!window.confirm("Bu yorumu kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", postId, "comments", yorumId), {
      silindi: true, silinmeTarihi: serverTimestamp(), silenUid: auth.currentUser.uid, silenRol: "admin"
    });
    setYorumlar(prev => ({
      ...prev,
      [postId]: prev[postId].map(y => y.id === yorumId ? { ...y, silindi: true, silenRol: "admin" } : y)
    }));
  };

  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), { okundu: true });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, okundu: true } : b));
  };

  const bildirimKaldir = async (reportId) => {
    if (!window.confirm("Bu bildirimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      adminSildi: true, adminSildiTarihi: serverTimestamp(), adminSildiUid: auth.currentUser.uid
    });
    setBildirimler(prev => prev.filter(b => b.id !== reportId));
  };

  const bildirimPostGoster = async (reportId, postId) => {
    const zatenAcik = acikBildirimPost[reportId];
    setAcikBildirimPost(prev => ({ ...prev, [reportId]: !zatenAcik }));
    if (!zatenAcik && !postDetay[postId]) {
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (postDoc.exists()) setPostDetay(prev => ({ ...prev, [postId]: { id: postDoc.id, ...postDoc.data() } }));
    }
  };

  const kullaniciOnayla = async (kullaniciId) => {
    await updateDoc(doc(db, "users", kullaniciId), { onaylandi: true });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    setKullaniciler(prev => ({ ...prev, [kullaniciId]: { ...prev[kullaniciId], onaylandi: true } }));
    alert("Kullanici onaylandi!");
  };

  const ogretmenOlarakOnayla = async (kullaniciId) => {
    if (!window.confirm("Ogretmen olarak onaylamak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", kullaniciId), { onaylandi: true, role: "teacher" });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    setKullaniciler(prev => ({ ...prev, [kullaniciId]: { ...prev[kullaniciId], onaylandi: true, role: "teacher" } }));
    alert("Ogretmen olarak onaylandi!");
  };

  const veliOlarakOnayla = async (kullaniciId) => {
    if (!window.confirm("Veli olarak onaylamak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", kullaniciId), { onaylandi: true, role: "parent" });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    setKullaniciler(prev => ({ ...prev, [kullaniciId]: { ...prev[kullaniciId], onaylandi: true, role: "parent" } }));
    alert("Veli olarak onaylandi!");
  };

  const kullaniciReddet = async (kullaniciId) => {
    if (!window.confirm("Bu kayit talebini reddetmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", kullaniciId), { reddedildi: true, reddedildiTarihi: serverTimestamp() });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    alert("Kayit reddedildi!");
  };

  const kullaniciYonetimAc = (k) => {
    setSecilenKullanici(k);
    setYonetimAcik(true);
    setSecilenOgrenciler(k.role === "teacher" ? (k.sinif || []) : []);
    setSecilenCocuk(k.role === "parent" ? ((k.cocuklar || [])[0] || "") : "");
    setAramaMetni("");
    setSinifAramaMetni("");
    setCocukAramaMetni("");
  };

  const rolDegistir = async (yeniRol) => {
    if (!secilenKullanici) return;
    if (!window.confirm(secilenKullanici.isim + " kullanicisinin rolunu " + yeniRol + " yapmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", secilenKullanici.id), { role: yeniRol });
    const guncellenmis = { ...secilenKullanici, role: yeniRol };
    setSecilenKullanici(guncellenmis);
    setKullaniciler(prev => ({ ...prev, [secilenKullanici.id]: guncellenmis }));
    if (yeniRol === "teacher") setSecilenOgrenciler(guncellenmis.sinif || []);
    if (yeniRol === "parent") setSecilenCocuk((guncellenmis.cocuklar || [])[0] || "");
    alert("Rol guncellendi!");
  };

  const ogrenciToggle = (uid) => {
    setSecilenOgrenciler(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  const sinifKaydet = async () => {
    if (!secilenKullanici) return;
    setKaydetYukleniyor(true);
    await updateDoc(doc(db, "users", secilenKullanici.id), { sinif: secilenOgrenciler });
    const eskiSinif = secilenKullanici.sinif || [];
    for (const uid of eskiSinif) {
      if (!secilenOgrenciler.includes(uid)) await updateDoc(doc(db, "users", uid), { ogretmenUid: null, ogretmenIsim: null });
    }
    for (const uid of secilenOgrenciler) {
      await updateDoc(doc(db, "users", uid), { ogretmenUid: secilenKullanici.id, ogretmenIsim: secilenKullanici.isim });
    }
    const guncellenmis = { ...secilenKullanici, sinif: secilenOgrenciler };
    setSecilenKullanici(guncellenmis);
    setKullaniciler(prev => ({ ...prev, [secilenKullanici.id]: guncellenmis }));
    setKaydetYukleniyor(false);
    alert("Sinif kaydedildi!");
  };

  const cocukKaydet = async () => {
    if (!secilenKullanici || !secilenCocuk) return;
    setKaydetYukleniyor(true);
    await updateDoc(doc(db, "users", secilenKullanici.id), { cocuklar: [secilenCocuk] });
    const guncellenmis = { ...secilenKullanici, cocuklar: [secilenCocuk] };
    setSecilenKullanici(guncellenmis);
    setKullaniciler(prev => ({ ...prev, [secilenKullanici.id]: guncellenmis }));
    setKaydetYukleniyor(false);
    alert("Cocuk atamasi kaydedildi!");
  };

  const rolRenk = (rol) => {
    if (rol === "admin") return { bg: "#fee2e2", text: "#991b1b" };
    if (rol === "teacher") return { bg: "#e0e7ff", text: "#3730a3" };
    if (rol === "parent") return { bg: "#d1fae5", text: "#065f46" };
    return { bg: "#f3f4f6", text: "#374151" };
  };

  const tarihFormat = (seconds) => {
    const d = new Date(seconds * 1000);
    return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const aramaSonuclari = aramaMetni.trim()
    ? Object.values(kullaniciler).filter(k => {
        const arama = aramaMetni.toLowerCase();
        return (k.isim || "").toLowerCase().includes(arama) || (k.email || "").toLowerCase().includes(arama);
      })
    : [];

  const filtrelenmisGonderiler = gonderiArama.trim()
    ? gonderiler.filter(g =>
        (g.icerik || "").toLowerCase().includes(gonderiArama.toLowerCase()) ||
        (g.yazar || "").toLowerCase().includes(gonderiArama.toLowerCase()))
    : gonderiler;

  const onayliOgrenciler = Object.values(kullaniciler).filter(k => k.role === "student" && k.onaylandi === true);
  const filtrelenmisOgrenciler = sinifAramaMetni.trim()
    ? onayliOgrenciler.filter(o => (o.isim || "").toLowerCase().includes(sinifAramaMetni.toLowerCase()))
    : onayliOgrenciler;
  const filtrelenmisCocuklar = cocukAramaMetni.trim()
    ? onayliOgrenciler.filter(o => (o.isim || "").toLowerCase().includes(cocukAramaMetni.toLowerCase()))
    : onayliOgrenciler;

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.okundu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.okundu).length;

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.2s" }}>
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => setSecilenProfil(null)} mevcutKullaniciRol="admin" />
      )}

      {yonetimAcik && secilenKullanici && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: kartBg, color: yaziRenk, borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "500px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: yaziRenk }}>👤 {secilenKullanici.isim}</h3>
              <button onClick={() => setYonetimAcik(false)} style={{ background: "#e5e7eb", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer" }}>Kapat</button>
            </div>
            <p style={{ fontSize: "13px", color: ikincilYazi, margin: "0 0 4px" }}>📧 {secilenKullanici.email}</p>
            {secilenKullanici.okul && <p style={{ fontSize: "13px", color: ikincilYazi, margin: "0 0 16px" }}>🏫 {secilenKullanici.okul}</p>}

            <div style={{ background: karanlikMod ? "#374151" : "#f9fafb", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 10px", color: yaziRenk }}>
                Mevcut rol:{" "}
                <span style={{ background: rolRenk(secilenKullanici.role).bg, color: rolRenk(secilenKullanici.role).text, padding: "2px 8px", borderRadius: "6px", fontSize: "12px" }}>
                  {secilenKullanici.role}
                </span>
              </p>
              <p style={{ fontSize: "12px", color: ikincilYazi, margin: "0 0 8px" }}>Rol degistir:</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["student", "teacher", "parent", "admin"].map(rol => (
                  <button key={rol} onClick={() => rolDegistir(rol)} disabled={secilenKullanici.role === rol}
                    style={{ padding: "6px 12px", border: "none", borderRadius: "6px", cursor: secilenKullanici.role === rol ? "default" : "pointer", background: secilenKullanici.role === rol ? rolRenk(rol).bg : "#e5e7eb", color: secilenKullanici.role === rol ? rolRenk(rol).text : "#374151", fontSize: "12px", fontWeight: "600" }}>
                    {rol === "student" ? "Ogrenci" : rol === "teacher" ? "Ogretmen" : rol === "parent" ? "Veli" : "Admin"}
                    {secilenKullanici.role === rol && " ✓"}
                  </button>
                ))}
              </div>
            </div>

            {secilenKullanici.role === "teacher" && (
              <div style={{ background: karanlikMod ? "#374151" : "#f9fafb", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 10px", color: yaziRenk }}>
                  📚 Sinif Atamalari ({secilenOgrenciler.length} ogrenci secildi)
                </p>
                {onayliOgrenciler.length === 0 ? (
                  <p style={{ fontSize: "12px", color: ikincilYazi }}>Onaylanmis ogrenci yok.</p>
                ) : (
                  <>
                    <input type="text" placeholder="🔍 Ogrenci ara..." value={sinifAramaMetni}
                      onChange={e => setSinifAramaMetni(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "13px", boxSizing: "border-box", marginBottom: "8px", background: inputBg, color: yaziRenk }} />
                    <div style={{ maxHeight: "220px", overflowY: "auto", marginBottom: "10px" }}>
                      {filtrelenmisOgrenciler.map(o => (
                        <div key={o.id} onClick={() => ogrenciToggle(o.id)}
                          style={{ padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", background: secilenOgrenciler.includes(o.id) ? "#e0e7ff" : (karanlikMod ? "#1f2937" : "white"), border: secilenOgrenciler.includes(o.id) ? "1px solid #4f46e5" : "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: secilenOgrenciler.includes(o.id) ? "#4f46e5" : yaziRenk }}>{o.isim}</p>
                            {o.sinif && <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>📚 {o.sinif}</p>}
                            {o.okul && <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>🏫 {o.okul}</p>}
                          </div>
                          {secilenOgrenciler.includes(o.id) && <span style={{ color: "#4f46e5", fontWeight: "700" }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <button onClick={sinifKaydet} disabled={kaydetYukleniyor}
                      style={{ width: "100%", padding: "10px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                      {kaydetYukleniyor ? "Kaydediliyor..." : "💾 Sinifi Kaydet"}
                    </button>
                  </>
                )}
              </div>
            )}

            {secilenKullanici.role === "parent" && (
              <div style={{ background: karanlikMod ? "#374151" : "#f9fafb", borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", fontWeight: "600", margin: "0 0 10px", color: yaziRenk }}>👶 Cocuk Atamasi</p>
                {onayliOgrenciler.length === 0 ? (
                  <p style={{ fontSize: "12px", color: ikincilYazi }}>Onaylanmis ogrenci yok.</p>
                ) : (
                  <>
                    <input type="text" placeholder="🔍 Ogrenci ara..." value={cocukAramaMetni}
                      onChange={e => setCocukAramaMetni(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "13px", boxSizing: "border-box", marginBottom: "8px", background: inputBg, color: yaziRenk }} />
                    <div style={{ maxHeight: "220px", overflowY: "auto", marginBottom: "10px" }}>
                      {filtrelenmisCocuklar.map(o => (
                        <div key={o.id} onClick={() => setSecilenCocuk(o.id)}
                          style={{ padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", background: secilenCocuk === o.id ? "#d1fae5" : (karanlikMod ? "#1f2937" : "white"), border: secilenCocuk === o.id ? "1px solid #10b981" : "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: secilenCocuk === o.id ? "#065f46" : yaziRenk }}>{o.isim}</p>
                            {o.sinif && <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>📚 {o.sinif}</p>}
                            {o.okul && <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>🏫 {o.okul}</p>}
                          </div>
                          {secilenCocuk === o.id && <span style={{ color: "#10b981", fontWeight: "700" }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <button onClick={cocukKaydet} disabled={kaydetYukleniyor || !secilenCocuk}
                      style={{ width: "100%", padding: "10px", background: secilenCocuk ? "#10b981" : "#9ca3af", color: "white", border: "none", borderRadius: "8px", cursor: secilenCocuk ? "pointer" : "default", fontWeight: "600", fontSize: "13px" }}>
                      {kaydetYukleniyor ? "Kaydediliyor..." : "💾 Cocugu Kaydet"}
                    </button>
                  </>
                )}
              </div>
            )}

            <button onClick={() => { setYonetimAcik(false); setSecilenProfil(secilenKullanici.id); }}
              style={{ width: "100%", padding: "10px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
              👤 Profili Goruntule
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ color: "#4f46e5", margin: 0 }}>Admin Paneli</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>☀️</span>
            <div onClick={() => { const yeni = !karanlikMod; setKaranlikMod(yeni); localStorage.setItem("adminKaranlikMod", yeni); }}
              style={{ width: "36px", height: "20px", borderRadius: "10px", background: karanlikMod ? "#4f46e5" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: karanlikMod ? "18px" : "2px", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>🌙</span>
          </div>
          <button onClick={() => signOut(auth)} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cikis</button>
        </div>
      </div>

      <div style={{ background: kartBg, padding: "12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "16px" }}>
        <input type="text" placeholder="🔍 Kullanici ara - tikla, rol/sinif ata..."
          value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "14px", boxSizing: "border-box", background: inputBg, color: yaziRenk }} />
        {aramaMetni.trim() && (
          <div style={{ marginTop: "10px" }}>
            <p style={{ fontSize: "12px", color: ikincilYazi, margin: "0 0 8px" }}>{aramaSonuclari.length} sonuc — tikla yonet</p>
            {aramaSonuclari.slice(0, 10).map(k => (
              <div key={k.id} onClick={() => kullaniciYonetimAc(k)}
                style={{ padding: "8px 10px", background: karanlikMod ? "#374151" : "#f9fafb", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: "0", fontSize: "13px", fontWeight: "600", color: yaziRenk }}>{k.isim || "Isimsiz"}</p>
                  <p style={{ margin: "0", fontSize: "11px", color: ikincilYazi }}>{k.email}</p>
                </div>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <span style={{ padding: "2px 6px", background: rolRenk(k.role).bg, color: rolRenk(k.role).text, borderRadius: "4px", fontSize: "10px", fontWeight: "600" }}>{k.role}</span>
                  {k.dondurulmus && <span style={{ padding: "2px 6px", background: "#fee2e2", color: "#ef4444", borderRadius: "4px", fontSize: "10px" }}>🔒</span>}
                  <span style={{ fontSize: "11px", color: ikincilYazi }}>→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          ["etkilesimler", "💬 Paylasimlar", 0],
          ["bildirimler", "🚩 Bildirimler", yeniBildirimSayisi],
          ["bekleyenler", "⏳ Onaylar", bekleyenler.length],
          ["asistan", "🤖 Asistan", 0]
        ].map(([key, label, badge]) => (
          <button key={key} onClick={() => setAktifSekme(key)}
            style={{ flex: "1 1 22%", padding: "10px", background: aktifSekme === key ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === key ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px", position: "relative" }}>
            {label}
            {badge > 0 && (
              <span style={{ position: "absolute", top: "-6px", right: "-6px", background: key === "bildirimler" && acilBildirimSayisi > 0 ? "#ef4444" : key === "bildirimler" ? "#f59e0b" : "#10b981", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {yukleniyor ? <p style={{ color: yaziRenk }}>Yukleniyor...</p> : aktifSekme === "asistan" ? (
        <div>
          <div style={{ background: kartBg, borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden", display: "flex", flexDirection: "column", height: "500px" }}>
            {/* Baslik */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${borderRenk}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", color: yaziRenk }}>🤖 AI Asistan</h3>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: ikincilYazi }}>Hikaye, ödev, içerik üret · Sadece yönetim için</p>
              </div>
              {mesajlar.length > 0 && (
                <button onClick={sohbetTemizle}
                  style={{ padding: "6px 12px", background: karanlikMod ? "#374151" : "#f3f4f6", color: ikincilYazi, border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                  🗑️ Temizle
                </button>
              )}
            </div>

            {/* Mesajlar */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {mesajlar.length === 0 && (
                <div style={{ textAlign: "center", padding: "30px 20px", color: ikincilYazi }}>
                  <div style={{ fontSize: "40px", marginBottom: "12px" }}>💬</div>
                  <p style={{ fontSize: "14px", margin: "0 0 16px" }}>Merhaba! Sana nasıl yardımcı olabilirim?</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "400px", margin: "0 auto" }}>
                    {[
                      "Kedilerle ilgili 12 sayfa hikaye üret, her 4 sayfada bir soru olsun",
                      "3. sınıf için çıkarma işlemi ödevi hazırla",
                      "Okul gezisi için veli duyurusu yaz"
                    ].map((ornek, i) => (
                      <button key={i} onClick={() => setGirdi(ornek)}
                        style={{ padding: "10px 14px", background: karanlikMod ? "#374151" : "#f9fafb", border: `1px solid ${borderRenk}`, borderRadius: "10px", color: yaziRenk, fontSize: "13px", cursor: "pointer", textAlign: "left" }}>
                        💡 {ornek}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mesajlar.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.rol === "user" ? "flex-end" : "flex-start", marginBottom: "12px" }}>
                  <div style={{
                    maxWidth: "80%", padding: "10px 14px", borderRadius: "14px",
                    background: m.rol === "user" ? "linear-gradient(135deg, #4f46e5, #7c3aed)" : (karanlikMod ? "#374151" : "#f3f4f6"),
                    color: m.rol === "user" ? "white" : yaziRenk,
                    fontSize: "14px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word"
                  }}>
                    {m.icerik}
                  </div>
                </div>
              ))}

              {asistanYukleniyor && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "12px" }}>
                  <div style={{ padding: "10px 14px", borderRadius: "14px", background: karanlikMod ? "#374151" : "#f3f4f6", color: ikincilYazi, fontSize: "14px" }}>
                    ⏳ Yazıyor...
                  </div>
                </div>
              )}

              {/* Bekleyen hikaye kaydet karti */}
              {bekleyenHikaye && (
                <div style={{ background: karanlikMod ? "#1e3a5f" : "#eff6ff", border: "2px solid #4f46e5", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "600", color: "#4f46e5" }}>📖 {bekleyenHikaye.baslik}</p>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", color: ikincilYazi }}>
                    {bekleyenHikaye.seviye || ""} · {bekleyenHikaye.sayfalar?.length} sayfa · {bekleyenHikaye.sayfalar?.filter(s => s.tip === "soru").length} soru
                  </p>
                  <div style={{ maxHeight: "280px", overflowY: "auto", marginBottom: "12px", background: karanlikMod ? "#0f1f33" : "white", borderRadius: "8px", padding: "10px" }}>
                    {bekleyenHikaye.sayfalar?.map((s, i) => (
                      <div key={i} style={{ padding: "8px 0", borderBottom: i < bekleyenHikaye.sayfalar.length - 1 ? `1px solid ${borderRenk}` : "none" }}>
                        <span style={{ fontSize: "10px", color: s.tip === "soru" ? "#f59e0b" : ikincilYazi, fontWeight: "600", letterSpacing: "1px" }}>
                          {s.tip === "soru" ? "⭐ SORU" : `SAYFA ${i + 1}`}
                        </span>
                        <p style={{ margin: "4px 0 0", fontSize: "13px", color: yaziRenk, lineHeight: 1.5 }}>
                          {s.tip === "soru" ? s.soru : s.metin}
                        </p>
                        {s.tip === "soru" && s.secenekler && (
                          <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                            {s.secenekler.map((sec, j) => (
                              <span key={j} style={{ fontSize: "12px", color: j === s.dogru ? "#10b981" : ikincilYazi, fontWeight: j === s.dogru ? "600" : "normal" }}>
                                {String.fromCharCode(65 + j)}) {sec} {j === s.dogru ? "✓" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={hikayeKaydet} disabled={hikayeKaydetYukleniyor}
                      style={{ flex: 1, padding: "10px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                      {hikayeKaydetYukleniyor ? "Kaydediliyor..." : "✅ Oyunlara Ekle"}
                    </button>
                    <button onClick={() => setBekleyenHikaye(null)}
                      style={{ padding: "10px 16px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                      İptal
                    </button>
                  </div>
                </div>
              )}

              <div ref={mesajSonuRef} />
            </div>

            {/* Girdi */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${borderRenk}`, display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <textarea value={girdi} onChange={e => setGirdi(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); asistanGonder(); } }}
                placeholder="Mesajını yaz... (Enter ile gönder)"
                rows={1}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: `1px solid ${borderRenk}`, fontSize: "14px", resize: "none", maxHeight: "120px", background: inputBg, color: yaziRenk, fontFamily: "inherit", boxSizing: "border-box" }} />
              <button onClick={asistanGonder} disabled={asistanYukleniyor || !girdi.trim()}
                style={{ padding: "10px 18px", background: (asistanYukleniyor || !girdi.trim()) ? "#9ca3af" : "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "white", border: "none", borderRadius: "10px", cursor: (asistanYukleniyor || !girdi.trim()) ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "14px", whiteSpace: "nowrap" }}>
                Gönder
              </button>
            </div>
          </div>

          {/* Kayitli Hikayeler Listesi */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: ikincilYazi, marginBottom: "12px", fontSize: "15px" }}>
              📚 Kayıtlı Hikayeler ({kayitliHikayeler.length})
            </h3>
            <p style={{ fontSize: "12px", color: ikincilYazi, margin: "0 0 12px" }}>
              💡 Hikayeler 7 gün sonra öğrencilerden gizlenir, 2 ay sonra otomatik silinir. Sorunlu hikayeyi hemen silebilirsin.
            </p>
            {kayitliHikayeler.length === 0 ? (
              <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}>
                <p>Henüz kayıtlı hikaye yok.</p>
              </div>
            ) : (
              kayitliHikayeler.map((h) => {
                const gun = hikayeKacGun(h.tarih);
                const gizli = gun >= 7;
                return (
                  <div key={h.firestoreId} style={{ background: kartBg, padding: "14px 16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: gizli ? 0.6 : 1 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "600", color: yaziRenk }}>
                        {h.baslik}
                        {gizli && <span style={{ marginLeft: "8px", fontSize: "10px", background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px" }}>GİZLİ</span>}
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>
                        {h.seviye || ""} · {h.sayfalar?.length} sayfa · {gun} gün önce
                      </p>
                    </div>
                    <button onClick={() => kayitliHikayeSil(h.firestoreId, h.baslik)}
                      style={{ padding: "6px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                      🗑️ Sil
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : aktifSekme === "bekleyenler" ? (
        <div>
          {bekleyenler.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}><p>Onay bekleyen kullanici yok.</p></div>
          ) : (
            <>
              <h3 style={{ color: ikincilYazi, marginBottom: "16px" }}>Onay Bekleyen Kullanicilar ({bekleyenler.length})</h3>
              {bekleyenler.map(k => (
                <div key={k.id} style={{ background: kartBg, padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "600", color: yaziRenk }}>{k.isim}</p>
                  <p style={{ margin: "0 0 4px", fontSize: "13px", color: ikincilYazi }}>📧 {k.email}</p>
                  {k.sinif && <p style={{ margin: "0 0 4px", fontSize: "13px", color: ikincilYazi }}>📚 {k.sinif}</p>}
                  {k.okul && <p style={{ margin: "0 0 12px", fontSize: "13px", color: ikincilYazi }}>🏫 {k.okul}</p>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => kullaniciOnayla(k.id)} style={{ flex: 1, padding: "8px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>✓ Ogrenci</button>
                    <button onClick={() => ogretmenOlarakOnayla(k.id)} style={{ flex: 1, padding: "8px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>👩‍🏫 Ogretmen</button>
                    <button onClick={() => veliOlarakOnayla(k.id)} style={{ flex: 1, padding: "8px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>👨‍👩‍👧 Veli</button>
                    <button onClick={() => kullaniciReddet(k.id)} style={{ flex: 1, padding: "8px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>✗ Reddet</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : aktifSekme === "bildirimler" ? (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}>
              <p>Hic bildirim yok.</p>
              <p style={{ fontSize: "12px", marginTop: "8px", color: ikincilYazi }}>Sadece veli veya ogretmen tarafindan iletilen bildirimler burada gorunur.</p>
            </div>
          ) : (
            <>
              <h3 style={{ color: ikincilYazi, marginBottom: "16px" }}>Iletilen Bildirimler ({bildirimler.length})</h3>
              {bildirimler.map(b => (
                <div key={b.id} style={{ background: kartBg, padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px", border: b.acil && !b.okundu ? "2px solid #ef4444" : `1px solid ${borderRenk}` }}>
                  {b.acil && !b.okundu && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", marginBottom: "8px", fontWeight: "700" }}>🚨 ACIL: Cocuk yardim istiyor!</div>}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {!b.okundu && <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>YENI</span>}
                  </div>
                  {b.ileten && <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#4f46e5", fontWeight: "600" }}>📨 Ileten: {b.ileten} ({b.iletenRol === "teacher" ? "Ogretmen" : "Veli"})</p>}
                  <p style={{ margin: "0 0 6px", fontSize: "13px", color: ikincilYazi }}>📋 Sebep: <strong>{b.kategori}</strong>{b.digerSebep && <span> — "{b.digerSebep}"</span>}</p>
                  <p style={{ margin: "0 0 8px", fontSize: "13px", color: ikincilYazi }}>💙 Bildiren durumu: {b.iyiMisin === "iyi" ? "😊 Iyi" : b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" : b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"}</p>
                  <div style={{ background: karanlikMod ? "#374151" : "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "8px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "14px", color: yaziRenk }}>{b.icerikMetni || "—"}</p>
                    {b.fotoUrl && <MedyaGoster url={b.fotoUrl} />}
                    <small style={{ color: ikincilYazi }}>Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.yazar}</span></small>
                  </div>
                  {b.postId && (
                    <button onClick={() => bildirimPostGoster(b.id, b.postId)}
                      style={{ fontSize: "12px", color: "#4f46e5", background: "none", border: "none", cursor: "pointer", padding: "0", marginBottom: "8px" }}>
                      {acikBildirimPost[b.id] ? "▲ Paylasim detayini gizle" : "▼ Paylasim tarihini goster"}
                    </button>
                  )}
                  {acikBildirimPost[b.id] && postDetay[b.postId] && (
                    <div style={{ background: karanlikMod ? "#4b5563" : "#ede9fe", padding: "10px", borderRadius: "8px", marginBottom: "8px", fontSize: "13px" }}>
                      {postDetay[b.postId].tarih && (
                        <p style={{ margin: "0", color: ikincilYazi }}>📅 Paylasim tarihi: <strong>{tarihFormat(postDetay[b.postId].tarih.seconds)}</strong></p>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: "12px", color: ikincilYazi, margin: "0 0 8px" }}>🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.bildiren}</span></p>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {!b.okundu && <button onClick={() => bildirimOkundu(b.id)} style={{ flex: 1, padding: "6px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>✓ Okundu</button>}
                    <button onClick={() => bildirimKaldir(b.id)} style={{ padding: "6px 12px", background: "#6b7280", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>🗑️ Kaldir</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: "12px" }}>
            <input type="text" placeholder="🔍 Gonderi veya yazar ara..." value={gonderiArama} onChange={e => setGonderiArama(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "14px", boxSizing: "border-box", background: inputBg, color: yaziRenk }} />
          </div>
          {filtrelenmisGonderiler.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}><p>Hic paylasim yok.</p></div>
          ) : (
            <>
              <h3 style={{ color: ikincilYazi, marginBottom: "16px" }}>Tum Paylasimlar ({filtrelenmisGonderiler.length})</h3>
              {filtrelenmisGonderiler.map(g => {
                const yazarKullanici = kullaniciler[g.yazarUid];
                const begenenler = g.begenenler || [];
                const kaldirildi = g.ogrenciSildi || g.veliKaldirdi || g.ogretmenKaldirdi || g.adminSildi;
                return (
                  <div key={g.id} style={{ background: kartBg, padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px", opacity: kaldirildi ? 0.75 : 1, border: kaldirildi ? `1px solid ${borderRenk}` : "none" }}>
                    {kaldirildi && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                        {g.ogrenciSildi && <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Ogrenci sildi</span>}
                        {g.veliKaldirdi && <span style={{ background: "#ede9fe", color: "#5b21b6", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Veli kaldirdi</span>}
                        {g.ogretmenKaldirdi && <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Ogretmen kaldirdi</span>}
                        {g.adminSildi && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Admin kaldirdi</span>}
                      </div>
                    )}
                    <p style={{ margin: "0 0 8px 0", fontSize: "15px", color: yaziRenk }}>{g.icerik}</p>
                    {!kaldirildi && g.fotoUrl && <MedyaGoster url={g.fotoUrl} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <small onClick={() => setSecilenProfil(g.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}>{g.yazar}</small>
                        {g.tarih && <small style={{ color: ikincilYazi, fontSize: "11px" }}>{tarihFormat(g.tarih.seconds)}</small>}
                        {yazarKullanici?.dondurulmus && <span style={{ background: "#fee2e2", color: "#ef4444", padding: "2px 6px", borderRadius: "8px", fontSize: "11px" }}>🔒 Dondurulmus</span>}
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#ef4444", borderRadius: "6px", fontSize: "12px" }}>❤️ {begenenler.length}</span>
                        <button onClick={() => yorumToggle(g.id)} style={{ padding: "4px 10px", background: "#e0e7ff", color: "#4f46e5", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                          💬 {yorumlar[g.id] ? yorumlar[g.id].length : ""} Yorum
                        </button>
                        {!g.adminSildi && <button onClick={() => handleSil(g.id)} style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>🗑️ Kaldir</button>}
                      </div>
                    </div>
                    {acikYorumlar[g.id] && (
                      <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${borderRenk}` }}>
                        {yorumlar[g.id] && yorumlar[g.id].length === 0 && <p style={{ color: ikincilYazi, fontSize: "13px", textAlign: "center" }}>Hic yorum yok.</p>}
                        {yorumlar[g.id] && yorumlar[g.id].map(y => (
                          <div key={y.id} style={{ background: karanlikMod ? "#374151" : "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "6px", position: "relative", opacity: y.silindi ? 0.6 : 1 }}>
                            {y.silindi && <span style={{ fontSize: "11px", color: ikincilYazi, display: "block", marginBottom: "4px" }}>[{y.silenRol === "admin" ? "Admin kaldirdi" : y.silenRol === "teacher" ? "Ogretmen kaldirdi" : y.silenRol === "parent" ? "Veli kaldirdi" : "Ogrenci sildi"}]</span>}
                            <p style={{ margin: "0 0 4px", fontSize: "14px", color: yaziRenk }}>{y.icerik}</p>
                            <small onClick={() => setSecilenProfil(y.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline", fontSize: "12px" }}>{y.yazar}</small>
                            {!y.silindi && <button onClick={() => yorumSil(g.id, y.id)} style={{ position: "absolute", top: "8px", right: "8px", padding: "2px 8px", background: "#ef4444", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "11px" }}>Kaldir</button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

export default AdminDashboard;