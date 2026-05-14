import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";

function ProfilSayfasi({ kullaniciId, onKapat, mevcutKullaniciRol }) {
  const [profil, setProfil] = useState(null);
  const [gonderiler, setGonderiler] = useState([]);
  const [duzenliyor, setDuzenliyor] = useState(false);
  const [isim, setIsim] = useState("");
  const [sinif, setSinif] = useState("");
  const [okul, setOkul] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [dondurmModal, setDondurmModal] = useState(false);
  const [dondurmeSuresi, setDondurmeSuresi] = useState("");

  const benimProfilim = kullaniciId === auth.currentUser.uid;
  const yetkili = ["admin", "teacher", "parent"].includes(mevcutKullaniciRol);

  useEffect(() => {
    const getir = async () => {
      const userDoc = await getDoc(doc(db, "users", kullaniciId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfil(data);
        setIsim(data.isim || "");
        setSinif(data.sinif || "");
        setOkul(data.okul || "");
      }

      const snapshot = await getDocs(collection(db, "posts"));
      const tumPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const kullaniciPosts = tumPosts.filter(p => p.yazarUid === kullaniciId);
      kullaniciPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setGonderiler(kullaniciPosts);
      setYukleniyor(false);
    };
    getir();
  }, [kullaniciId]);

  const handleKaydet = async () => {
    await updateDoc(doc(db, "users", kullaniciId), { isim, sinif, okul });
    setProfil(prev => ({ ...prev, isim, sinif, okul }));
    setDuzenliyor(false);
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

    await updateDoc(doc(db, "users", kullaniciId), {
      dondurulmus: true,
      dondurulmaBitis: bitis ? bitis.toISOString() : null
    });
    setProfil(prev => ({ ...prev, dondurulmus: true, dondurulmaBitis: bitis ? bitis.toISOString() : null }));
    setDondurmModal(false);
    setDondurmeSuresi("");
    alert("Hesap donduruldu!");
  };

  const handleCoz = async () => {
    await updateDoc(doc(db, "users", kullaniciId), { dondurulmus: false, dondurulmaBitis: null });
    setProfil(prev => ({ ...prev, dondurulmus: false, dondurulmaBitis: null }));
    alert("Dondurma kaldirildi!");
  };

  if (yukleniyor) return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>
      <div style={{ background:"white", padding:"30px", borderRadius:"16px" }}>Yukleniyor...</div>
    </div>
  );

  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>

      {dondurmModal && (
        <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.7)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:1000 }}>
          <div style={{ background:"white", padding:"30px", borderRadius:"16px", width:"300px" }}>
            <h3 style={{ marginBottom:"16px" }}>Hesap Dondur</h3>
            <select value={dondurmeSuresi} onChange={e => setDondurmeSuresi(e.target.value)}
              style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ddd", marginBottom:"16px" }}>
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
              <button onClick={() => setDondurmModal(false)}
                style={{ flex:1, padding:"10px", background:"#e5e7eb", border:"none", borderRadius:"8px", cursor:"pointer" }}>
                Iptal
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background:"white", borderRadius:"20px", width:"90%", maxWidth:"500px", maxHeight:"85vh", overflowY:"auto", padding:"30px", position:"relative" }}>

        <button onClick={onKapat}
          style={{ position:"absolute", top:"16px", right:"16px", background:"#e5e7eb", border:"none", borderRadius:"50%", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>
          ✕
        </button>

        <div style={{ textAlign:"center", marginBottom:"20px" }}>
          <div style={{ width:"80px", height:"80px", borderRadius:"50%", background:"linear-gradient(135deg, #6C63FF, #FF6584)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px", margin:"0 auto 10px" }}>
            👤
          </div>

          {duzenliyor ? (
            <input value={isim} onChange={e => setIsim(e.target.value)}
              style={{ fontSize:"20px", fontWeight:"700", textAlign:"center", border:"1px solid #ddd", borderRadius:"8px", padding:"6px 12px", width:"100%", boxSizing:"border-box" }} />
          ) : (
            <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#1f2937", margin:"0" }}>
              {profil?.isim || profil?.email}
            </h2>
          )}

          {profil?.dondurulmus && (
            <span style={{ background:"#fee2e2", color:"#ef4444", padding:"3px 10px", borderRadius:"10px", fontSize:"12px", marginTop:"6px", display:"inline-block" }}>
              🔒 Dondurulmus
            </span>
          )}
        </div>

        <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"20px" }}>
          {duzenliyor ? (
            <>
              <div style={{ marginBottom:"12px" }}>
                <label style={{ fontSize:"13px", color:"#6b7280", display:"block", marginBottom:"4px" }}>Sinif</label>
                <input value={sinif} onChange={e => setSinif(e.target.value)} placeholder="Sinif (orn: 5-A)"
                  style={{ width:"100%", padding:"8px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:"13px", color:"#6b7280", display:"block", marginBottom:"4px" }}>Okul</label>
                <input value={okul} onChange={e => setOkul(e.target.value)} placeholder="Okul adi"
                  style={{ width:"100%", padding:"8px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
              </div>
            </>
          ) : (
            <>
              {profil?.sinif && <p style={{ margin:"0 0 8px", fontSize:"14px", color:"#374151" }}>📚 Sinif: <strong>{profil.sinif}</strong></p>}
              {profil?.okul && <p style={{ margin:"0 0 8px", fontSize:"14px", color:"#374151" }}>🏫 Okul: <strong>{profil.okul}</strong></p>}
              <p style={{ margin:"0", fontSize:"14px", color:"#374151" }}>📧 {profil?.email}</p>
            </>
          )}
        </div>

        <div style={{ display:"flex", gap:"10px", marginBottom:"20px" }}>
          {benimProfilim && (
            duzenliyor ? (
              <>
                <button onClick={handleKaydet}
                  style={{ flex:1, padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                  💾 Kaydet
                </button>
                <button onClick={() => setDuzenliyor(false)}
                  style={{ flex:1, padding:"10px", background:"#e5e7eb", border:"none", borderRadius:"8px", cursor:"pointer" }}>
                  Vazgec
                </button>
              </>
            ) : (
              <button onClick={() => setDuzenliyor(true)}
                style={{ flex:1, padding:"10px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                ✏️ Profili Duzenle
              </button>
            )
          )}

          {!benimProfilim && yetkili && (
            profil?.dondurulmus ? (
              <button onClick={handleCoz}
                style={{ flex:1, padding:"10px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                🔓 Dondurmayi Kaldir
              </button>
            ) : (
              <button onClick={() => setDondurmModal(true)}
                style={{ flex:1, padding:"10px", background:"#f59e0b", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
                🔒 Hesabi Dondur
              </button>
            )
          )}
        </div>

        <h3 style={{ fontSize:"16px", color:"#374151", marginBottom:"12px" }}>
          Paylasimlar ({gonderiler.length})
        </h3>
        {gonderiler.length === 0 ? (
          <p style={{ color:"#9ca3af", textAlign:"center" }}>Hic paylasim yok.</p>
        ) : (
          gonderiler.map(g => (
            <div key={g.id} style={{ background:"#f9fafb", padding:"12px", borderRadius:"10px", marginBottom:"8px" }}>
              <p style={{ margin:"0", fontSize:"14px", color:"#374151" }}>{g.icerik}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ProfilSayfasi;