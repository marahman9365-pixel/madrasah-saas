// js/results.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let currentInstituteId = null;
let instituteInfo = null;
let currentSubjects = [];
let classStudents = [];
const marksheetModal = new bootstrap.Modal(document.getElementById("marksheetModal"));

const EXAM_NAMES = {
  half_yearly_2026: "অর্ধ-বার্ষিক পরীক্ষা - ২০২৬",
  annual_2026: "বার্ষিক পরীক্ষা - ২০২৬",
  pre_test_2026: "প্রাক-নির্বাচনী পরীক্ষা - ২০২৬",
  test_2026: "নির্বাচনী পরীক্ষা - ২০২৬"
};

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) return;

  currentInstituteId = userSnap.data().instituteId;
  const instSnap = await getDoc(doc(db, "institutes", currentInstituteId));
  instituteInfo = instSnap.data();
});

function calculateGrade(obtained, fullMarks) {
  const percentage = (obtained / fullMarks) * 100;
  if (percentage >= 80) return { letter: "A+", point: 5.0 };
  if (percentage >= 70) return { letter: "A", point: 4.0 };
  if (percentage >= 60) return { letter: "A-", point: 3.5 };
  if (percentage >= 50) return { letter: "B", point: 3.0 };
  if (percentage >= 40) return { letter: "C", point: 2.0 };
  if (percentage >= 33) return { letter: "D", point: 1.0 };
  return { letter: "F", point: 0.0 };
}

document.getElementById("resClass").addEventListener("change", async (e) => {
  const classId = e.target.value;
  const studentSelect = document.getElementById("resStudentSelect");
  const form = document.getElementById("marksEntryForm");

  if (!classId) {
    form.classList.add("d-none");
    return;
  }

  const stuQuery = query(
    collection(db, "institutes", currentInstituteId, "students"),
    where("classId", "==", classId)
  );
  const stuSnap = await getDocs(stuQuery);
  classStudents = [];
  stuSnap.forEach(d => classStudents.push({ id: d.id, ...d.data() }));
  classStudents.sort((a, b) => a.roll - b.roll);

  studentSelect.innerHTML = `<option value="">-- শিক্ষার্থী নির্বাচন করুন (${classStudents.length} জন) --</option>` +
    classStudents.map(s => `<option value="${s.id}">রোল: ${s.roll} - ${s.name}</option>`).join("");

  const currSnap = await getDoc(doc(db, "institutes", currentInstituteId, "curriculum", classId));
  currentSubjects = currSnap.exists() ? currSnap.data().subjects : [];

  const container = document.getElementById("subjectsInputContainer");
  if (currentSubjects.length === 0) {
    container.innerHTML = `<div class="alert alert-warning small">এই শ্রেণির কোনো বিষয় সেট করা নেই।</div>`;
    form.classList.remove("d-none");
    return;
  }

  container.innerHTML = currentSubjects.map(sub => `
    <div class="row g-2 align-items-center mb-2 border-bottom pb-1">
      <div class="col-7">
        <span class="small fw-bold">[${sub.code}] ${sub.name}</span>
        <small class="text-muted d-block">পূর্ণমান: ${sub.fullMarks}</small>
      </div>
      <div class="col-5">
        <input type="number" class="form-control form-control-sm mark-input" 
               data-code="${sub.code}" data-name="${sub.name}" data-full="${sub.fullMarks}"
               min="0" max="${sub.fullMarks}" placeholder="প্রাপ্ত নম্বর" required>
      </div>
    </div>
  `).join("");

  form.classList.remove("d-none");
  loadSavedResults(classId);
});

document.getElementById("marksEntryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentId = document.getElementById("resStudentSelect").value;
  const classId = document.getElementById("resClass").value;
  const examId = document.getElementById("resExamName").value;
  const msg = document.getElementById("resMsg");

  if (!studentId) {
    alert("অনুগ্রহ করে একজন শিক্ষার্থী নির্বাচন করুন!");
    return;
  }

  const student = classStudents.find(s => s.id === studentId);
  const inputs = document.querySelectorAll(".mark-input");

  let subjectResults = [];
  let totalObtained = 0;
  let totalFullMarks = 0;
  let totalPoints = 0;
  let hasFailed = false;

  inputs.forEach(input => {
    const obtained = parseFloat(input.value) || 0;
    const full = parseFloat(input.dataset.full);
    const gradeObj = calculateGrade(obtained, full);

    if (gradeObj.letter === "F") hasFailed = true;
    totalObtained += obtained;
    totalFullMarks += full;
    totalPoints += gradeObj.point;

    subjectResults.push({
      code: input.dataset.code,
      name: input.dataset.name,
      fullMarks: full,
      obtainedMarks: obtained,
      grade: gradeObj.letter,
      point: gradeObj.point
    });
  });

  const gpa = hasFailed ? "0.00" : (totalPoints / subjectResults.length).toFixed(2);
  let finalGrade = "F";
  if (!hasFailed) {
    const numGpa = parseFloat(gpa);
    if (numGpa === 5.0) finalGrade = "A+";
    else if (numGpa >= 4.0) finalGrade = "A";
    else if (numGpa >= 3.5) finalGrade = "A-";
    else if (numGpa >= 3.0) finalGrade = "B";
    else if (numGpa >= 2.0) finalGrade = "C";
    else finalGrade = "D";
  }

  const resultDocId = `${examId}_${studentId}`;
  await setDoc(doc(db, "institutes", currentInstituteId, "results", resultDocId), {
    examId,
    classId,
    studentId,
    roll: student.roll,
    studentName: student.name,
    fatherName: student.fatherName,
    subjects: subjectResults,
    totalObtained,
    totalFullMarks,
    gpa,
    finalGrade,
    updatedAt: serverTimestamp()
  });

  msg.innerHTML = `<span class="text-success fw-bold">ফলাফল সংরক্ষিত হয়েছে! (GPA: ${gpa}, গ্রেড: ${finalGrade})</span>`;
  setTimeout(() => msg.innerText = "", 3000);
  loadSavedResults(classId);
});

