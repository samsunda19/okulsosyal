import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, deleteDoc, doc, orderBy, query, updateDoc, arrayUnion } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

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

  useEffect(() => {
    verileriGetir();
  }, []);

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
      if (data.role === "student" && data.onaylandi === false) {
        bekleyenListesi.push(data);
      }
    });
    setKullaniciler(tumKullaniciler);
    setBekleyenler(bekleyenListesi);

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const adminBildirimler = tumReports.filter(r => {
      const iletilmis = r.adminIletildi === true;
      const kaldirilmis = (r.kaldirildi || []).includes(auth.currentUser.uid);
      return iletilmis && !kaldirilmis;
    });
    setBildirimler(adminBildirimler);

    setYukleniyor(false);
  };

  const handleSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi silmek istediginizden emin misiniz?")) return;
    await deleteDoc(doc(db, "posts", gonderiId));
    setGonderiler(prev => prev.filter(g => g.id !== gonderiId));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setYorumlar(prev => ({ ...prev, [postId]: liste }));
  };

  const yorumToggle = async (postId) => {
    const acik = !acikYorumlar[postId];
    setAcikYorumlar(prev => ({ ...prev, [postId]: acik }));
    if (acik && !yorumlar[postId]) {
      await yorumlariGetir(postId);
    }
  };

  const yorumSil = async (postId, yorumId) => {
    if (!window.confirm("Bu yorumu silmek istediginizden emin misiniz?")) return;
    await deleteDoc(doc(db, "posts", postId, "comments", yorumId));
    await yorumlariGetir(postId);
  };

  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), { okundu: true });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, okundu: true } : b));
  };

  const bildirimKaldir = async (reportId) => {
    if (!window.confirm("Bu bildirimi listeden kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      kaldirildi: arrayUnion(auth.currentUser.uid)
    });
    setBildirimler(prev => prev.filter(b => b.id !== reportId));
  };

  const kullaniciOnayla = async (kullaniciId) => {
    await updateDoc(doc(db, "users", kullaniciId), { onaylandi: true });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    alert("Kullanici onaylandi!");
  };

  const kullaniciReddet = async (kullaniciId) => {
    if (!window.confirm("Bu kayit talebini reddedip silmek istediginizden emin misiniz?")) return;
    await deleteDoc(doc(db, "users", kullaniciId));
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    alert("Kayit reddedildi!");
  };

  const aramaSonuclari = aramaMetni.trim()
    ? Object.values(kullaniciler).filter(k => {
        const arama = aramaMetni.toLowerCase();
        return (k.isim || "").toLowerCase().includes(arama) ||
               (k.email || "").toLowerCase().includes(arama);
      })
    : [];

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.okundu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.okundu).length;
  const bekleyenSayisi = bekleyenler.length;

  return (
    <div style={{ maxWidth:"700px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi
          kullaniciId={secilenProfil}
          onKapat={() => setSecilenProfil(null)}
          mevcutKullaniciRol="admin"
        />
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5" }}>Admin Paneli</h2>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      <div style={{ background:"white", padding:"12px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"16px" }}>
        <input
          type="text"
          placeholder="🔍 Kullanici ara (isim veya email)..."
          value={aramaMetni}
          onChange={e => setAramaMetni(e.target.value)}
          style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"14px", boxSizing:"border-box" }}
        />
        {aramaMetni.trim() && (
          <div style={{ marginTop:"10px" }}>
            <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>
              {aramaSonuclari.length} sonuc bulundu
            </p>
            {aramaSonuclari.slice(0, 10).map(k => (
              <div key={k.id}
                onClick={() => { setSecilenProfil(k.id); setAramaMetni(""); }}
                style={{ padding:"8px 10px", background:"#f9fafb", borderRadius:"8px", marginBottom:"4px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ margin:"0", fontSize:"13px", fontWeight:"600" }}>{k.isim || "Isimsiz"}</p>
                  <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>{k.email}</p>
                </div>
                <div style={{ display:"flex", gap:"4px" }}>
                  <span style={{ padding:"2px 6px", background:"#e0e7ff", color:"#4f46e5", borderRadius:"4px", fontSize:"10px" }}>
                    {k.role}
                  </span>
                  {k.dondurulmus && (
                    <span style={{ padding:"2px 6px", background:"#fee2e2", color:"#ef4444", borderRadius:"4px", fontSize:"10px" }}>
                      🔒
                    </span>
                  )}
                </div>
              </div>
            ))}
            {aramaSonuclari.length > 10 && (
              <p style={{ fontSize:"11px", color:"#9ca3af", textAlign:"center", margin:"8px 0 0" }}>
                ve {aramaSonuclari.length - 10} sonuc daha...
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:"6px", marginBottom:"20px", flexWrap:"wrap" }}>
        <button onClick={() => setAktifSekme("etkilesimler")}
          style={{ flex:"1 1 30%", padding:"10px", background: aktifSekme === "etkilesimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "etkilesimler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>
          💬 Paylasimlar
        </button>
        <button onClick={() => setAktifSekme("bildirimler")}
          style={{ flex:"1 1 30%", padding:"10px", background: aktifSekme === "bildirimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "bildirimler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", position:"relative", fontSize:"13px" }}>
          🚩 Bildirimler
          {yeniBildirimSayisi > 0 && (
            <span style={{ position:"absolute", top:"-6px", right:"-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color:"white", borderRadius:"50%", width:"22px", height:"22px", fontSize:"11px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
              {yeniBildirimSayisi}
            </span>
          )}
        </button>
        <button onClick={() => setAktifSekme("bekleyenler")}
          style={{ flex:"1 1 30%", padding:"10px", background: aktifSekme === "bekleyenler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "bekleyenler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", position:"relative", fontSize:"13px" }}>
          ⏳ Onaylar
          {bekleyenSayisi > 0 && (
            <span style={{ position:"absolute", top:"-6px", right:"-6px", background:"#10b981", color:"white", borderRadius:"50%", width:"22px", height:"22px", fontSize:"11px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
              {bekleyenSayisi}
            </span>
          )}
        </button>
      </div>

      {yukleniyor ? (
        <p>Yukleniyor...</p>
      ) : aktifSekme === "bekleyenler" ? (
        <div>
          {bekleyenler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
              <p>Onay bekleyen kullanici yok.</p>
            </div>
          ) : (
            <>
              <h3 style={{ color:"#666", marginBottom:"16px" }}>
                Onay Bekleyen Kullanicilar ({bekleyenler.length})
              </h3>
              {bekleyenler.map(k => (
                <div key={k.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
                  <p style={{ margin:"0 0 4px", fontSize:"15px", fontWeight:"600" }}>{k.isim}</p>
                  <p style={{ margin:"0 0 12px", fontSize:"13px", color:"#6b7280" }}>📧 {k.email}</p>
                  <div style={{ display:"flex", gap:"8px" }}>
                    <button onClick={() => kullaniciOnayla(k.id)}
                      style={{ flex:1, padding:"8px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>
                      ✓ Onayla
                    </button>
                    <button onClick={() => kullaniciReddet(k.id)}
                      style={{ flex:1, padding:"8px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>
                      ✗ Reddet
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : aktifSekme === "bildirimler" ? (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
              <p>Hic bildirim yok.</p>
              <p style={{ fontSize:"12px", marginTop:"8px" }}>(Sadece veli/ogretmen tarafindan iletilen bildirimler burada gorunur)</p>
            </div>
          ) : (
            <>
              <h3 style={{ color:"#666", marginBottom:"16px" }}>
                Iletilen Bildirimler ({bildirimler.length})
              </h3>
              {bildirimler.map(b => (
                <div key={b.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px", border: b.acil && !b.okundu ? "2px solid #ef4444" : "none" }}>
                  {b.acil && !b.okundu && (
                    <div style={{ background:"#fee2e2", color:"#991b1b", padding:"6px 10px", borderRadius:"6px", fontSize:"12px", marginBottom:"8px", fontWeight:"700" }}>
                      🚨 ACIL: Cocuk yardim istiyor!
                    </div>
                  )}
                  {!b.okundu && !b.acil && (
                    <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", marginBottom:"6px", display:"inline-block", fontWeight:"600" }}>
                      YENI
                    </span>
                  )}
                  {b.ileten && (
                    <p style={{ margin:"0 0 6px", fontSize:"12px", color:"#4f46e5", fontWeight:"600" }}>
                      📨 Ileten: {b.ileten} ({b.iletenRol === "teacher" ? "Ogretmen" : "Veli"})
                    </p>
                  )}
                  <p style={{ margin:"0 0 6px", fontSize:"13px", color:"#6b7280" }}>
                    📋 Sebep: <strong>{b.kategori}</strong>
                    {b.digerSebep && <span> — "{b.digerSebep}"</span>}
                  </p>
                  <p style={{ margin:"0 0 8px", fontSize:"13px", color:"#6b7280" }}>
                    💙 Bildiren durumu: {
                      b.iyiMisin === "iyi" ? "😊 Iyi" :
                      b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" :
                      b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"
                    }
                  </p>
                  <div style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"8px" }}>
                    <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{b.icerikMetni}</p>
                    <small style={{ color:"#6b7280" }}>
                      Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.yazar}</span>
                    </small>
                  </div>
                  <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>
                    🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.bildiren}</span>
                  </p>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {!b.okundu && (
                      <button onClick={() => bildirimOkundu(b.id)}
                        style={{ flex:1, padding:"6px 12px", background:"#10b981", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>
                        ✓ Okundu olarak isaretle
                      </button>
                    )}
                    <button onClick={() => bildirimKaldir(b.id)}
                      style={{ padding:"6px 12px", background:"#6b7280", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                      🗑️ Kaldir
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : gonderiler.length === 0 ? (
        <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
          <p>Hic paylasim yok.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>
            Tum Paylasimlar ({gonderiler.length} paylasim)
          </h3>
          {gonderiler.map(g => {
            const yazarKullanici = Object.values(kullaniciler).find(k => k.id === g.yazarUid);
            const dondurulmus = yazarKullanici?.dondurulmus;
            const begenenler = g.begenenler || [];
            return (
              <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
                <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <small
                      onClick={() => setSecilenProfil(g.yazarUid)}
                      style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"13px" }}>
                      {g.yazar}
                    </small>
                    {dondurulmus && (
                      <span style={{ background:"#fee2e2", color:"#ef4444", padding:"2px 6px", borderRadius:"8px", fontSize:"11px" }}>
                        🔒 Dondurulmus
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <span style={{ padding:"4px 10px", background:"#fee2e2", color:"#ef4444", borderRadius:"6px", fontSize:"12px" }}>
                      ❤️ {begenenler.length}
                    </span>
                    <button onClick={() => yorumToggle(g.id)}
                      style={{ padding:"4px 10px", background:"#e0e7ff", color:"#4f46e5", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                      💬 {yorumlar[g.id] ? yorumlar[g.id].length : ""} Yorum
                    </button>
                    <button onClick={() => handleSil(g.id)}
                      style={{ padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                      🗑️ Sil
                    </button>
                  </div>
                </div>

                {acikYorumlar[g.id] && (
                  <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid #f0f4ff" }}>
                    {yorumlar[g.id] && yorumlar[g.id].length === 0 && (
                      <p style={{ color:"#9ca3af", fontSize:"13px", textAlign:"center" }}>Hic yorum yok.</p>
                    )}
                    {yorumlar[g.id] && yorumlar[g.id].map(y => (
                      <div key={y.id} style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"6px", position:"relative" }}>
                        <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{y.icerik}</p>
                        <small
                          onClick={() => setSecilenProfil(y.yazarUid)}
                          style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"12px" }}>
                          {y.yazar}
                        </small>
                        <button onClick={() => yorumSil(g.id, y.id)}
                          style={{ position:"absolute", top:"8px", right:"8px", padding:"2px 8px", background:"#ef4444", color:"white", border:"none", borderRadius:"5px", cursor:"pointer", fontSize:"11px" }}>
                          Sil
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;