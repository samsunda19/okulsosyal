import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCIWmeUvIYhgokjJCXo0oEKnp7-0gUFORs",
  authDomain: "zupii-ef469.firebaseapp.com",
  projectId: "zupii-ef469",
  storageBucket: "zupii-ef469.firebasestorage.app",
  messagingSenderId: "613258919461",
  appId: "1:613258919461:web:d001e00c516ad6b662c9cc"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
