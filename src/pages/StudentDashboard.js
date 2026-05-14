import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";

function StudentDashboard() {
  const [gonderi, setGonderi] = useState("");
  const [gonderiler, setGonderiler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const gonderileriGetir = async () => {
    const q = query(collection(db, "posts"), orderBy("tarih", "desc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setGonderiler(liste);
  };

  useEffect(() => {
    gonderileriGetir();
  }, []);

  const gonderiYap = async () => {
    if (!gonderi.trim()) return;
    setYukleniyor(true);
    await addDoc(collection(db, "posts"), {
      icerik: gonderi,
      yazar: auth.currentUser.email,
      yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp()
    });
    setGonderi("");
    await gonderileriGetir();
    setYukleniyor(false);
  };

  return (
    <div style={{ maxWidth:"600px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5" }}>Ogrenci Paneli</h2>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      <div style={{ background:"white", padding:"20px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"24px" }}>
        <textarea
          placeholder="Ne dusunuyorsun?"
          value={gonderi}
          onChange={e => setGonderi(e.target.value)}
          style={{ width:"100%", padding:"12px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"15px", resize:"vertical", minHeight:"80px", boxSizing:"border-box" }}
        />
        <button onClick={gonderiYap} disabled={yukleniyor}
          style={{ marginTop:"10px", padding:"10px 24px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"15px" }}>
          {yukleniyor ? "Paylasiliyor..." : "Paylas"}
        </button>
      </div>

      <div>
        {gonderiler.map(g => (
          <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
            <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
            <small style={{ color:"#888" }}>{g.yazar}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentDashboard;