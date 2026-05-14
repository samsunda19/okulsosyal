import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function AdminDashboard() {
  const [gonderiler, setGonderiler] = useState([]);
  const [kullaniciler, setKullaniciler] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});

  useEffect(() => {
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
      setYukleniyor(false);
    };
    verileriGetir();
  }, []);

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

      {yukleniyor ? (
        <p>Yukleniyor...</p>
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