import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDocFromServer, collection, getDocs, addDoc, orderBy, query, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

const WORKER_URL = "https://zupii-photos.samsunda-yasamak.workers.dev";

const KUFUR_LISTESI = [
  "amk", "aq", "amq", "amina", "amini", "amcik", "anasini",
  "siktir", "siktiret", "sikim", "sikme", "siker", "sikiyim", "sikerim",
  "orospu", "kahpe", "fahise", "surtuk", "pic", "pust", "ibne",
  "got", "gotveren", "yarrak", "yarak", "bok", "boktan",
  "salak", "aptal", "gerizekali", "fuck", "fucking", "shit", "bitch", "asshole", "bastard"
];

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
  const belgeUzantilari = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"];
  const belge = belgeUzantilari.some(u => url.toLowerCase().includes(u)) || url.includes("/belgeler/");
  if (belge) {
    const dosyaExt = url.split(".").pop().split("?")[0].toUpperCase();
    return (
      <div style={{ display: "block", marginTop: "8px" }}>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "#e0e7ff", color: "#4f46e5", borderRadius: "8px", textDecoration: "none", fontSize: "13px", fontWeight: "600" }}>
          📄 {dosyaExt}
        </a>
      </div>
    );
  }
  return (
    <img src={url} alt="gonderi" style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "8px", cursor: "pointer" }}
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
};

