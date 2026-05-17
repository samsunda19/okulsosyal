import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDocFromServer, getDoc, collection, getDocs, orderBy, query, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function TeacherDashboard() {
  const [tumGonderiler, setTumGonderiler] = useState([]);
  const [ogrenciler, setOgrenciler] = useState([]);
  const [ogrenciBilgileri, setOgrenciBilgileri] = useState({});
  const [bildirimler, setBildirimler] = useState([]);
  const [ogretmenIsmi, setOgretmenIsmi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");
  // Bildirimlerde hangi postun tam icerigi acik
  const [acikIcerik, setAcikIcerik] = useState({});
  const [postDetay, setPostDetay] = useState({});

  useEffect(() => {
    verileriGetir();
  }, []);

  const verileriGetir = async () => {
    const ogretmenDoc = await getDocFromServer(doc(db, "users", auth.currentUser.uid));
    const ogretmenData = ogretmenDoc.data();
    const sinif = ogretmenData?.sinif || [];
    setOgrenciler(sinif);
    setOgretmenIsmi(ogretmenData?.isim || auth.currentUser.email);

    const ogrenciBilgi = {};
    for (const uid of sinif) {
      const ogrenciDoc = await getDoc(doc(db, "users", uid));
      if (ogrenciDoc.exists()) {
        ogrenciBilgi[uid] = { id: uid, ...ogrenciDoc.data() };
      }
    }
    setOgrenciBilgileri(ogrenciBilgi);

    // Etkilesimler: ogrencinin yazdig veya yorum yaptigi gonderiler
    // Ogretmen silmis olsa bile burada tam icerik gorur
    const snapshot = await getDocs(collection(db, "posts"));
    const tumPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const ilgiliPostlar = [];
    for (const post of tumPosts) {
      // Ogretmen kendi sildigini de gorur (soft delete - icerik kaybolmaz)
      if (sinif.includes(post.yazarUid)) {
        ilgiliPostlar.push({ ...post, ogrenciYazari: true });
        continue;
      }
      const yorumSnapshot = await getDocs(collection(db, "posts", post.id, "comments"));
      const yorumlarListesi = yorumSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(y => !y.silindi); // soft delete - silinen yorumlar gizli
      const ogrenciYorumu = yorumlarListesi.some(y => sinif.includes(y.yazarUid));
      if (ogrenciYorumu) {
        ilgiliPostlar.push({ ...post, ogrenciYazari: false });
      }
    }

    ilgiliPostlar.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    setTumGonderiler(ilgiliPostlar);

    // Bildirimler: ogretmen kendi sildigini de gorur (ogretmenSildi:true olsa bile listede kalir)
    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const ilgiliReports = tumReports.filter(r =>
      sinif.includes(r.bildirenUid) || sinif.includes(r.yazarUid)
    );
    setBildirimler(ilgiliReports);

    setYukleniyor(false);
  };

  // Gonderi soft delete - ogretmen kaldiriyor
  const handleSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      ogretmenKaldirdi: true,
      ogretmenKaldirmaTarihi: serverTimestamp(),
      ogretmenKaldiranUid: auth.currentUser.uid
    });
    // Etkilesimler listesinde isaretli goster, listeden kaldir degil
    setTumGonderiler(prev => prev.map(g =>
      g.id === gonderiId ? { ...g, ogretmenKaldirdi: true } : g
    ));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    // Ogretmen silinen yorumlari da gorur (soft delete log amacli)
    const tumYorumlar = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtrelenmis = tumYorumlar.filter(y => ogrenciler.includes(y.yazarUid));
    setYorumlar(prev => ({ ...prev, [postId]: filtrelenmis }));
  };

  const yorumToggle = async (postId) => {
    const acik = !acikYorumlar[postId];
    setAcikYorumlar(prev => ({ ...prev, [postId]: acik }));
    if (acik && !yorumlar[postId]) {
      await yorumlariGetir(postId);
    }
  };

  // Yorum soft delete - ogretmen kaldiriyor
  const yorumSil = async (postId, yorumId) => {
    if (!window.confirm("Bu yorumu kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", postId, "comments", yorumId), {
      silindi: true,
      silinmeTarihi: serverTimestamp(),
      silenUid: auth.currentUser.uid,
      silenRol: "teacher"
    });
    // Listede silindi olarak isaretli goster
    setYorumlar(prev => ({
      ...prev,
      [postId]: prev[postId].map(y =>
        y.id === yorumId ? { ...y, silindi: true } : y
      )
    }));
  };

  // Bildirim okundu - ogretmenGordu:true yap
  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), {
      okundu: true,
      ogretmenGordu: true
    });
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, okundu: true, ogretmenGordu: true } : b
    ));
  };

  // Ogretmen kaldiriyor - ama bildirim listeden gitmez, sadece ogretmenSildi:true
  const bildirimKaldir = async (reportId, postId) => {
    if (!window.confirm("Bu bildirimi listeden kaldirmak istediginizden emin misiniz?")) return;
    // Ilgili gonderiyi de ogretmen kaldirmis say
    await updateDoc(doc(db, "reports", reportId), {
      ogretmenSildi: true,
      ogretmenSildiTarihi: serverTimestamp(),
      ogretmenSildiUid: auth.currentUser.uid
    });
    if (postId) {
      await updateDoc(doc(db, "posts", postId), {
        ogretmenKaldirdi: true,
        ogretmenKaldirmaTarihi: serverTimestamp(),
        ogretmenKaldiranUid: auth.currentUser.uid
      });
    }
    // Listeden kalkmaz, sadece isaretlenir
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, ogretmenSildi: true } : b
    ));
  };

  // Admine ilet - adminaIletti field adi StudentDashboard ile eslesir
  const adminIlet = async (reportId) => {
    if (!window.confirm("Bu bildirimi admine iletmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      adminaIletti: true,
      ileten: ogretmenIsmi,
      iletenRol: "teacher",
      iletenUid: auth.currentUser.uid,
      iletmeTarihi: serverTimestamp()
    });
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, adminaIletti: true, ileten: ogretmenIsmi, iletenRol: "teacher" } : b
    ));
    alert("Bildirim admine iletildi!");
  };

  // Bildirimdeki postun tam icerigi - ogretmen her zaman gorur
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

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.ogretmenGordu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.ogretmenGordu).length;

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
        <div>
          <h2 style={{ color:"#4f46e5", margin:"0 0 4px" }}>Ogretmen Paneli</h2>
          <p style={{ margin:0, fontSize:"13px", color:"#6b7280" }}>👤 {ogretmenIsmi}</p>
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
                border: b.acil && !b.ogretmenGordu ? "2px solid #ef4444" : "1px solid #e5e7eb",
                opacity: b.ogretmenSildi ? 0.7 : 1
              }}>

                {/* Acil uyari */}
                {b.acil && !b.ogretmenGordu && (
                  <div style={{ background:"#fee2e2", color:"#991b1b", padding:"6px 10px", borderRadius:"6px", fontSize:"12px", marginBottom:"8px", fontWeight:"700" }}>
                    🚨 ACIL: Ogrenci yardim istiyor!
                  </div>
                )}

                {/* Rozetler */}
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px" }}>
                  {!b.ogretmenGordu && (
                    <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      YENI
                    </span>
                  )}
                  {b.ogretmenSildi && (
                    <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      ✓ Kaldirildi
                    </span>
                  )}
                  {/* Veli veya ogretmen admine ilettiyse goster */}
                  {b.adminaIletti && (
                    <span style={{ background:"#d1fae5", color:"#065f46", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      ✓ Admine iletildi {b.iletenRol === "parent" ? "(veli)" : "(ogretmen)"}
                    </span>
                  )}
                  {/* Veli kaldirdiysa ogretmen gorsun */}
                  {b.veliSildi && (
                    <span style={{ background:"#ede9fe", color:"#5b21b6", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>
                      Veli kaldirdi
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

                {/* Bildirilen icerik - ogretmen her zaman tam gorur */}
                <div style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"8px" }}>
                  <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{b.icerikMetni}</p>
                  <small style={{ color:"#6b7280" }}>
                    Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.yazar}</span>
                  </small>
                </div>

                {/* Postun tam icerigi - gonderi mi yorum mu kontrolu */}
                {b.tip === "post" && (
                  <button onClick={() => postIcerikGoster(b.id, b.postId)}
                    style={{ fontSize:"12px", color:"#4f46e5", background:"none", border:"none", cursor:"pointer", padding:"0", marginBottom:"8px" }}>
                    {acikIcerik[b.id] ? "▲ Gonderiyi gizle" : "▼ Gonderiyi tam goster"}
                  </button>
                )}
                {acikIcerik[b.id] && postDetay[b.postId] && (
                  <div style={{ background:"#ede9fe", padding:"10px", borderRadius:"8px", marginBottom:"8px", fontSize:"13px" }}>
                    <p style={{ margin:"0 0 4px" }}>{postDetay[b.postId].icerik}</p>
                    {postDetay[b.postId].ogretmenKaldirdi && (
                      <span style={{ fontSize:"11px", color:"#6b7280" }}>— Bu gonderi ogretmen tarafindan kaldirildi</span>
                    )}
                    {postDetay[b.postId].veliKaldirdi && (
                      <span style={{ fontSize:"11px", color:"#6b7280" }}>— Bu gonderi veli tarafindan kaldirildi</span>
                    )}
                  </div>
                )}

                <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>
                  🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.bildiren}</span>
                </p>

                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  {!b.ogretmenGordu && (
                    <button onClick={() => bildirimOkundu(b.id)}
                      style={{ flex:"1 1 45%", padding:"6px 12px", background:"#10b981", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>
                      ✓ Okundu
                    </button>
                  )}
                  {/* Admine ilet - sadece henuz iletilmemisse goster */}
                  {!b.adminaIletti && (
                    <button onClick={() => adminIlet(b.id)}
                      style={{ flex:"1 1 45%", padding:"6px 12px", background:"#f59e0b", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>
                      📨 Admine Ilet
                    </button>
                  )}
                  {/* Kaldir - ogretmen kaldirdiysa tekrar kaldiramaz */}
                  {!b.ogretmenSildi && (
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
      ) : (
        // Etkilesimler sekmesi
        tumGonderiler.length === 0 ? (
          <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
            <p>Sinifınızda hic etkilesim yok.</p>
          </div>
        ) : (
          <div>
            <h3 style={{ color:"#666", marginBottom:"16px" }}>
              Sinif Etkilesimleri ({tumGonderiler.length})
            </h3>
            {tumGonderiler.map(g => {
              const yazarOgrenci = ogrenciBilgileri[g.yazarUid];
              const dondurulmus = yazarOgrenci?.dondurulmus;
              const begenenler = g.begenenler || [];
              const kaldirildi = g.ogretmenKaldirdi || g.veliKaldirdi || g.ogrenciSildi;
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
                  {!g.ogrenciYazari && (
                    <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"8px", fontSize:"11px", marginBottom:"8px", display:"inline-block" }}>
                      💬 Ogrenciniz yorum yapti
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
                  {/* Ogretmen her zaman tam icerigi gorur */}
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
                      {/* Ogretmen kaldir - sadece kaldirilmamissa goster */}
                      {g.ogrenciYazari && !g.ogretmenKaldirdi && (
                        <button onClick={() => handleSil(g.id)}
                          style={{ padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                          🗑️ Kaldir
                        </button>
                      )}
                    </div>
                  </div>

                  {acikYorumlar[g.id] && (
                    <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid #f0f4ff" }}>
                      {yorumlar[g.id] && yorumlar[g.id].length === 0 && (
                        <p style={{ color:"#9ca3af", fontSize:"13px", textAlign:"center" }}>Ogrencinizin yorumu yok.</p>
                      )}
                      {yorumlar[g.id] && yorumlar[g.id].map(y => (
                        <div key={y.id} style={{
                          background: y.silindi ? "#f9fafb" : "#f9fafb",
                          padding:"10px",
                          borderRadius:"8px",
                          marginBottom:"6px",
                          position:"relative",
                          opacity: y.silindi ? 0.6 : 1
                        }}>
                          {y.silindi && (
                            <span style={{ fontSize:"11px", color:"#6b7280", display:"block", marginBottom:"4px" }}>
                              [{y.silenRol === "teacher" ? "Ogretmen kaldirdi" : y.silenRol === "student" ? "Ogrenci sildi" : "Kaldirild"}]
                            </span>
                          )}
                          <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{y.icerik}</p>
                          <small
                            onClick={() => setSecilenProfil(y.yazarUid)}
                            style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"12px" }}>
                            {y.yazar}
                          </small>
                          {!y.silindi && (
                            <button onClick={() => yorumSil(g.id, y.id)}
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
        )
      )}
    </div>
  );
}

export default TeacherDashboard;