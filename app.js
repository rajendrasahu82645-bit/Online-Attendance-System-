/**
 * AttendX — app.js (ES Module)
 * Technologies:
 *   ✅ Native BarcodeDetector API (Chrome/Edge hardware-accelerated)
 *   ✅ ZXing fallback (Firefox / older browsers)
 *   ✅ Chart.js (donut + weekly bar chart)
 *   ✅ IntersectionObserver (scroll-reveal animations)
 *   ✅ Notifications API (scan alerts)
 *   ✅ Vibration API (haptic feedback on mobile)
 *   ✅ localStorage (persist theme + settings)
 *   ✅ requestAnimationFrame (BarcodeDetector scan loop)
 *   ✅ ES Module (type="module" in HTML)
 */

const BASE = "http://localhost:5000";

/* ════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════ */
let students = [];
let attendance = [];
let scanning = false;
let stream = null;
let animId = null;          // rAF id for BarcodeDetector loop
let zxReader = null;          // ZXing fallback reader
let scannedStudent = null;
let cooldown = false;
let donutChart = null;
let weekChart = null;
let SCAN_MODE = "none";        // "native" | "zxing" | "none"
let fpsLast = 0;
let fpsCount = 0;

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
(async function init() {
    loadTheme();
    initClock();
    initScrollReveal();
    initTabNav();
    initSidebarToggle();
    initThemeToggle();
    initMobileMenu();
    await detectScannerAPI();
    await loadCameras();
    await fetchAll();
    requestNotifPermission();
})();

/* ════════════════════════════════════════════
   THEME (localStorage)
   ════════════════════════════════════════════ */
function loadTheme() {
    const saved = localStorage.getItem("attendx-theme");
    if (saved === "light") {
        document.body.classList.add("light");
        document.querySelector("#themeToggle i").className = "fas fa-sun";
    }
}

function initThemeToggle() {
    document.getElementById("themeToggle").addEventListener("click", () => {
        document.body.classList.toggle("light");
        const isLight = document.body.classList.contains("light");
        document.querySelector("#themeToggle i").className = isLight ? "fas fa-sun" : "fas fa-moon";
        localStorage.setItem("attendx-theme", isLight ? "light" : "dark");
    });
}

/* ════════════════════════════════════════════
   LIVE CLOCK
   ════════════════════════════════════════════ */
