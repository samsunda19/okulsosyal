import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, orderBy, query, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

function AdminDashboard() {
  const [gonderiler, setGonderiler] = useState([]);
  const [kullaniciler, setKullaniciler] = useState({});
  const [bekleyenler, setBekleyenler] = useState([]);
  const [bildirimler, setBildirimler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");
  const [aramaMetni, setAramaMetni] = useState("");
  const [gonderiArama, setGonderiArama] = useState("");
  const [secilenKullanici, setSecilenKullanici] = useState(null);
  const [yonetimAcik, setYonetimAcik] = useState(false);
  const [secilenOgrenciler, setSecilenOgrenciler] = useState([]);
  const [secilenCocuk, setSecilenCocuk] = useState("");
  const [kaydetYukleniyor, setKaydetYukleniyor] = useState(false);

  useEffect(() => {
    verileriGetir();
  }, []);

  const verileriGetir = async () => {
    const postSnapshot = await getDocs(collection(db, "posts"));
    const tumPosts = postSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    tumPosts.sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
    setGonderiler(tumPosts);

    const userSnapshot = await getDocs(collection(db, "users"));
    const tumKullaniciler = {};
    const bekleyenListesi = [];
    userSnapshot.docs.forEach(d => {
      const data = { id: d.id, ...d.data() };
      tumKullaniciler[d.id] = data;
      if (data.role === "student" && data.onaylandi === false && !data.reddedildi) {
        bekleyenListesi.push(data);
      }
    });
    setKullaniciler(tumKullaniciler);
    setBekleyenler(bekleyenListesi);

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setBildirimler(tumReports.filter(r => r.adminaIletti === true));

    setYukleniyor(false);
  };

  const handleSil = async (gonderiId) => {
    if (!window.confirm("Bu paylasimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      adminSildi: true, adminSildiTarihi: serverTimestamp(), adminSildiUid: auth.currentUser.uid
    });
    setGonderiler(prev => prev.map(g => g.id === gonderiId ? { ...g, adminSildi: true } : g));
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    setYorumlar(prev => ({ ...prev, [postId]: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) }));
  };

  const yorumToggle = async (postId) => {
    const acik = !acikYorumlar[postId];
    setAcikYorumlar(prev => ({ ...prev, [postId]: acik }));
    if (acik && !yorumlar[postId]) await yorumlariGetir(postId);
  };

  const yorumSil = async (postId, yorumId) => {
    if (!window.confirm("Bu yorumu kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", postId, "comments", yorumId), {
      silindi: true, silinmeTarihi: serverTimestamp(), silenUid: auth.currentUser.uid, silenRol: "admin"
    });
    setYorumlar(prev => ({
      ...prev,
      [postId]: prev[postId].map(y => y.id === yorumId ? { ...y, silindi: true, silenRol: "admin" } : y)
    }));
  };

  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), { okundu: true });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, okundu: true } : b));
  };

  const bildirimKaldir = async (reportId) => {
    if (!window.confirm("Bu bildirimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      adminSildi: true, adminSildiTarihi: serverTimestamp(), adminSildiUid: auth.currentUser.uid
    });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, adminSildi: true } : b));
  };

  const kullaniciOnayla = async (kullaniciId) => {
    await updateDoc(doc(db, "users", kullaniciId), { onaylandi: true });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    setKullaniciler(prev => ({ ...prev, [kullaniciId]: { ...prev[kullaniciId], onaylandi: true } }));
    alert("Kullanici onaylandi!");
  };

  const kullaniciReddet = async (kullaniciId) => {
    if (!window.confirm("Bu kayit talebini reddetmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", kullaniciId), { reddedildi: true, reddedildiTarihi: serverTimestamp() });
    setBekleyenler(prev => prev.filter(k => k.id !== kullaniciId));
    alert("Kayit reddedildi!");
  };

  const kullaniciYonetimAc = (k) => {
    setSecilenKullanici(k);
    setYonetimAcik(true);
    setSecilenOgrenciler(k.role === "teacher" ? (k.sinif || []) : []);
    setSecilenCocuk(k.role === "parent" ? ((k.cocuklar || [])[0] || "") : "");
    setAramaMetni("");
  };

  const rolDegistir = async (yeniRol) => {
    if (!secilenKullanici) return;
    if (!window.confirm(secilenKullanici.isim + " kullanicisinin rolunu " + yeniRol + " yapmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "users", secilenKullanici.id), { role: yeniRol });
    const guncellenmis = { ...secilenKullanici, role: yeniRol };
    setSecilenKullanici(guncellenmis);
    setKullaniciler(prev => ({ ...prev, [secilenKullanici.id]: guncellenmis }));
    if (yeniRol === "teacher") setSecilenOgrenciler(guncellenmis.sinif || []);
    if (yeniRol === "parent") setSecilenCocuk((guncellenmis.cocuklar || [])[0] || "");
    alert("Rol guncellendi!");
  };

  const ogrenciToggle = (uid) => {
    setSecilenOgrenciler(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  const sinifKaydet = async () => {
    if (!secilenKullanici) return;
    setKaydetYukleniyor(true);
    await updateDoc(doc(db, "users", secilenKullanici.id), { sinif: secilenOgrenciler });
    const guncellenmis = { ...secilenKullanici, sinif: secilenOgrenciler };
    setSecilenKullanici(guncellenmis);
    setKullaniciler(prev => ({ ...prev, [secilenKullanici.id]: guncellenmis }));
    setKaydetYukleniyor(false);
    alert("Sinif kaydedildi!");
  };

  const cocukKaydet = async () => {
    if (!secilenKullanici || !secilenCocuk) return;
    setKaydetYukleniyor(true);
    await updateDoc(doc(db, "users", secilenKullanici.id), { cocuklar: [secilenCocuk] });
    const guncellenmis = { ...secilenKullanici, cocuklar: [secilenCocuk] };
    setSecilenKullanici(guncellenmis);
    setKullaniciler(prev => ({ ...prev, [secilenKullanici.id]: guncellenmis }));
    setKaydetYukleniyor(false);
    alert("Cocuk atamasi kaydedildi!");
  };

  const rolRenk = (rol) => {
    if (rol === "admin") return { bg: "#fee2e2", text: "#991b1b" };
    if (rol === "teacher") return { bg: "#e0e7ff", text: "#3730a3" };
    if (rol === "parent") return { bg: "#d1fae5", text: "#065f46" };
    return { bg: "#f3f4f6", text: "#374151" };
  };

  const aramaSonuclari = aramaMetni.trim()
    ? Object.values(kullaniciler).filter(k => {
        const arama = aramaMetni.toLowerCase();
        return (k.isim || "").toLowerCase().includes(arama) || (k.email || "").toLowerCase().includes(arama);
      })
    : [];

  const filtrelenmisGonderiler = gonderiArama.trim()
    ? gonderiler.filter(g =>
        (g.icerik || "").toLowerCase().includes(gonderiArama.toLowerCase()) ||
        (g.yazar || "").toLowerCase().includes(gonderiArama.toLowerCase()))
    : gonderiler;

  const onayliOgrenciler = Object.values(kullaniciler).filter(k => k.role === "student" && k.onaylandi === true);
  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.okundu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.okundu).length;

  return (
    <div style={{ maxWidth:"700px", margin:"0 auto", padding:"20px", fontFamily:"sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => setSecilenProfil(null)} mevcutKullaniciRol="admin" />
      )}

      {/* Kullanici Yonetim Modali */}
      {yonetimAcik && secilenKullanici && (
        <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.6)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:1000 }}>
          <div style={{ background:"white", borderRadius:"16px", padding:"24px", width:"90%", maxWidth:"500px", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <h3 style={{ margin:0, fontSize:"16px" }}>👤 {secilenKullanici.isim}</h3>
              <button onClick={() => setYonetimAcik(false)}
                style={{ background:"#e5e7eb", border:"none", borderRadius:"8px", padding:"6px 12px", cursor:"pointer" }}>
                Kapat
              </button>
            </div>
            <p style={{ fontSize:"13px", color:"#6b7280", margin:"0 0 4px" }}>📧 {secilenKullanici.email}</p>
            {secilenKullanici.okul && <p style={{ fontSize:"13px", color:"#6b7280", margin:"0 0 16px" }}>🏫 {secilenKullanici.okul}</p>}

            {/* Rol degistir */}
            <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
              <p style={{ fontSize:"13px", fontWeight:"600", margin:"0 0 10px" }}>
                Mevcut rol:{" "}
                <span style={{ background: rolRenk(secilenKullanici.role).bg, color: rolRenk(secilenKullanici.role).text, padding:"2px 8px", borderRadius:"6px", fontSize:"12px" }}>
                  {secilenKullanici.role}
                </span>
              </p>
              <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>Rol degistir:</p>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {["student", "teacher", "parent", "admin"].map(rol => (
                  <button key={rol} onClick={() => rolDegistir(rol)}
                    disabled={secilenKullanici.role === rol}
                    style={{
                      padding:"6px 12px", border:"none", borderRadius:"6px",
                      cursor: secilenKullanici.role === rol ? "default" : "pointer",
                      background: secilenKullanici.role === rol ? rolRenk(rol).bg : "#e5e7eb",
                      color: secilenKullanici.role === rol ? rolRenk(rol).text : "#374151",
                      fontSize:"12px", fontWeight:"600"
                    }}>
                    {rol === "student" ? "Ogrenci" : rol === "teacher" ? "Ogretmen" : rol === "parent" ? "Veli" : "Admin"}
                    {secilenKullanici.role === rol && " ✓"}
                  </button>
                ))}
              </div>
            </div>

            {/* Ogretmense ogrenci ata */}
            {secilenKullanici.role === "teacher" && (
              <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
                <p style={{ fontSize:"13px", fontWeight:"600", margin:"0 0 10px" }}>
                  📚 Sinif Atamalari ({secilenOgrenciler.length} ogrenci secildi)
                </p>
                {onayliOgrenciler.length === 0 ? (
                  <p style={{ fontSize:"12px", color:"#9ca3af" }}>Onaylanmis ogrenci yok.</p>
                ) : (
                  <>
                    <div style={{ maxHeight:"220px", overflowY:"auto", marginBottom:"10px" }}>
                      {onayliOgrenciler.map(o => (
                        <div key={o.id} onClick={() => ogrenciToggle(o.id)}
                          style={{
                            padding:"8px 10px", borderRadius:"8px", marginBottom:"4px", cursor:"pointer",
                            background: secilenOgrenciler.includes(o.id) ? "#e0e7ff" : "white",
                            border: secilenOgrenciler.includes(o.id) ? "1px solid #4f46e5" : "1px solid #e5e7eb",
                            display:"flex", justifyContent:"space-between", alignItems:"center"
                          }}>
                          <div>
                            <p style={{ margin:0, fontSize:"13px", fontWeight:"600", color: secilenOgrenciler.includes(o.id) ? "#4f46e5" : "#374151" }}>{o.isim}</p>
                            {o.sinif && <p style={{ margin:0, fontSize:"11px", color:"#6b7280" }}>📚 {o.sinif}</p>}
                            {o.okul && <p style={{ margin:0, fontSize:"11px", color:"#6b7280" }}>🏫 {o.okul}</p>}
                          </div>
                          {secilenOgrenciler.includes(o.id) && <span style={{ color:"#4f46e5", fontWeight:"700" }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <button onClick={sinifKaydet} disabled={kaydetYukleniyor}
                      style={{ width:"100%", padding:"10px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>
                      {kaydetYukleniyor ? "Kaydediliyor..." : "💾 Sinifi Kaydet"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Veliyse cocuk ata */}
            {secilenKullanici.role === "parent" && (
              <div style={{ background:"#f9fafb", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
                <p style={{ fontSize:"13px", fontWeight:"600", margin:"0 0 10px" }}>👶 Cocuk Atamasi</p>
                {onayliOgrenciler.length === 0 ? (
                  <p style={{ fontSize:"12px", color:"#9ca3af" }}>Onaylanmis ogrenci yok.</p>
                ) : (
                  <>
                    <div style={{ maxHeight:"220px", overflowY:"auto", marginBottom:"10px" }}>
                      {onayliOgrenciler.map(o => (
                        <div key={o.id} onClick={() => setSecilenCocuk(o.id)}
                          style={{
                            padding:"8px 10px", borderRadius:"8px", marginBottom:"4px", cursor:"pointer",
                            background: secilenCocuk === o.id ? "#d1fae5" : "white",
                            border: secilenCocuk === o.id ? "1px solid #10b981" : "1px solid #e5e7eb",
                            display:"flex", justifyContent:"space-between", alignItems:"center"
                          }}>
                          <div>
                            <p style={{ margin:0, fontSize:"13px", fontWeight:"600", color: secilenCocuk === o.id ? "#065f46" : "#374151" }}>{o.isim}</p>
                            {o.sinif && <p style={{ margin:0, fontSize:"11px", color:"#6b7280" }}>📚 {o.sinif}</p>}
                            {o.okul && <p style={{ margin:0, fontSize:"11px", color:"#6b7280" }}>🏫 {o.okul}</p>}
                          </div>
                          {secilenCocuk === o.id && <span style={{ color:"#10b981", fontWeight:"700" }}>✓</span>}
                        </div>
                      ))}
                    </div>
                    <button onClick={cocukKaydet} disabled={kaydetYukleniyor || !secilenCocuk}
                      style={{ width:"100%", padding:"10px", background: secilenCocuk ? "#10b981" : "#9ca3af", color:"white", border:"none", borderRadius:"8px", cursor: secilenCocuk ? "pointer" : "default", fontWeight:"600", fontSize:"13px" }}>
                      {kaydetYukleniyor ? "Kaydediliyor..." : "💾 Cocugu Kaydet"}
                    </button>
                  </>
                )}
              </div>
            )}

            <button onClick={() => { setYonetimAcik(false); setSecilenProfil(secilenKullanici.id); }}
              style={{ width:"100%", padding:"10px", background:"#6b7280", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
              👤 Profili Goruntule
            </button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ color:"#4f46e5" }}>Admin Paneli</h2>
        <button onClick={() => signOut(auth)}
          style={{ padding:"8px 16px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>
          Cikis
        </button>
      </div>

      {/* Kullanici arama - tiklaninca yonetim modali acilir */}
      <div style={{ background:"white", padding:"12px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"16px" }}>
        <input type="text" placeholder="🔍 Kullanici ara - tikla, rol/sinif ata..."
          value={aramaMetni} onChange={e => setAramaMetni(e.target.value)}
          style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"14px", boxSizing:"border-box" }} />
        {aramaMetni.trim() && (
          <div style={{ marginTop:"10px" }}>
            <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>{aramaSonuclari.length} sonuc — tikla yonet</p>
            {aramaSonuclari.slice(0, 10).map(k => (
              <div key={k.id} onClick={() => kullaniciYonetimAc(k)}
                style={{ padding:"8px 10px", background:"#f9fafb", borderRadius:"8px", marginBottom:"4px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ margin:"0", fontSize:"13px", fontWeight:"600" }}>{k.isim || "Isimsiz"}</p>
                  <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>{k.email}</p>
                  {k.role === "teacher" && (
                    <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>📚 {(k.sinif || []).length} ogrenci atanmis</p>
                  )}
                  {k.role === "parent" && (
                    <p style={{ margin:"0", fontSize:"11px", color:"#6b7280" }}>
                      👶 {(k.cocuklar || []).length > 0 ? (kullaniciler[(k.cocuklar || [])[0]]?.isim || "Atanmis") : "Cocuk atanmamis"}
                    </p>
                  )}
                </div>
                <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
                  <span style={{ padding:"2px 6px", background: rolRenk(k.role).bg, color: rolRenk(k.role).text, borderRadius:"4px", fontSize:"10px", fontWeight:"600" }}>
                    {k.role}
                  </span>
                  {k.dondurulmus && <span style={{ padding:"2px 6px", background:"#fee2e2", color:"#ef4444", borderRadius:"4px", fontSize:"10px" }}>🔒</span>}
                  {k.reddedildi && <span style={{ padding:"2px 6px", background:"#f3f4f6", color:"#6b7280", borderRadius:"4px", fontSize:"10px" }}>Reddedildi</span>}
                  <span style={{ fontSize:"11px", color:"#9ca3af" }}>→</span>
                </div>
              </div>
            ))}
            {aramaSonuclari.length > 10 && (
              <p style={{ fontSize:"11px", color:"#9ca3af", textAlign:"center", margin:"8px 0 0" }}>ve {aramaSonuclari.length - 10} sonuc daha...</p>
            )}
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:"6px", marginBottom:"20px", flexWrap:"wrap" }}>
        {[["etkilesimler", "💬 Paylasimlar"], ["bildirimler", "🚩 Bildirimler"], ["bekleyenler", "⏳ Onaylar"]].map(([key, label]) => (
          <button key={key} onClick={() => setAktifSekme(key)}
            style={{ flex:"1 1 30%", padding:"10px", background: aktifSekme === key ? "#4f46e5" : "#e5e7eb", color: aktifSekme === key ? "white" : "#374151", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px", position:"relative" }}>
            {label}
            {key === "bildirimler" && yeniBildirimSayisi > 0 && (
              <span style={{ position:"absolute", top:"-6px", right:"-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color:"white", borderRadius:"50%", width:"22px", height:"22px", fontSize:"11px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
                {yeniBildirimSayisi}
              </span>
            )}
            {key === "bekleyenler" && bekleyenler.length > 0 && (
              <span style={{ position:"absolute", top:"-6px", right:"-6px", background:"#10b981", color:"white", borderRadius:"50%", width:"22px", height:"22px", fontSize:"11px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700" }}>
                {bekleyenler.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {yukleniyor ? <p>Yukleniyor...</p> : aktifSekme === "bekleyenler" ? (
        <div>
          {bekleyenler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}><p>Onay bekleyen kullanici yok.</p></div>
          ) : (
            <>
              <h3 style={{ color:"#666", marginBottom:"16px" }}>Onay Bekleyen Kullanicilar ({bekleyenler.length})</h3>
              {bekleyenler.map(k => (
                <div key={k.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
                  <p style={{ margin:"0 0 4px", fontSize:"15px", fontWeight:"600" }}>{k.isim}</p>
                  <p style={{ margin:"0 0 4px", fontSize:"13px", color:"#6b7280" }}>📧 {k.email}</p>
                  {k.sinif && <p style={{ margin:"0 0 4px", fontSize:"13px", color:"#6b7280" }}>📚 {k.sinif}</p>}
                  {k.okul && <p style={{ margin:"0 0 12px", fontSize:"13px", color:"#6b7280" }}>🏫 {k.okul}</p>}
                  <div style={{ display:"flex", gap:"8px" }}>
                    <button onClick={() => kullaniciOnayla(k.id)} style={{ flex:1, padding:"8px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>✓ Onayla</button>
                    <button onClick={() => kullaniciReddet(k.id)} style={{ flex:1, padding:"8px", background:"#ef4444", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:"600", fontSize:"13px" }}>✗ Reddet</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : aktifSekme === "bildirimler" ? (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}>
              <p>Hic bildirim yok.</p>
              <p style={{ fontSize:"12px", marginTop:"8px", color:"#9ca3af" }}>Sadece veli veya ogretmen tarafindan iletilen bildirimler burada gorunur.</p>
            </div>
          ) : (
            <>
              <h3 style={{ color:"#666", marginBottom:"16px" }}>Iletilen Bildirimler ({bildirimler.length})</h3>
              {bildirimler.map(b => (
                <div key={b.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px", border: b.acil && !b.okundu ? "2px solid #ef4444" : "1px solid #e5e7eb", opacity: b.adminSildi ? 0.7 : 1 }}>
                  {b.acil && !b.okundu && <div style={{ background:"#fee2e2", color:"#991b1b", padding:"6px 10px", borderRadius:"6px", fontSize:"12px", marginBottom:"8px", fontWeight:"700" }}>🚨 ACIL: Cocuk yardim istiyor!</div>}
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px" }}>
                    {!b.okundu && <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>YENI</span>}
                    {b.adminSildi && <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontWeight:"600" }}>✓ Kaldirildi</span>}
                  </div>
                  {b.ileten && <p style={{ margin:"0 0 6px", fontSize:"12px", color:"#4f46e5", fontWeight:"600" }}>📨 Ileten: {b.ileten} ({b.iletenRol === "teacher" ? "Ogretmen" : "Veli"})</p>}
                  <p style={{ margin:"0 0 6px", fontSize:"13px", color:"#6b7280" }}>📋 Sebep: <strong>{b.kategori}</strong>{b.digerSebep && <span> — "{b.digerSebep}"</span>}</p>
                  <p style={{ margin:"0 0 8px", fontSize:"13px", color:"#6b7280" }}>💙 Bildiren durumu: {b.iyiMisin === "iyi" ? "😊 Iyi" : b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" : b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"}</p>
                  <div style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"8px" }}>
                    <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{b.icerikMetni}</p>
                    <small style={{ color:"#6b7280" }}>Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.yazar}</span></small>
                  </div>
                  <p style={{ fontSize:"12px", color:"#6b7280", margin:"0 0 8px" }}>🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>{b.bildiren}</span></p>
                  <div style={{ display:"flex", gap:"6px" }}>
                    {!b.okundu && <button onClick={() => bildirimOkundu(b.id)} style={{ flex:1, padding:"6px 12px", background:"#10b981", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px", fontWeight:"600" }}>✓ Okundu</button>}
                    {!b.adminSildi && <button onClick={() => bildirimKaldir(b.id)} style={{ padding:"6px 12px", background:"#6b7280", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>🗑️ Kaldir</button>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom:"12px" }}>
            <input type="text" placeholder="🔍 Gonderi veya yazar ara..." value={gonderiArama} onChange={e => setGonderiArama(e.target.value)}
              style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"14px", boxSizing:"border-box" }} />
          </div>
          {filtrelenmisGonderiler.length === 0 ? (
            <div style={{ background:"white", padding:"20px", borderRadius:"12px", textAlign:"center", color:"#888" }}><p>Hic paylasim yok.</p></div>
          ) : (
            <>
              <h3 style={{ color:"#666", marginBottom:"16px" }}>Tum Paylasimlar ({filtrelenmisGonderiler.length})</h3>
              {filtrelenmisGonderiler.map(g => {
                const yazarKullanici = kullaniciler[g.yazarUid];
                const begenenler = g.begenenler || [];
                const kaldirildi = g.ogrenciSildi || g.veliKaldirdi || g.ogretmenKaldirdi || g.adminSildi;
                return (
                  <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px", opacity: kaldirildi ? 0.75 : 1, border: kaldirildi ? "1px solid #e5e7eb" : "none" }}>
                    {kaldirildi && (
                      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"6px" }}>
                        {g.ogrenciSildi && <span style={{ background:"#f3f4f6", color:"#6b7280", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Ogrenci sildi</span>}
                        {g.veliKaldirdi && <span style={{ background:"#ede9fe", color:"#5b21b6", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Veli kaldirdi</span>}
                        {g.ogretmenKaldirdi && <span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Ogretmen kaldirdi</span>}
                        {g.adminSildi && <span style={{ background:"#fee2e2", color:"#991b1b", padding:"2px 8px", borderRadius:"6px", fontSize:"11px" }}>Admin kaldirdi</span>}
                      </div>
                    )}
                    <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <small onClick={() => setSecilenProfil(g.yazarUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"13px" }}>{g.yazar}</small>
                        {yazarKullanici?.dondurulmus && <span style={{ background:"#fee2e2", color:"#ef4444", padding:"2px 6px", borderRadius:"8px", fontSize:"11px" }}>🔒 Dondurulmus</span>}
                      </div>
                      <div style={{ display:"flex", gap:"6px" }}>
                        <span style={{ padding:"4px 10px", background:"#fee2e2", color:"#ef4444", borderRadius:"6px", fontSize:"12px" }}>❤️ {begenenler.length}</span>
                        <button onClick={() => yorumToggle(g.id)} style={{ padding:"4px 10px", background:"#e0e7ff", color:"#4f46e5", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                          💬 {yorumlar[g.id] ? yorumlar[g.id].length : ""} Yorum
                        </button>
                        {!g.adminSildi && <button onClick={() => handleSil(g.id)} style={{ padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>🗑️ Kaldir</button>}
                      </div>
                    </div>
                    {acikYorumlar[g.id] && (
                      <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid #f0f4ff" }}>
                        {yorumlar[g.id] && yorumlar[g.id].length === 0 && <p style={{ color:"#9ca3af", fontSize:"13px", textAlign:"center" }}>Hic yorum yok.</p>}
                        {yorumlar[g.id] && yorumlar[g.id].map(y => (
                          <div key={y.id} style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"6px", position:"relative", opacity: y.silindi ? 0.6 : 1 }}>
                            {y.silindi && <span style={{ fontSize:"11px", color:"#6b7280", display:"block", marginBottom:"4px" }}>[{y.silenRol === "admin" ? "Admin kaldirdi" : y.silenRol === "teacher" ? "Ogretmen kaldirdi" : y.silenRol === "parent" ? "Veli kaldirdi" : "Ogrenci sildi"}]</span>}
                            <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{y.icerik}</p>
                            <small onClick={() => setSecilenProfil(y.yazarUid)} style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"12px" }}>{y.yazar}</small>
                            {!y.silindi && <button onClick={() => yorumSil(g.id, y.id)} style={{ position:"absolute", top:"8px", right:"8px", padding:"2px 8px", background:"#ef4444", color:"white", border:"none", borderRadius:"5px", cursor:"pointer", fontSize:"11px" }}>Kaldir</button>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;