async function loadSavedResults(classId) {
  const examId = document.getElementById("resExamName").value;
  const resQuery = query(
    collection(db, "institutes", currentInstituteId, "results"),
    where("classId", "==", classId),
    where("examId", "==", examId)
  );
  const snap = await getDocs(resQuery);
  const results = [];
  snap.forEach(d => results.push(d.data()));
  results.sort((a, b) => a.roll - b.roll);

  const tbody = document.getElementById("resultsTableBody");
  if (results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">এই পরীক্ষার কোনো ফলাফল এখনো এন্ট্রি হয়নি।</td></tr>`;
    return;
  }

  tbody.innerHTML = results.map((r, index) => `
    <tr>
      <td><strong>রোল: ${r.roll}</strong><br><small>${r.studentName}</small></td>
      <td>${r.totalObtained} / ${r.totalFullMarks}</td>
      <td>
        <span class="badge ${r.finalGrade === 'F' ? 'bg-danger' : 'bg-success'}">${r.finalGrade}</span>
        <small class="d-block">GPA: ${r.gpa}</small>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-dark view-ms-btn" data-idx="${index}">মার্কশিট</button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".view-ms-btn").forEach(btn => {
    btn.addEventListener("click", () => openMarksheet(results[btn.dataset.idx]));
  });
}

document.getElementById("refreshResultsBtn").addEventListener("click", () => {
  const classId = document.getElementById("resClass").value;
  if (classId) loadSavedResults(classId);
});

function openMarksheet(res) {
  const container = document.getElementById("printableMarksheet");
  const examTitle = EXAM_NAMES[res.examId] || res.examId;

  const rowsHtml = res.subjects.map(sub => `
    <tr>
      <td class="text-center">${sub.code}</td>
      <td>${sub.name}</td>
      <td class="text-center">${sub.fullMarks}</td>
      <td class="text-center fw-bold">${sub.obtainedMarks}</td>
      <td class="text-center">${sub.grade}</td>
      <td class="text-center">${sub.point.toFixed(2)}</td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="border border-2 border-dark p-4">
      <div class="text-center border-bottom border-dark pb-3 mb-3">
        <h3 class="fw-bold mb-1">${instituteInfo.name}</h3>
        <p class="mb-1 small">${instituteInfo.address} | EIIN: ${instituteInfo.eiin}</p>
        <span class="badge bg-dark px-3 py-2 mt-1 fs-6">একাডেমিক ট্রান্সক্রিপ্ট / নম্বরপত্র</span>
        <div class="fw-bold mt-2">${examTitle}</div>
      </div>

      <div class="row mb-3 small">
        <div class="col-6">
          <p class="mb-1"><strong>শিক্ষার্থীর নাম:</strong> ${res.studentName}</p>
          <p class="mb-1"><strong>পিতার নাম:</strong> ${res.fatherName}</p>
        </div>
        <div class="col-6 text-end">
          <p class="mb-1"><strong>শ্রেণি:</strong> ${res.classId}</p>
          <p class="mb-1"><strong>রোল নম্বর:</strong> ${res.roll}</p>
        </div>
      </div>

      <table class="table table-bordered border-dark table-sm mb-3">
        <thead class="table-light text-center">
          <tr>
            <th>কোড</th>
            <th>বিষয়ের নাম</th>
            <th>পূর্ণমান</th>
            <th>প্রাপ্ত নম্বর</th>
            <th>লেটার গ্রেড</th>
            <th>গ্রেড পয়েন্ট</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot class="fw-bold">
          <tr>
            <td colspan="2" class="text-end">সর্বমোট নম্বর ও ফলাফল:</td>
            <td class="text-center">${res.totalFullMarks}</td>
            <td class="text-center">${res.totalObtained}</td>
            <td class="text-center">${res.finalGrade}</td>
            <td class="text-center">GPA: ${res.gpa}</td>
          </tr>
        </tfoot>
      </table>

      <div class="row mt-5 pt-4 small text-center">
        <div class="col-4"><div class="border-top border-dark pt-1">শ্রেণি শিক্ষকের স্বাক্ষর</div></div>
        <div class="col-4"><div class="border-top border-dark pt-1">পরীক্ষা নিয়ন্ত্রকের স্বাক্ষর</div></div>
        <div class="col-4"><div class="border-top border-dark pt-1">প্রতিষ্ঠান প্রধানের স্বাক্ষর ও সীল</div></div>
      </div>
    </div>
  `;

  marksheetModal.show();
}