function initClock() {
    function tick() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const el = document.getElementById("liveClock");
        if (el) el.textContent = `${dateStr} — ${timeStr}`;
    }
    tick();
    setInterval(tick, 1000);

    // Set today's date in attendance form
    const dateInput = document.getElementById("attendDate");
    if (dateInput) dateInput.value = todayStr();

    // Display date in attendance tab
    const dd = document.getElementById("attendDateDisplay");
    if (dd) {
        const now = new Date();
        dd.innerHTML = `<i class="fas fa-calendar"></i> ${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
    }
}

/* ════════════════════════════════════════════
   IntersectionObserver — scroll reveal
   ════════════════════════════════════════════ */
function initScrollReveal() {
    const obs = new IntersectionObserver((entries) => {
        entries.forEach((e, i) => {
            if (e.isIntersecting) {
                setTimeout(() => e.target.classList.add("visible"), i * 60);
                obs.unobserve(e.target);
            }
        });
    }, { threshold: 0.08 });

    document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
}

/* ════════════════════════════════════════════
   TAB NAVIGATION
   ════════════════════════════════════════════ */
const TAB_TITLES = {
    dashboard: "Dashboard", students: "Students",
    attendance: "Attendance", scanner: "Barcode Scanner", reports: "Reports"
};

function initTabNav() {
    document.querySelectorAll("[data-tab]").forEach(el => {
        el.addEventListener("click", e => {
            e.preventDefault();
            switchTab(el.dataset.tab);
        });
    });
}

function switchTab(name) {
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

    const pane = document.getElementById(`tab-${name}`);
    if (pane) pane.classList.add("active");

    const nav = document.querySelector(`.nav-item[data-tab="${name}"]`);
    if (nav) nav.classList.add("active");

    document.getElementById("pageTitle").textContent = TAB_TITLES[name] || name;
    document.getElementById("breadcrumb").textContent = `Home / ${TAB_TITLES[name] || name}`;

    // Re-trigger reveal animations in new tab
    setTimeout(initScrollReveal, 50);

    // Refresh scanner tab data
    if (name === "scanner") { renderBarcodeCards(); renderHistory(); updateMiniStats(); }

    // Stop scanner when leaving
    if (name !== "scanner" && scanning) stopScanner();
}

/* ════════════════════════════════════════════
   SIDEBAR
   ════════════════════════════════════════════ */
function initSidebarToggle() {
    document.getElementById("sidebarToggle").addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("collapsed");
        document.body.classList.toggle("sidebar-collapsed");
    });
}

function initMobileMenu() {
    const btn = document.getElementById("mobileMenuBtn");
    if (btn) btn.addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });
}

/* ════════════════════════════════════════════
   NOTIFICATIONS
   ════════════════════════════════════════════ */
function requestNotifPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        document.getElementById("notifBtn").addEventListener("click", () => {
            Notification.requestPermission();
        }, { once: true });
    }
}

function sendNotif(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "" });
    }
}

/* ════════════════════════════════════════════
   VIBRATION (haptic on mobile scan)
   ════════════════════════════════════════════ */
function vibrate(pattern = [60]) {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
}

/* ════════════════════════════════════════════
   DETECT SCANNER API
   ════════════════════════════════════════════ */
async function detectScannerAPI() {
    const badge = document.getElementById("techBadge");
    const desc = document.getElementById("techDesc");
    const dot = document.querySelector(".api-dot");
    const label = document.getElementById("apiLabel");

    if ("BarcodeDetector" in window) {
        try {
            const formats = await BarcodeDetector.getSupportedFormats();
            SCAN_MODE = "native";
            if (badge) { badge.className = "tech-badge native"; badge.innerHTML = `<i class="fas fa-microchip"></i> Native BarcodeDetector API`; }
            if (desc) desc.textContent = `Hardware-accelerated scanning (${formats.length} formats). Fastest possible. Requires Chrome 88+ or Edge 88+.`;
            if (dot) dot.className = "api-dot native";
            if (label) label.textContent = "BarcodeDetector (Native)";
        } catch { SCAN_MODE = "none"; }
    } else if (typeof ZXing !== "undefined") {
        SCAN_MODE = "zxing";
        if (badge) { badge.className = "tech-badge zxing"; badge.innerHTML = `<i class="fas fa-qrcode"></i> ZXing Fallback`; }
        if (desc) desc.textContent = "ZXing library is active (BarcodeDetector not supported in this browser). Works in all browsers.";
        if (dot) dot.className = "api-dot zxing";
        if (label) label.textContent = "ZXing (Fallback)";
    } else {
        SCAN_MODE = "none";
        if (badge) { badge.className = "tech-badge none"; badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> No Scanner API`; }
        if (desc) desc.textContent = "No barcode scanning API available. Use manual roll number entry below.";
        if (dot) dot.className = "api-dot error";
        if (label) label.textContent = "No API Available";
    }
}

/* ════════════════════════════════════════════
   CAMERAS
   ════════════════════════════════════════════ */
async function loadCameras() {
    try {
        // Request permission first so labels are populated
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(t => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === "videoinput");
        const sel = document.getElementById("camSelect");
        if (!sel) return;

        sel.innerHTML = `<option value="">📷 Select Camera</option>`;
        cams.forEach(c => {
            const o = document.createElement("option");
            o.value = c.deviceId;
            o.textContent = c.label || `Camera ${sel.options.length}`;
            sel.appendChild(o);
        });

        // Auto-prefer rear camera
        const rear = [...sel.options].findIndex(o => /back|rear|environment/i.test(o.textContent));
        if (rear > 0) sel.selectedIndex = rear;
        else if (sel.options.length > 1) sel.selectedIndex = 1;
    } catch { /* camera not yet permitted — will ask on start */ }
}

/* ════════════════════════════════════════════
   FETCH
   ════════════════════════════════════════════ */
async function fetchAll() {
    await Promise.all([fetchStudents(), fetchAttendance()]);
}

