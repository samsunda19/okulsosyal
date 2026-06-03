import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

function YoneticiDashboard() {
  const [aktifSekme, setAktifSekme] = useState("kod");
  const [karanlikMod, setKaranlikMod] = useState(() => localStorage.getItem("yoneticiKaranlikMod") === "true");
  const [kullanici, setKullanici] = useState({ isim: "", okul: "" });

  // Kod uretme formu
  const [veliAdi, setVeliAdi] = useState("");
  const [veliTel, setVeliTel] = useState("");
  const [cocukSayisi, setCocukSayisi] = useState(1);

  const bg = karanlikMod ? "#111827" : "#f9fafb";
  const kartBg = karanlikMod ? "#1f2937" : "white";
  const yaziRenk = karanlikMod ? "#f3f4f6" : "#111827";
  const ikincilYazi = karanlikMod ? "#9ca3af" : "#6b7280";
  const inputBg = karanlikMod ? "#374151" : "white";
  const borderRenk = karanlikMod ? "#374151" : "#e5e7eb";

  useEffect(() => {
    const getir = async () => {
      if (!auth.currentUser) return;
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setKullanici({ isim: data.isim || auth.currentUser.email, okul: data.okul || "" });
      }
    };
    getir();
  }, []);

  const SEKMELER = [
    { id: "kod", label: "🔑 Kod Üret", aktif: true },
    { id: "ogretmen", label: "👩‍🏫 Öğretmen Paylaşımları", aktif: false },
    { id: "ogrenci", label: "🎓 Öğrenci Paylaşımları", aktif: false }
  ];

  return (
    <div style={{ minHeight: "100vh", background: bg, transition: "background 0.2s" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2 style={{ color: "#0891b2", margin: 0 }}>🏫 Yönetici Paneli</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: ikincilYazi }}>☀️</span>
              <div onClick={() => { const yeni = !karanlikMod; setKaranlikMod(yeni); localStorage.setItem("yoneticiKaranlikMod", yeni); }}
                style={{ width: "36px", height: "20px", borderRadius: "10px", background: karanlikMod ? "#0891b2" : "#d1d5db", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: karanlikMod ? "18px" : "2px", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: "12px", color: ikincilYazi }}>🌙</span>
            </div>
            <button onClick={() => signOut(auth)} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Çıkış</button>
          </div>
        </div>

        <p style={{ fontSize: "13px", color: ikincilYazi, margin: "0 0 20px" }}>
          {kullanici.isim}{kullanici.okul ? ` · ${kullanici.okul}` : ""}
        </p>

        {/* SEKMELER */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
          {SEKMELER.map(s => (
            <button key={s.id} onClick={() => s.aktif && setAktifSekme(s.id)} disabled={!s.aktif}
              style={{ flex: "1 1 30%", padding: "10px", background: aktifSekme === s.id ? "#0891b2" : (karanlikMod ? "#374151" : "#e5e7eb"), color: aktifSekme === s.id ? "white" : (karanlikMod ? "#f3f4f6" : "#374151"), border: "none", borderRadius: "8px", cursor: s.aktif ? "pointer" : "default", fontWeight: "600", fontSize: "12px", position: "relative", opacity: s.aktif ? 1 : 0.55 }}>
              {s.label}
              {!s.aktif && (
                <span style={{ position: "absolute", top: "-6px", right: "-6px", background: "#f59e0b", color: "white", borderRadius: "10px", padding: "2px 6px", fontSize: "9px", fontWeight: "700", letterSpacing: "0.5px" }}>YAKINDA</span>
              )}
            </button>
          ))}
        </div>

        {/* KOD URET SEKMESI */}
        {aktifSekme === "kod" && (
          <div style={{ background: kartBg, padding: "24px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: yaziRenk }}>🔑 Veli Kayıt Kodu Üret</h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: ikincilYazi, lineHeight: 1.6 }}>
              Velinin bilgilerini gir. Çocuk sayısı kadar tek kullanımlık kod üretilir (1 hafta geçerli).
              Veli bu kodla kaydolur, sonra her çocuğu için ayrı kod ister.
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "13px", color: ikincilYazi, display: "block", marginBottom: "6px" }}>Veli Adı Soyadı</label>
              <input type="text" value={veliAdi} onChange={e => setVeliAdi(e.target.value)} placeholder="Örn: Ayşe Yılmaz"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "14px", boxSizing: "border-box", background: inputBg, color: yaziRenk }} />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "13px", color: ikincilYazi, display: "block", marginBottom: "6px" }}>Veli Telefon No</label>
              <input type="tel" value={veliTel} onChange={e => setVeliTel(e.target.value)} placeholder="05XX XXX XX XX"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "14px", boxSizing: "border-box", background: inputBg, color: yaziRenk }} />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "13px", color: ikincilYazi, display: "block", marginBottom: "6px" }}>Okuldaki Çocuk Sayısı</label>
              <input type="number" min="1" max="10" value={cocukSayisi} onChange={e => setCocukSayisi(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${borderRenk}`, fontSize: "14px", boxSizing: "border-box", background: inputBg, color: yaziRenk }} />
            </div>

            {/* Buton - su an PASIF (log sistemi bekleniyor) */}
            <button disabled
              style={{ width: "100%", padding: "14px", background: "#9ca3af", color: "white", border: "none", borderRadius: "8px", cursor: "not-allowed", fontWeight: "600", fontSize: "15px" }}>
              🔒 Kod Üret
            </button>
            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#f59e0b", textAlign: "center", background: karanlikMod ? "#3a2e00" : "#fef3c7", padding: "8px", borderRadius: "8px" }}>
              ⚠️ Kod üretme, güvenlik kayıt (log) sistemi tamamlanınca aktif olacak.
            </p>
          </div>
        )}

        {/* YAKINDA sekmeleri (gorunmez ama yine de) */}
        {aktifSekme !== "kod" && (
          <div style={{ background: kartBg, padding: "40px 20px", borderRadius: "12px", textAlign: "center", color: ikincilYazi }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔜</div>
            <p>Bu bölüm yakında aktif olacak.</p>
          </div>
        )}

      </div>
    </div>
  );
}

export default YoneticiDashboard;