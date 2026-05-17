import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDocFromServer, getDoc, collection, getDocs, addDoc, orderBy, query, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

const KUFUR_LISTESI = [
  "amk", "aq", "amq", "amina", "amini", "amcik", "anasini",
  "siktir", "siktiret", "sikim", "sikme", "siker", "sikiyim", "sikerim",
  "orospu", "kahpe", "fahise", "surtuk", "pic", "pust", "ibne",
  "got", "gotveren", "yarrak", "yarak", "bok", "boktan",
  "salak", "aptal", "gerizekali", "fuck", "fucking", "shit", "bitch", "asshole", "bastard"
];

function TeacherDashboard() {
  const [ogrenciler, setOgrenciler] = useState([]);
  const [bildirimler, setBildirimler] = useState([]);
  const [ogretmenIsmi, setOgretmenIsmi] = useState("");
  const [ogretmenOkul, setOgretmenOkul] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [aktifSekme, setAktifSekme] = useState("paylasimlar");
  const [acikIcerik, setAcikIcerik] = useState({});
  const [postDetay, setPostDetay] = useState({});
  // Sinifim panel
  const [tumOgrenciler, setTumOgrenciler] = useState([]);
  const [secilenOgrenciler, setSecilenOgrenciler] = useState([]);
  const [sinifAcik, setSinifAcik] = useState(false);
  const [sinifArama, setSinifArama] = useState("");
  const [sinifKaydetYukleniyor, setSinifKaydetYukleniyor] = useState(false);
  // Ogretmen paylasimlar
  const [gonderiler, setGonderiler] = useState([]);
  const [yeniGonderi, setYeniGonderi] = useState("");
  const [gonderiYukleniyor, setGonderiYukleniyor] = useState(false);
  const [hataMesaj, setHataMesaj] = useState("");

  useEffect(() => {
    verileriGetir();
  }, []);

  const verileriGetir = async () => {
    const ogretmenDoc = await getDocFromServer(doc(db, "users", auth.currentUser.uid));
    const ogretmenData = ogretmenDoc.data();
    const sinif = ogretmenData?.sinif || [];
    setOgrenciler(sinif);
    setSecilenOgrenciler(sinif);
    setOgretmenIsmi(ogretmenData?.isim || auth.currentUser.email);
    setOgretmenOkul(ogretmenData?.okul || "");

    // Ogretmenin kendi paylasimlarini getir
    const postSnapshot = await getDocs(query(collection(db, "posts"), orderBy("tarih", "desc")));
    const tumPosts = postSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(g => g.yazarUid === auth.currentUser.uid && !g.adminSildi);
    setGonderiler(tumPosts);

    // Tum onaylanmis ogrenciler - sinif yonetimi icin
    const userSnapshot = await getDocs(collection(db, "users"));
    const hepsi = userSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "student" && u.onaylandi === true);
    setTumOgrenciler(hepsi);

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const ilgiliReports = tumReports.filter(r =>
      sinif.includes(r.bildirenUid) || sinif.includes(r.yazarUid)
    );
    setBildirimler(ilgiliReports);
    setYukleniyor(false);
  };

  const kufurKontrol = (metin) => {
    const kucuk = metin.toLowerCase();
    return KUFUR_LISTESI.some(k => kucuk.includes(k));
  };

  const gonderiYap = async () => {
    if (!yeniGonderi.trim()) return;
    if (kufurKontrol(yeniGonderi)) {
      setHataMesaj("⚠️ Uygunsuz kelime tespit edildi!");
      setTimeout(() => setHataMesaj(""), 3000);
      return;
    }
    setGonderiYukleniyor(true);
    await addDoc(collection(db, "posts"), {
      icerik: yeniGonderi,
      yazar: ogretmenIsmi,
      yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp(),
      begenenler: [],
      ogrenciSildi: false,
      veliKaldirdi: false,
      ogretmenKaldirdi: false,
      adminSildi: false,
      ogretmenPostu: true
    });
    setYeniGonderi("");
    // Listeyi guncelle
    const postSnapshot = await getDocs(query(collection(db, "posts"), orderBy("tarih", "desc")));
    const tumPosts = postSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(g => g.yazarUid === auth.currentUser.uid && !g.adminSildi);
    setGonderiler(tumPosts);
    setGonderiYukleniyor(false);
  };

  const gonderiSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi silmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      ogretmenKaldirdi: true,
      ogretmenKaldirmaTarihi: serverTimestamp(),
      ogretmenKaldiranUid: auth.currentUser.uid
    });
    setGonderiler(prev => prev.filter(g => g.id !== gonderiId));
  };

  const ogrenciToggle = (uid) => {
    setSecilenOgrenciler(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    );
  };

  const sinifKaydet = async () => {
    setSinifKaydetYukleniyor(true);
    await updateDoc(doc(db, "users", auth.currentUser.uid), { sinif: secilenOgrenciler });
    for (const uid of ogrenciler) {
      if (!secilenOgrenciler.includes(uid)) {
        await updateDoc(doc(db, "users", uid), { ogretmenUid: null, ogretmenIsim: null });
      }
    }
    for (const uid of secilenOgrenciler) {
      await updateDoc(doc(db, "users", uid), {
        ogretmenUid: auth.currentUser.uid,
        ogretmenIsim: ogretmenIsmi
      });
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
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, adminaIletti: true, ileten: ogretmenIsmi, iletenRol: "teacher" } : b
    ));
    alert("Bildirim admine iletildi!");
  };

  const postIcerikGoster = async (reportId, postId) => {
    const zatenAcik = acikIcerik[reportId];
    setAcikIcerik(prev => ({ ...prev, [reportId]: !zatenAcik }));
    if (!zatenAcik && !postDetay[postId]) {
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (postDoc.exists()) {
        setPostDetay(prev => ({ ...prev, [postId]: { id: postDoc.id, ...postDoc.data() } }));
      }
    }
  };

  // Okul filtreli + arama filtreli ogrenci listesi
  const filtrelenmisOgrenciler = tumOgrenciler.filter(o => {
    const ayniOkul = !ogretmenOkul || (o.okul || "").trim().toLowerCase() === ogretmenOkul.trim().toLowerCase();
    const aramaUyumu = !sinifArama || (o.isim || "").toLowerCase().includes(sinifArama.toLowerCase());
    return ayniOkul && aramaUyumu;
  });

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.ogretmenGordu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.ogretmenGordu).length;

  return (
    <div style={{ maxWidth: "650px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => setSecilenProfil(null)} mevcutKullaniciRol="teacher" />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ color: "#4f46e5", margin: "0 0 4px" }}>Ogretmen Paneli</h2>
          <p onClick={() => setSecilenProfil(auth.currentUser.uid)} style={{ margin: 0, fontSize: "13px", color: "#4f46e5", cursor: "pointer", fontWeight: "600" }}>👤 {ogretmenIsmi} {ogretmenOkul && `• 🏫 ${ogretmenOkul}`}</p>
        </div>
        <button onClick={() => signOut(auth)}
          style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          Cikis
        </button>
      </div>

      {/* Sinifim acilir panel */}
      <div style={{ marginBottom: "16px" }}>
        <button onClick={() => setSinifAcik(!sinifAcik)}
          style={{ width: "100%", padding: "12px 16px", background: "white", border: "1px solid #e5e7eb", borderRadius: sinifAcik ? "12px 12px 0 0" : "12px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <span style={{ fontWeight: "600", color: "#374151", fontSize: "14px" }}>
            👥 Sinifim — {secilenOgrenciler.length} ogrenci
          </span>
          <span style={{ color: "#6b7280", fontSize: "16px" }}>{sinifAcik ? "▲" : "▼"}</span>
        </button>

        {sinifAcik && (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "16px", boxShadow: "0 4px 8px rgba(0,0,0,0.06)" }}>
            {!ogretmenOkul && (
              <div style={{ background: "#fef3c7", color: "#92400e", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", marginBottom: "12px" }}>
                ⚠️ Profilinden okul bilgini ekle — sadece ayni okuldaki ogrenciler listelenecek.
              </div>
            )}
            <input type="text" placeholder="🔍 Ogrenci ara..."
              value={sinifArama} onChange={e => setSinifArama(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "13px", boxSizing: "border-box", marginBottom: "10px" }} />
            <div style={{ maxHeight: "280px", overflowY: "auto", marginBottom: "12px" }}>
              {filtrelenmisOgrenciler.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", padding: "12px" }}>
                  {ogretmenOkul ? "Ayni okuldaki ogrenci bulunamadi." : "Ogrenci bulunamadi."}
                </p>
              ) : (
                filtrelenmisOgrenciler.map(o => (
                  <div key={o.id} onClick={() => ogrenciToggle(o.id)}
                    style={{
                      padding: "8px 10px", borderRadius: "8px", marginBottom: "4px", cursor: "pointer",
                      background: secilenOgrenciler.includes(o.id) ? "#e0e7ff" : "#f9fafb",
                      border: secilenOgrenciler.includes(o.id) ? "1px solid #4f46e5" : "1px solid #e5e7eb",
                      display: "flex", justifyContent: "space-between", alignItems: "center"
                    }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: secilenOgrenciler.includes(o.id) ? "#4f46e5" : "#374151" }}>{o.isim}</p>
                      {o.sinif && <p style={{ margin: 0, fontSize: "11px", color: "#6b7280" }}>📚 {o.sinif}</p>}
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
              <button onClick={() => setSinifAcik(false)}
                style={{ padding: "10px 16px", background: "#e5e7eb", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px" }}>
                Kapat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sekmeler */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button onClick={() => setAktifSekme("paylasimlar")}
          style={{ flex: 1, padding: "10px", background: aktifSekme === "paylasimlar" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "paylasimlar" ? "white" : "#374151", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
          📢 Paylasimlarim
        </button>
        <button onClick={() => setAktifSekme("bildirimler")}
          style={{ flex: 1, padding: "10px", background: aktifSekme === "bildirimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "bildirimler" ? "white" : "#374151", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", position: "relative" }}>
          🚩 Bildirimler
          {yeniBildirimSayisi > 0 && (
            <span style={{ position: "absolute", top: "-6px", right: "-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
              {yeniBildirimSayisi}
            </span>
          )}
        </button>
      </div>

      {yukleniyor ? <p>Yukleniyor...</p> : aktifSekme === "paylasimlar" ? (
        <div>
          {/* Paylasim kutusu */}
          <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 8px" }}>
              📋 Sinifina duyuru veya bilgi paylas ({ogrenciler.length} ogrenci gorecek)
            </p>
            <textarea placeholder="Odev, duyuru, hatirlatma yazin..." value={yeniGonderi} onChange={e => setYeniGonderi(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", resize: "vertical", minHeight: "80px", boxSizing: "border-box", fontFamily: "inherit" }} />
            {hataMesaj && <div style={{ marginTop: "8px", padding: "8px 12px", background: "#fee2e2", color: "#ef4444", borderRadius: "8px", fontSize: "13px" }}>{hataMesaj}</div>}
            <button onClick={gonderiYap} disabled={gonderiYukleniyor}
              style={{ marginTop: "10px", padding: "10px 24px", background: "#4f46e5", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>
              {gonderiYukleniyor ? "Paylasiliyor..." : "📢 Paylas"}
            </button>
          </div>

          {/* Ogretmenin paylasimlar listesi */}
          {gonderiler.length === 0 ? (
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", textAlign: "center", color: "#888" }}>
              <p>Henuz paylasim yapmadınız.</p>
            </div>
          ) : (
            <>
              <h3 style={{ color: "#666", marginBottom: "12px", fontSize: "14px" }}>Paylasimlarim ({gonderiler.length})</h3>
              {gonderiler.map(g => {
                const begenenler = g.begenenler || [];
                return (
                  <div key={g.id} style={{ background: "white", padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px" }}>
                    <p style={{ margin: "0 0 10px", fontSize: "15px", color: "#111827" }}>{g.icerik}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <small style={{ color: "#6b7280", fontSize: "12px" }}>
                        {g.tarih ? new Date(g.tarih.seconds * 1000).toLocaleDateString("tr-TR") : ""}
                      </small>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#ef4444", borderRadius: "6px", fontSize: "12px" }}>
                          ❤️ {begenenler.length}
                        </span>
                        <button onClick={() => gonderiSil(g.id)}
                          style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                          🗑️ Sil
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      ) : (
        // Bildirimler sekmesi
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", textAlign: "center", color: "#888" }}>
              <p>Hic bildirim yok.</p>
            </div>
          ) : (
            bildirimler.map(b => (
              <div key={b.id} style={{
                background: "white", padding: "16px", borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px",
                border: b.acil && !b.ogretmenGordu ? "2px solid #ef4444" : "1px solid #e5e7eb",
                opacity: b.ogretmenSildi ? 0.7 : 1
              }}>
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
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#6b7280" }}>
                  📋 Sebep: <strong>{b.kategori}</strong>{b.digerSebep && <span> — "{b.digerSebep}"</span>}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280" }}>
                  💙 Bildiren cocugun durumu: {b.iyiMisin === "iyi" ? "😊 Iyi" : b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" : b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"}
                </p>
                <div style={{ background: "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "8px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px" }}>{b.icerikMetni}</p>
                  <small style={{ color: "#6b7280" }}>Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.yazar}</span></small>
                </div>
                {b.tip === "post" && (
                  <button onClick={() => postIcerikGoster(b.id, b.postId)}
                    style={{ fontSize: "12px", color: "#4f46e5", background: "none", border: "none", cursor: "pointer", padding: "0", marginBottom: "8px" }}>
                    {acikIcerik[b.id] ? "▲ Gonderiyi gizle" : "▼ Gonderiyi tam goster"}
                  </button>
                )}
                {acikIcerik[b.id] && postDetay[b.postId] && (
                  <div style={{ background: "#ede9fe", padding: "10px", borderRadius: "8px", marginBottom: "8px", fontSize: "13px" }}>
                    <p style={{ margin: 0 }}>{postDetay[b.postId].icerik}</p>
                  </div>
                )}
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 8px" }}>
                  🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.bildiren}</span>
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {!b.ogretmenGordu && (
                    <button onClick={() => bildirimOkundu(b.id)}
                      style={{ flex: "1 1 45%", padding: "6px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                      ✓ Okundu
                    </button>
                  )}
                  {!b.adminaIletti && (
                    <button onClick={() => adminIlet(b.id)}
                      style={{ flex: "1 1 45%", padding: "6px 12px", background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                      📨 Admine Ilet
                    </button>
                  )}
                  {!b.ogretmenSildi && (
                    <button onClick={() => bildirimKaldir(b.id)}
                      style={{ padding: "6px 12px", background: "#6b7280", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                      🗑️ Kaldir
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;