async function fetchStudents() {
    try {
        const r = await fetch(`${BASE}/students`);
        if (!r.ok) throw 0;
        students = await r.json();
        renderStudentsTable();
        renderStudentSelect();
        renderDashStudents();
        renderBarcodeCards();
        updateStats();
        updateMiniStats();
        updateCharts();
    } catch {
        toast("Cannot reach server. Start the backend first.", "err");
    }
}

async function fetchAttendance() {
    try {
        const r = await fetch(`${BASE}/attendance`);
        if (!r.ok) throw 0;
        attendance = await r.json();
        renderRecentLog();
        renderAttendLog();
        renderReport();
        renderHistory();
        updateStats();
        updateMiniStats();
        updateCharts();
    } catch { }
}

/* ════════════════════════════════════════════
   STATS
   ════════════════════════════════════════════ */
function todayStr() { return new Date().toISOString().split("T")[0]; }

function updateStats() {
    const today = todayStr();
    const rec = attendance.filter(r => r.date === today);
    const p = rec.filter(r => r.status === "present").length;
    const a = rec.filter(r => r.status === "absent").length;
    const pct = students.length ? Math.round((p / students.length) * 100) : 0;

    animNum("sTotal", students.length);
    animNum("sPresent", p);
    animNum("sAbsent", a);
    const rEl = document.getElementById("sRate");
    if (rEl) rEl.textContent = pct + "%";

    const dp = document.getElementById("donutPct");
    if (dp) dp.textContent = pct + "%";
}

function updateMiniStats() {
    const today = todayStr();
    const rec = attendance.filter(r => r.date === today);
    const p = rec.filter(r => r.status === "present").length;
    const a = rec.filter(r => r.status === "absent").length;
    setText("msPresent", p);
    setText("msAbsent", a);
    setText("msTotal", students.length);
}

