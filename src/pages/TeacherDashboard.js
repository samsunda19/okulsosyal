import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDocFromServer, getDoc, collection, getDocs, deleteDoc, orderBy, query, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function TeacherDashboard() {
  const [tumGonderiler, setTumGonderiler] = useState([]);
  const [ogrenciler, setOgrenciler] = useState([]);
  const [ogrenciBilgileri, setOgrenciBilgileri] = useState({});
  const [bildirimler, setBildirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");

  useEffect(() => {
    const verileriGetir = async () => {
      const ogretmenDoc = await getDocFromServer(doc(db, "users", auth.currentUser.uid));
      const sinif = ogretmenDoc.data()?.sinif || [];
      setOgrenciler(sinif);

      const ogrenciBilgi = {};
      for (const uid of sinif) {
        const ogrenciDoc = await getDoc(doc(db, "users", uid));
        if (ogrenciDoc.exists()) {
          ogrenciBilgi[uid] = { id: uid, ...ogrenciDoc.data() };
        }
      }
      setOgrenciBilgileri(ogrenciBilgi);

      const snapshot = await getDocs(collection(db, "posts"));
      const tumPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const ilgiliPostlar = [];
      for (const post of tumPosts) {
        if (sinif.includes(post.yazarUid)) {
          ilgiliPostlar.push({ ...post, ogrenciYazari: true });
          continue;
        }
        const yorumSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));
        const yorumlarListesi = yorumSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const ogrenciYorumu = yorumlarListesi.some(y => sinif.includes(y.yazarUid));
        if (ogrenciYorumu) {
          ilgiliPostlar.push({ ...post, ogrenciYazari: false });
        }
      }

      ilgiliPostlar.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setTumGonderiler(ilgiliPostlar);

      // Bildirimleri cek - ogrenci ile ilgili olanlar
      const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
      const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const ilgiliReports = tumReports.filter(r =>
        sinif.includes(r.bildirenUid) || sinif.includes(r.yazarUid)
      );
      setBildirimler(ilgiliReports);

      setYukleniyor(false);
    };
    verileriGetir();
  }, []);

  const handleSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi silmek istediginizden emin misiniz?")) return;
    await deleteDoc(doc(db, "posts", gonderiId));
    setTumGonderiler(prev => prev.filter(g => g.id !== gonderiId));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    const tumYorumlar = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtrelenmis = tumYorumlar.filter(y => ogrenciler.includes(y.yazarUid));
    setYorumlar(prev => ({ ...prev, [postId]: filtrelenmis }));
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

  const bildirimSil = async (reportId) => {
    if (!window.confirm("Bu bildirimi silmek istediginizden emin misiniz?")) return;
    await deleteDoc(doc(db, "reports", reportId));
    setBildirimler(prev => prev.filter(b => b.id !== reportId));
  };

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.okundu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.okundu).length;

  return (
    <div style={{ maxWidth:"650px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi
          kullaniciId={secilenProfil}
          onKapat={() => setSecilenProfil(null)}
          mevcutKullaniciRol="teacher"
        />
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5" }}>Ogretmen Paneli</h2>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      {/* Sekme */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
        <button onClick={() => setAktifSekme("etkilesimler")}
          style={{ flex:1, padding:"10px", background: aktifSekme === "etkilesimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "etkilesimler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
          💬 Etkilesimler
        </button>
        <button onClick={() => setAktifSekme("bildirimler")}
          style={{ flex:1, padding:"10px", background: aktifSekme === "bildirimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "bildirimler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", position:"relative" }}>
          🚩 Bildirimler
          {yeniBildirimSayisi > 0 && (
            <span style={{ position:"absolute", top:"-6px", right:"-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color:"white", borderRadius:"50%", width:"22px", height:"22px", fontSize:"11px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
              {yeniBildirimSayisi}
            </span>
          )}
        </button>
      </div>

      {yukleniyor ? (
        <p>Yukleniyor...</p>
      ) : aktifSekme === "bildirimler" ? (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
              <p>Hic bildirim yok.</p>
            </div>
          ) : (
            bildirimler.map(b => (
              <div key={b.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px", border: b.acil && !b.okundu ? "2px solid #ef4444" : "none" }}>
                {b.acil && !b.okundu && (
                  <div style={{ background:"#fee2e2", color:"#991b1b", padding:"6px 10px", borderRadius:"6px", fontSize:"12px", marginBottom:"8px", fontWeight:"700" }}>
                    🚨 ACIL: Ogrenci yardim istiyor!
                  </div>
                )}
                {!b.okundu && !b.acil && (
                  <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", marginBottom:"6px", display:"inline-block", fontWeight:"600" }}>
                    YENI
                  </span>
                )}
                <p style={{ margin:"0 0 6px", fontSize:"13px", color:"#6b7280" }}>
                  📋 Sebep: <strong>{b.kategori}</strong>
                  {b.digerSebep && <span> — "{b.digerSebep}"</span>}
                </p>
                <p style={{ margin:"0 0 8px", fontSize:"13px", color:"#6b7280" }}>
                  💙 Bildiren cocugun durumu: {
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
                  <button onClick={() => bildirimSil(b.id)}
                    style={{ padding:"6px 12px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                    🗑️ Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : tumGonderiler.length === 0 ? (
        <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
          <p>Sinifınızda hic etkilesim yok.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>
            Sinif Etkilesimleri ({tumGonderiler.length})
          </h3>
          {tumGonderiler.map(g => {
            const yazarOgrenci = ogrenciBilgileri[g.yazarUid];
            const dondurulmus = yazarOgrenci?.dondurulmus;
            const begenenler = g.begenenler || [];
            return (
              <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
                {!g.ogrenciYazari && (
                  <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"8px", fontSize:"11px", marginBottom:"8px", display:"inline-block" }}>
                    💬 Ogrenciniz yorum yapti
                  </span>
                )}
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
                      💬 Ogrencimin Yorumlari
                    </button>
                    {g.ogrenciYazari && (
                      <button onClick={() => handleSil(g.id)}
                        style={{ padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                        🗑️ Sil
                      </button>
                    )}
                  </div>
                </div>

                {acikYorumlar[g.id] && (
                  <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid #f0f4ff" }}>
                    {yorumlar[g.id] && yorumlar[g.id].length === 0 && (
                      <p style={{ color:"#9ca3af", fontSize:"13px", textAlign:"center" }}>Ogrencinizin yorumu yok.</p>
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

export default TeacherDashboard;