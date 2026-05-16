import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, where } from "firebase/firestore";

const KUFUR_LISTESI = [
  "amk", "aq", "amq", "amına", "amini", "amcık", "amcik", "anasını",
  "siktir", "siktiret", "sikim", "sikme", "siker", "sikiyim", "sikerim", "sikiş",
  "siktigim", "sikilmis", "sikti", "sikiyo", "sikis", "sik",
  "orospu", "orusbu", "oruspu", "kahpe", "fahişe", "fahise", "sürtük", "surtuk",
  "piç", "pic", "puşt", "pust", "ibne", "ibnə",
  "göt", "got", "götveren", "gotveren", "götlek", "gotlek",
  "yarrak", "yarrağ", "yarra", "yarak",
  "oç", "oc", "öç", "ananın", "ananı", "ananızın", "anasının", "ananin",
  "babanı", "babanın", "babani",
  "bacın", "bacını", "bacının",
  "bok", "boktan", "bokunu",
  "salak", "aptal", "gerizekalı", "gerizekali", "mal", "öküz", "okuz",
  "fuck", "fucking", "shit", "bitch", "asshole", "bastard"
];

function konusmaId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function DM({ kullaniciIsim, arkadaslar, karanlikMod }) {
  const [acik, setAcik] = useState(false);
  const [aktifKonusma, setAktifKonusma] = useState(null);
  const [arkadasBilgileri, setArkadasBilgileri] = useState([]);
  const [mesajlar, setMesajlar] = useState([]);
  const [yeniMesaj, setYeniMesaj] = useState("");
  const [okunmamisToplam, setOkunmamisToplam] = useState(0);
  const [okunmamisHaritasi, setOkunmamisHaritasi] = useState({});
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (arkadaslar && arkadaslar.length > 0) {
      arkadasBilgileriniGetir();
      okunmamisSayilariGetir();
      const interval = setInterval(okunmamisSayilariGetir, 3000);
      return () => clearInterval(interval);
    } else {
      setArkadasBilgileri([]);
      setOkunmamisToplam(0);
    }
  }, [arkadaslar]);

  useEffect(() => {
    if (aktifKonusma) {
      mesajlariGetir();
      const interval = setInterval(mesajlariGetir, 2000);
      return () => clearInterval(interval);
    }
  }, [aktifKonusma]);

  const arkadasBilgileriniGetir = async () => {
    const bilgiler = [];
    for (const uid of arkadaslar) {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        bilgiler.push({ id: uid, ...userDoc.data() });
      }
    }
    setArkadasBilgileri(bilgiler);
  };

  const okunmamisSayilariGetir = async () => {
    if (!arkadaslar || arkadaslar.length === 0) return;
    let toplam = 0;
    const harita = {};
    for (const uid of arkadaslar) {
      const kId = konusmaId(auth.currentUser.uid, uid);
      try {
        const q = query(
          collection(db, "messages", kId, "mesajlar"),
          where("aliciUid", "==", auth.currentUser.uid),
          where("okundu", "==", false)
        );
        const snapshot = await getDocs(q);
        const sayi = snapshot.size;
        harita[uid] = sayi;
        toplam += sayi;
      } catch (e) {
        harita[uid] = 0;
      }
    }
    setOkunmamisHaritasi(harita);
    setOkunmamisToplam(toplam);
  };

  const mesajlariGetir = async () => {
    if (!aktifKonusma) return;
    const kId = konusmaId(auth.currentUser.uid, aktifKonusma.id);
    const q = query(collection(db, "messages", kId, "mesajlar"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setMesajlar(liste);

    // Bana gelen okunmamislari okundu yap
    for (const m of liste) {
      if (m.aliciUid === auth.currentUser.uid && !m.okundu) {
        await updateDoc(doc(db, "messages", kId, "mesajlar", m.id), { okundu: true });
      }
    }
  };

  const kufurKontrol = (metin) => {
    const kucukMetin = metin.toLowerCase();
    return KUFUR_LISTESI.some(kufur => kucukMetin.includes(kufur));
  };

  const mesajGonder = async () => {
    if (!yeniMesaj.trim() || !aktifKonusma) return;
    if (kufurKontrol(yeniMesaj)) {
      alert("⚠️ Mesajda uygunsuz kelimeler tespit edildi!");
      return;
    }
    setYukleniyor(true);
    const kId = konusmaId(auth.currentUser.uid, aktifKonusma.id);
    await addDoc(collection(db, "messages", kId, "mesajlar"), {
      icerik: yeniMesaj,
      gondericiUid: auth.currentUser.uid,
      gondericiIsim: kullaniciIsim,
      aliciUid: aktifKonusma.id,
      aliciIsim: aktifKonusma.isim,
      tarih: serverTimestamp(),
      okundu: false
    });
    setYeniMesaj("");
    await mesajlariGetir();
    setYukleniyor(false);
  };

  const mesajSil = async (mesajId) => {
    if (!window.confirm("Bu mesaji silmek istediginizden emin misiniz?")) return;
    const kId = konusmaId(auth.currentUser.uid, aktifKonusma.id);
    await updateDoc(doc(db, "messages", kId, "mesajlar", mesajId), { silindi: true });
    await mesajlariGetir();
  };

  const mesajSikayet = async (mesaj) => {
    const sebep = window.prompt("Bu mesaji neden sikayet ediyorsun?");
    if (!sebep || !sebep.trim()) return;
    await addDoc(collection(db, "reports"), {
      tip: "dm",
      icerikId: mesaj.id,
      konusmaId: konusmaId(auth.currentUser.uid, aktifKonusma.id),
      icerikMetni: mesaj.icerik,
      yazarUid: mesaj.gondericiUid,
      yazar: mesaj.gondericiIsim,
      bildirenUid: auth.currentUser.uid,
      bildiren: kullaniciIsim,
      kategori: "Ozel mesaj sikayeti",
      kategoriId: "dm",
      digerSebep: sebep,
      iyiMisin: null,
      acil: false,
      tarih: serverTimestamp(),
      okundu: false
    });
    alert("✅ Sikayetin alindi! Veli ve ogretmenlerin bilgilendirildi.");
  };

  const arkaplan = karanlikMod ? "#1f2937" : "white";
  const yazi = karanlikMod ? "#f3f4f6" : "#111827";
  const ikincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";
  const cizgi = karanlikMod ? "#374151" : "#e5e7eb";

  return (
    <>
      {/* Sag alt buton */}
      <button onClick={() => setAcik(!acik)}
        style={{
          position:"fixed",
          bottom:"20px",
          right:"20px",
          width:"60px",
          height:"60px",
          borderRadius:"50%",
          background:"#4f46e5",
          color:"white",
          border:"none",
          cursor:"pointer",
          fontSize:"24px",
          boxShadow:"0 4px 12px rgba(0,0,0,0.2)",
          zIndex:998
        }}>
        💬
        {okunmamisToplam > 0 && (
          <span style={{
            position:"absolute",
            top:"-4px",
            right:"-4px",
            background:"#ef4444",
            color:"white",
            borderRadius:"50%",
            minWidth:"22px",
            height:"22px",
            fontSize:"11px",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            fontWeight:"700",
            padding:"0 4px"
          }}>
            {okunmamisToplam}
          </span>
        )}
      </button>

      {/* Acilan panel */}
      {acik && (
        <div style={{
          position:"fixed",
          bottom:"90px",
          right:"20px",
          width:"340px",
          height:"500px",
          background: arkaplan,
          borderRadius:"16px",
          boxShadow:"0 8px 24px rgba(0,0,0,0.2)",
          zIndex:998,
          display:"flex",
          flexDirection:"column",
          overflow:"hidden"
        }}>

          {/* Baslik */}
          <div style={{
            padding:"12px 16px",
            background:"#4f46e5",
            color:"white",
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center"
          }}>
            {aktifKonusma ? (
              <>
                <button onClick={() => setAktifKonusma(null)}
                  style={{ background:"transparent", border:"none", color:"white", cursor:"pointer", fontSize:"18px", padding:"0 8px 0 0" }}>
                  ←
                </button>
                <span style={{ fontWeight:"700", flex:1, color:"white", fontSize:"15px" }}>💬 {aktifKonusma.isim}</span>
              </>
            ) : (
              <span style={{ fontWeight:"700", color:"white", fontSize:"15px" }}>💬 Mesajlar</span>
            )}
            <button onClick={() => setAcik(false)}
              style={{ background:"transparent", border:"none", color:"white", cursor:"pointer", fontSize:"18px" }}>
              ✕
            </button>
          </div>

          {/* Icerik */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
            {!aktifKonusma ? (
              // Arkadas listesi
              arkadasBilgileri.length === 0 ? (
                <p style={{ textAlign:"center", color: ikincilYazi, fontSize:"13px", marginTop:"20px" }}>
                  Henuz arkadasin yok. Arkadas ekleyince burada gozukur.
                </p>
              ) : (
                arkadasBilgileri.map(a => (
                  <div key={a.id}
                    onClick={() => setAktifKonusma(a)}
                    style={{
                      padding:"10px",
                      background: karanlikMod ? "#374151" : "#f9fafb",
                      borderRadius:"8px",
                      marginBottom:"6px",
                      cursor:"pointer",
                      display:"flex",
                      justifyContent:"space-between",
                      alignItems:"center"
                    }}>
                    <div>
                      <p style={{ margin:"0", fontSize:"13px", fontWeight:"600", color: yazi }}>{a.isim}</p>
                      {a.sinif && <p style={{ margin:"0", fontSize:"11px", color: ikincilYazi }}>📚 {a.sinif}</p>}
                    </div>
                    {okunmamisHaritasi[a.id] > 0 && (
                      <span style={{
                        background:"#ef4444",
                        color:"white",
                        borderRadius:"50%",
                        minWidth:"20px",
                        height:"20px",
                        fontSize:"11px",
                        display:"flex",
                        alignItems:"center",
                        justifyContent:"center",
                        fontWeight:"700",
                        padding:"0 4px"
                      }}>
                        {okunmamisHaritasi[a.id]}
                      </span>
                    )}
                  </div>
                ))
              )
            ) : (
              // Mesajlar
              mesajlar.length === 0 ? (
                <p style={{ textAlign:"center", color: ikincilYazi, fontSize:"13px", marginTop:"20px" }}>
                  Henuz mesaj yok. Ilk mesaji sen at!
                </p>
              ) : (
                mesajlar.map(m => {
                  const benim = m.gondericiUid === auth.currentUser.uid;
                  return (
                    <div key={m.id} style={{
                      display:"flex",
                      justifyContent: benim ? "flex-end" : "flex-start",
                      marginBottom:"6px"
                    }}>
                      <div style={{
                        background: m.silindi ? (karanlikMod ? "#4b5563" : "#e5e7eb") : (benim ? "#4f46e5" : (karanlikMod ? "#374151" : "#f3f4f6")),
                        color: m.silindi ? ikincilYazi : (benim ? "white" : yazi),
                        padding:"8px 12px",
                        borderRadius:"12px",
                        maxWidth:"70%",
                        wordBreak:"break-word",
                        position:"relative",
                        fontStyle: m.silindi ? "italic" : "normal"
                      }}>
                        <p style={{ margin:"0", fontSize:"13px" }}>
                          {m.silindi ? "🗑️ Bu mesaj silindi" : m.icerik}
                        </p>
                        <div style={{ display:"flex", gap:"4px", marginTop:"4px", justifyContent:"flex-end" }}>
                          {benim && !m.silindi && (
                            <button onClick={() => mesajSil(m.id)}
                              style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:"11px", color:"rgba(255,255,255,0.7)", padding:"0" }}>
                              🗑️
                            </button>
                          )}
                          {!benim && (
                            <button onClick={() => mesajSikayet(m)}
                              style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:"11px", padding:"0" }}>
                              🚩
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>

          {/* Mesaj yazma alani */}
          {aktifKonusma && (
            <div style={{ padding:"10px", borderTop: "1px solid " + cizgi, display:"flex", gap:"6px" }}>
              <input
                type="text"
                placeholder="Mesaj yaz..."
                value={yeniMesaj}
                onChange={e => setYeniMesaj(e.target.value)}
                onKeyDown={e => e.key === "Enter" && mesajGonder()}
                style={{ flex:1, padding:"8px", borderRadius:"8px", border:"1px solid " + cizgi, fontSize:"13px", background: karanlikMod ? "#374151" : "white", color: yazi }} />
              <button onClick={mesajGonder} disabled={yukleniyor}
                style={{ padding:"8px 14px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
                ➤
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default DM;