function animNum(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let c = 0;
    const step = Math.max(1, Math.ceil(target / 25));
    const iv = setInterval(() => {
        c = Math.min(c + step, target);
        el.textContent = c;
        if (c >= target) clearInterval(iv);
    }, 35);
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

/* ════════════════════════════════════════════
   CHART.JS
   ════════════════════════════════════════════ */
function updateCharts() {
    if (typeof Chart === "undefined") return;
    buildDonut();
    buildWeekBar();
}

function buildDonut() {
    const ctx = document.getElementById("donutChart");
    if (!ctx) return;

    const today = todayStr();
    const rec = attendance.filter(r => r.date === today);
    const p = rec.filter(r => r.status === "present").length;
    const a = rec.filter(r => r.status === "absent").length;
    const none = Math.max(0, students.length - p - a);

    const data = {
        labels: ["Present", "Absent", "Not Marked"],
        datasets: [{
            data: students.length ? [p, a, none] : [0, 0, 1],
            backgroundColor: ["#10b981", "#f43f5e", "#334155"],
            borderWidth: 0,
            hoverOffset: 6
        }]
    };

    if (donutChart) {
        donutChart.data = data;
        donutChart.update();
        return;
    }

    donutChart = new Chart(ctx, {
        type: "doughnut",
        data,
        options: {
            cutout: "72%",
            plugins: {
                legend: { display: false }, tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.raw}`
                    }
                }
            },
            animation: { animateRotate: true, duration: 800 }
        }
    });
}

function buildWeekBar() {
    const ctx = document.getElementById("weekChart");
    if (!ctx) return;

    // Generate last 7 days
    const days = [], labels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split("T")[0]);
        labels.push(d.toLocaleDateString("en-IN", { weekday: "short" }));
    }

    const presData = days.map(d => attendance.filter(r => r.date === d && r.status === "present").length);
    const absnData = days.map(d => attendance.filter(r => r.date === d && r.status === "absent").length);

    const data = {
        labels,
        datasets: [
            { label: "Present", data: presData, backgroundColor: "rgba(16,185,129,0.7)", borderRadius: 6, borderSkipped: false },
            { label: "Absent", data: absnData, backgroundColor: "rgba(244,63,94,0.6)", borderRadius: 6, borderSkipped: false }
        ]
    };

    const isDark = !document.body.classList.contains("light");
    const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    const tickColor = isDark ? "#64748b" : "#94a3b8";

    if (weekChart) {
        weekChart.data = data;
        weekChart.update();
        return;
    }

    weekChart = new Chart(ctx, {
        type: "bar",
        data,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { labels: { color: tickColor, font: { size: 12, family: "Inter" }, boxWidth: 14 } }
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1, font: { size: 11 } } }
            }
        }
    });
}

/* ════════════════════════════════════════════
   RENDERS
   ════════════════════════════════════════════ */

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function badgeHtml(status) {
    return `<span class="badge ${status}">${status === "present" ? "✓ Present" : "✗ Absent"}</span>`;
}

function renderStudentsTable(filter = "") {
    const tb = document.getElementById("studentsBody");
    if (!tb) return;
    const list = filter
        ? students.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()) || s.roll_number.toLowerCase().includes(filter.toLowerCase()))
        : students;
    if (!list.length) { tb.innerHTML = `<tr><td colspan="5" class="empty">No students found.</td></tr>`; return; }
    tb.innerHTML = list.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.roll_number)}</td>
      <td>${esc(s.department || "General")}</td>
      <td>
        <button class="btn btn-sm btn-ghost" onclick="openBarcodeModal('${esc(s.roll_number)}','${esc(s.name)}')">
          <i class="fas fa-barcode"></i> Card
        </button>
      </td>
    </tr>`).join("");
}

function renderStudentSelect() {
    const sel = document.getElementById("attendStudent");
    if (!sel) return;
    sel.innerHTML = `<option value="">-- Select student --</option>`;
    students.forEach(s => {
        const o = document.createElement("option");
        o.value = s.id;
        o.textContent = `${s.name} (${s.roll_number})`;
        sel.appendChild(o);
    });
}

function renderDashStudents() { /* Students shown in recent log */ }

function renderRecentLog() {
    const tb = document.getElementById("dashRecentBody");
    if (!tb) return;
    const rec = [...attendance].reverse().slice(0, 8);
    if (!rec.length) { tb.innerHTML = `<tr><td colspan="4" class="empty">No records yet.</td></tr>`; return; }
    tb.innerHTML = rec.map(r => `<tr>
    <td>${r.name}</td><td>${r.roll_number}</td>
    <td>${fmtDate(r.date)}</td><td>${badgeHtml(r.status)}</td>
  </tr>`).join("");
}

function renderAttendLog() {
    const tb = document.getElementById("attendLogBody");
    if (!tb) return;
    const rec = attendance.filter(r => r.date === todayStr());
    if (!rec.length) { tb.innerHTML = `<tr><td colspan="4" class="empty">No attendance today.</td></tr>`; return; }
    tb.innerHTML = rec.map(r => `<tr>
    <td>${r.name}</td><td>${r.roll_number}</td>
    <td>${fmtDate(r.date)}</td><td>${badgeHtml(r.status)}</td>
  </tr>`).join("");
}

function renderReport() {
    const tb = document.getElementById("rptBody");
    if (tb) {
        if (!attendance.length) { tb.innerHTML = `<tr><td colspan="4" class="empty">No records.</td></tr>`; }
        else tb.innerHTML = [...attendance].reverse().map(r => `<tr>
      <td>${r.name}</td><td>${r.roll_number}</td>
      <td>${fmtDate(r.date)}</td><td>${badgeHtml(r.status)}</td>
    </tr>`).join("");
    }

    const bars = document.getElementById("rptBars");
    if (!bars) return;
    if (!students.length) { bars.innerHTML = `<p class="empty">Add students first.</p>`; return; }
    bars.innerHTML = students.map(s => {
        const recs = attendance.filter(r => r.roll_number === s.roll_number);
        const tot = recs.length, p = recs.filter(r => r.status === "present").length;
        const pct = tot ? Math.round((p / tot) * 100) : 0;
        const cls = pct >= 75 ? "hi" : pct >= 50 ? "mid" : "lo";
        const col = pct >= 75 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--rose)";
        return `<div class="rpt-row">
      <div class="rpt-hd">
        <span class="rpt-name">${s.name} <small style="color:var(--muted);font-weight:400">(${s.roll_number})</small></span>
        <span style="font-weight:700;color:${col}">${pct}% &nbsp;<span style="font-weight:400;color:var(--muted)">(${p}/${tot})</span></span>
      </div>
      <div class="rpt-track"><div class="rpt-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
    }).join("");
}

function renderHistory() {
    const tb = document.getElementById("histBody");
    if (!tb) return;
    const rec = attendance.filter(r => r.date === todayStr());
    if (!rec.length) { tb.innerHTML = `<tr><td colspan="3" class="empty">No scans today.</td></tr>`; return; }
    tb.innerHTML = rec.map(r => `<tr>
    <td>${r.name}</td><td>${r.roll_number}</td>
    <td>${badgeHtml(r.status)}</td>
  </tr>`).join("");
}

/* ════════════════════════════════════════════
   BARCODE CARDS (JsBarcode)
   ════════════════════════════════════════════ */
function renderBarcodeCards() {
    const container = document.getElementById("bcGrid");
    if (!container) return;
    if (!students.length) { container.innerHTML = `<p class="empty">Add students to generate cards.</p>`; return; }
    container.innerHTML = students.map(s => `
    <div class="bc-card" onclick="openBarcodeModal('${esc(s.roll_number)}','${esc(s.name)}')">
      <div class="bc-name">${s.name}</div>
      <div class="bc-roll">${s.roll_number}</div>
      <svg id="bcsvg-${s.id}"></svg>
    </div>`).join("");

    requestAnimationFrame(() => {
        students.forEach(s => {
            try {
                JsBarcode(`#bcsvg-${s.id}`, s.roll_number, {
                    format: "CODE128", width: 1.8, height: 58,
                    displayValue: false, background: "#fff", lineColor: "#000", margin: 3
                });
            } catch { }
        });
    });
}

