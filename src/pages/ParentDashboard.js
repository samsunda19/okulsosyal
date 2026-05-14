import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

function ParentDashboard() {
  const [cocukGonderiler, setCocukGonderiler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const verileriGetir = async () => {
      const veliDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const cocuklar = veliDoc.data().cocuklar || [];

      const snapshot = await getDocs(collection(db, "posts"));
      const tumPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const cocukPosts = tumPosts.filter(p => cocuklar.includes(p.yazarUid));
      cocukPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setCocukGonderiler(cocukPosts);
      setYukleniyor(false);
    };
    verileriGetir();
  }, []);

  const handleSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi silmek istediginizden emin misiniz?")) return;
    await deleteDoc(doc(db, "posts", gonderiId));
    setCocukGonderiler(prev => prev.filter(g => g.id !== gonderiId));
  };

  return (
    <div style={{ maxWidth:"600px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5" }}>Veli Paneli</h2>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      {yukleniyor ? (
        <p>Yukleniyor...</p>
      ) : cocukGonderiler.length === 0 ? (
        <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
          <p>Cocugunuzun hic paylasimi yok.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>Cocugunuzun Paylasimları</h3>
          {cocukGonderiler.map(g => (
            <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
              <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <small style={{ color:"#888" }}>{g.yazar}</small>
                <button onClick={() => handleSil(g.id)}
                  style={{ padding:"6px 12px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
                  🗑️ Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ParentDashboard;