function TeacherDashboard() {
  const [ogrenciler, setOgrenciler] = useState([]);
  const [bildirimler, setBildirimler] = useState([]);
  const [ogretmenIsmi, setOgretmenIsmi] = useState("");
  const [ogretmenOkul, setOgretmenOkul] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [aktifSekme, setAktifSekme] = useState("paylasimlar");
  const [acikIcerik, setAcikIcerik] = useState({});
  const [tumOgrenciler, setTumOgrenciler] = useState([]);
  const [secilenOgrenciler, setSecilenOgrenciler] = useState([]);
  const [sinifAcik, setSinifAcik] = useState(false);
  const [sinifArama, setSinifArama] = useState("");
  const [sinifKaydetYukleniyor, setSinifKaydetYukleniyor] = useState(false);
  const [gonderiler, setGonderiler] = useState([]);
  const [yeniGonderi, setYeniGonderi] = useState("");
  const [gonderiYukleniyor, setGonderiYukleniyor] = useState(false);
  const [hataMesaj, setHataMesaj] = useState("");
  const [karanlikMod, setKaranlikMod] = useState(() => localStorage.getItem("teacherKaranlikMod") === "true");
  const [secilenMedya, setSecilenMedya] = useState(null);
  const [medyaOnizleme, setMedyaOnizleme] = useState(null);
  const [medyaTip, setMedyaTip] = useState(null);
  const [medyaYukleniyor, setMedyaYukleniyor] = useState(false);

  const bg = karanlikMod ? "#111827" : "#f9fafb";
  const kartBg = karanlikMod ? "#1f2937" : "white";
  const yaziRenk = karanlikMod ? "#f3f4f6" : "#111827";
  const ikincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";
  const borderRenk = karanlikMod ? "#374151" : "#e5e7eb";

  useEffect(() => { verileriGetir(); }, []);

  const verileriGetir = async () => {
    const ogretmenDoc = await getDocFromServer(doc(db, "users", auth.currentUser.uid));
    const ogretmenData = ogretmenDoc.data();
    const sinif = ogretmenData?.sinif || [];
    setOgrenciler(sinif);
    setSecilenOgrenciler(sinif);
    setOgretmenIsmi(ogretmenData?.isim || auth.currentUser.email);
    setOgretmenOkul(ogretmenData?.okul || "");

    const postSnapshot = await getDocs(query(collection(db, "duyurular"), orderBy("tarih", "desc")));
    const tumPosts = postSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(g => g.yazarUid === auth.currentUser.uid && !g.adminSildi && !g.ogretmenKaldirdi);
    setGonderiler(tumPosts);

    const userSnapshot = await getDocs(collection(db, "users"));
    const hepsi = userSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "student" && u.onaylandi === true);
    setTumOgrenciler(hepsi);

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setBildirimler(tumReports.filter(r => sinif.includes(r.bildirenUid) || sinif.includes(r.yazarUid)));
    setYukleniyor(false);
  };

  const kufurKontrol = (metin) => {
    const kucuk = metin.toLowerCase();
    return KUFUR_LISTESI.some(k => kucuk.includes(k));
  };

  const medyaSec = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isFoto = f.type.startsWith("image/");
    const isBelge = f.type.includes("pdf") || f.type.includes("word") || f.type.includes("excel") ||
      f.type.includes("powerpoint") || f.type.includes("text") || f.type.includes("officedocument");
    if (!isVideo && !isFoto && !isBelge) { alert("Foto, video veya belge yukleyebilirsiniz!"); return; }
    const maxBoyut = isVideo ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (f.size > maxBoyut) { alert(isVideo ? "Max 50MB!" : "Max 20MB!"); return; }
    setSecilenMedya(f);
    setMedyaTip(isVideo ? "video" : isFoto ? "foto" : "belge");
    if (isFoto) setMedyaOnizleme(URL.createObjectURL(f));
    else setMedyaOnizleme(null);
    e.target.value = "";
  };

  const medyaTemizle = () => {
    setSecilenMedya(null);
    setMedyaOnizleme(null);
    setMedyaTip(null);
  };

  const gonderiYap = async () => {
    if (!yeniGonderi.trim() && !secilenMedya) return;
    if (yeniGonderi.trim() && kufurKontrol(yeniGonderi)) {
      setHataMesaj("⚠️ Uygunsuz kelime tespit edildi!");
      setTimeout(() => setHataMesaj(""), 3000);
      return;
    }
    setGonderiYukleniyor(true);
    let medyaUrl = null;
    if (secilenMedya) {
      try {
        setMedyaYukleniyor(true);
        const token = await auth.currentUser.getIdToken();
        if (medyaTip === "video") {
          const formData = new FormData();
          formData.append("file", secilenMedya, secilenMedya.name);
          const response = await fetch(WORKER_URL + "/upload-video", {
            method: "POST", headers: { "Authorization": "Bearer " + token }, body: formData
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Video yuklenemedi");
          medyaUrl = data.embedUrl;
        } else {
          const klasor = medyaTip === "belge" ? "belgeler" : "posts";
          const ext = secilenMedya.name.split(".").pop();
          const key = klasor + "/" + auth.currentUser.uid + "_" + Date.now() + "." + ext;
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
        setGonderiYukleniyor(false);
        setMedyaYukleniyor(false);
        return;
      }
    }
    await addDoc(collection(db, "duyurular"), {
      icerik: yeniGonderi, yazar: ogretmenIsmi, yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp(), begenenler: [], fotoUrl: medyaUrl, adminSildi: false
    });
    setYeniGonderi("");
    medyaTemizle();
    const postSnapshot = await getDocs(query(collection(db, "duyurular"), orderBy("tarih", "desc")));
    setGonderiler(postSnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(g => g.yazarUid === auth.currentUser.uid && !g.adminSildi && !g.ogretmenKaldirdi));
    setGonderiYukleniyor(false);
  };

  const gonderiSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi silmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "duyurular", gonderiId), {
      ogretmenKaldirdi: true, ogretmenKaldirmaTarihi: serverTimestamp(), ogretmenKaldiranUid: auth.currentUser.uid
    });
    setGonderiler(prev => prev.filter(g => g.id !== gonderiId));
  };

  const ogrenciToggle = (uid) => {
    setSecilenOgrenciler(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  const sinifKaydet = async () => {
    setSinifKaydetYukleniyor(true);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { sinif: secilenOgrenciler });
    for (const uid of ogrenciler) {
      if (!secilenOgrenciler.includes(uid)) await updateDoc(doc(db, "users", uid), { ogretmenUid: null, ogretmenIsim: null });
    }
    for (const uid of secilenOgrenciler) {
      await updateDoc(doc(db, "users", uid), { ogretmenUid: auth.currentUser.uid, ogretmenIsim: ogretmenIsmi });
    }
    setOgrenciler(secilenOgrenciler);
    setSinifKaydetYukleniyor(false);
    setSinifAcik(false);
    alert("Sinif kaydedildi!");
  };

  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), { okundu: true, ogretmenGordu: true });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, okundu: true, ogretmenGordu: true } : b));
  };

  const bildirimKaldir = async (reportId) => {
    if (!window.confirm("Bu bildirimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      ogretmenSildi: true, ogretmenSildiTarihi: serverTimestamp(), ogretmenSildiUid: auth.currentUser.uid
    });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, ogretmenSildi: true } : b));
  };

  const adminIlet = async (reportId) => {
    if (!window.confirm("Bu bildirimi admine iletmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      adminaIletti: true, ileten: ogretmenIsmi, iletenRol: "teacher",
      iletenUid: auth.currentUser.uid, iletmeTarihi: serverTimestamp()
    });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, adminaIletti: true, ileten: ogretmenIsmi, iletenRol: "teacher" } : b));
    alert("Bildirim admine iletildi!");
  };

  const postIcerikGoster = async (reportId) => {
    // Postu Firestore'dan CEKMIYORUZ (baskasinin cocugunun postu olabilir, Rules engeller).
    // Sikayet detayi (metin + foto) zaten reports kaydinda var.
    setAcikIcerik(prev => ({ ...prev, [reportId]: !prev[reportId] }));
  };

  const filtrelenmisOgrenciler = tumOgrenciler.filter(o => {
    const ayniOkul = !ogretmenOkul || (o.okul || "").trim().toLowerCase() === ogretmenOkul.trim().toLowerCase();
    const aramaUyumu = !sinifArama || (o.isim || "").toLowerCase().includes(sinifArama.toLowerCase());
    return ayniOkul && aramaUyumu;
  });

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.ogretmenGordu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.ogretmenGordu).length;

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.2s" }}>
    <div style={{ maxWidth: "650px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => setSecilenProfil(null)} mevcutKullaniciRol="teacher" />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ color: "#4f46e5", margin: "0 0 4px" }}>Ogretmen Paneli</h2>
          <p style={{ margin: 0, fontSize: "13px", color: ikincilYazi }}>👤 {ogretmenIsmi} {ogretmenOkul && `• 🏫 ${ogretmenOkul}`}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>☀️</span>
            <div onClick={() => { const yeni = !karanlikMod; setKaranlikMod(yeni); localStorage.setItem("teacherKaranlikMod", yeni); }}
              style={{ width: "36px", height: "20px", borderRadius: "10px", background: karanlikMod ? "#4f46e5" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: karanlikMod ? "18px" : "2px", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>🌙</span>
          </div>
          <button onClick={() => signOut(auth)} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cikis</button>
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <button onClick={() => setSinifAcik(!sinifAcik)}
          style={{ width: "100%", padding: "12px 16px", background: kartBg, border: `1px solid ${borderRenk}`, borderRadius: sinifAcik ? "12px 12px 0 0" : "12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <span style={{ fontWeight: "600", color: yaziRenk, fontSize: "14px" }}>👥 Sinifim — {secilenOgrenciler.length} ogrenci</span>
          <span style={{ color: ikincilYazi, fontSize: "16px" }}>{sinifAcik ? "▲" : "▼"}</span>
        </button>
        {sinifAcik && (
          <div style={{ background: kartBg, border: `1px solid ${borderRenk}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px", boxShadow: "0 4px 8px rgba(0,0,0,0.06)" }}>
            {!ogretmenOkul && (
              <div style={{ background: "#fef3c7", color: "#92400e", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "12px" }}>
                ⚠️ Profilinden okul bilgini ekle — sadece ayni okuldaki ogrenciler listelenecek.
              </div>
            )}
            <input type="text" placeholder="🔍 Ogrenci ara..." value={sinifArama} onChange={e => setSinifArama(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "13px", boxSizing: "border-box", marginBottom: "10px", background: karanlikMod ? "#374151" : "white", color: yaziRenk }} />
            <div style={{ maxHeight: "280px", overflowY: "auto", marginBottom: "12px" }}>
              {filtrelenmisOgrenciler.length === 0 ? (
                <p style={{ fontSize: "13px", color: ikincilYazi, textAlign: "center", padding: "12px" }}>
                  {ogretmenOkul ? "Ayni okuldaki ogrenci bulunamadi." : "Ogrenci bulunamadi."}
                </p>
              ) : (
                filtrelenmisOgrenciler.map(o => (
                  <div key={o.id} onClick={() => ogrenciToggle(o.id)}
                    style={{ padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", cursor: "pointer", background: secilenOgrenciler.includes(o.id) ? "#e0e7ff" : (karanlikMod ? "#374151" : "#f9fafb"), border: secilenOgrenciler.includes(o.id) ? "1px solid #4f46e5" : `1px solid ${borderRenk}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: secilenOgrenciler.includes(o.id) ? "#4f46e5" : yaziRenk }}>{o.isim}</p>
                      {o.sinif && <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>📚 {o.sinif}</p>}
                      {o.ogretmenIsim && o.ogretmenUid !== auth.currentUser.uid && (
                        <p style={{ margin: 0, fontSize: "11px", color: "#f59e0b" }}>⚠️ Baska ogretmende: {o.ogretmenIsim}</p>
                      )}
                    </div>
                    {secilenOgrenciler.includes(o.id) && <span style={{ color: "#4f46e5", fontWeight: "700" }}>✓</span>}
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={sinifKaydet} disabled={sinifKaydetYukleniyor}
                style={{ flex: 1, padding: "10px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                {sinifKaydetYukleniyor ? "Kaydediliyor..." : "💾 Kaydet ve Kapat"}
              </button>
              <button onClick={() => setSinifAcik(false)} style={{ padding: "10px 16px", background: "#e5e7eb", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>Kapat</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button onClick={() => setAktifSekme("paylasimlar")}
          style={{ flex: 1, padding: "10px", background: aktifSekme === "paylasimlar" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "paylasimlar" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
          📢 Paylasimlarim
        </button>
        <button onClick={() => setAktifSekme("bildirimler")}
          style={{ flex: 1, padding: "10px", background: aktifSekme === "bildirimler" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "bildirimler" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", position: "relative" }}>
          🚩 Bildirimler
          {yeniBildirimSayisi > 0 && (
            <span style={{ position: "absolute", top: "-6px", right: "-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
              {yeniBildirimSayisi}
            </span>
          )}
        </button>
      </div>

      {yukleniyor ? <p style={{ color: yaziRenk }}>Yukleniyor...</p> : aktifSekme === "paylasimlar" ? (
        <div>
          <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
            <p style={{ fontSize: "13px", color: ikincilYazi, margin: "0 0 8px" }}>
              📋 Sinifina duyuru veya bilgi paylas ({ogrenciler.length} ogrenci gorecek)
            </p>
            <textarea placeholder="Odev, duyuru, hatirlatma yazin..." value={yeniGonderi} onChange={e => setYeniGonderi(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "14px", resize: "vertical", minHeight: "80px", boxSizing: "border-box", fontFamily: "inherit", background: karanlikMod ? "#374151" : "white", color: yaziRenk }} />
            {hataMesaj && <div style={{ marginTop: "8px", padding: "8px 12px", background: "#fee2e2", color: "#ef4444", borderRadius: "8px", fontSize: "13px" }}>{hataMesaj}</div>}
            {secilenMedya && (
              <div style={{ marginTop: "10px", position: "relative", display: "inline-block" }}>
                {medyaTip === "video" ? (
                  <video src={medyaOnizleme || ""} controls style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
                ) : medyaTip === "foto" ? (
                  <img src={medyaOnizleme} alt="onizleme" style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "8px", border: "1px solid #ddd" }} />
                ) : (
                  <div style={{ padding: "10px 16px", background: "#e0e7ff", color: "#4f46e5", borderRadius: "8px", fontSize: "13px", fontWeight: "600" }}>
                    📄 {secilenMedya.name}
                  </div>
                )}
                <button onClick={medyaTemizle} style={{ position: "absolute", top: "4px", right: "4px", background: "#ef4444", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>✕</button>
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ padding: "8px 14px", background: karanlikMod ? "#374151" : "#f3f4f6", color: yaziRenk, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                🖼️ Foto <input type="file" accept="image/*" onChange={medyaSec} style={{ display: "none" }} />
              </label>
              <label style={{ padding: "8px 14px", background: karanlikMod ? "#374151" : "#f3f4f6", color: yaziRenk, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                🎬 Video <input type="file" accept="video/*" onChange={medyaSec} style={{ display: "none" }} />
              </label>
              <label style={{ padding: "8px 14px", background: karanlikMod ? "#374151" : "#f3f4f6", color: yaziRenk, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                📄 Belge <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={medyaSec} style={{ display: "none" }} />
              </label>
              <button onClick={gonderiYap} disabled={gonderiYukleniyor || medyaYukleniyor}
                style={{ padding: "8px 20px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
                {medyaYukleniyor ? "Yukleniyor..." : gonderiYukleniyor ? "Paylasiliyor..." : "📢 Paylas"}
              </button>
            </div>
          </div>

          {gonderiler.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}><p>Henuz paylasim yapmadınız.</p></div>
          ) : (
            <>
              <h3 style={{ color: ikincilYazi, marginBottom: "12px", fontSize: "14px" }}>Paylasimlarim ({gonderiler.length})</h3>
              {gonderiler.map(g => {
                const begenenler = g.begenenler || [];
                return (
                  <div key={g.id} style={{ background: kartBg, padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px" }}>
                    <p style={{ margin: "0 0 6px", fontSize: "15px", color: yaziRenk }}>
                      {(g.icerik || "").split(/(\bhttps?:\/\/\S+)/g).map((parca, i) =>
                        parca.match(/^https?:\/\//) ? (
                          <a key={i} href={parca} target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5", textDecoration: "underline" }}>{parca}</a>
                        ) : parca
                      )}
                    </p>
                    {g.fotoUrl && <MedyaGoster url={g.fotoUrl} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                      <small style={{ color: ikincilYazi, fontSize: "12px" }}>
                        {g.tarih ? new Date(g.tarih.seconds * 1000).toLocaleDateString("tr-TR") + " " + new Date(g.tarih.seconds * 1000).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </small>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#ef4444", borderRadius: "6px", fontSize: "12px" }}>❤️ {begenenler.length}</span>
                        <button onClick={() => gonderiSil(g.id)} style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>🗑️ Sil</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}><p>Hic bildirim yok.</p></div>
          ) : (
            bildirimler.map(b => (
              <div key={b.id} style={{ background: kartBg, padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px", border: b.acil && !b.ogretmenGordu ? "2px solid #ef4444" : `1px solid ${borderRenk}`, opacity: b.ogretmenSildi ? 0.7 : 1 }}>
                {b.acil && !b.ogretmenGordu && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", marginBottom: "8px", fontWeight: "700" }}>
                    🚨 ACIL: Ogrenci yardim istiyor!
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                  {!b.ogretmenGordu && <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>YENI</span>}
                  {b.ogretmenSildi && <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>✓ Kaldirildi</span>}
                  {b.adminaIletti && <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>✓ Admine iletildi {b.iletenRol === "parent" ? "(veli)" : "(ogretmen)"}</span>}
                  {b.veliSildi && <span style={{ background: "#ede9fe", color: "#5b21b6", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>Veli kaldirdi</span>}
                </div>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: ikincilYazi }}>📋 Sebep: <strong>{b.kategori}</strong>{b.digerSebep && <span> — "{b.digerSebep}"</span>}</p>
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: ikincilYazi }}>💙 Bildiren cocugun durumu: {b.iyiMisin === "iyi" ? "😊 Iyi" : b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" : b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"}</p>
                <div style={{ background: karanlikMod ? "#374151" : "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "8px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", color: yaziRenk }}>{b.icerikMetni}</p>
                  <small style={{ color: ikincilYazi }}>Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.yazar}</span></small>
                </div>
                {b.tip === "post" && (b.icerikMetni || b.fotoUrl) && (
                  <button onClick={() => postIcerikGoster(b.id)}
                    style={{ fontSize: "12px", color: "#4f46e5", background: "none", border: "none", cursor: "pointer", padding: "0", marginBottom: "8px" }}>
                    {acikIcerik[b.id] ? "▲ Gonderiyi gizle" : "▼ Gonderiyi tam goster"}
                  </button>
                )}
                {acikIcerik[b.id] && (
                  <div style={{ background: karanlikMod ? "#4b5563" : "#ede9fe", padding: "10px", borderRadius: "8px", marginBottom: "8px", fontSize: "13px" }}>
                    <p style={{ margin: 0, color: yaziRenk }}>{b.icerikMetni}</p>
                    {b.fotoUrl && <MedyaGoster url={b.fotoUrl} />}
                  </div>
                )}
                <p style={{ fontSize: "12px", color: ikincilYazi, margin: "0 0 8px" }}>🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.bildiren}</span></p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {!b.ogretmenGordu && (
                    <button onClick={() => bildirimOkundu(b.id)} style={{ flex: "1 1 45%", padding: "6px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>✓ Okundu</button>
                  )}
                  {!b.adminaIletti && (
                    <button onClick={() => adminIlet(b.id)} style={{ flex: "1 1 45%", padding: "6px 12px", background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>📨 Admine Ilet</button>
                  )}
                  {!b.ogretmenSildi && (
                    <button onClick={() => bildirimKaldir(b.id)} style={{ padding: "6px 12px", background: "#6b7280", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>🗑️ Kaldir</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
    </div>
  );
}

export default TeacherDashboard;