window.openBarcodeModal = function (roll, name) {
    document.getElementById("modalName").textContent = name;
    document.getElementById("modalRoll").textContent = roll;
    document.getElementById("bcModal").style.display = "flex";
    requestAnimationFrame(() => {
        try {
            JsBarcode("#modalSvg", roll, {
                format: "CODE128", width: 3, height: 90, displayValue: true,
                background: "#fff", lineColor: "#000"
            });
        } catch { }
    });
};

document.getElementById("bcModalClose").addEventListener("click", () => {
    document.getElementById("bcModal").style.display = "none";
});
document.getElementById("bcModal").addEventListener("click", e => {
    if (e.target === document.getElementById("bcModal"))
        document.getElementById("bcModal").style.display = "none";
});

/* ════════════════════════════════════════════
   BARCODE SCANNER — Native BarcodeDetector API
   ════════════════════════════════════════════ */

async function startScanner() {
    if (scanning) return;
    document.getElementById("btnStart").style.display = "none";
    document.getElementById("btnStop").style.display = "inline-flex";
    setStatus("Starting camera...", "idle");

    const deviceId = document.getElementById("camSelect").value;
    const constraints = {
        video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById("scanVideo");
        video.srcObject = stream;
        await video.play();

        document.getElementById("idleScreen").style.display = "none";
        video.style.display = "block";
        document.getElementById("scanOverlay").style.display = "block";
        document.getElementById("viewport").classList.add("scanning");

        scanning = true;
        setStatus("Scanning — hold barcode in frame", "active");
        toast("📷 Scanner active!", "info");

        if (SCAN_MODE === "native") {
            startNativeScan(video);
        } else if (SCAN_MODE === "zxing") {
            startZxingScan(deviceId);
        } else {
            setStatus("No scanner API available — use manual input", "error");
        }
    } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera access denied", "error");
        toast("Camera not accessible. Allow permission and try again.", "err");
        stopScanner();
    }
}

