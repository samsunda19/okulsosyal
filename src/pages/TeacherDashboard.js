import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDocFromServer, getDoc, collection, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function TeacherDashboard() {
  const [gonderiler, setGonderiler] = useState([]);
  const [ogrenciBilgileri, setOgrenciBilgileri] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);

  useEffect(() => {
    const verileriGetir = async () => {
      const ogretmenDoc = await getDocFromServer(doc(db, "users", auth.currentUser.uid));
      const sinif = ogretmenDoc.data()?.sinif || [];

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
      const sinifPosts = tumPosts.filter(p => sinif.includes(p.yazarUid));
      sinifPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setGonderiler(sinifPosts);
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

      {yukleniyor ? (
        <p>Yukleniyor...</p>
      ) : gonderiler.length === 0 ? (
        <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
          <p>Sinifınızda hic paylasim yok.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>
            Sinif Paylasımları ({gonderiler.length} paylasim)
          </h3>
          {gonderiler.map(g => {
            const yazarOgrenci = ogrenciBilgileri[g.yazarUid];
            const dondurulmus = yazarOgrenci?.dondurulmus;
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

export default TeacherDashboard;