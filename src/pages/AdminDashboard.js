import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, orderBy, query, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

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
  const [bildirimler, setBildirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");
  const [gonderiArama, setGonderiArama] = useState("");
  const [karanlikMod, setKaranlikMod] = useState(() => localStorage.getItem("adminKaranlikMod") === "true");
  const [postDetay, setPostDetay] = useState({});
  const [acikBildirimPost, setAcikBildirimPost] = useState({});

  const bg = karanlikMod ? "#111827" : "#f9fafb";
  const kartBg = karanlikMod ? "#1f2937" : "white";
  const yaziRenk = karanlikMod ? "#f3f4f6" : "#111827";
  const ikincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";
  const inputBg = karanlikMod ? "#374151" : "white";
  const borderRenk = karanlikMod ? "#374151" : "#e5e7eb";

  useEffect(() => { verileriGetir(); }, []);

  const verileriGetir = async () => {
    const postSnapshot = await getDocs(collection(db, "posts"));
    const tumPosts = postSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    tumPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    setGonderiler(tumPosts);

    const userSnapshot = await getDocs(collection(db, "users"));
    const tumKullaniciler = {};
    userSnapshot.docs.forEach(d => {
      tumKullaniciler[d.id] = { id: d.id, ...d.data() };
    });
    setKullaniciler(tumKullaniciler);

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setBildirimler(tumReports.filter(r => r.adminaIletti === true && !r.adminSildi));

    setYukleniyor(false);
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



  const tarihFormat = (seconds) => {
    const d = new Date(seconds * 1000);
    return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  const filtrelenmisGonderiler = gonderiArama.trim()
    ? gonderiler.filter(g =>
        (g.icerik || "").toLowerCase().includes(gonderiArama.toLowerCase()) ||
        (g.yazar || "").toLowerCase().includes(gonderiArama.toLowerCase()))
    : gonderiler;

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.okundu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.okundu).length;

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.2s" }}>
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => setSecilenProfil(null)} mevcutKullaniciRol="admin" />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ color: "#7c3aed", margin: 0 }}>🛡️ Moderatör Paneli</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>☀️</span>
            <div onClick={() => { const yeni = !karanlikMod; setKaranlikMod(yeni); localStorage.setItem("adminKaranlikMod", yeni); }}
              style={{ width: "36px", height: "20px", borderRadius: "10px", background: karanlikMod ? "#7c3aed" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: karanlikMod ? "18px" : "2px", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>🌙</span>
          </div>
          <button onClick={() => signOut(auth)} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cikis</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        {[
          ["etkilesimler", "💬 Paylasimlar", 0],
          ["bildirimler", "🚩 Bildirimler", yeniBildirimSayisi]
        ].map(([key, label, badge]) => (
          <button key={key} onClick={() => setAktifSekme(key)}
            style={{ flex: "1 1 45%", padding: "10px", background: aktifSekme === key ? "#7c3aed" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === key ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px", position: "relative" }}>
            {label}
            {badge > 0 && (
              <span style={{ position: "absolute", top: "-6px", right: "-6px", background: key === "bildirimler" && acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {yukleniyor ? <p style={{ color: yaziRenk }}>Yukleniyor...</p> : aktifSekme === "bildirimler" ? (
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
                  {b.ileten && <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#7c3aed", fontWeight: "600" }}>📨 Ileten: {b.ileten} ({b.iletenRol === "teacher" ? "Ogretmen" : "Veli"})</p>}
                  <p style={{ margin: "0 0 6px", fontSize: "13px", color: ikincilYazi }}>📋 Sebep: <strong>{b.kategori}</strong>{b.digerSebep && <span> — "{b.digerSebep}"</span>}</p>
                  <p style={{ margin: "0 0 8px", fontSize: "13px", color: ikincilYazi }}>💙 Bildiren durumu: {b.iyiMisin === "iyi" ? "😊 Iyi" : b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" : b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"}</p>
                  <div style={{ background: karanlikMod ? "#374151" : "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "8px" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "14px", color: yaziRenk }}>{b.icerikMetni || "—"}</p>
                    {b.fotoUrl && <MedyaGoster url={b.fotoUrl} />}
                    <small style={{ color: ikincilYazi }}>Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color: "#7c3aed", cursor: "pointer", textDecoration: "underline" }}>{b.yazar}</span></small>
                  </div>
                  {b.postId && (
                    <button onClick={() => bildirimPostGoster(b.id, b.postId)}
                      style={{ fontSize: "12px", color: "#7c3aed", background: "none", border: "none", cursor: "pointer", padding: "0", marginBottom: "8px" }}>
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
                  <p style={{ fontSize: "12px", color: ikincilYazi, margin: "0 0 8px" }}>🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color: "#7c3aed", cursor: "pointer", textDecoration: "underline" }}>{b.bildiren}</span></p>
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
                        <small onClick={() => setSecilenProfil(g.yazarUid)} style={{ color: "#7c3aed", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}>{g.yazar}</small>
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
                            <small onClick={() => setSecilenProfil(y.yazarUid)} style={{ color: "#7c3aed", cursor: "pointer", textDecoration: "underline", fontSize: "12px" }}>{y.yazar}</small>
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