/* ── Native BarcodeDetector (requestAnimationFrame loop) ── */
function startNativeScan(video) {
    const detector = new BarcodeDetector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "data_matrix", "upc_a"]
    });

    const fpsEl = document.getElementById("fpsBadge");
    if (fpsEl) { fpsEl.style.display = "inline"; fpsLast = performance.now(); fpsCount = 0; }

    async function loop(ts) {
        if (!scanning) return;
        fpsCount++;

        // Update FPS every second
        if (ts - fpsLast >= 1000) {
            if (fpsEl) fpsEl.textContent = `${fpsCount} FPS`;
            fpsCount = 0; fpsLast = ts;
        }

        if (!cooldown && video.readyState === video.HAVE_ENOUGH_DATA) {
            try {
                const results = await detector.detect(video);
                if (results.length > 0) {
                    onBarcodeDetected(results[0].rawValue);
                }
            } catch { }
        }

        animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
}

/* ── ZXing fallback scan ── */
function startZxingScan(deviceId) {
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.QR_CODE,
    ]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    zxReader = new ZXing.BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    zxReader.decodeFromVideoDevice(deviceId || undefined, "scanVideo", (result) => {
        if (result) onBarcodeDetected(result.getText());
    }).catch(err => {
        console.error("ZXing error:", err);
        setStatus("ZXing error — try manual entry", "error");
    });
}

/* ── on barcode decoded ── */
function onBarcodeDetected(raw) {
    if (cooldown) return;

    const roll = raw.trim();
    const student = students.find(s => s.roll_number.trim().toLowerCase() === roll.toLowerCase());

    if (!student) {
        toast(`⚠ Unknown code: "${roll}"`, "err");
        return;
    }

    if (scannedStudent && scannedStudent.id === student.id) return;

    cooldown = true;
    scannedStudent = student;

    // Flash green on viewport
    const flash = document.getElementById("scanFlash");
    if (flash) { flash.classList.remove("go"); void flash.offsetWidth; flash.classList.add("go"); }

    // Vibrate on mobile
    vibrate([30, 50, 30]);

    // Show result card
    setText("rAvatar", student.name[0].toUpperCase());
    setText("rName", student.name);
    setText("rRoll", student.roll_number);
    setText("rDept", student.department || "General");
    const rc = document.getElementById("resultCard");
    if (rc) { rc.style.display = "flex"; rc.scrollIntoView({ behavior: "smooth", block: "nearest" }); }

    setStatus(`✓ Detected: ${student.name}`, "success");
    toast(`📷 Scanned: ${student.name}`, "info");
}

function stopScanner() {
    scanning = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (zxReader) { try { zxReader.reset(); } catch { } zxReader = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }

    const video = document.getElementById("scanVideo");
    if (video) { video.srcObject = null; video.style.display = "none"; }

    const idle = document.getElementById("idleScreen");
    if (idle) idle.style.display = "flex";

    document.getElementById("scanOverlay").style.display = "none";
    document.getElementById("viewport").classList.remove("scanning");
    document.getElementById("btnStart").style.display = "inline-flex";
    document.getElementById("btnStop").style.display = "none";
    document.getElementById("resultCard").style.display = "none";
    document.getElementById("fpsBadge").style.display = "none";

    setStatus("Scanner stopped", "idle");
    scannedStudent = null;
    cooldown = false;
}

/* ── Mark from scan ── */
async function markFromScan(status) {
    if (!scannedStudent) { toast("No student scanned.", "err"); return; }
    const s = scannedStudent;
    try {
        const res = await fetch(`${BASE}/mark_attendance`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: s.id, status, date: todayStr() })
        });
        const r = await res.json();
        if (res.ok) {
            toast(`${status === "present" ? "✓" : "✗"} ${s.name} marked ${status}!`, "ok");
            sendNotif("AttendX", `${s.name} marked ${status}`);
            vibrate(status === "present" ? [60] : [30, 60, 30]);
            fetchAttendance();
            resetScan();
        } else {
            toast(r.error || "Failed.", "err");
        }
    } catch { toast("Server error.", "err"); }
}

function resetScan() {
    scannedStudent = null;
    document.getElementById("resultCard").style.display = "none";
    setTimeout(() => { cooldown = false; }, 1500);
}

/* ── Manual lookup ── */
function manualLookup() {
    const input = document.getElementById("manualInput");
    const roll = input.value.trim();
    if (!roll) { toast("Enter a roll number.", "err"); return; }

    const student = students.find(s => s.roll_number.trim().toLowerCase() === roll.toLowerCase());
    if (!student) { toast(`"${roll}" not found.`, "err"); return; }

    cooldown = false;
    onBarcodeDetected(student.roll_number);
    input.value = "";
}

