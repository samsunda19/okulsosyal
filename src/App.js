import './App.css';
import { AuthProvider, useAuth } from "./AuthContext";
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import StudentDashboard from "./pages/StudentDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function LoginForm({ tip, onKapat }) {
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");

  const handleGiris = async (e) => {
    e.preventDefault();
    setHata("");
    try {
      await signInWithEmailAndPassword(auth, email, sifre);
    } catch (err) {
      setHata("E-posta veya sifre hatali!");
    }
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>
      <div style={{ background:"white", padding:"40px", borderRadius:"16px", width:"320px" }}>
        <h3 style={{ textAlign:"center", marginBottom:"20px" }}>{tip} Girisi</h3>
        {tip !== "Ogrenci" && (
          <p style={{ textAlign:"center", color:"#f59e0b", background:"#fef3c7", padding:"8px", borderRadius:"8px", fontSize:"13px", marginBottom:"16px" }}>
            ⚠️ Bu giris secenegi su an aktif degil.
          </p>
        )}
        {hata && <p style={{ color:"red", textAlign:"center" }}>{hata}</p>}
        <form onSubmit={handleGiris}>
          <input type="email" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"12px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
          <input type="password" placeholder="Sifre" value={sifre} onChange={e => setSifre(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"16px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
          <button type="submit"
            style={{ width:"100%", padding:"12px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"16px", marginBottom:"10px" }}>
            Giris Yap
          </button>
          <button type="button" onClick={onKapat}
            style={{ width:"100%", padding:"10px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer" }}>
            Iptal
          </button>
        </form>
      </div>
    </div>
  );
}

function KayitForm({ onKapat }) {
  const [isim, setIsim] = useState("");
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const handleKayit = async (e) => {
    e.preventDefault();
    setHata("");
    if (!isim.trim()) { setHata("Isim giriniz!"); return; }
    if (sifre.length < 6) { setHata("Sifre en az 6 karakter olmali!"); return; }
    setYukleniyor(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, sifre);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: email,
        isim: isim,
        role: "student",
        dondurulmus: false,
        dondurulmaBitis: null
      });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setHata("Bu e-posta zaten kayitli!");
      } else {
        setHata("Kayit sirasinda hata olustu!");
      }
      setYukleniyor(false);
    }
  };

  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(0,0,0,0.5)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:999 }}>
      <div style={{ background:"white", padding:"40px", borderRadius:"16px", width:"320px" }}>
        <h3 style={{ textAlign:"center", marginBottom:"20px" }}>Kayit Ol</h3>
        {hata && <p style={{ color:"red", textAlign:"center", marginBottom:"12px" }}>{hata}</p>}
        <form onSubmit={handleKayit}>
          <input type="text" placeholder="Adiniz Soyadiniz" value={isim} onChange={e => setIsim(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"12px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
          <input type="email" placeholder="E-posta" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"12px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
          <input type="password" placeholder="Sifre (en az 6 karakter)" value={sifre} onChange={e => setSifre(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"16px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }} />
          <button type="submit" disabled={yukleniyor}
            style={{ width:"100%", padding:"12px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"16px", marginBottom:"10px" }}>
            {yukleniyor ? "Kaydediliyor..." : "Kayit Ol"}
          </button>
          <button type="button" onClick={onKapat}
            style={{ width:"100%", padding:"10px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer" }}>
            Iptal
          </button>
        </form>
      </div>
    </div>
  );
}

function AppContent() {
  const { currentUser, userRole } = useAuth();
  const [aktifForm, setAktifForm] = useState(null);

  if (currentUser) {
    if (userRole === "admin") return <AdminDashboard />;
    if (userRole === "teacher") return <TeacherDashboard />;
    if (userRole === "parent") return <ParentDashboard />;
    if (userRole === "student") return <StudentDashboard />;
  }

  return (
    <div className="App">
      {aktifForm === "Ogrenci" && <LoginForm tip="Ogrenci" onKapat={() => setAktifForm(null)} />}
      {aktifForm === "Veli" && <LoginForm tip="Veli" onKapat={() => setAktifForm(null)} />}
      {aktifForm === "Ogretmen" && <LoginForm tip="Ogretmen" onKapat={() => setAktifForm(null)} />}
      {aktifForm === "Kayit" && <KayitForm onKapat={() => setAktifForm(null)} />}
      <header className="App-header">
        <div className="zupii-logo">
          <h1>ZUPii</h1>
          <p className="slogan">Zevkli Ucusan Paylasimlı Interaktif Icerikler</p>
        </div>
        <div className="giris-kutusu">
          <h2>Hos Geldin!</h2>
          <div className="giris-secenekleri">
            <button className="btn-eokul" onClick={() => setAktifForm("Ogrenci")}>
              e-Okul ile Giris Yap
            </button>
            <button className="btn-veli" onClick={() => setAktifForm("Veli")}>
              Veli Girisi
            </button>
            <button className="btn-ogretmen" onClick={() => setAktifForm("Ogretmen")}>
              Ogretmen Girisi
            </button>
          </div>
          <button
            onClick={() => setAktifForm("Kayit")}
            style={{ width:"100%", padding:"12px", background:"#10b981", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"15px", fontWeight:"600", marginTop:"12px" }}>
            Kayit Ol
          </button>
          <div className="bilgi-kutusu">
            <p>Tamamen yerli ve guvenli</p>
            <p>Veli onay sistemi</p>
            <p>MEB denetimli icerikler</p>
          </div>
        </div>
      </header>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;