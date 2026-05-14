import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { signOut } from "firebase/auth";
import ProfilSayfasi from "./ProfilSayfasi";

const KUFUR_LISTESI = [
  // Klasik küfürler
  "amk", "aq", "amq", "amına", "amini", "amcık", "amcik", "amına koyayım", "anasını",
  "siktir", "siktiret", "sikim", "sikme", "siker", "sikiyim", "sikerim", "sikiş",
  "siktigim", "sikilmis", "sikti", "sikiyo", "sikis", "sik",
  "orospu", "orusbu", "oruspu", "kahpe", "fahişe", "fahise", "sürtük", "surtuk",
  "piç", "pic", "puşt", "pust", "ibne", "ibnə",
  "göt", "got", "götveren", "gotveren", "götlek", "gotlek",
  "yarrak", "yarrağ", "yarra", "yarak",
  "oç", "oc", "öç", "ananın", "ananı", "ananızın", "anasının", "ananin",
  "babanı", "babanın", "baban", "babani",
  "bacın", "bacını", "bacının",
  "bok", "boktan", "bokunu",
  
  // Yumuşak/argo
  "salak", "aptal", "gerizekalı", "gerizekali", "mal", "öküz", "okuz",
  "hıyar", "hiyar", "eşek", "esek",
  
  // İngilizce
  "fuck", "fucking", "shit", "bitch", "asshole", "bastard", "dick", "pussy",
  
  // Yaratıcı varyasyonlar
  "5iktir", "s1ktir", "$iktir", "amk lan", "anan", "ananizi",
  "döl", "dol", "tasak", "taşak", "meme"
];
function StudentDashboard() {
  const [gonderi, setGonderi] = useState("");
  const [gonderiler, setGonderiler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kullaniciIsim, setKullaniciIsim] = useState("");
  const [secilenProfil, setSecilenProfil] = useState(null);
  const [acikYorumlar, setAcikYorumlar] = useState({});
  const [yorumlar, setYorumlar] = useState({});
  const [yeniYorum, setYeniYorum] = useState({});
  const [hataMesaj, setHataMesaj] = useState("");

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

  const kufurKontrol = (metin) => {
    const kucukMetin = metin.toLowerCase();
    return KUFUR_LISTESI.some(kufur => kucukMetin.includes(kufur));
  };

  const gonderileriGetir = async () => {
    const q = query(collection(db, "posts"), orderBy("tarih", "desc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setGonderiler(liste);
  };

  const yorumlariGetir = async (postId) => {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("tarih", "asc"));
    const snapshot = await getDocs(q);
    const liste = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setYorumlar(prev => ({ ...prev, [postId]: liste }));
  };

  const yorumToggle = async (postId) => {
    const acik = !acikYorumlar[postId];
    setAcikYorumlar(prev => ({ ...prev, [postId]: acik }));
    if (acik && !yorumlar[postId]) {
      await yorumlariGetir(postId);
    }
  };

  const yorumYap = async (postId) => {
    const metin = yeniYorum[postId];
    if (!metin || !metin.trim()) return;
    if (kufurKontrol(metin)) {
      alert("⚠️ Yorumda uygunsuz kelimeler tespit edildi. Lutfen duzenleyin!");
      return;
    }
    await addDoc(collection(db, "posts", postId, "comments"), {
      icerik: metin,
      yazar: kullaniciIsim || auth.currentUser.email,
      yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp()
    });
    setYeniYorum(prev => ({ ...prev, [postId]: "" }));
    await yorumlariGetir(postId);
  };

  const yorumSil = async (postId, yorumId) => {
    await deleteDoc(doc(db, "posts", postId, "comments", yorumId));
    await yorumlariGetir(postId);
  };

  const gonderiYap = async () => {
    if (!gonderi.trim()) return;
    if (kufurKontrol(gonderi)) {
      setHataMesaj("⚠️ Paylasimda uygunsuz kelimeler tespit edildi. Lutfen duzenleyin!");
      setTimeout(() => setHataMesaj(""), 4000);
      return;
    }
    setYukleniyor(true);
    await addDoc(collection(db, "posts"), {
      icerik: gonderi,
      yazar: kullaniciIsim || auth.currentUser.email,
      yazarUid: auth.currentUser.uid,
      tarih: serverTimestamp(),
      begenenler: []
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

  const begeniToggle = async (postId, begenenler) => {
    const benBegendimMi = begenenler && begenenler.includes(auth.currentUser.uid);
    if (benBegendimMi) {
      await updateDoc(doc(db, "posts", postId), {
        begenenler: arrayRemove(auth.currentUser.uid)
      });
    } else {
      await updateDoc(doc(db, "posts", postId), {
        begenenler: arrayUnion(auth.currentUser.uid)
      });
    }
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
        <h2 style={{ color:"#4f46e5" }}>Ogrenci Paneli</h2>
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
        {hataMesaj && (
          <div style={{ marginTop:"8px", padding:"8px 12px", background:"#fee2e2", color:"#ef4444", borderRadius:"8px", fontSize:"13px" }}>
            {hataMesaj}
          </div>
        )}
        <button onClick={gonderiYap} disabled={yukleniyor}
          style={{ marginTop:"10px", padding:"10px 24px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"15px" }}>
          {yukleniyor ? "Paylasiliyor..." : "Paylas"}
        </button>
      </div>

      <div>
        {gonderiler.map(g => {
          const begenenler = g.begenenler || [];
          const benBegendimMi = begenenler.includes(auth.currentUser.uid);
          return (
            <div key={g.id} style={{ background:"white", padding:"16px", borderRadius:"12px", boxShadow:"0 2px 8px rgba(0,0,0,0.1)", marginBottom:"12px" }}>
              <p style={{ margin:"0 0 8px 0", fontSize:"15px" }}>{g.icerik}</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                <small
                  onClick={() => setSecilenProfil(g.yazarUid)}
                  style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline" }}>
                  {g.yazar}
                </small>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button onClick={() => begeniToggle(g.id, begenenler)}
                    style={{ padding:"4px 10px", background: benBegendimMi ? "#fee2e2" : "#f3f4f6", color: benBegendimMi ? "#ef4444" : "#6b7280", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                    {benBegendimMi ? "❤️" : "🤍"} {begenenler.length}
                  </button>
                  <button onClick={() => yorumToggle(g.id)}
                    style={{ padding:"4px 10px", background:"#e0e7ff", color:"#4f46e5", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                    💬 {yorumlar[g.id] ? yorumlar[g.id].length : ""} Yorum
                  </button>
                  {g.yazarUid === auth.currentUser.uid && (
                    <button onClick={() => gonderiSil(g.id, g.yazarUid)}
                      style={{ padding:"4px 10px", background:"#ef4444", color:"white", border:"none", borderRadius:"6px", cursor:"pointer", fontSize:"12px" }}>
                      Sil
                    </button>
                  )}
                </div>
              </div>

              {acikYorumlar[g.id] && (
                <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid #f0f4ff" }}>
                  {yorumlar[g.id] && yorumlar[g.id].map(y => (
                    <div key={y.id} style={{ background:"#f9fafb", padding:"10px", borderRadius:"8px", marginBottom:"6px", position:"relative" }}>
                      <p style={{ margin:"0 0 4px", fontSize:"14px" }}>{y.icerik}</p>
                      <small
                        onClick={() => setSecilenProfil(y.yazarUid)}
                        style={{ color:"#4f46e5", cursor:"pointer", textDecoration:"underline", fontSize:"12px" }}>
                        {y.yazar}
                      </small>
                      {y.yazarUid === auth.currentUser.uid && (
                        <button onClick={() => yorumSil(g.id, y.id)}
                          style={{ position:"absolute", top:"8px", right:"8px", padding:"2px 8px", background:"#ef4444", color:"white", border:"none", borderRadius:"5px", cursor:"pointer", fontSize:"11px" }}>
                          Sil
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
                    <input
                      type="text"
                      placeholder="Yorum yaz..."
                      value={yeniYorum[g.id] || ""}
                      onChange={e => setYeniYorum(prev => ({ ...prev, [g.id]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && yorumYap(g.id)}
                      style={{ flex:1, padding:"8px", borderRadius:"8px", border:"1px solid #ddd", fontSize:"13px" }} />
                    <button onClick={() => yorumYap(g.id)}
                      style={{ padding:"8px 14px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"13px" }}>
                      Gonder
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StudentDashboard;