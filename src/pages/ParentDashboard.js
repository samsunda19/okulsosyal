import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

function ParentDashboard() {
  const [cocukGonderiler, setCocukGonderiler] = useState([]);
  const [cocukBilgileri, setCocukBilgileri] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenCocuk, setSecilenCocuk] = useState(null);
  const [dondurmeSuresi, setDondurmeSuresi] = useState("");

  useEffect(() => {
    const verileriGetir = async () => {
      const veliDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const cocuklarListesi = veliDoc.data().cocuklar || [];

      const cocukBilgi = {};
      for (const uid of cocuklarListesi) {
        const cocukDoc = await getDoc(doc(db, "users", uid));
        if (cocukDoc.exists()) {
          cocukBilgi[uid] = { id: uid, ...cocukDoc.data() };
        }
      }
      setCocukBilgileri(cocukBilgi);

      const snapshot = await getDocs(collection(db, "posts"));
      const tumPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const cocukPosts = tumPosts.filter(p => cocuklarListesi.includes(p.yazarUid));
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

  const handleYazarTikla = (yazarUid) => {
    const cocuk = cocukBilgileri[yazarUid];
    if (cocuk) setSecilenCocuk(cocuk);
  };

  const handleDondur = async () => {
    if (!dondurmeSuresi) { alert("Lutfen sure secin!"); return; }

    let bitis = null;
    const simdi = new Date();
    if (dondurmeSuresi === "1saat") bitis = new Date(simdi.getTime() + 1 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "1gun") bitis = new Date(simdi.getTime() + 24 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "1hafta") bitis = new Date(simdi.getTime() + 7 * 24 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "1ay") bitis = new Date(simdi.getTime() + 30 * 24 * 60 * 60 * 1000);
    else if (dondurmeSuresi === "suresiz") bitis = null;

    await updateDoc(doc(db, "users", secilenCocuk.id), {
      dondurulmus: true,
      dondurulmaBitis: bitis ? bitis.toISOString() : null
    });

    setCocukBilgileri(prev => ({
      ...prev,
      [secilenCocuk.id]: {
        ...prev[secilenCocuk.id],
        dondurulmus: true,
        dondurulmaBitis: bitis ? bitis.toISOString() : null
      }
    }));

    setSecilenCocuk(null);
    setDondurmeSuresi("");
    alert("Hesap donduruldu!");
  };

  const handleCoz = async () => {
    await updateDoc(doc(db, "users", secilenCocuk.id), {
      dondurulmus: false,
      dondurulmaBitis: null
    });
    setCocukBilgileri(prev => ({
      ...prev,
      [secilenCocuk.id]: { ...prev[secilenCocuk.id], dondurulmus: false, dondurulmaBitis: null }
    }));
    setSecilenCocuk(null);
    alert("Dondurma kaldirildi!");
  };

  const dondurmaBitisYazisi = (bitis) => {
    if (!bitis) return "Suresiz";
    return new Date(bitis).toLocaleString("tr-TR");
  };

  return (
    <div style={{ maxWidth:"650px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>

      {/* Modal */}
      {secilenCocuk && (
        <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>
          <div style={{ background:"white", padding:"30px", borderRadius:"16px", width:"320px" }}>
            <h3 style={{ marginBottom:"8px", color:"#1f2937" }}>Hesap Yonetimi</h3>
            <p style={{ color:"#6b7280", fontSize:"14px", marginBottom:"20px" }}>
              <strong>{secilenCocuk.email}</strong>
            </p>

            {secilenCocuk.dondurulmus ? (
              <>
                <p style={{ color:"#ef4444", fontSize:"14px", marginBottom:"16px" }}>
                  🔒 Dondurulmus — {dondurmaBitisYazisi(secilenCocuk.dondurulmaBitis)}
                </p>
                <div style={{ display:"flex", gap:"10px" }}>
                  <button onClick={handleCoz}
                    style={{ flex:1, padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    🔓 Dondurmayi Kaldir
                  </button>
                  <button onClick={() => { setSecilenCocuk(null); setDondurmeSuresi(""); }}
                    style={{ flex:1, padding:"10px", background:"#e5e7eb", color:"#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    Iptal
                  </button>
                </div>
              </>
            ) : (
              <>
                <select
                  value={dondurmeSuresi}
                  onChange={e => setDondurmeSuresi(e.target.value)}
                  style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"14px", marginBottom:"16px" }}>
                  <option value="">Sure secin</option>
                  <option value="1saat">1 Saat</option>
                  <option value="1gun">1 Gun</option>
                  <option value="1hafta">1 Hafta</option>
                  <option value="1ay">1 Ay</option>
                  <option value="suresiz">Suresiz</option>
                </select>
                <div style={{ display:"flex", gap:"10px" }}>
                  <button onClick={handleDondur}
                    style={{ flex:1, padding:"10px", background:"#f59e0b", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    🔒 Dondur
                  </button>
                  <button onClick={() => { setSecilenCocuk(null); setDondurmeSuresi(""); }}
                    style={{ flex:1, padding:"10px", background:"#e5e7eb", color:"#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                    Iptal
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
          <h3 style={{ color:"#666", marginBottom:"16px" }}>
            Cocugunuzun Paylasimları ({cocukGonderiler.length})
          </h3>
          {cocukGonderiler.map(g => {
            const yazarCocuk = cocukBilgileri[g.yazarUid];
            const dondurulmus = yazarCocuk?.dondurulmus;
            return (
              <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
                <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <small
                      onClick={() => handleYazarTikla(g.yazarUid)}
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

export default ParentDashboard;