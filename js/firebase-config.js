// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAbZvZ0R3GFn5kZ2UoHC5V3PQf2mT7_t5I",
  authDomain: "edusaas-bd-1ad72.firebaseapp.com",
  projectId: "edusaas-bd-1ad72",
  storageBucket: "edusaas-bd-1ad72.firebasestorage.app",
  messagingSenderId: "222812728127",
  appId: "1:222812728127:web:ce543c1308a00ddbecc18a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
