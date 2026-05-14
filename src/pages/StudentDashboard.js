import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function StudentDashboard() {
  const [gonderi, setGonderi] = useState("");
  const [gonderiler, setGonderiler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kullaniciIsim, setKullaniciIsim] = useState("");
  const [secilenProfil, setSecilenProfil] = useState(null);

  useEffect(() => {
    const isimGetir = async () => {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        setKullaniciIsim(userDoc.data().isim || auth.currentUser.email);
      }
    };
    isimGetir();
    gonderileriGetir();
  }, []);

  const gonderileriGetir = async () => {
    const q = query(collection(db, "posts"), orderBy("tarih", "desc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setGonderiler(liste);
  };

  const gonderiYap = async () => {
    if (!gonderi.trim()) return;
    setYukleniyor(true);
    await addDoc(collection(db, "posts"), {
      icerik: gonderi,
      yazar: kullaniciIsim || auth.currentUser.email,
      yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp()
    });
    setGonderi("");
    await gonderileriGetir();
    setYukleniyor(false);
  };

  const gonderiSil = async (id, yazarUid) => {
    if (yazarUid !== auth.currentUser.uid) return;
    await deleteDoc(doc(db, "posts", id));
    await gonderileriGetir();
  };

  return (
    <div style={{ maxWidth:"600px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi
          kullaniciId={secilenProfil}
          onKapat={() => setSecilenProfil(null)}
          mevcutKullaniciRol="student"
        />
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5", cursor:"pointer" }}
          onClick={() => setSecilenProfil(auth.currentUser.uid)}>
          Ogrenci Paneli
        </h2>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span
            onClick={() => setSecilenProfil(auth.currentUser.uid)}
            style={{ fontSize:"14px", color:"#4f46e5", cursor:"pointer", fontWeight:"600" }}>
            👤 {kullaniciIsim}
          </span>
          <button onClick={() => signOut(auth)}
            style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
            Cikis
          </button>
        </div>
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
          <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px", position:"relative" }}>
            <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
            <small
              onClick={() => setSecilenProfil(g.yazarUid)}
              style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>
              {g.yazar}
            </small>
            {g.yazarUid === auth.currentUser.uid && (
              <button onClick={() => gonderiSil(g.id, g.yazarUid)}
                style={{ position:"absolute", top:"12px", right:"12px", padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                Sil
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudentDashboard;