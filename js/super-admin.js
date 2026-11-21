// js/super-admin.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allInstitutes = [];
const editModal = new bootstrap.Modal(document.getElementById("editPlanModal"));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists() || userSnap.data().role !== "super_admin") {
    alert("অ্যাক্সেস অনুমোদিত নয়!");
    window.location.href = "login.html";
    return;
  }
  loadInstitutes();
});

async function loadInstitutes() {
  const querySnapshot = await getDocs(collection(db, "institutes"));
  allInstitutes = [];
  let activeCount = 0;
  let paidCount = 0;

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    allInstitutes.push(data);
    if (data.subscription?.status === "active") activeCount++;
    if (data.subscription?.plan !== "free_trial") paidCount++;
  });

  document.getElementById("totalInstitutes").innerText = allInstitutes.length;
  document.getElementById("activeInstitutes").innerText = activeCount;
  document.getElementById("paidInstitutes").innerText = paidCount;

  renderTable(allInstitutes);
}

function renderTable(list) {
  const tbody = document.getElementById("institutesTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">কোনো প্রতিষ্ঠান পাওয়া যায়নি।</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(inst => {
    const sub = inst.subscription || {};
    const badgeClass = sub.status === "active" ? "bg-success" : "bg-danger";
    return `
      <tr>
        <td>
          <div class="fw-bold">${inst.name}</div>
          <small class="text-muted">${inst.address}</small>
        </td>
        <td>
          <span class="badge bg-info text-dark">${inst.type === 'madrasah' ? 'মাদরাসা' : 'স্কুল'}</span><br>
          <small>EIIN: ${inst.eiin}</small>
        </td>
        <td>${inst.phone}</td>
        <td>
          <span class="fw-bold text-uppercase">${sub.plan}</span><br>
          <small class="text-muted">সীমা: ${sub.maxStudents} জন</small>
        </td>
        <td>
          <span class="badge ${badgeClass}">${sub.status}</span><br>
          <small>মেয়াদ: ${sub.expiryDate}</small>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${inst.instituteId}">প্যাকেজ পরিবর্তন</button>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
}

function openEditModal(instId) {
  const inst = allInstitutes.find(i => i.instituteId === instId);
  if (!inst) return;

  document.getElementById("editInstId").value = inst.instituteId;
  document.getElementById("editInstName").innerText = inst.name;
  document.getElementById("editPlan").value = inst.subscription.plan;
  document.getElementById("editMaxStudents").value = inst.subscription.maxStudents;
  document.getElementById("editExpiryDate").value = inst.subscription.expiryDate;
  document.getElementById("editStatus").value = inst.subscription.status;

  editModal.show();
}

document.getElementById("savePlanBtn").addEventListener("click", async () => {
  const instId = document.getElementById("editInstId").value;
  const plan = document.getElementById("editPlan").value;
  const maxStudents = parseInt(document.getElementById("editMaxStudents").value, 10);
  const expiryDate = document.getElementById("editExpiryDate").value;
  const status = document.getElementById("editStatus").value;

  await updateDoc(doc(db, "institutes", instId), {
    "subscription.plan": plan,
    "subscription.maxStudents": maxStudents,
    "subscription.expiryDate": expiryDate,
    "subscription.status": status
  });

  editModal.hide();
  loadInstitutes();
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allInstitutes.filter(i => 
    i.name.toLowerCase().includes(term) || i.eiin.toLowerCase().includes(term)
  );
  renderTable(filtered);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});
