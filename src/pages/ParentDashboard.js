import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

function ParentDashboard() {
  const [cocukGonderiler, setCocukGonderiler] = useState([]);
  const [cocuklar, setCocuklar] = useState([]);
  const [cocukBilgileri, setCocukBilgileri] = useState({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dondurmeSuresi, setDondurmeSuresi] = useState({});

  useEffect(() => {
    const verileriGetir = async () => {
      const veliDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const cocuklarListesi = veliDoc.data().cocuklar || [];
      setCocuklar(cocuklarListesi);

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

  const handleDondur = async (kullaniciId) => {
    const sure = dondurmeSuresi[kullaniciId];
    if (!sure) { alert("Lutfen sure secin!"); return; }
    if (!window.confirm("Bu kullaniciyi dondurmak istediginizden emin misiniz?")) return;

    let bitis = null;
    const simdi = new Date();
    if (sure === "1saat") bitis = new Date(simdi.getTime() + 1 * 60 * 60 * 1000);
    else if (sure === "1gun") bitis = new Date(simdi.getTime() + 24 * 60 * 60 * 1000);
    else if (sure === "1hafta") bitis = new Date(simdi.getTime() + 7 * 24 * 60 * 60 * 1000);
    else if (sure === "1ay") bitis = new Date(simdi.getTime() + 30 * 24 * 60 * 60 * 1000);
    else if (sure === "suresiz") bitis = null;

    await updateDoc(doc(db, "users", kullaniciId), {
      dondurulmus: true,
      dondurulmaBitis: bitis ? bitis.toISOString() : null
    });

    setCocukBilgileri(prev => ({
      ...prev,
      [kullaniciId]: { ...prev[kullaniciId], dondurulmus: true, dondurulmaBitis: bitis ? bitis.toISOString() : null }
    }));

    alert("Kullanici donduruldu!");
  };

  const handleCoz = async (kullaniciId) => {
    if (!window.confirm("Dondurmayi kaldiirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", kullaniciId), {
      dondurulmus: false,
      dondurulmaBitis: null
    });
    setCocukBilgileri(prev => ({
      ...prev,
      [kullaniciId]: { ...prev[kullaniciId], dondurulmus: false, dondurulmaBitis: null }
    }));
    alert("Dondurma kaldirildi!");
  };

  const dondurmaBitisYazisi = (bitis) => {
    if (!bitis) return "Suresiz";
    const tarih = new Date(bitis);
    return tarih.toLocaleString("tr-TR");
  };

  return (
    <div style={{ maxWidth:"650px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5" }}>Veli Paneli</h2>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      {/* Cocuk Hesap Yonetimi */}
      {Object.values(cocukBilgileri).length > 0 && (
        <div style={{ marginBottom:"30px" }}>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>Hesap Yonetimi</h3>
          {Object.values(cocukBilgileri).map(cocuk => (
            <div key={cocuk.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                <div>
                  <strong>{cocuk.email || cocuk.id}</strong>
                  {cocuk.dondurulmus && (
                    <span style={{ marginLeft:"10px", background:"#fee2e2", color:"#ef4444", padding:"2px 8px", borderRadius:"10px", fontSize:"12px" }}>
                      🔒 Dondurulmus — {dondurmaBitisYazisi(cocuk.dondurulmaBitis)}
                    </span>
                  )}
                </div>
              </div>
              {!cocuk.dondurulmus ? (
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  <select
                    value={dondurmeSuresi[cocuk.id] || ""}
                    onChange={e => setDondurmeSuresi(prev => ({ ...prev, [cocuk.id]: e.target.value }))}
                    style={{ padding:"6px 10px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"13px" }}>
                    <option value="">Sure sec</option>
                    <option value="1saat">1 Saat</option>
                    <option value="1gun">1 Gun</option>
                    <option value="1hafta">1 Hafta</option>
                    <option value="1ay">1 Ay</option>
                    <option value="suresiz">Suresiz</option>
                  </select>
                  <button onClick={() => handleDondur(cocuk.id)}
                    style={{ padding:"6px 12px", background:"#f59e0b", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
                    🔒 Dondur
                  </button>
                </div>
              ) : (
                <button onClick={() => handleCoz(cocuk.id)}
                  style={{ padding:"6px 12px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
                  🔓 Dondurmayi Kaldir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gonderiler */}
      {yukleniyor ? (
        <p>Yukleniyor...</p>
      ) : cocukGonderiler.length === 0 ? (
        <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
          <p>Cocugunuzun hic paylasimi yok.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>Cocugunuzun Paylasimları ({cocukGonderiler.length})</h3>
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