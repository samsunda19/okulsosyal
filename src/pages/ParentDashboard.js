import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, orderBy, query, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function ParentDashboard() {
  const [tumGonderiler, setTumGonderiler] = useState([]);
  const [cocuklar, setCocuklar] = useState([]);
  const [cocukBilgileri, setCocukBilgileri] = useState({});
  const [bildirimler, setBildirimler] = useState([]);
  const [veliIsmi, setVeliIsmi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");
  const [acikIcerik, setAcikIcerik] = useState({});
  const [postDetay, setPostDetay] = useState({});

  useEffect(() => {
    verileriGetir();
  }, []);

  const verileriGetir = async () => {
    const veliDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const veliData = veliDoc.data();
    const cocuklarListesi = veliData.cocuklar || [];
    setCocuklar(cocuklarListesi);
    setVeliIsmi(veliData.isim || auth.currentUser.email);

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

    const ilgiliPostlar = [];
    for (const post of tumPosts) {
      // Veli kendi kaldirdigini da gorur (soft delete - icerik kaybolmaz)
      if (cocuklarListesi.includes(post.yazarUid)) {
        ilgiliPostlar.push({ ...post, cocukYazari: true });
        continue;
      }
      const yorumSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));
      const yorumlarListesi = yorumSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(y => !y.silindi);
      const cocukYorumu = yorumlarListesi.some(y => cocuklarListesi.includes(y.yazarUid));
      if (cocukYorumu) {
        ilgiliPostlar.push({ ...post, cocukYazari: false });
      }
    }

    ilgiliPostlar.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    setTumGonderiler(ilgiliPostlar);

    // Bildirimler: cocuguyla ilgili olan - veli silse de listede kalir
    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const ilgiliReports = tumReports.filter(r =>
      cocuklarListesi.includes(r.bildirenUid) || cocuklarListesi.includes(r.yazarUid)
    );
    setBildirimler(ilgiliReports);

    setYukleniyor(false);
  };

  // Gonderi soft delete - veli kaldiriyor (sadece kendi cocugununkini)
  const handleSil = async (gonderiId, yazarUid) => {
    if (!cocuklar.includes(yazarUid)) return; // guvenlik: sadece kendi cocugunun gonderisi
    if (!window.confirm("Bu paylasimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      veliKaldirdi: true,
      veliKaldirmaTarihi: serverTimestamp(),
      veliKaldiranUid: auth.currentUser.uid
    });
    // Etkilesimler listesinde isaretli goster
    setTumGonderiler(prev => prev.map(g =>
      g.id === gonderiId ? { ...g, veliKaldirdi: true } : g
    ));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    // Veli silinen yorumlari da gorur (log amacli)
    const tumYorumlar = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtrelenmis = tumYorumlar.filter(y => cocuklar.includes(y.yazarUid));
    setYorumlar(prev => ({ ...prev, [postId]: filtrelenmis }));
  };

  const yorumToggle = async (postId) => {
    const acik = !acikYorumlar[postId];
    setAcikYorumlar(prev => ({ ...prev, [postId]: acik }));
    if (acik && !yorumlar[postId]) {
      await yorumlariGetir(postId);
    }
  };

  // Yorum soft delete - veli kaldiriyor (sadece kendi cocugunun yorumu)
  const yorumSil = async (postId, yorumId, yazarUid) => {
    if (!cocuklar.includes(yazarUid)) return; // guvenlik: sadece kendi cocugunun yorumu
    if (!window.confirm("Bu yorumu kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", postId, "comments", yorumId), {
      silindi: true,
      silinmeTarihi: serverTimestamp(),
      silenUid: auth.currentUser.uid,
      silenRol: "parent"
    });
    setYorumlar(prev => ({
      ...prev,
      [postId]: prev[postId].map(y =>
        y.id === yorumId ? { ...y, silindi: true } : y
      )
    }));
  };

  // Bildirim okundu - veliGordu:true yap
  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), {
      okundu: true,
      veliGordu: true
    });
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, okundu: true, veliGordu: true } : b
    ));
  };

  // Veli kaldiriyor - bildirim listeden gitmiyor, veliSildi:true
  const bildirimKaldir = async (reportId, postId) => {
    if (!window.confirm("Bu bildirimi listeden kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      veliSildi: true,
      veliSildiTarihi: serverTimestamp(),
      veliSildiUid: auth.currentUser.uid
    });
    if (postId) {
      await updateDoc(doc(db, "posts", postId), {
        veliKaldirdi: true,
        veliKaldirmaTarihi: serverTimestamp(),
        veliKaldiranUid: auth.currentUser.uid
      });
    }
    // Listeden kalkmaz, sadece isaretlenir
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, veliSildi: true } : b
    ));
  };

  // Admine ilet - adminaIletti field adi StudentDashboard ile eslesir
  const adminIlet = async (reportId) => {
    if (!window.confirm("Bu bildirimi admine iletmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      adminaIletti: true,
      ileten: veliIsmi,
      iletenRol: "parent",
      iletenUid: auth.currentUser.uid,
      iletmeTarihi: serverTimestamp()
    });
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, adminaIletti: true, ileten: veliIsmi, iletenRol: "parent" } : b
    ));
    alert("Bildirim admine iletildi!");
  };

  // Bildirimdeki postun tam icerigi - veli her zaman gorur
  const postIcerikGoster = async (reportId, postId) => {
    const zatenAcik = acikIcerik[reportId];
    setAcikIcerik(prev => ({ ...prev, [reportId]: !zatenAcik }));
    if (!zatenAcik && !postDetay[postId]) {
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (postDoc.exists()) {
        setPostDetay(prev => ({ ...prev, [postId]: { id: postDoc.id, ...postDoc.data() } }));
      }
    }
  };

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.veliGordu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.veliGordu).length;

  return (
    <div style={{ maxWidth:"650px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi
          kullaniciId={secilenProfil}
          onKapat={() => setSecilenProfil(null)}
          mevcutKullaniciRol="parent"
        />
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <div>
          <h2 style={{ color:"#4f46e5", margin:"0 0 4px" }}>Veli Paneli</h2>
          <p style={{ margin:0, fontSize:"13px", color:"#6b7280" }}>👤 {veliIsmi}</p>
        </div>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
        <button onClick={() => setAktifSekme("etkilesimler")}
          style={{ flex:1, padding:"10px", background: aktifSekme === "etkilesimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "etkilesimler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600" }}>
          💬 Etkilesimler
        </button>
        <button onClick={() => setAktifSekme("bildirimler")}
          style={{ flex:1, padding:"10px", background: aktifSekme === "bildirimler" ? "#4f46e5" : "#e5e7eb", color: aktifSekme === "bildirimler" ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", position:"relative" }}>
          🚩 Bildirimler
          {yeniBildirimSayisi > 0 && (
            <span style={{ position:"absolute", top:"-6px", right:"-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color:"white", borderRadius:"50%", width:"22px", height:"22px", fontSize:"11px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
              {yeniBildirimSayisi}
            </span>
          )}
        </button>
      </div>

      {yukleniyor ? (
        <p>Yukleniyor...</p>
      ) : aktifSekme === "bildirimler" ? (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
              <p>Hic bildirim yok.</p>
            </div>
          ) : (
            bildirimler.map(b => (
              <div key={b.id} style={{
                background:"white",
                padding:"16px",
                borderRadius:"12px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.1)",
                marginBottom:"12px",
                border: b.acil && !b.veliGordu ? "2px solid #ef4444" : "1px solid #e5e7eb",
                opacity: b.veliSildi ? 0.7 : 1
              }}>

                {b.acil && !b.veliGordu && (
                  <div style={{ background:"#fee2e2", color:"#991b1b", padding:"6px 10px", borderRadius:"6px", fontSize:"12px", marginBottom:"8px", fontWeight:"700" }}>
                    🚨 ACIL: Cocugunuz yardim istiyor!
                  </div>
                )}

                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px" }}>
                  {!b.veliGordu && (
                    <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      YENI
                    </span>
                  )}
                  {b.veliSildi && (
                    <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      ✓ Kaldirildi
                    </span>
                  )}
                  {/* Veli veya ogretmen admine ilettiyse goster */}
                  {b.adminaIletti && (
                    <span style={{ background:"#d1fae5", color:"#065f46", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      ✓ Admine iletildi {b.iletenRol === "teacher" ? "(ogretmen)" : "(veli)"}
                    </span>
                  )}
                  {/* Ogretmen kaldirdiysa veli gorsun */}
                  {b.ogretmenSildi && (
                    <span style={{ background:"#e0e7ff", color:"#3730a3", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      Ogretmen kaldirdi
                    </span>
                  )}
                </div>

                <p style={{ margin:"0 0 6px", fontSize:"13px", color:"#6b7280" }}>
                  📋 Sebep: <strong>{b.kategori}</strong>
                  {b.digerSebep && <span> — "{b.digerSebep}"</span>}
                </p>
                <p style={{ margin:"0 0 8px", fontSize:"13px", color:"#6b7280" }}>
                  💙 Bildiren cocugun durumu: {
                    b.iyiMisin === "iyi" ? "😊 Iyi" :
                    b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" :
                    b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"
                  }
                </p>

                {/* Bildirilen icerik - veli her zaman tam gorur */}
                <div style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"8px" }}>
                  <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{b.icerikMetni}</p>
                  <small style={{ color:"#6b7280" }}>
                    Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.yazar}</span>
                  </small>
                </div>

                {/* Postun tam icerigi */}
                {b.tip === "post" && (
                  <button onClick={() => postIcerikGoster(b.id, b.postId)}
                    style={{ fontSize:"12px", color:"#4f46e5", background:"none", border:"none", cursor:"pointer", padding:"0", marginBottom:"8px" }}>
                    {acikIcerik[b.id] ? "▲ Gonderiyi gizle" : "▼ Gonderiyi tam goster"}
                  </button>
                )}
                {acikIcerik[b.id] && postDetay[b.postId] && (
                  <div style={{ background:"#ede9fe", padding:"10px", borderRadius:"8px", marginBottom:"8px", fontSize:"13px" }}>
                    <p style={{ margin:"0 0 4px" }}>{postDetay[b.postId].icerik}</p>
                    {postDetay[b.postId].veliKaldirdi && (
                      <span style={{ fontSize:"11px", color:"#6b7280" }}>— Bu gonderi veli tarafindan kaldirildi</span>
                    )}
                    {postDetay[b.postId].ogretmenKaldirdi && (
                      <span style={{ fontSize:"11px", color:"#6b7280" }}>— Bu gonderi ogretmen tarafindan kaldirildi</span>
                    )}
                  </div>
                )}

                <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>
                  🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.bildiren}</span>
                </p>

                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  {!b.veliGordu && (
                    <button onClick={() => bildirimOkundu(b.id)}
                      style={{ flex:"1 1 45%", padding:"6px 12px", background:"#10b981", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>
                      ✓ Okundu
                    </button>
                  )}
                  {!b.adminaIletti && (
                    <button onClick={() => adminIlet(b.id)}
                      style={{ flex:"1 1 45%", padding:"6px 12px", background:"#f59e0b", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>
                      📨 Admine Ilet
                    </button>
                  )}
                  {!b.veliSildi && (
                    <button onClick={() => bildirimKaldir(b.id, b.postId)}
                      style={{ padding:"6px 12px", background:"#6b7280", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                      🗑️ Kaldir
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tumGonderiler.length === 0 ? (
        <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
          <p>Cocugunuzun hic etkilesimi yok.</p>
        </div>
      ) : (
        <div>
          <h3 style={{ color:"#666", marginBottom:"16px" }}>
            Cocugunuzun Etkilesimleri ({tumGonderiler.length})
          </h3>
          {tumGonderiler.map(g => {
            const yazarCocuk = cocukBilgileri[g.yazarUid];
            const dondurulmus = yazarCocuk?.dondurulmus;
            const begenenler = g.begenenler || [];
            const kaldirildi = g.veliKaldirdi || g.ogretmenKaldirdi || g.ogrenciSildi;
            return (
              <div key={g.id} style={{
                background:"white",
                padding:"16px",
                borderRadius:"12px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.1)",
                marginBottom:"12px",
                opacity: kaldirildi ? 0.75 : 1,
                border: kaldirildi ? "1px solid #e5e7eb" : "none"
              }}>
                {!g.cocukYazari && (
                  <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"8px", fontSize:"11px", marginBottom:"8px", display:"inline-block" }}>
                    💬 Cocugunuz yorum yapti
                  </span>
                )}
                {/* Kaldirma durumu rozeti */}
                {kaldirildi && (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
                    {g.ogrenciSildi && <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Ogrenci sildi</span>}
                    {g.veliKaldirdi && <span style={{ background:"#ede9fe", color:"#5b21b6", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Veli kaldirdi</span>}
                    {g.ogretmenKaldirdi && <span style={{ background:"#fee2e2", color:"#991b1b", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Ogretmen kaldirdi</span>}
                  </div>
                )}
                {/* Veli her zaman tam icerigi gorur */}
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
                      💬 Yorumlar
                    </button>
                    {/* Veli sadece kendi cocugunun gonderisini kaldirir, kaldirilmamissa goster */}
                    {g.cocukYazari && !g.veliKaldirdi && (
                      <button onClick={() => handleSil(g.id, g.yazarUid)}
                        style={{ padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                        🗑️ Kaldir
                      </button>
                    )}
                  </div>
                </div>

                {acikYorumlar[g.id] && (
                  <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid #f0f4ff" }}>
                    {yorumlar[g.id] && yorumlar[g.id].length === 0 && (
                      <p style={{ color:"#9ca3af", fontSize:"13px", textAlign:"center" }}>Cocugunuzun yorumu yok.</p>
                    )}
                    {yorumlar[g.id] && yorumlar[g.id].map(y => (
                      <div key={y.id} style={{
                        background:"#f9fafb",
                        padding:"10px",
                        borderRadius:"8px",
                        marginBottom:"6px",
                        position:"relative",
                        opacity: y.silindi ? 0.6 : 1
                      }}>
                        {y.silindi && (
                          <span style={{ fontSize:"11px", color:"#6b7280", display:"block", marginBottom:"4px" }}>
                            [{y.silenRol === "parent" ? "Veli kaldirdi" : y.silenRol === "teacher" ? "Ogretmen kaldirdi" : "Ogrenci sildi"}]
                          </span>
                        )}
                        <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{y.icerik}</p>
                        <small
                          onClick={() => setSecilenProfil(y.yazarUid)}
                          style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"12px" }}>
                          {y.yazar}
                        </small>
                        {/* Veli sadece kendi cocugunun yorumunu kaldirir */}
                        {!y.silindi && cocuklar.includes(y.yazarUid) && (
                          <button onClick={() => yorumSil(g.id, y.id, y.yazarUid)}
                            style={{ position:"absolute", top:"8px", right:"8px", padding:"2px 8px", background:"#ef4444", color:"white", border:"none", borderRadius:"5px", cursor:"pointer", fontSize:"11px" }}>
                            Kaldir
                          </button>
                        )}
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

export default ParentDashboard;