/* ════════════════════════════════════════════
   ADD STUDENT
   ════════════════════════════════════════════ */
document.getElementById("addStudentBtn").addEventListener("click", async () => {
    const name = document.getElementById("sName").value.trim();
    const roll = document.getElementById("sRoll").value.trim();
    const dept = document.getElementById("sDept").value.trim();
    if (!name || !roll) { toast("Name and Roll Number are required.", "err"); return; }

    const btn = document.getElementById("addStudentBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner" style="animation:spin 1s linear infinite"></i> Adding…`;

    try {
        const res = await fetch(`${BASE}/add_student`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, roll_number: roll, department: dept || "General" })
        });
        const r = await res.json();
        if (res.ok) {
            toast(`✓ "${name}" added successfully!`, "ok");
            document.getElementById("sName").value = "";
            document.getElementById("sRoll").value = "";
            document.getElementById("sDept").value = "";
            await fetchStudents();
        } else { toast(r.error || "Failed.", "err"); }
    } catch { toast("Server error.", "err"); }
    finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-plus"></i> Add Student`;
    }
});

/* ════════════════════════════════════════════
   MANUAL ATTENDANCE
   ════════════════════════════════════════════ */
async function markManual(status) {
    const sid = document.getElementById("attendStudent").value;
    const date = document.getElementById("attendDate").value;
    if (!sid) { toast("Select a student.", "err"); return; }
    if (!date) { toast("Select a date.", "err"); return; }
    try {
        const res = await fetch(`${BASE}/mark_attendance`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: sid, status, date })
        });
        const r = await res.json();
        if (res.ok) {
            const sel = document.getElementById("attendStudent");
            toast(`${status === "present" ? "✓" : "✗"} ${sel.options[sel.selectedIndex].text} marked ${status}!`, "ok");
            fetchAttendance();
        } else { toast(r.error || "Failed.", "err"); }
    } catch { toast("Server error.", "err"); }
}

/* ════════════════════════════════════════════
   EVENT WIRING
   ════════════════════════════════════════════ */
document.getElementById("btnPresent").addEventListener("click", () => markManual("present"));
document.getElementById("btnAbsent").addEventListener("click", () => markManual("absent"));

document.getElementById("btnStart").addEventListener("click", startScanner);
document.getElementById("btnStop").addEventListener("click", stopScanner);

document.getElementById("rPresent").addEventListener("click", () => markFromScan("present"));
document.getElementById("rAbsent").addEventListener("click", () => markFromScan("absent"));
document.getElementById("rSkip").addEventListener("click", resetScan);

document.getElementById("manualLookup").addEventListener("click", manualLookup);
document.getElementById("manualInput").addEventListener("keydown", e => {
    if (e.key === "Enter") manualLookup();
});

document.getElementById("refreshAttend").addEventListener("click", fetchAttendance);
document.getElementById("btnRefreshRpt").addEventListener("click", () => { fetchStudents(); fetchAttendance(); });
document.getElementById("btnRefreshHist").addEventListener("click", fetchAttendance);
document.getElementById("btnPrint").addEventListener("click", () => window.print());
document.getElementById("searchStu").addEventListener("input", e => renderStudentsTable(e.target.value));

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;").replace(/"/g, "&quot;");
}

function setStatus(msg, type = "idle") {
    const led = document.getElementById("statusLed");
    const txt = document.getElementById("statusMsg");
    if (led) led.className = `status-led ${type}`;
    if (txt) txt.textContent = msg;
}

/* ════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════ */
function toast(msg, type = "info") {
    const t = document.getElementById("toast");
    const iconMap = { ok: "fas fa-check-circle", err: "fas fa-times-circle", info: "fas fa-info-circle" };
    const colorMap = { ok: "var(--success)", err: "var(--danger)", info: "var(--primary)" };

    t.innerHTML = `<i class="${iconMap[type] || iconMap.info}" style="color:${colorMap[type] || colorMap.info}"></i> ${msg}`;
    t.className = `toast show ${type}`;
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.className = "toast"; }, 3500);
}