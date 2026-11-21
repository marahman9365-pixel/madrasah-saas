// js/fees.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, addDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentInstituteId = null;
let instituteInfo = null;
let feeStudents = [];
const receiptModal = new bootstrap.Modal(document.getElementById("receiptModal"));

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) return;

  currentInstituteId = userSnap.data().instituteId;
  const instSnap = await getDoc(doc(db, "institutes", currentInstituteId));
  instituteInfo = instSnap.data();

  loadFeesHistory();
});

document.getElementById("feeClass").addEventListener("change", async (e) => {
  const classId = e.target.value;
  const studentSelect = document.getElementById("feeStudentSelect");

  if (!classId) {
    studentSelect.innerHTML = `<option value="">-- প্রথমে শ্রেণি নির্বাচন করুন --</option>`;
    return;
  }

  const stuQuery = query(
    collection(db, "institutes", currentInstituteId, "students"),
    where("classId", "==", classId)
  );
  const snap = await getDocs(stuQuery);
  feeStudents = [];
  snap.forEach(d => feeStudents.push({ id: d.id, ...d.data() }));
  feeStudents.sort((a, b) => a.roll - b.roll);

  studentSelect.innerHTML = `<option value="">-- শিক্ষার্থী বাছুন --</option>` +
    feeStudents.map(s => `<option value="${s.id}">রোল: ${s.roll} - ${s.name}</option>`).join("");
});

document.getElementById("feeCollectionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("saveFeeBtn");
  const msg = document.getElementById("feeMsg");

  const classId = document.getElementById("feeClass").value;
  const studentId = document.getElementById("feeStudentSelect").value;
  const feeType = document.getElementById("feeType").value;
  const feeMonth = document.getElementById("feeMonth").value.trim();
  const amount = parseFloat(document.getElementById("feeAmount").value);

  const student = feeStudents.find(s => s.id === studentId);
  if (!student) return;

  btn.disabled = true;
  btn.innerText = "রসিদ তৈরি হচ্ছে...";

  try {
    const receiptNo = "REC-" + Math.floor(100000 + Math.random() * 900000);
    const today = new Date().toISOString().split("T")[0];

    const feeData = {
      receiptNo,
      date: today,
      classId,
      studentId,
      roll: student.roll,
      studentName: student.name,
      fatherName: student.fatherName,
      feeType,
      feeMonth,
      amount,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "institutes", currentInstituteId, "fees"), feeData);

    e.target.reset();
    msg.innerHTML = `<span class="text-success fw-bold">ফি আদায় সফল হয়েছে!</span>`;
    setTimeout(() => msg.innerText = "", 2500);

    loadFeesHistory();
    openReceipt(feeData);
  } catch (err) {
    msg.innerHTML = `<span class="text-danger">ত্রুটি: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerText = "রসিদ তৈরি ও সংরক্ষণ করুন";
  }
});

async function loadFeesHistory() {
  const q = query(
    collection(db, "institutes", currentInstituteId, "fees"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  const feesList = [];
  let totalAmount = 0;

  snap.forEach(d => {
    const data = d.data();
    feesList.push(data);
    totalAmount += data.amount || 0;
  });

  document.getElementById("totalFeeCollected").innerText = totalAmount.toLocaleString("bn-BD");

  const tbody = document.getElementById("feesTableBody");
  if (feesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">কোনো ফি আদায়ের তথ্য নেই।</td></tr>`;
    return;
  }

  tbody.innerHTML = feesList.map((f, idx) => `
    <tr>
      <td><small class="fw-bold">${f.receiptNo}</small><br><small class="text-muted">${f.date}</small></td>
      <td>${f.studentName}<br><small class="text-muted">রোল: ${f.roll}</small></td>
      <td>${f.feeType}<br><small class="text-muted">${f.feeMonth}</small></td>
      <td class="fw-bold text-success">${f.amount} ৳</td>
      <td><button class="btn btn-sm btn-outline-dark view-rec-btn" data-idx="${idx}">রসিদ</button></td>
    </tr>
  `).join("");

  document.querySelectorAll(".view-rec-btn").forEach(btn => {
    btn.addEventListener("click", () => openReceipt(feesList[btn.dataset.idx]));
  });
}

function openReceipt(fee) {
  const container = document.getElementById("printableReceipt");
  container.innerHTML = `
    <div class="border border-2 border-dark p-3">
      <div class="text-center border-bottom border-dark pb-2 mb-3">
        <h5 class="fw-bold mb-0">${instituteInfo.name}</h5>
        <small class="text-muted">${instituteInfo.address}</small>
        <div class="mt-1"><span class="badge bg-dark">টাকা জমার রসিদ / Money Receipt</span></div>
      </div>

      <div class="d-flex justify-content-between small mb-2">
        <span><strong>রসিদ নং:</strong> ${fee.receiptNo}</span>
        <span><strong>তারিখ:</strong> ${fee.date}</span>
      </div>

      <div class="small mb-3">
        <div><strong>শিক্ষার্থীর নাম:</strong> ${fee.studentName} (রোল: ${fee.roll})</div>
        <div><strong>পিতার নাম:</strong> ${fee.fatherName}</div>
        <div><strong>শ্রেণি:</strong> ${fee.classId}</div>
      </div>

      <table class="table table-bordered border-dark table-sm small mb-3">
        <thead class="table-light">
          <tr>
            <th>বিবরণ</th>
            <th class="text-end">টাকা (৳)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${fee.feeType} (${fee.feeMonth})</td>
            <td class="text-end fw-bold">${fee.amount} /-</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="fw-bold">
            <td class="text-end">সর্বমোট প্রাপ্তি:</td>
            <td class="text-end">${fee.amount} /-</td>
          </tr>
        </tfoot>
      </table>

      <div class="d-flex justify-content-between mt-4 pt-3 small text-center">
        <div class="border-top border-dark px-3 pt-1">অভিভাবকের স্বাক্ষর</div>
        <div class="border-top border-dark px-3 pt-1">আদায়কারীর স্বাক্ষর</div>
      </div>
    </div>
  `;
  receiptModal.show();
}
