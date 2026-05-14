import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDocFromServer, collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";

function TeacherDashboard() {
  const [gonderiler, setGonderiler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const verileriGetir = async () => {
      const ogretmenDoc = await getDocFromServer(doc(db, "users", auth.currentUser.uid));
      const sinif = ogretmenDoc.data()?.sinif || [];

      const snapshot = await getDocs(collection(db, "posts"));
      const tumPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const sinifPosts = tumPosts.filter(p => sinif.includes(p.yazarUid));
      sinifPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setGonderiler(sinifPosts);
      setYukleniyor(false);
    };
    verileriGetir();
  }, []);

  return (
    <div style={{ maxWidth:"600px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>
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
          <h3 style={{ color:"#666", marginBottom:"16px" }}>Sinif Paylasımları</h3>
          {gonderiler.map(g => (
            <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
              <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
              <small style={{ color:"#888" }}>{g.yazar}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;