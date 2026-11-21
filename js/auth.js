// js/auth.js
import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { DEFAULT_CURRICULUM } from "./curriculum.js";

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    const msg = document.getElementById("msg");
    btn.disabled = true;
    btn.innerText = "প্রসেসিং হচ্ছে...";

    try {
      const instType = document.getElementById("instType").value;
      const instName = document.getElementById("instName").value.trim();
      const eiin = document.getElementById("eiin").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const address = document.getElementById("address").value.trim();
      const adminName = document.getElementById("adminName").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;
      const instituteId = eiin ? `INST_${eiin}` : `INST_${Date.now()}`;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      await setDoc(doc(db, "institutes", instituteId), {
        instituteId,
        name: instName,
        type: instType,
        eiin: eiin || "N/A",
        phone,
        address,
        ownerUid: uid,
        createdAt: serverTimestamp(),
        subscription: {
          plan: "free_trial",
          status: "active",
          maxStudents: 50,
          expiryDate: expiryDate.toISOString().split("T")[0]
        }
      });

      await setDoc(doc(db, "users", uid), {
        uid,
        name: adminName,
        email,
        phone,
        role: "institute_admin",
        instituteId,
        createdAt: serverTimestamp()
      });

      const curriculumData = DEFAULT_CURRICULUM[instType] || {};
      for (const [classId, subjects] of Object.entries(curriculumData)) {
        await setDoc(doc(db, "institutes", instituteId, "curriculum", classId), {
          classId,
          subjects
        });
      }

      msg.innerHTML = `<span class="text-success fw-bold">নিবন্ধন সফল হয়েছে! ড্যাশবোর্ডে নেওয়া হচ্ছে...</span>`;
      setTimeout(() => window.location.href = "dashboard.html", 1500);

    } catch (error) {
      msg.innerHTML = `<span class="text-danger">ত্রুটি: ${error.message}</span>`;
      btn.disabled = false;
      btn.innerText = "অ্যাকাউন্ট তৈরি করুন";
    }
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("loginBtn");
    const msg = document.getElementById("loginMsg");
    btn.disabled = true;
    btn.innerText = "যাচাই করা হচ্ছে...";

    try {
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCred.user.uid));

      if (!userDoc.exists()) {
        throw new Error("ইউজার প্রোফাইল পাওয়া যায়নি!");
      }

      const userData = userDoc.data();
      if (userData.role === "super_admin") {
        window.location.href = "super-admin.html";
      } else {
        window.location.href = "dashboard.html";
      }
    } catch (error) {
      msg.innerText = "ইমেইল বা পাসওয়ার্ড সঠিক নয়!";
      btn.disabled = false;
      btn.innerText = "প্রবেশ করুন";
    }
  });
}
