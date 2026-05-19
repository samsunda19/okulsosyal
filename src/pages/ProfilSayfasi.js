import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";

const ARKAPLANLAR = [
  { id: "varsayilan", isim: "Balonlu Cocuklar", deger: "url(/background2.png)", tip: "resim" },
  { id: "gokkusagi", isim: "Gokkusagi", deger: "linear-gradient(135deg, #ff6b9d, #feca57, #48dbfb, #1dd1a1)", tip: "gradient" },
  { id: "uzay", isim: "Uzay", deger: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", tip: "gradient" },
  { id: "okyanus", isim: "Okyanus", deger: "linear-gradient(135deg, #2193b0, #6dd5ed)", tip: "gradient" },
  { id: "gunbatimi", isim: "Gun Batimi", deger: "linear-gradient(135deg, #fa709a, #fee140)", tip: "gradient" },
  { id: "orman", isim: "Orman", deger: "linear-gradient(135deg, #134e5e, #71b280)", tip: "gradient" },
  { id: "pastel", isim: "Pastel", deger: "linear-gradient(135deg, #ffecd2, #fcb69f)", tip: "gradient" },
  { id: "morpembe", isim: "Mor Pembe", deger: "linear-gradient(135deg, #667eea, #764ba2)", tip: "gradient" },
  { id: "neon", isim: "Neon", deger: "linear-gradient(135deg, #00c9ff, #92fe9d)", tip: "gradient" },
  { id: "atesli", isim: "Atesli", deger: "linear-gradient(135deg, #ff512f, #f09819)", tip: "gradient" },
  { id: "lavanta", isim: "Lavanta", deger: "linear-gradient(135deg, #c471f5, #fa71cd)", tip: "gradient" },
  { id: "kiraz", isim: "Kiraz", deger: "linear-gradient(135deg, #eb3349, #f45c43)", tip: "gradient" },
  { id: "gece", isim: "Gece Mavisi", deger: "linear-gradient(135deg, #141e30, #243b55)", tip: "gradient" },
  { id: "ananas", isim: "Ananas", deger: "linear-gradient(135deg, #f7971e, #ffd200)", tip: "gradient" },
  { id: "buz", isim: "Buz", deger: "linear-gradient(135deg, #74ebd5, #acb6e5)", tip: "gradient" }
];

const AVATAR_RENKLERI = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #30cfd0, #330867)",
  "linear-gradient(135deg, #a8edea, #fed6e3)",
  "linear-gradient(135deg, #ff9a9e, #fecfef)"
];

function getAvatarRenk(isim) {
  if (!isim) return AVATAR_RENKLERI[0];
  const harf = isim.charCodeAt(0) || 0;
  return AVATAR_RENKLERI[harf % AVATAR_RENKLERI.length];
}

function getBasHarfler(isim) {
  if (!isim) return "?";
  const parcalar = isim.trim().split(" ");
  if (parcalar.length >= 2) {
    return (parcalar[0][0] + parcalar[1][0]).toUpperCase();
  }
  return parcalar[0][0].toUpperCase();
}

