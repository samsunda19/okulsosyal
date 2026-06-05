import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, orderBy, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";
import { logKaydet } from "../logKaydet";

function konusmaId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// 30'arlik gruplara bol (Firestore "in" sorgusu max 30)
function gruplara(liste) {
  const g = [];
  for (let i = 0; i < liste.length; i += 30) g.push(liste.slice(i, i + 30));
  return g;
}

const MedyaGoster = ({ url }) => {
  if (!url) return null;
  if (url.includes("cloudflarestream.com")) {
    const embedUrl = url.includes("/iframe") ? url : url.replace("/manifest/video.m3u8", "/iframe");
    return (
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, marginTop: "8px", borderRadius: "8px", overflow: "hidden" }}>
        <iframe src={embedUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen title="video" />
      </div>
    );
  }
  return (
    <img src={url} alt="gonderi" style={{ maxWidth: "100%", borderRadius: "8px", marginTop: "8px", cursor: "pointer" }}
      onClick={() => window.open(url, "_blank")} />
  );
};

function ParentDashboard() {
  const [cocukPostlari, setCocukPostlari] = useState([]);
  const [cocuklar, setCocuklar] = useState([]);
  const [cocukBilgileri, setCocukBilgileri] = useState({});
  const [bildirimler, setBildirimler] = useState([]);
  const [veliIsmi, setVeliIsmi] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [aktifSekme, setAktifSekme] = useState("etkilesimler");
  const [acikIcerik, setAcikIcerik] = useState({});
  const [ogretmenGonderiler, setOgretmenGonderiler] = useState([]);
  const [ogretmenIsim, setOgretmenIsim] = useState("");
  const [ogretmenUid, setOgretmenUid] = useState(null);
  const [karanlikMod, setKaranlikMod] = useState(() => localStorage.getItem("parentKaranlikMod") === "true");
  const [ayarKaydet, setAyarKaydet] = useState(null);

  // Mesajlar sekmesi
  const [sohbetler, setSohbetler] = useState([]);
  const [sohbetlerYuklendi, setSohbetlerYuklendi] = useState(false);
  const [aktifSohbet, setAktifSohbet] = useState(null);
  const [sohbetMesajlari, setSohbetMesajlari] = useState([]);
  const [mesajYukleniyor, setMesajYukleniyor] = useState(false);

  const bg = karanlikMod ? "#111827" : "#f9fafb";
  const kartBg = karanlikMod ? "#1f2937" : "white";
  const yaziRenk = karanlikMod ? "#f3f4f6" : "#111827";
  const ikincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";
  const borderRenk = karanlikMod ? "#374151" : "#e5e7eb";

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
    let cocukOgretmenUid = null;
    let cocukOgretmenIsim = "";

    for (const uid of cocuklarListesi) {
      const cocukDoc = await getDoc(doc(db, "users", uid));
      if (cocukDoc.exists()) {
        const cocukData = cocukDoc.data();
        cocukBilgi[uid] = { id: uid, ...cocukData };
        if (cocukData.ogretmenUid && !cocukOgretmenUid) {
          cocukOgretmenUid = cocukData.ogretmenUid;
          cocukOgretmenIsim = cocukData.ogretmenIsim || "";
        }
      }
    }
    setCocukBilgileri(cocukBilgi);
    setOgretmenUid(cocukOgretmenUid);
    setOgretmenIsim(cocukOgretmenIsim);

    if (cocukOgretmenUid) {
      const postSnapshot = await getDocs(query(collection(db, "duyurular"), orderBy("tarih", "desc")));
      const ogretmenPostlari = postSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g => g.yazarUid === cocukOgretmenUid && !g.adminSildi);
      setOgretmenGonderiler(ogretmenPostlari);
    }

    if (cocuklarListesi.length > 0) {
      // 1) Cocugun KENDI postlari (where in, 30'arlik)
      let postlar = [];
      for (const grup of gruplara(cocuklarListesi)) {
        const snap = await getDocs(query(collection(db, "posts"), where("yazarUid", "in", grup)));
        postlar = postlar.concat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      postlar = postlar
        .filter(g => !g.ogrenciSildi && !g.veliKaldirdi && !g.ogretmenKaldirdi && !g.adminSildi)
        .sort((a, b) => (b.tarih?.seconds || 0) - (a.tarih?.seconds || 0));
      setCocukPostlari(postlar);

    }

    const reportSnapshot = await getDocs(query(collection(db, "reports"), orderBy("tarih", "desc")));
    const tumReports = reportSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const ilgiliReports = tumReports.filter(r =>
      cocuklarListesi.includes(r.bildirenUid) || cocuklarListesi.includes(r.yazarUid)
    );
    setBildirimler(ilgiliReports);
    setYukleniyor(false);
  };

  // ===== MESAJLAR =====
  const sohbetleriGetir = async () => {
    setMesajYukleniyor(true);
    const bulunan = [];
    for (const cocukUid of cocuklar) {
      const cocuk = cocukBilgileri[cocukUid];
      const cocukIsim = cocuk?.isim || "Cocuk";
      const arkadaslar = cocuk?.arkadaslar || [];
      for (const karsiUid of arkadaslar) {
        const kId = konusmaId(cocukUid, karsiUid);
        try {
          const q = query(collection(db, "messages", kId, "mesajlar"), orderBy("tarih", "asc"));
          const snap = await getDocs(q);
          if (snap.docs.length === 0) continue;
          const mesajlar = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const sonMesaj = mesajlar[mesajlar.length - 1];
          const karsiDoc = await getDoc(doc(db, "users", karsiUid));
          const karsiIsim = karsiDoc.exists() ? (karsiDoc.data().isim || "Kullanici") : "Kullanici";
          bulunan.push({
            konusmaId: kId, cocukUid, cocukIsim, karsiUid, karsiIsim,
            sonMesajMetni: sonMesaj.silindi ? "(silindi)" : sonMesaj.icerik,
            sonMesajZaman: sonMesaj.tarih?.seconds || 0,
            mesajSayisi: mesajlar.length
          });
        } catch (e) { /* atla */ }
      }
    }
    bulunan.sort((a, b) => b.sonMesajZaman - a.sonMesajZaman);
    setSohbetler(bulunan);
    setSohbetlerYuklendi(true);
    setMesajYukleniyor(false);
  };

  const sohbetAc = async (sohbet) => {
    setAktifSohbet(sohbet);
    setMesajYukleniyor(true);
    try {
      const q = query(collection(db, "messages", sohbet.konusmaId, "mesajlar"), orderBy("tarih", "asc"));
      const snap = await getDocs(q);
      setSohbetMesajlari(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setSohbetMesajlari([]);
    }
    setMesajYukleniyor(false);
  };

  const veliMesajSil = async (mesaj) => {
    if (!aktifSohbet) return;
    if (mesaj.gondericiUid !== aktifSohbet.cocukUid) return;
    if (!window.confirm("Cocugunuzun bu mesajini kaldirmak istediginizden emin misiniz?")) return;
    try {
      await updateDoc(doc(db, "messages", aktifSohbet.konusmaId, "mesajlar", mesaj.id), { silindi: true });
      setSohbetMesajlari(prev => prev.map(m => m.id === mesaj.id ? { ...m, silindi: true } : m));
      const token = await auth.currentUser.getIdToken();
      logKaydet(token, {
        uid: auth.currentUser.uid,
        islem: "veli_mesaj_kaldir",
        detay: "veli " + veliIsmi + " -> cocuk " + aktifSohbet.cocukIsim + " mesajini kaldirdi (sohbet: " + aktifSohbet.karsiIsim + ")"
      });
    } catch (e) {
      alert("Mesaj kaldirilamadi: " + e.message);
    }
  };

  // ===== AYAR =====
  const izinDegistir = async (cocukUid, izinTipi, deger) => {
    setAyarKaydet(cocukUid + izinTipi);
    try {
      await updateDoc(doc(db, "users", cocukUid), { [izinTipi]: deger });
      setCocukBilgileri(prev => ({ ...prev, [cocukUid]: { ...prev[cocukUid], [izinTipi]: deger } }));
      const token = await auth.currentUser.getIdToken();
      const cocukAd = cocukBilgileri[cocukUid]?.isim || cocukUid;
      const tip = izinTipi === "dmIzni" ? "DM" : "Akis";
      logKaydet(token, {
        uid: auth.currentUser.uid,
        islem: "ayar_degisti",
        detay: "veli " + veliIsmi + " -> cocuk " + cocukAd + " " + tip + " izni: " + deger
      });
    } catch (e) {
      alert("Ayar kaydedilemedi: " + e.message);
    }
    setAyarKaydet(null);
  };

  const handleSil = async (gonderiId, yazarUid) => {
    if (!cocuklar.includes(yazarUid)) return;
    if (!window.confirm("Bu paylasimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "posts", gonderiId), {
      veliKaldirdi: true,
      veliKaldirmaTarihi: serverTimestamp(),
      veliKaldiranUid: auth.currentUser.uid
    });
    setCocukPostlari(prev => prev.map(g => g.id === gonderiId ? { ...g, veliKaldirdi: true } : g));
  };

  const bildirimOkundu = async (reportId) => {
    await updateDoc(doc(db, "reports", reportId), { okundu: true, veliGordu: true });
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, okundu: true, veliGordu: true } : b));
  };

  const bildirimKaldir = async (reportId, postId) => {
    if (!window.confirm("Bu bildirimi kaldirmak istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      veliSildi: true, veliSildiTarihi: serverTimestamp(), veliSildiUid: auth.currentUser.uid
    });
    if (postId) {
      await updateDoc(doc(db, "posts", postId), {
        veliKaldirdi: true, veliKaldirmaTarihi: serverTimestamp(), veliKaldiranUid: auth.currentUser.uid
      });
    }
    setBildirimler(prev => prev.map(b => b.id === reportId ? { ...b, veliSildi: true } : b));
  };

  const adminIlet = async (reportId) => {
    if (!window.confirm("Bu bildirimi admine iletmek istediginizden emin misiniz?")) return;
    await updateDoc(doc(db, "reports", reportId), {
      adminaIletti: true, ileten: veliIsmi, iletenRol: "parent",
      iletenUid: auth.currentUser.uid, iletmeTarihi: serverTimestamp()
    });
    setBildirimler(prev => prev.map(b =>
      b.id === reportId ? { ...b, adminaIletti: true, ileten: veliIsmi, iletenRol: "parent" } : b
    ));
    alert("Bildirim admine iletildi!");
  };

  const postIcerikGoster = async (reportId) => {
    // Postu Firestore'dan CEKMIYORUZ (baskasinin cocugunun postu olabilir, Rules engeller).
    // Sikayet detayi (metin + foto) zaten reports kaydinda var, onu gosteriyoruz.
    setAcikIcerik(prev => ({ ...prev, [reportId]: !prev[reportId] }));
  };

  const acilBildirimSayisi = bildirimler.filter(b => b.acil && !b.veliGordu).length;
  const yeniBildirimSayisi = bildirimler.filter(b => !b.veliGordu).length;

  const IZIN_SECENEKLERI = [
    { deger: "arkadas", label: "👫 Sadece arkadaslari", aciklama: "Sadece arkadas oldugu kisilerle" },
    { deger: "okul", label: "🏫 Kendi okulundan", aciklama: "Ayni okuldaki ogrencilerle" },
    { deger: "kapali", label: "🚫 Kapali", aciklama: "Hic kimseyle" }
  ];

  const mesajTarih = (sn) => {
    if (!sn) return "";
    const d = new Date(sn * 1000);
    return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  // Etkilesimler: su an sadece cocugun kendi postlari (yorumlar ileride eklenecek)
  const etkilesimler = [
    ...cocukPostlari.map(p => ({ tur: "post", zaman: p.tarih?.seconds || 0, veri: p }))
  ].sort((a, b) => b.zaman - a.zaman);

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.2s" }}>
    <div style={{ maxWidth: "650px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

      {secilenProfil && (
        <ProfilSayfasi kullaniciId={secilenProfil} onKapat={() => setSecilenProfil(null)} mevcutKullaniciRol="parent" />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ color: "#4f46e5", margin: "0 0 4px" }}>Veli Paneli</h2>
          <p style={{ margin: 0, fontSize: "13px", color: ikincilYazi }}>👤 {veliIsmi}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>☀️</span>
            <div onClick={() => { const yeni = !karanlikMod; setKaranlikMod(yeni); localStorage.setItem("parentKaranlikMod", yeni); }}
              style={{ width: "36px", height: "20px", borderRadius: "10px", background: karanlikMod ? "#4f46e5" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: karanlikMod ? "18px" : "2px", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: "12px", color: ikincilYazi }}>🌙</span>
          </div>
          <button onClick={() => signOut(auth)}
            style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
            Cikis
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => setAktifSekme("etkilesimler")}
          style={{ flex: "1 1 18%", padding: "10px", background: aktifSekme === "etkilesimler" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "etkilesimler" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>
          💬 Etkilesimler
        </button>
        <button onClick={() => setAktifSekme("bildirimler")}
          style={{ flex: "1 1 18%", padding: "10px", background: aktifSekme === "bildirimler" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "bildirimler" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px", position: "relative" }}>
          🚩 Bildirimler
          {yeniBildirimSayisi > 0 && (
            <span style={{ position: "absolute", top: "-6px", right: "-6px", background: acilBildirimSayisi > 0 ? "#ef4444" : "#f59e0b", color: "white", borderRadius: "50%", width: "22px", height: "22px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>
              {yeniBildirimSayisi}
            </span>
          )}
        </button>
        {ogretmenUid && (
          <button onClick={() => setAktifSekme("ogretmen")}
            style={{ flex: "1 1 18%", padding: "10px", background: aktifSekme === "ogretmen" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "ogretmen" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>
            🏫 Ogretmen
          </button>
        )}
        <button onClick={() => { setAktifSekme("mesajlar"); setAktifSohbet(null); if (!sohbetlerYuklendi) sohbetleriGetir(); }}
          style={{ flex: "1 1 18%", padding: "10px", background: aktifSekme === "mesajlar" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "mesajlar" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>
          ✉️ Mesajlar
        </button>
        <button onClick={() => setAktifSekme("ayarlar")}
          style={{ flex: "1 1 18%", padding: "10px", background: aktifSekme === "ayarlar" ? "#4f46e5" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === "ayarlar" ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>
          ⚙️ Ayarlar
        </button>
      </div>

      {yukleniyor ? <p style={{ color: yaziRenk }}>Yukleniyor...</p> : aktifSekme === "mesajlar" ? (
        <div>
          <div style={{ background: karanlikMod ? "#1e3a5f" : "#eff6ff", padding: "12px 14px", borderRadius: "10px", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: karanlikMod ? "#bfdbfe" : "#1e40af", lineHeight: 1.5 }}>
              ℹ️ Cocugunuzun yazismalarini buradan gorebilirsiniz (salt okunur). Gerekli gordugunuzde yalnizca cocugunuzun gonderdigi mesaji kaldirabilirsiniz. Karsi tarafin mesajlarina dokunamaz, mesaj yazamazsiniz.
            </p>
          </div>

          {aktifSohbet ? (
            <div>
              <button onClick={() => { setAktifSohbet(null); setSohbetMesajlari([]); }}
                style={{ marginBottom: "12px", padding: "8px 14px", background: karanlikMod ? "#374151" : "#e5e7eb", color: yaziRenk, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                ← Sohbetlere don
              </button>
              <div style={{ background: kartBg, padding: "14px 16px", borderRadius: "12px", marginBottom: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: yaziRenk }}>
                  💬 {aktifSohbet.cocukIsim} ↔ {aktifSohbet.karsiIsim}
                </p>
              </div>
              {mesajYukleniyor ? (
                <p style={{ color: ikincilYazi, textAlign: "center" }}>Yukleniyor...</p>
              ) : sohbetMesajlari.length === 0 ? (
                <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}><p>Bu sohbette mesaj yok.</p></div>
              ) : (
                <div style={{ background: kartBg, padding: "12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                  {sohbetMesajlari.map(m => {
                    const cocuktan = m.gondericiUid === aktifSohbet.cocukUid;
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: cocuktan ? "flex-end" : "flex-start", marginBottom: "8px" }}>
                        <div style={{ maxWidth: "75%" }}>
                          <div style={{
                            background: m.silindi ? (karanlikMod ? "#4b5563" : "#e5e7eb") : (cocuktan ? "#4f46e5" : (karanlikMod ? "#374151" : "#f3f4f6")),
                            color: m.silindi ? ikincilYazi : (cocuktan ? "white" : yaziRenk),
                            padding: "8px 12px", borderRadius: "12px", wordBreak: "break-word", fontStyle: m.silindi ? "italic" : "normal"
                          }}>
                            <p style={{ margin: 0, fontSize: "13px" }}>{m.silindi ? "🗑️ Bu mesaj silindi" : m.icerik}</p>
                          </div>
                          <div style={{ display: "flex", justifyContent: cocuktan ? "flex-end" : "flex-start", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <small style={{ fontSize: "10px", color: ikincilYazi }}>
                              {cocuktan ? aktifSohbet.cocukIsim : aktifSohbet.karsiIsim} · {mesajTarih(m.tarih?.seconds)}
                            </small>
                            {cocuktan && !m.silindi && (
                              <button onClick={() => veliMesajSil(m)}
                                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "11px", color: "#ef4444", padding: 0 }}>
                                🗑️ Kaldir
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : mesajYukleniyor ? (
            <p style={{ color: ikincilYazi, textAlign: "center" }}>Sohbetler yukleniyor...</p>
          ) : sohbetler.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}>
              <p>Cocugunuzun henuz mesajlasmasi yok.</p>
            </div>
          ) : (
            <div>
              {sohbetler.map(s => (
                <div key={s.konusmaId} onClick={() => sohbetAc(s)}
                  style={{ background: kartBg, padding: "14px 16px", borderRadius: "12px", marginBottom: "8px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: `1px solid ${borderRenk}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: yaziRenk }}>
                      {s.cocukIsim} <span style={{ color: ikincilYazi, fontWeight: "400" }}>↔</span> {s.karsiIsim}
                    </p>
                    <small style={{ fontSize: "10px", color: ikincilYazi }}>{mesajTarih(s.sonMesajZaman)}</small>
                  </div>
                  <p style={{ margin: 0, fontSize: "12px", color: ikincilYazi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.sonMesajMetni} · {s.mesajSayisi} mesaj
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : aktifSekme === "ayarlar" ? (
        <div>
          <div style={{ background: karanlikMod ? "#1e3a5f" : "#eff6ff", padding: "12px 14px", borderRadius: "10px", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: karanlikMod ? "#bfdbfe" : "#1e40af", lineHeight: 1.5 }}>
              ℹ️ Cocugunuzun kimlerle mesajlasabilecegini ve kimlerin paylasimlarini gorebilecegini buradan ayarlayabilirsiniz. Bu ayarlari yalnizca siz degistirebilirsiniz.
            </p>
          </div>

          {cocuklar.length === 0 ? (
            <div style={{ background: kartBg, padding: "20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}>
              <p>Henuz tanimli cocugunuz yok.</p>
            </div>
          ) : (
            cocuklar.map(uid => {
              const cocuk = cocukBilgileri[uid];
              if (!cocuk) return null;
              const dmIzni = cocuk.dmIzni || "okul";
              const akisIzni = cocuk.akisIzni || "okul";
              return (
                <div key={uid} style={{ background: kartBg, padding: "18px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "16px" }}>
                  <p style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: "700", color: yaziRenk }}>👶 {cocuk.isim || "Cocuk"}</p>

                  <div style={{ marginBottom: "18px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "600", color: yaziRenk }}>📨 Mesajlasma (DM)</p>
                    <p style={{ margin: "0 0 10px", fontSize: "12px", color: ikincilYazi }}>Cocugunuza kimler mesaj atabilir?</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {IZIN_SECENEKLERI.map(s => {
                        const secili = dmIzni === s.deger;
                        const kaydediliyor = ayarKaydet === uid + "dmIzni";
                        return (
                          <div key={s.deger} onClick={() => !kaydediliyor && izinDegistir(uid, "dmIzni", s.deger)}
                            style={{ padding: "10px 12px", borderRadius: "8px", cursor: kaydediliyor ? "default" : "pointer", background: secili ? (karanlikMod ? "#312e81" : "#e0e7ff") : (karanlikMod ? "#374151" : "#f9fafb"), border: secili ? "2px solid #4f46e5" : `1px solid ${borderRenk}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: secili ? "#4f46e5" : yaziRenk }}>{s.label}</p>
                              <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>{s.aciklama}</p>
                            </div>
                            {secili && <span style={{ color: "#4f46e5", fontWeight: "700", fontSize: "16px" }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "600", color: yaziRenk }}>📰 Akis (Paylasimlar)</p>
                    <p style={{ margin: "0 0 10px", fontSize: "12px", color: ikincilYazi }}>Cocugunuz kimlerin paylasimlarini gorsun?</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {IZIN_SECENEKLERI.map(s => {
                        const secili = akisIzni === s.deger;
                        const kaydediliyor = ayarKaydet === uid + "akisIzni";
                        const akisLabel = s.deger === "kapali" ? "🚫 Kapali (sadece kendi paylasimlari)" : s.label;
                        return (
                          <div key={s.deger} onClick={() => !kaydediliyor && izinDegistir(uid, "akisIzni", s.deger)}
                            style={{ padding: "10px 12px", borderRadius: "8px", cursor: kaydediliyor ? "default" : "pointer", background: secili ? (karanlikMod ? "#312e81" : "#e0e7ff") : (karanlikMod ? "#374151" : "#f9fafb"), border: secili ? "2px solid #4f46e5" : `1px solid ${borderRenk}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: secili ? "#4f46e5" : yaziRenk }}>{akisLabel}</p>
                              <p style={{ margin: 0, fontSize: "11px", color: ikincilYazi }}>{s.aciklama}</p>
                            </div>
                            {secili && <span style={{ color: "#4f46e5", fontWeight: "700", fontSize: "16px" }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : aktifSekme === "ogretmen" ? (
        <div>
          {ogretmenIsim && (
            <div style={{ background: "#e0e7ff", padding: "10px 14px", borderRadius: "10px", marginBottom: "12px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#3730a3", fontWeight: "600" }}>
                👩‍🏫 Cocugunuzun Ogretmeni: {ogretmenIsim}
              </p>
            </div>
          )}
          {ogretmenGonderiler.length === 0 ? (
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", textAlign: "center", color: "#888" }}>
              <p>Ogretmen henuz paylasim yapmadi.</p>
            </div>
          ) : (
            ogretmenGonderiler.map(g => {
              const begenenler = g.begenenler || [];
              return (
                <div key={g.id} style={{ background: "white", padding: "16px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", color: "#4f46e5", background: "#e0e7ff", padding: "2px 8px", borderRadius: "6px", display: "inline-block", marginBottom: "8px" }}>
                    📋 Ogretmen Paylasimi
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "15px", color: "#111827" }}>{g.icerik}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <small style={{ color: "#6b7280", fontSize: "12px" }}>
                      {g.tarih ? new Date(g.tarih.seconds * 1000).toLocaleDateString("tr-TR") : ""}
                    </small>
                    <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#ef4444", borderRadius: "6px", fontSize: "12px" }}>
                      ❤️ {begenenler.length}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : aktifSekme === "bildirimler" ? (
        <div>
          {bildirimler.length === 0 ? (
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", textAlign: "center", color: "#888" }}>
              <p>Hic bildirim yok.</p>
            </div>
          ) : (
            bildirimler.map(b => (
              <div key={b.id} style={{
                background: "white", padding: "16px", borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px",
                border: b.acil && !b.veliGordu ? "2px solid #ef4444" : "1px solid #e5e7eb",
                opacity: b.veliSildi ? 0.7 : 1
              }}>
                {b.acil && !b.veliGordu && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", marginBottom: "8px", fontWeight: "700" }}>
                    🚨 ACIL: Cocugunuz yardim istiyor!
                  </div>
                )}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                  {!b.veliGordu && <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>YENI</span>}
                  {b.veliSildi && <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>✓ Kaldirildi</span>}
                  {b.adminaIletti && <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>✓ Admine iletildi {b.iletenRol === "teacher" ? "(ogretmen)" : "(veli)"}</span>}
                  {b.ogretmenSildi && <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>Ogretmen kaldirdi</span>}
                </div>
                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#6b7280" }}>
                  📋 Sebep: <strong>{b.kategori}</strong>{b.digerSebep && <span> — "{b.digerSebep}"</span>}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280" }}>
                  💙 Bildiren cocugun durumu: {b.iyiMisin === "iyi" ? "😊 Iyi" : b.iyiMisin === "uzgun" ? "😟 Biraz uzgun" : b.iyiMisin === "yardim" ? "😢 Yardim istiyor" : "—"}
                </p>
                <div style={{ background: "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "8px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "14px" }}>{b.icerikMetni}</p>
                  <small style={{ color: "#6b7280" }}>Yazan: <span onClick={() => setSecilenProfil(b.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.yazar}</span></small>
                </div>
                {b.tip === "post" && (b.icerikMetni || b.fotoUrl) && (
                  <button onClick={() => postIcerikGoster(b.id)}
                    style={{ fontSize: "12px", color: "#4f46e5", background: "none", border: "none", cursor: "pointer", padding: "0", marginBottom: "8px" }}>
                    {acikIcerik[b.id] ? "▲ Gonderiyi gizle" : "▼ Gonderiyi tam goster"}
                  </button>
                )}
                {acikIcerik[b.id] && (
                  <div style={{ background: "#ede9fe", padding: "10px", borderRadius: "8px", marginBottom: "8px", fontSize: "13px" }}>
                    <p style={{ margin: 0 }}>{b.icerikMetni}</p>
                    {b.fotoUrl && <MedyaGoster url={b.fotoUrl} />}
                  </div>
                )}
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 8px" }}>
                  🚩 Bildiren: <span onClick={() => setSecilenProfil(b.bildirenUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline" }}>{b.bildiren}</span>
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {!b.veliGordu && (
                    <button onClick={() => bildirimOkundu(b.id)}
                      style={{ flex: "1 1 45%", padding: "6px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                      ✓ Okundu
                    </button>
                  )}
                  {!b.adminaIletti && (
                    <button onClick={() => adminIlet(b.id)}
                      style={{ flex: "1 1 45%", padding: "6px 12px", background: "#f59e0b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                      📨 Admine Ilet
                    </button>
                  )}
                  {!b.veliSildi && (
                    <button onClick={() => bildirimKaldir(b.id, b.postId)}
                      style={{ padding: "6px 12px", background: "#6b7280", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                      🗑️ Kaldir
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        etkilesimler.length === 0 ? (
          <div style={{ background: "white", padding: "20px", borderRadius: "12px", textAlign: "center", color: "#888" }}>
            <p>Cocugunuzun hic etkilesimi yok.</p>
          </div>
        ) : (
          <div>
            <h3 style={{ color: "#666", marginBottom: "16px" }}>Cocugunuzun Etkilesimleri</h3>
            {etkilesimler.map((e) => {
                const g = e.veri;
                const yazarCocuk = cocukBilgileri[g.yazarUid];
                const begenenler = g.begenenler || [];
                const kaldirildi = g.veliKaldirdi || g.ogretmenKaldirdi || g.ogrenciSildi;
                return (
                  <div key={"post_" + g.id} style={{
                    background: "white", padding: "16px", borderRadius: "12px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "12px",
                    opacity: kaldirildi ? 0.75 : 1, border: kaldirildi ? "1px solid #e5e7eb" : "none"
                  }}>
                    <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "8px", fontSize: "11px", marginBottom: "8px", display: "inline-block" }}>
                      📝 Paylasim
                    </span>
                    {kaldirildi && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px", marginTop: "4px" }}>
                        {g.ogrenciSildi && <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Ogrenci sildi</span>}
                        {g.veliKaldirdi && <span style={{ background: "#ede9fe", color: "#5b21b6", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Veli kaldirdi</span>}
                        {g.ogretmenKaldirdi && <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "6px", fontSize: "11px" }}>Ogretmen kaldirdi</span>}
                      </div>
                    )}
                    {!kaldirildi && <p style={{ margin: "8px 0", fontSize: "15px" }}>{g.icerik}</p>}
                    {!kaldirildi && g.fotoUrl && <MedyaGoster url={g.fotoUrl} />}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <small onClick={() => setSecilenProfil(g.yazarUid)} style={{ color: "#4f46e5", cursor: "pointer", textDecoration: "underline", fontSize: "13px" }}>{g.yazar}</small>
                        {yazarCocuk?.dondurulmus && <span style={{ background: "#fee2e2", color: "#ef4444", padding: "2px 6px", borderRadius: "8px", fontSize: "11px" }}>🔒 Dondurulmus</span>}
                        {g.tarih && <small style={{ color: "#9ca3af", fontSize: "11px" }}>{mesajTarih(g.tarih.seconds)}</small>}
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ padding: "4px 10px", background: "#fee2e2", color: "#ef4444", borderRadius: "6px", fontSize: "12px" }}>❤️ {begenenler.length}</span>
                        {!g.veliKaldirdi && (
                          <button onClick={() => handleSil(g.id, g.yazarUid)} style={{ padding: "4px 10px", background: "#ef4444", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>🗑️ Kaldir</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        )
      )}
    </div>
    </div>
  );
}

export default ParentDashboard;