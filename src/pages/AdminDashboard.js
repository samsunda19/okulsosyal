import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function AdminDashboard() {
  const [gonderiler, setGonderiler] = useState([]);
  const [kullaniciler, setKullaniciler] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);

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
                  <button onClick={() => handleSil(g.id)}
                    style={{ padding:"6px 12px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
                    🗑️ Sil
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;