function ProfilSayfasi({ kullaniciId, onKapat, mevcutKullaniciRol }) {
  const [profil, setProfil] = useState(null);
  const [benimProfilim2, setBenimProfilim2] = useState(null);
  const [profilFoto, setProfilFoto] = useState(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);
  const [gonderiler, setGonderiler] = useState([]);
  const [engellenenlerListesi, setEngellenenlerListesi] = useState([]);
  const [istatistik, setIstatistik] = useState({ paylasim: 0, yorum: 0, begeni: 0 });
  const [duzenliyor, setDuzenliyor] = useState(false);
  const [temaPaneli, setTemaPaneli] = useState(false);
  const [engelPaneli, setEngelPaneli] = useState(false);
  const [isim, setIsim] = useState("");
  const [sinif, setSinif] = useState("");
  const [okul, setOkul] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dondurmModal, setDondurmModal] = useState(false);
  const [dondurmeSuresi, setDondurmeSuresi] = useState("");
  const [ozelArkaplan, setOzelArkaplan] = useState(null);
  const [duzenlenenPostId, setDuzenlenenPostId] = useState(null);
  const [duzenlenenMetin, setDuzenlenenMetin] = useState("");
  const benimProfilim = kullaniciId === auth.currentUser.uid;
  const yetkili = ["admin", "teacher", "parent"].includes(mevcutKullaniciRol);
  const ogrenciyim = mevcutKullaniciRol === "student";

  useEffect(() => {
    const getir = async () => {
      const userDoc = await getDoc(doc(db, "users", kullaniciId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfil(data);
        if (data.profilFotoUrl) setProfilFoto(data.profilFotoUrl);
        setIsim(data.isim || "");
        setSinif(data.sinif || "");
        setOkul(data.okul || "");
      }

      if (!benimProfilim) {
        const benDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (benDoc.exists()) {
          setBenimProfilim2(benDoc.data());
        }
      } else {
        const benDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (benDoc.exists()) {
          const benimData = benDoc.data();
          setBenimProfilim2(benimData);
          const engelUidleri = benimData.engellenenler || [];
          if (engelUidleri.length > 0) {
            const engelKisiler = [];
            for (const uid of engelUidleri) {
              const eDoc = await getDoc(doc(db, "users", uid));
              if (eDoc.exists()) {
                engelKisiler.push({ id: uid, ...eDoc.data() });
              }
            }
            setEngellenenlerListesi(engelKisiler);
          }
        }
      }

      const postSnapshot = await getDocs(collection(db, "posts"));
      const tumPosts = postSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const kullaniciPosts = tumPosts
        .filter(p => p.yazarUid === kullaniciId)
        .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setGonderiler(kullaniciPosts);

      let yorumSayisi = 0;
      let begeniSayisi = 0;
      for (const post of tumPosts) {
        const yorumSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));
        for (const d of yorumSnapshot.docs) {
          if (d.data().yazarUid === kullaniciId && !d.data().silindi) yorumSayisi++;
        }
        if (post.yazarUid === kullaniciId) {
          begeniSayisi += (post.begenenler || []).length;
        }
      }
      // Istatistikte sadece silinmemis paylasimlar
      const aktifPaylasimlar = kullaniciPosts.filter(p => !p.ogrenciSildi && !p.veliKaldirdi && !p.ogretmenKaldirdi && !p.adminSildi);
      setIstatistik({ paylasim: aktifPaylasimlar.length, yorum: yorumSayisi, begeni: begeniSayisi });

      const ozelKayit = localStorage.getItem("ozelArkaplan_" + kullaniciId);
      if (ozelKayit) setOzelArkaplan(ozelKayit);

      setYukleniyor(false);
    };
    getir();
  }, [kullaniciId, benimProfilim]);

  const fotoYukle = async (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    if (!dosya.type.startsWith("image/")) { alert("Sadece resim yukleyebilirsiniz!"); return; }
    if (dosya.size > 5 * 1024 * 1024) { alert("Dosya max 5MB olmali!"); return; }
    setFotoYukleniyor(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const key = "profil/" + auth.currentUser.uid + "_" + Date.now() + "." + dosya.name.split(".").pop();
      await fetch(WORKER_URL + "/upload/" + key, {
        method: "PUT",
        headers: { "Content-Type": dosya.type, "Authorization": "Bearer " + token },
        body: dosya
      });
      const fotoUrl = WORKER_URL + "/photo/" + key;
      await updateDoc(doc(db, "users", auth.currentUser.uid), { profilFotoUrl: fotoUrl });
      setProfilFoto(fotoUrl);
    } catch (err) {
      alert("Foto yuklenemedi: " + err.message);
    }
    setFotoYukleniyor(false);
  };

  const handleKaydet = async () => {
    await updateDoc(doc(db, "users", kullaniciId), { isim, sinif, okul });
    setProfil(prev => ({ ...prev, isim, sinif, okul }));
    setDuzenliyor(false);
  };

  const temaSec = async (arkaplanId, karanlikMi) => {
    const guncelle = {};
    if (arkaplanId !== undefined) {
      guncelle.arkaplan = arkaplanId;
      localStorage.removeItem("ozelArkaplan_" + kullaniciId);
      setOzelArkaplan(null);
    }
    if (karanlikMi !== undefined) guncelle.karanlikMod = karanlikMi;
    await updateDoc(doc(db, "users", kullaniciId), guncelle);
    setProfil(prev => ({ ...prev, ...guncelle }));
  };

  const handleFotografYukle = (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    if (dosya.size > 5 * 1024 * 1024) {
      alert("Fotograf 5MB'dan kucuk olmali!");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      localStorage.setItem("ozelArkaplan_" + kullaniciId, base64);
      setOzelArkaplan(base64);
      await updateDoc(doc(db, "users", kullaniciId), { arkaplan: "ozel" });
      setProfil(prev => ({ ...prev, arkaplan: "ozel" }));
      alert("Arka plan kaydedildi! Sadece bu cihazda gorunecek.");
    };
    reader.readAsDataURL(dosya);
  };

  const handleDondur = async () => {
    if (!dondurmeSuresi) { alert("Lutfen sure secin!"); return; }
    let bitis = null;
    const simdi = new Date();
    if (dondurmeSuresi === "1saat") bitis = new Date(simdi.getTime() + 1 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "1gun") bitis = new Date(simdi.getTime() + 24 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "1hafta") bitis = new Date(simdi.getTime() + 7 * 24 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "1ay") bitis = new Date(simdi.getTime() + 30 * 24 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "suresiz") bitis = null;

    await updateDoc(doc(db, "users", kullaniciId), {
      dondurulmus: true,
      dondurulmaBitis: bitis ? bitis.toISOString() : null
    });
    setProfil(prev => ({ ...prev, dondurulmus: true, dondurulmaBitis: bitis ? bitis.toISOString() : null }));
    setDondurmModal(false);
    setDondurmeSuresi("");
    alert("Hesap donduruldu!");
  };

  const handleCoz = async () => {
    await updateDoc(doc(db, "users", kullaniciId), { dondurulmus: false, dondurulmaBitis: null });
    setProfil(prev => ({ ...prev, dondurulmus: false, dondurulmaBitis: null }));
    alert("Dondurma kaldirildi!");
  };

  // Gonderi soft delete - profil sayfasindan silme
  const gonderiSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi silmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      ogrenciSildi: true,
      silinmeTarihi: serverTimestamp(),
      silenUid: auth.currentUser.uid,
      silenRol: "student"
    });
    // Listede silindi olarak isaretlenir, tamamen kaybolmaz
    setGonderiler(prev => prev.map(g =>
      g.id === gonderiId ? { ...g, ogrenciSildi: true } : g
    ));
    // Istatistigi guncelle
    setIstatistik(prev => ({ ...prev, paylasim: prev.paylasim - 1 }));
  };

  const gonderiDuzenleKaydet = async (gonderiId) => {
    if (!duzenlenenMetin.trim()) return;
    await updateDoc(doc(db, "posts", gonderiId), { icerik: duzenlenenMetin });
    setGonderiler(prev => prev.map(g => g.id === gonderiId ? { ...g, icerik: duzenlenenMetin } : g));
    setDuzenlenenPostId(null);
    setDuzenlenenMetin("");
  };

  const istekGonder = async () => {
    await updateDoc(doc(db, "users", kullaniciId), { gelenIstekler: arrayUnion(auth.currentUser.uid) });
    await updateDoc(doc(db, "users", auth.currentUser.uid), { gidenIstekler: arrayUnion(kullaniciId) });
    setBenimProfilim2(prev => ({ ...prev, gidenIstekler: [...(prev?.gidenIstekler || []), kullaniciId] }));
    alert("Istek gonderildi!");
  };

  const istegiIptal = async () => {
    await updateDoc(doc(db, "users", kullaniciId), { gelenIstekler: arrayRemove(auth.currentUser.uid) });
    await updateDoc(doc(db, "users", auth.currentUser.uid), { gidenIstekler: arrayRemove(kullaniciId) });
    setBenimProfilim2(prev => ({ ...prev, gidenIstekler: (prev?.gidenIstekler || []).filter(u => u !== kullaniciId) }));
    alert("Istek iptal edildi!");
  };

  const istegiKabul = async () => {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      gelenIstekler: arrayRemove(kullaniciId),
      arkadaslar: arrayUnion(kullaniciId)
    });
    await updateDoc(doc(db, "users", kullaniciId), {
      gidenIstekler: arrayRemove(auth.currentUser.uid),
      arkadaslar: arrayUnion(auth.currentUser.uid)
    });
    setBenimProfilim2(prev => ({
      ...prev,
      gelenIstekler: (prev?.gelenIstekler || []).filter(u => u !== kullaniciId),
      arkadaslar: [...(prev?.arkadaslar || []), kullaniciId]
    }));
    alert("Arkadaslik kabul edildi!");
  };

  const istegiReddet = async () => {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { gelenIstekler: arrayRemove(kullaniciId) });
    await updateDoc(doc(db, "users", kullaniciId), { gidenIstekler: arrayRemove(auth.currentUser.uid) });
    setBenimProfilim2(prev => ({ ...prev, gelenIstekler: (prev?.gelenIstekler || []).filter(u => u !== kullaniciId) }));
    alert("Istek reddedildi!");
  };

  const arkadasliktanCikar = async () => {
    if (!window.confirm("Arkadaslikten cikarmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { arkadaslar: arrayRemove(kullaniciId) });
    await updateDoc(doc(db, "users", kullaniciId), { arkadaslar: arrayRemove(auth.currentUser.uid) });
    setBenimProfilim2(prev => ({ ...prev, arkadaslar: (prev?.arkadaslar || []).filter(u => u !== kullaniciId) }));
    alert("Arkadasliktan cikarildi!");
  };

  const engelle = async () => {
    if (!window.confirm("Bu kisiyi engellemek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      engellenenler: arrayUnion(kullaniciId),
      arkadaslar: arrayRemove(kullaniciId),
      gelenIstekler: arrayRemove(kullaniciId),
      gidenIstekler: arrayRemove(kullaniciId)
    });
    await updateDoc(doc(db, "users", kullaniciId), {
      arkadaslar: arrayRemove(auth.currentUser.uid),
      gelenIstekler: arrayRemove(auth.currentUser.uid),
      gidenIstekler: arrayRemove(auth.currentUser.uid)
    });
    setBenimProfilim2(prev => ({
      ...prev,
      engellenenler: [...(prev?.engellenenler || []), kullaniciId],
      arkadaslar: (prev?.arkadaslar || []).filter(u => u !== kullaniciId),
      gelenIstekler: (prev?.gelenIstekler || []).filter(u => u !== kullaniciId),
      gidenIstekler: (prev?.gidenIstekler || []).filter(u => u !== kullaniciId)
    }));
    alert("Engellendi!");
  };

  const engelKaldir = async (uid) => {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { engellenenler: arrayRemove(uid) });
    setBenimProfilim2(prev => ({ ...prev, engellenenler: (prev?.engellenenler || []).filter(u => u !== uid) }));
    setEngellenenlerListesi(prev => prev.filter(k => k.id !== uid));
    alert("Engel kaldirildi!");
  };

  if (yukleniyor) return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>
      <div style={{ background:"white", padding:"30px", borderRadius:"16px" }}>Yukleniyor...</div>
    </div>
  );

  const profilIsim = profil?.isim || profil?.email || "?";
  const WORKER_URL = "https://zupii-photos.samsunda-yasamak.workers.dev";
  const avatarRenk = getAvatarRenk(profilIsim);
  const basHarfler = getBasHarfler(profilIsim);

  const arkadasMi = (benimProfilim2?.arkadaslar || []).includes(kullaniciId);
  const istekGondermisMi = (benimProfilim2?.gidenIstekler || []).includes(kullaniciId);
  const istekAlmisMi = (benimProfilim2?.gelenIstekler || []).includes(kullaniciId);
  const engellenmisMi = (benimProfilim2?.engellenenler || []).includes(kullaniciId);
  const normalize = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const ayniOkul = benimProfilim2?.okul && profil?.okul && normalize(benimProfilim2.okul) === normalize(profil.okul);

  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>

      {dondurmModal && (
        <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.7)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:1000 }}>
          <div style={{ background:"white", padding:"30px", borderRadius:"16px", width:"300px" }}>
            <h3 style={{ marginBottom:"16px" }}>Hesap Dondur</h3>
            <select value={dondurmeSuresi} onChange={e => setDondurmeSuresi(e.target.value)}
              style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ddd", marginBottom:"16px" }}>
              <option value="">Sure secin</option>
              <option value="1saat">1 Saat</option>
              <option value="1gun">1 Gun</option>
              <option value="1hafta">1 Hafta</option>
              <option value="1ay">1 Ay</option>
              <option value="suresiz">Suresiz</option>
            </select>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={handleDondur}
                style={{ flex:1, padding:"10px", background:"#f59e0b", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                🔒 Dondur
              </button>
              <button onClick={() => setDondurmModal(false)}
                style={{ flex:1, padding:"10px", background:"#e5e7eb", border:"none", borderRadius:"8px", cursor:"pointer" }}>
                Iptal
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background:"white", borderRadius:"20px", width:"90%", maxWidth:"500px", maxHeight:"85vh", overflowY:"auto", padding:"0", position:"relative" }}>

        <div style={{ background: avatarRenk, height:"100px", borderRadius:"20px 20px 0 0", position:"relative" }}>
          <button onClick={onKapat}
            style={{ position:"absolute", top:"16px", right:"16px", background:"rgba(255,255,255,0.3)", border:"none", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px", color:"white", fontWeight:"700" }}>
            ✕
          </button>
        </div>

        <div style={{ padding:"0 30px 30px" }}>
          <div style={{ textAlign:"center", marginTop:"-50px", marginBottom:"16px" }}>
            <div style={{ position: "relative", width: "100px", margin: "0 auto" }}>
              <div style={{
                width:"100px", height:"100px", borderRadius:"50%", background: profilFoto ? "transparent" : avatarRenk,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:"38px",
                fontWeight:"800", color:"white", border:"5px solid white",
                boxShadow:"0 4px 12px rgba(0,0,0,0.15)", overflow: "hidden"
              }}>
                {profilFoto ? (
                  <img src={profilFoto} alt="profil" 
                    style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                    onClick={() => window.open(profilFoto, "_blank")} />
                ) : (
                  basHarfler
                )}
              </div>
              {benimProfilim && (
                <label style={{
                  position: "absolute", bottom: "0", right: "0",
                  background: "#4f46e5", color: "white", borderRadius: "50%",
                  width: "28px", height: "28px", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", fontSize: "14px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                }}>
                  {fotoYukleniyor ? "..." : "📷"}
                  <input type="file" accept="image/*" onChange={fotoYukle} style={{ display: "none" }} />
                </label>
              )}
            </div>

            <div style={{ marginTop:"12px" }}>
              {duzenliyor ? (
                <input value={isim} onChange={e => setIsim(e.target.value)}
                  style={{ fontSize:"20px", fontWeight:"700", textAlign:"center", border:"1px solid #ddd", borderRadius:"8px", padding:"6px 12px", width:"100%", boxSizing:"border-box" }} />
              ) : (
                <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#1f2937", margin:"0" }}>
                  {profilIsim}
                </h2>
              )}
              {profil?.dondurulmus && (
                <span style={{ background:"#fee2e2", color:"#ef4444", padding:"3px 10px", borderRadius:"10px", fontSize:"12px", marginTop:"6px", display:"inline-block" }}>
                  🔒 Dondurulmus
                </span>
              )}
              {arkadasMi && !benimProfilim && (
                <span style={{ background:"#d1fae5", color:"#065f46", padding:"3px 10px", borderRadius:"10px", fontSize:"12px", marginTop:"6px", display:"inline-block", marginLeft:"4px" }}>
                  ✓ Arkadasin
                </span>
              )}
            </div>
          </div>

          <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
            <div style={{ flex:1, background:"#f3f4f6", padding:"12px", borderRadius:"12px", textAlign:"center" }}>
              <p style={{ margin:"0", fontSize:"20px", fontWeight:"800", color:"#4f46e5" }}>{istatistik.paylasim}</p>
              <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>Paylasim</p>
            </div>
            <div style={{ flex:1, background:"#f3f4f6", padding:"12px", borderRadius:"12px", textAlign:"center" }}>
              <p style={{ margin:"0", fontSize:"20px", fontWeight:"800", color:"#4f46e5" }}>{istatistik.yorum}</p>
              <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>Yorum</p>
            </div>
            <div style={{ flex:1, background:"#f3f4f6", padding:"12px", borderRadius:"12px", textAlign:"center" }}>
              <p style={{ margin:"0", fontSize:"20px", fontWeight:"800", color:"#ef4444" }}>{istatistik.begeni}</p>
              <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>Begeni</p>
            </div>
          </div>

          <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"20px" }}>
            {duzenliyor ? (
              <>
                <div style={{ marginBottom:"12px" }}>
                  <label style={{ fontSize:"13px", color:"#6b7280", display:"block", marginBottom:"4px" }}>Sinif</label>
                  <input value={sinif} onChange={e => setSinif(e.target.value)} placeholder="Sinif (orn: 5-A)"
                    style={{ width:"100%", padding:"8px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:"13px", color:"#6b7280", display:"block", marginBottom:"4px" }}>Okul</label>
                  <input value={okul} onChange={e => setOkul(e.target.value)} placeholder="Okul adi"
                    style={{ width:"100%", padding:"8px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
                </div>
              </>
            ) : (
              <>
                {profil?.sinif && <p style={{ margin:"0 0 8px", fontSize:"14px", color:"#374151" }}>📚 Sinif: <strong>{profil.sinif}</strong></p>}
                {profil?.okul && <p style={{ margin:"0 0 8px", fontSize:"14px", color:"#374151" }}>🏫 Okul: <strong>{profil.okul}</strong></p>}
                {benimProfilim && <p style={{ margin:"0", fontSize:"14px", color:"#374151" }}>📧 {profil?.email}</p>}
              </>
            )}
          </div>

          <div style={{ display:"flex", gap:"10px", marginBottom:"20px", flexWrap:"wrap" }}>
            {benimProfilim && (
              duzenliyor ? (
                <>
                  <button onClick={handleKaydet}
                    style={{ flex:1, padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    💾 Kaydet
                  </button>
                  <button onClick={() => setDuzenliyor(false)}
                    style={{ flex:1, padding:"10px", background:"#e5e7eb", border:"none", borderRadius:"8px", cursor:"pointer" }}>
                    Vazgec
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setDuzenliyor(true)}
                    style={{ flex:"1 1 100%", padding:"10px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    ✏️ Profili Duzenle
                  </button>
                  <button onClick={() => setTemaPaneli(!temaPaneli)}
                    style={{ flex:"1 1 45%", padding:"10px", background:"#8b5cf6", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    🎨 Tema
                  </button>
                  {ogrenciyim && (
                    <button onClick={() => setEngelPaneli(!engelPaneli)}
                      style={{ flex:"1 1 45%", padding:"10px", background:"#6b7280", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", position:"relative" }}>
                      🚫 Engeller
                      {(benimProfilim2?.engellenenler || []).length > 0 && (
                        <span style={{ position:"absolute", top:"-6px", right:"-6px", background:"#ef4444", color:"white", borderRadius:"50%", width:"20px", height:"20px", fontSize:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
                          {(benimProfilim2?.engellenenler || []).length}
                        </span>
                      )}
                    </button>
                  )}
                </>
              )
            )}

            {!benimProfilim && ogrenciyim && !engellenmisMi && (
              <>
                {arkadasMi && (
                  <button onClick={arkadasliktanCikar}
                    style={{ flex:"1 1 45%", padding:"10px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    ❌ Arkadasliktan Cikar
                  </button>
                )}
                {istekAlmisMi && (
                  <>
                    <button onClick={istegiKabul}
                      style={{ flex:"1 1 45%", padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                      ✓ Kabul Et
                    </button>
                    <button onClick={istegiReddet}
                      style={{ flex:"1 1 45%", padding:"10px", background:"#6b7280", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                      ✗ Reddet
                    </button>
                  </>
                )}
                {istekGondermisMi && (
                  <button onClick={istegiIptal}
                    style={{ flex:"1 1 45%", padding:"10px", background:"#6b7280", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    📤 Istegi Iptal Et
                  </button>
                )}
                {!arkadasMi && !istekGondermisMi && !istekAlmisMi && ayniOkul && (
                  <button onClick={istekGonder}
                    style={{ flex:"1 1 45%", padding:"10px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    ➕ Arkadas Ekle
                  </button>
                )}
                {!arkadasMi && !istekGondermisMi && !istekAlmisMi && !ayniOkul && (
                  <p style={{ flex:"1 1 100%", padding:"10px", background:"#fef3c7", color:"#92400e", borderRadius:"8px", fontSize:"12px", textAlign:"center", margin:"0" }}>
                    ⚠️ Sadece ayni okuldan arkadas ekleyebilirsin
                  </p>
                )}
                <button onClick={engelle}
                  style={{ flex:"1 1 45%", padding:"10px", background:"#6b7280", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                  🚫 Engelle
                </button>
              </>
            )}

            {!benimProfilim && ogrenciyim && engellenmisMi && (
              <button onClick={() => engelKaldir(kullaniciId)}
                style={{ flex:1, padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                ✓ Engeli Kaldir
              </button>
            )}

            {!benimProfilim && yetkili && (
              profil?.dondurulmus ? (
                <button onClick={handleCoz}
                  style={{ flex:1, padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                  🔓 Dondurmayi Kaldir
                </button>
              ) : (
                <button onClick={() => setDondurmModal(true)}
                  style={{ flex:1, padding:"10px", background:"#f59e0b", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                  🔒 Hesabi Dondur
                </button>
              )
            )}
          </div>

          {engelPaneli && benimProfilim && (
            <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"20px" }}>
              <h3 style={{ fontSize:"15px", marginBottom:"12px" }}>🚫 Engellediklerim ({engellenenlerListesi.length})</h3>
              {engellenenlerListesi.length === 0 ? (
                <p style={{ fontSize:"13px", color:"#9ca3af", textAlign:"center" }}>Engelledigin kimse yok.</p>
              ) : (
                engellenenlerListesi.map(k => (
                  <div key={k.id} style={{ background:"white", padding:"10px", borderRadius:"8px", marginBottom:"6px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <p style={{ margin:"0", fontSize:"13px", fontWeight:"600" }}>{k.isim}</p>
                      {k.sinif && <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>📚 {k.sinif}</p>}
                    </div>
                    <button onClick={() => engelKaldir(k.id)}
                      style={{ padding:"4px 10px", background:"#10b981", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"11px", fontWeight:"600" }}>
                      ✓ Engeli Kaldir
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {temaPaneli && benimProfilim && (
            <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"20px" }}>
              <h3 style={{ fontSize:"15px", marginBottom:"12px" }}>🌗 Mod Sec</h3>
              <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
                <button onClick={() => temaSec(undefined, false)}
                  style={{ flex:1, padding:"10px", background: !profil?.karanlikMod ? "#4f46e5" : "#e5e7eb", color: !profil?.karanlikMod ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                  ☀️ Acik Mod
                </button>
                <button onClick={() => temaSec(undefined, true)}
                  style={{ flex:1, padding:"10px", background: profil?.karanlikMod ? "#4f46e5" : "#e5e7eb", color: profil?.karanlikMod ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                  🌙 Karanlik Mod
                </button>
              </div>
              <h3 style={{ fontSize:"15px", marginBottom:"12px" }}>📷 Kendi Fotografin</h3>
              <label style={{ display:"block", width:"100%", padding:"12px", background:"#10b981", color:"white", borderRadius:"8px", cursor:"pointer", textAlign:"center", fontWeight:"600", marginBottom:"16px" }}>
                📁 Bilgisayardan Fotograf Sec
                <input type="file" accept="image/*" onChange={handleFotografYukle} style={{ display:"none" }} />
              </label>
              {ozelArkaplan && (
                <div style={{ marginBottom:"16px" }}>
                  <p style={{ fontSize:"12px", color:"#6b7280", marginBottom:"6px" }}>Mevcut ozel arka planin:</p>
                  <div style={{ height:"60px", borderRadius:"8px", backgroundImage:"url(" + ozelArkaplan + ")", backgroundSize:"cover", backgroundPosition:"center" }} />
                  <p style={{ fontSize:"11px", color:"#9ca3af", marginTop:"4px" }}>⚠️ Sadece bu cihazda gorunur</p>
                </div>
              )}
              <h3 style={{ fontSize:"15px", marginBottom:"12px" }}>🎨 Arka Plan Sec</h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"8px" }}>
                {ARKAPLANLAR.map(arka => (
                  <div key={arka.id}
                    onClick={() => temaSec(arka.id, undefined)}
                    style={{
                      background: arka.deger, backgroundSize: arka.tip === "resim" ? "cover" : "auto",
                      backgroundPosition:"center", height:"60px", borderRadius:"8px", cursor:"pointer",
                      border: profil?.arkaplan === arka.id ? "3px solid #4f46e5" : "3px solid transparent",
                      display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"4px"
                    }}>
                    <span style={{ background:"rgba(0,0,0,0.5)", color:"white", padding:"2px 6px", borderRadius:"4px", fontSize:"10px", fontWeight:"600" }}>
                      {arka.isim}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paylasimlar listesi */}
          <h3 style={{ fontSize:"16px", color:"#374151", marginBottom:"12px" }}>
            Paylasimlar ({istatistik.paylasim})
          </h3>
          {gonderiler.length === 0 ? (
            <p style={{ color:"#9ca3af", textAlign:"center" }}>Hic paylasim yok.</p>
          ) : (
            gonderiler.map(g => {
              const kaldirildi = g.ogrenciSildi || g.veliKaldirdi || g.ogretmenKaldirdi || g.adminSildi;
              return (
                <div key={g.id} style={{
                  background: kaldirildi ? "#f3f4f6" : "#f9fafb",
                  padding:"12px", borderRadius:"10px", marginBottom:"8px", position:"relative",
                  opacity: kaldirildi ? 0.65 : 1
                }}>
                  {duzenlenenPostId === g.id ? (
                    <>
                      <textarea value={duzenlenenMetin} onChange={e => setDuzenlenenMetin(e.target.value)}
                        style={{ width:"100%", padding:"8px", borderRadius:"6px", border:"1px solid #ddd", fontSize:"14px", minHeight:"60px", boxSizing:"border-box", fontFamily:"inherit", marginBottom:"6px" }} />
                      <div style={{ display:"flex", gap:"6px" }}>
                        <button onClick={() => gonderiDuzenleKaydet(g.id)}
                          style={{ padding:"4px 10px", background:"#10b981", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"11px", fontWeight:"600" }}>
                          💾 Kaydet
                        </button>
                        <button onClick={() => { setDuzenlenenPostId(null); setDuzenlenenMetin(""); }}
                          style={{ padding:"4px 10px", background:"#e5e7eb", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>
                          Vazgec
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Kaldirma rozeti */}
                      {kaldirildi && (
                        <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", marginBottom:"4px" }}>
                          {g.ogrenciSildi && <span style={{ background:"#e5e7eb", color:"#6b7280", padding:"1px 6px", borderRadius:"4px", fontSize:"10px" }}>Silindi</span>}
                          {g.veliKaldirdi && <span style={{ background:"#ede9fe", color:"#5b21b6", padding:"1px 6px", borderRadius:"4px", fontSize:"10px" }}>Veli kaldirdi</span>}
                          {g.ogretmenKaldirdi && <span style={{ background:"#fef3c7", color:"#92400e", padding:"1px 6px", borderRadius:"4px", fontSize:"10px" }}>Ogretmen kaldirdi</span>}
                          {g.adminSildi && <span style={{ background:"#fee2e2", color:"#991b1b", padding:"1px 6px", borderRadius:"4px", fontSize:"10px" }}>Admin kaldirdi</span>}
                        </div>
                      )}
                      <p style={{ margin:"0", fontSize:"14px", color: kaldirildi ? "#9ca3af" : "#374151", paddingRight: benimProfilim && !kaldirildi ? "90px" : "0", fontStyle: kaldirildi ? "italic" : "normal" }}>
                        {kaldirildi ? "Bu gonderi kaldirildi." : g.icerik}
                      </p>
                      {/* Duzenleme ve silme sadece kaldirilmamissa */}
                      {benimProfilim && !kaldirildi && (
                        <div style={{ position:"absolute", top:"8px", right:"8px", display:"flex", gap:"4px" }}>
                          <button onClick={() => { setDuzenlenenPostId(g.id); setDuzenlenenMetin(g.icerik); }}
                            style={{ padding:"4px 8px", background:"#4f46e5", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>
                            ✏️
                          </button>
                          <button onClick={() => gonderiSil(g.id)}
                            style={{ padding:"4px 8px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"11px" }}>
                            🗑️
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilSayfasi;