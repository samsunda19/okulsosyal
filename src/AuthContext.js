import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dondurulmaMesaj, setDondurulmaMesaj] = useState("");
  const dondurulduRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();

          if (data.dondurulmus) {
            const bitis = data.dondurulmaBitis;

            if (!bitis || new Date(bitis) > new Date()) {
              let mesaj = "Hesabiniz dondurulmustur.";
              if (bitis) {
                mesaj += " Acilma tarihi: " + new Date(bitis).toLocaleString("tr-TR");
              } else {
                mesaj += " Suresiz olarak dondurulmustur.";
              }

              dondurulduRef.current = true;
              setDondurulmaMesaj(mesaj);
              setCurrentUser(null);
              setUserRole(null);
              setLoading(false);
              await signOut(auth);
              return;
            } else {
              const { updateDoc } = await import("firebase/firestore");
              await updateDoc(docRef, { dondurulmus: false, dondurulmaBitis: null });
            }
          }

          setUserRole(data.role);
          setCurrentUser(user);
          dondurulduRef.current = false;
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        if (!dondurulduRef.current) {
          setDondurulmaMesaj("");
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading }}>
      {!loading && children}
      {dondurulmaMesaj && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center",
          alignItems: "center", zIndex: 9999
        }}>
          <div style={{
            background: "white", padding: "30px", borderRadius: "16px",
            width: "320px", textAlign: "center"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "15px" }}>🔒</div>
            <h3 style={{ color: "#ef4444", marginBottom: "10px" }}>Hesap Donduruldu</h3>
            <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "20px" }}>
              {dondurulmaMesaj}
            </p>
            <button
              onClick={() => {
                dondurulduRef.current = false;
                setDondurulmaMesaj("");
              }}
              style={{
                padding: "10px 24px", background: "#4f46e5", color: "white",
                border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600"
              }}>
              Tamam
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}