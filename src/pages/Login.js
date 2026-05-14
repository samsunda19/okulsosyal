import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("E-posta veya sifre hatali!");
    }
  };

  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100vh", background:"#f0f4ff" }}>
      <div style={{ background:"white", padding:"40px", borderRadius:"16px", boxShadow:"0 4px 20px rgba(0,0,0,0.1)", width:"320px" }}>
        <h2 style={{ textAlign:"center", color:"#4f46e5", marginBottom:"24px" }}>Zupii Giris</h2>
        {error && <p style={{ color:"red", textAlign:"center" }}>{error}</p>}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"12px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }}
          />
          <input
            type="password"
            placeholder="Sifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width:"100%", padding:"10px", marginBottom:"16px", borderRadius:"8px", border:"1px solid #ddd", boxSizing:"border-box" }}
          />
          <button
            type="submit"
            style={{ width:"100%", padding:"12px", background:"#4f46e5", color:"white", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"16px" }}
          >
            Giris Yap
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;