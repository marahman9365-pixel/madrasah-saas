// js/students.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentInstituteId = null;
let instituteData = null;
let allStudents = [];

const CLASS_NAMES = {
  ebtedayee_5: "ইবতেদায়ী ৫ম",
  dakhil_9_10: "দাখিল ৯ম/১০ম",
  alim_1_2: "আলিম ১ম/২য় বর্ষ",
  secondary_9_10: "মাধ্যমিক ৯ম/১০ম"
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    window.location.href = "login.html";
    return;
  }

  currentInstituteId = userSnap.data().instituteId;
  const instSnap = await getDoc(doc(db, "institutes", currentInstituteId));
  instituteData = instSnap.data();

  document.getElementById("navInstName").innerText = instituteData.name;
  document.getElementById("navPlanBadge").innerText = `Plan: ${instituteData.subscription.plan.toUpperCase()} (মেয়াদ: ${instituteData.subscription.expiryDate})`;
  document.getElementById("stuMax").innerText = instituteData.subscription.maxStudents;

  checkSubscriptionStatus();
  loadStudents();
});

function checkSubscriptionStatus() {
  const sub = instituteData.subscription;
  const today = new Date().toISOString().split("T")[0];
  const alertBox = document.getElementById("subscriptionAlert");

  if (sub.status !== "active" || sub.expiryDate < today) {
    alertBox.classList.remove("d-none");
    document.getElementById("alertText").innerText = "আপনার সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে! নতুন ডেটা যুক্ত করতে প্যাকেজ আপগ্রেড করুন।";
    document.getElementById("addStuBtn").disabled = true;
  }
}

async function loadStudents() {
  const studentsRef = collection(db, "institutes", currentInstituteId, "students");
  const q = query(studentsRef, orderBy("roll", "asc"));
  const snapshot = await getDocs(q);

  allStudents = [];
  snapshot.forEach((docSnap) => {
    allStudents.push({ id: docSnap.id, ...docSnap.data() });
  });

  document.getElementById("stuCount").innerText = allStudents.length;

  if (allStudents.length >= instituteData.subscription.maxStudents) {
    document.getElementById("subscriptionAlert").classList.remove("d-none");
    document.getElementById("alertText").innerText = `আপনার বর্তমান প্যাকেজের সর্বোচ্চ ${instituteData.subscription.maxStudents} জন শিক্ষার্থীর সীমা পূর্ণ হয়েছে।`;
    document.getElementById("addStuBtn").disabled = true;
  }

  renderStudents(allStudents);
}

function renderStudents(list) {
  const tbody = document.getElementById("studentsTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">কোনো শিক্ষার্থী যুক্ত করা হয়নি।</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(stu => `
    <tr>
      <td class="fw-bold">${stu.roll}</td>
      <td>
        <div>${stu.name}</div>
        <small class="text-muted">পিতা: ${stu.fatherName}</small>
      </td>
      <td><span class="badge bg-secondary">${CLASS_NAMES[stu.classId] || stu.classId}</span></td>
      <td>${stu.phone || "-"}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger del-stu-btn" data-id="${stu.id}">মুছুন</button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".del-stu-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("আপনি কি নিশ্চিতভাবে এই শিক্ষার্থীর তথ্য মুছে ফেলতে চান?")) {
        await deleteDoc(doc(db, "institutes", currentInstituteId, "students", btn.dataset.id));
        loadStudents();
      }
    });
  });
}

document.getElementById("addStudentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("addStuBtn");
  const msg = document.getElementById("stuMsg");

  if (allStudents.length >= instituteData.subscription.maxStudents) {
    alert("শিক্ষার্থী সীমা পূর্ণ হয়েছে! অনুগ্রহ করে প্যাকেজ আপগ্রেড করুন।");
    return;
  }

  btn.disabled = true;
  btn.innerText = "সংরক্ষণ হচ্ছে...";

  try {
    const classId = document.getElementById("stuClass").value;
    const roll = parseInt(document.getElementById("stuRoll").value, 10);
    const name = document.getElementById("stuName").value.trim();
    const fatherName = document.getElementById("stuFather").value.trim();
    const phone = document.getElementById("stuPhone").value.trim();

    await addDoc(collection(db, "institutes", currentInstituteId, "students"), {
      classId,
      roll,
      name,
      fatherName,
      phone,
      createdAt: serverTimestamp()
    });

    e.target.reset();
    msg.innerHTML = `<span class="text-success">শিক্ষার্থী সফলভাবে যুক্ত হয়েছে!</span>`;
    setTimeout(() => msg.innerText = "", 2000);
    loadStudents();
  } catch (err) {
    msg.innerHTML = `<span class="text-danger">ত্রুটি: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerText = "শিক্ষার্থী সংরক্ষণ করুন";
  }
});

document.getElementById("filterClass").addEventListener("change", (e) => {
  const val = e.target.value;
  if (val === "all") {
    renderStudents(allStudents);
  } else {
    renderStudents(allStudents.filter(s => s.classId === val));
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
