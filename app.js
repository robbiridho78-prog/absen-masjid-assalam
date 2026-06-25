/**
 * ABSEN JAMAAH ASSALAM - APP LOGIC
 * State Management, Interactive UI, Charts, and local Data Persistence.
 */

// ==========================================================================
// 1. STATE & CORE CONFIGURATION
// ==========================================================================
let state = {
    mosque: {
        name: "Kelompok Assalam",
        address: "Jl. Assalam No. 45, Jakarta Selatan"
    },
    jamaah: [],
    attendance: [], // Array of { id, date, prayer, memberId, present: true }
    schedules: JSON.parse(localStorage.getItem('assalam_schedules')) || []
};

// Auth variables
let currentUserRole = null;
const PIN_ADMIN = "9999";
const PIN_PENGABSEN = "123";

// Charts references
let trendChart = null;
let isDemoMode = false;


// ==========================================================================
// EXPORT CSV
// ==========================================================================
function exportToCSV() {
    if (state.jamaah.length === 0) {
        showToast("Tidak ada data untuk di-export", "warning");
        return;
    }

    const { streaks, breakdown } = calculateMemberStreak();
    
    // Create CSV header
    let csvContent = "Nama Jamaah,Hadir,Izin,Sakit,Alpa,Hari Istiqamah\n";
    
    // Add rows
    state.jamaah.forEach(m => {
        const bd = breakdown[m.id] || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
        const st = streaks[m.id] || 0;
        csvContent += `"${m.name}",${bd.hadir},${bd.izin},${bd.sakit},${bd.alpa},${st}\n`;
    });

    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_absen_assalam_${getLocalYMD()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Laporan berhasil di-download!", "success");
}

// Helper for getting local YYYY-MM-DD
function getLocalYMD(dateObj = new Date()) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Initialize application on DOM load
document.addEventListener("DOMContentLoaded", async () => {
    checkAuthSession();

    await loadDataFromDatabase();
    initializeUI();
    initializeClock();
    initializeCharts();
    
    // Default: If database is empty, show empty state or alert.
    updateDashboard();
    
    // Refresh icons
    lucide.createIcons();
});

// ==========================================================================
// 1.5 AUTHENTICATION LOGIC
// ==========================================================================
function checkAuthSession() {
    const savedRole = localStorage.getItem("absen_jamaah_role");
    const loginScreen = document.getElementById("login-screen");
    const appContainer = document.getElementById("app-container");

    if (savedRole) {
        currentUserRole = savedRole;
        loginScreen.classList.remove("active");
        appContainer.style.display = "flex";
        applyRolePermissions();
    } else {
        loginScreen.classList.add("active");
        appContainer.style.display = "none";
    }

    // Bind login form
    document.getElementById("form-login").addEventListener("submit", (e) => {
        e.preventDefault();
        const role = document.getElementById("login-role").value;
        const pin = document.getElementById("login-pin").value;

        if (role === "admin" && pin === PIN_ADMIN) {
            loginSuccess("admin");
        } else if (role === "pengabsen" && pin === PIN_PENGABSEN) {
            loginSuccess("pengabsen");
        } else {
            alert("PIN Salah! Silakan coba lagi.");
        }
    });

    // Bind logout button
    const handleLogout = () => {
        if(confirm("Apakah Anda yakin ingin keluar?")) {
            localStorage.removeItem("absen_jamaah_role");
            window.location.reload();
        }
    };
    
    document.getElementById("btn-logout").addEventListener("click", handleLogout);
    
    const btnMobileLogout = document.getElementById("btn-mobile-logout");
    if(btnMobileLogout) {
        btnMobileLogout.addEventListener("click", handleLogout);
    }
}

function loginSuccess(role) {
    localStorage.setItem("absen_jamaah_role", role);
    currentUserRole = role;
    document.getElementById("login-pin").value = "";
    
    const loginScreen = document.getElementById("login-screen");
    const appContainer = document.getElementById("app-container");
    
    loginScreen.classList.remove("active");
    appContainer.style.display = "flex";
    
    applyRolePermissions();
    showToast("Berhasil masuk sebagai " + (role === "admin" ? "Admin" : "Pengabsen"), "success");
}

function applyRolePermissions() {
    // Nav Items
    const navDashboard = document.getElementById("nav-dashboard");
    const navMembers = document.getElementById("nav-members");
    const navSettings = document.getElementById("nav-settings");
    
    // Action Buttons
    const btnAddMember = document.getElementById("btn-add-member");

    if (currentUserRole === "pengabsen") {
        // Hide Admin menus
        if (navDashboard) navDashboard.style.display = "none";
        if (navMembers) navMembers.style.display = "none";
        if (navSettings) navSettings.style.display = "none";
        
        // Hide add/edit/delete buttons
        if (btnAddMember) btnAddMember.style.display = "none";
        
        // Add CSS rule to hide action columns in tables
        let style = document.createElement('style');
        style.innerHTML = '.action-buttons-group { display: none !important; } .admin-only { display: none !important; }';
        document.head.appendChild(style);

        // Force active tab to attendance
        document.querySelector('[data-tab="attendance"]').click();
    } else {
        // Show everything for Admin
        if (navDashboard) navDashboard.style.display = "flex";
        if (navMembers) navMembers.style.display = "flex";
        if (navSettings) navSettings.style.display = "flex";
        if (btnAddMember) btnAddMember.style.display = "flex";
    }
}

// ==========================================================================
// 2. STORAGE MANAGEMENT
// ==========================================================================
function saveToLocalStorage() {
    localStorage.setItem("absen_jamaah_state", JSON.stringify(state));
}

function saveToLocalStorage() {
    localStorage.setItem("absen_jamaah_state", JSON.stringify(state));
}

async function loadDataFromDatabase() {
    if (window.db) {
        try {
            const dbJamaah = await window.db.fetchJamaah();
            const dbAttendance = await window.db.fetchAttendance();
            
            state.jamaah = dbJamaah || [];
            state.attendance = dbAttendance || [];
            
            // Mosque config still from local for now, or default
            const saved = localStorage.getItem("absen_jamaah_state");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.mosque) state.mosque = parsed.mosque;
            }
            if (!state.mosque || !state.mosque.name) {
                state.mosque = { name: "Kelompok Assalam", address: "Jl. Assalam No. 45, Jakarta Selatan" };
            }
        } catch (e) {
            console.error("Gagal memuat dari Supabase. Menggunakan data local jika ada.", e);
            const saved = localStorage.getItem("absen_jamaah_state");
            if (saved) state = JSON.parse(saved);
        }
    } else {
        const saved = localStorage.getItem("absen_jamaah_state");
        if (saved) state = JSON.parse(saved);
    }
}

// ==========================================================================
// 3. CLOCK & TIME DYNAMICS
// ==========================================================================
function initializeClock() {
    const clockEl = document.getElementById("live-clock");
    const dateEl = document.getElementById("live-date");
    
    function tick() {
        const now = new Date();
        
        // Clock format HH:MM:SS
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
        
        // Date format (Indonesian style)
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('id-ID', options);
    }
    
    tick();
    setInterval(tick, 1000);
}

// ==========================================================================
// 4. UI INTERACTIVE LOGIC (TABS & MODALS)
// ==========================================================================
function initializeUI() {
    // Tab Navigation Switcher
    const navItems = document.querySelectorAll(".nav-item");
    const tabPanels = document.querySelectorAll(".tab-panel");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    
    const subtitleMap = {
        dashboard: "Ringkasan aktivitas dan kehadiran jamaah hari ini",
        attendance: "catatan kehadiran jamaah Kelompok Assalam untuk sambung pengajian",
        members: "Daftar jamaah Kelompok Assalam",
        leaderboard: "Daftar jamaah teraktif dan istiqamah",
        settings: "Pengaturan profil masjid dan manajemen database"
    };

    
    // Schedule Listeners
    document.getElementById("btn-add-schedule")?.addEventListener("click", () => {
        document.getElementById("form-schedule").reset();
        document.getElementById("schedule-id").value = "";
        document.getElementById("schedule-modal").classList.add("active");
    });
    document.getElementById("btn-close-schedule-modal")?.addEventListener("click", () => {
        document.getElementById("schedule-modal").classList.remove("active");
    });
    document.getElementById("btn-cancel-schedule")?.addEventListener("click", () => {
        document.getElementById("schedule-modal").classList.remove("active");
    });
    document.getElementById("form-schedule")?.addEventListener("submit", (e) => {
        e.preventDefault();
        saveSchedule();
    });

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTab = item.getAttribute("data-tab");
            
            // Toggle active classes
            navItems.forEach(nav => nav.classList.remove("active"));
            tabPanels.forEach(panel => panel.classList.remove("active"));
            
            item.classList.add("active");
            const target = document.getElementById(`tab-${targetTab}`);
            if (target) target.classList.add("active");
            
            // Set page title
            if (targetTab === 'leaderboard') {
                pageTitle.textContent = "Peringkat Jamaah";
            } else {
                pageTitle.textContent = item.querySelector("span").textContent;
            }
            pageSubtitle.textContent = subtitleMap[targetTab] || "";
            
            // Reload specific tab data
            if (targetTab === "dashboard") {
                updateDashboard();
            } else if (targetTab === "attendance") {
                renderAttendanceTab();
            } else if (targetTab === "members") {
                renderMembersTab();
            } else if (targetTab === "leaderboard") {
                renderLeaderboardTab();
            } else if (targetTab === "settings") {
                loadSettingsTab();
            }
        });
    });

    // Handle view all button on Dashboard click
    document.querySelector(".btn-view-all-absensi").addEventListener("click", () => {
        document.querySelector('[data-tab="attendance"]').click();
    });

    // Date fields in Attendance tab
    const dateInput = document.getElementById("attendance-date");

    // Set default attendance filter to today's date
    const todayStr = getLocalYMD();
    dateInput.max = "2045-12-31"; // Limit to 2045
    dateInput.value = todayStr;
    
    // Event listeners for change filters in attendance
    dateInput.addEventListener("change", renderAttendanceTab);
    document.getElementById("attendance-search").addEventListener("input", function(e) {
        window.filterAttendanceCards(e.target.value);
    });

    // Member tab add member trigger
    document.getElementById("btn-add-member").addEventListener("click", () => {
        openMemberModal();
    });
    
    // Member table filters
    document.getElementById("member-search").addEventListener("input", filterMembersTable);
    document.getElementById("member-filter-gender").addEventListener("change", filterMembersTable);
    document.getElementById("member-filter-category").addEventListener("change", filterMembersTable);
    
    // Modal controls
    document.getElementById("btn-close-modal").addEventListener("click", closeMemberModal);
    document.getElementById("btn-cancel-modal").addEventListener("click", closeMemberModal);
    document.getElementById("form-member").addEventListener("submit", saveMemberSubmit);
    
    // Settings actions
    document.getElementById("form-settings-mosque").addEventListener("submit", saveMosqueSettings);
    document.getElementById("btn-export-json").addEventListener("click", exportDataJSON);
    document.getElementById("btn-export-csv").addEventListener("click", exportDataCSV);
    document.getElementById("import-json-file").addEventListener("change", importDataJSON);
    document.getElementById("btn-generate-mock").addEventListener("click", handleGenerateMock);
    document.getElementById("btn-reset-leaderboard").addEventListener("click", handleResetLeaderboard);
    document.getElementById("btn-clear-db").addEventListener("click", handleClearDatabase);
}

// Toast Notifications
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconName = "check-circle";
    if (type === "info") iconName = "info";
    if (type === "warning") iconName = "alert-triangle";
    if (type === "danger") iconName = "x-circle";
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'toast-icon' } });
    
    // Remove toast after animation completes (3.3s total)
    setTimeout(() => {
        toast.remove();
    }, 3500);
}

// ==========================================================================
// 5. TAB 1: DASHBOARD DYNAMICS & RENDER
// ==========================================================================
function updateDashboard() {
    // 1. Total Registered
    const totalJamaah = state.jamaah.length;
    document.getElementById("stat-total-jamaah").textContent = totalJamaah;
    
    // 2. Today's Stats
    const datePicker = document.getElementById("attendance-date");
    let todayStr;
    if (datePicker && datePicker.value) {
        todayStr = datePicker.value;
    } else {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        todayStr = `${yyyy}-${mm}-${dd}`;
    }
    const todayLogs = state.attendance.filter(log => log.date === todayStr);
    
    const countHadir = todayLogs.filter(log => log.status === "Hadir" || log.present).length;
    const countIzin = todayLogs.filter(log => log.status === "Ijin" || log.status === "Izin").length;
    const countSakit = todayLogs.filter(log => log.status === "Sakit").length;
    let countAlpa = todayLogs.filter(log => log.status === "Alpa").length;
    
    // Hitung Alpa implisit (yang tidak diabsen sama sekali hari ini)
    if (todayLogs.length > 0) {
        const totalDiabsen = countHadir + countIzin + countSakit + countAlpa;
        if (totalDiabsen < totalJamaah) {
            countAlpa += (totalJamaah - totalDiabsen);
        }
    }
    
    const pctHadir = totalJamaah > 0 ? Math.round((countHadir / totalJamaah) * 100) : 0;
    const pctIzin = totalJamaah > 0 ? Math.round((countIzin / totalJamaah) * 100) : 0;
    const pctSakit = totalJamaah > 0 ? Math.round((countSakit / totalJamaah) * 100) : 0;
    const pctAlpa = totalJamaah > 0 ? Math.round((countAlpa / totalJamaah) * 100) : 0;
    
    const elHadirPct = document.getElementById("stat-today-attendance");
    if(elHadirPct) elHadirPct.textContent = `${pctHadir}%`;
    const elHadirCount = document.getElementById("stat-today-count");
    if(elHadirCount) elHadirCount.textContent = `${countHadir} Hadir`;
    
    const elIzinCount = document.getElementById("stat-izin-count");
    if(elIzinCount) elIzinCount.textContent = countIzin;
    const elIzinPct = document.getElementById("stat-izin-pct");
    if(elIzinPct) elIzinPct.textContent = `${pctIzin}% dari total`;
    
    const elSakitCount = document.getElementById("stat-sakit-count");
    if(elSakitCount) elSakitCount.textContent = countSakit;
    const elSakitPct = document.getElementById("stat-sakit-pct");
    if(elSakitPct) elSakitPct.textContent = `${pctSakit}% dari total`;
    
    const elAlpaCount = document.getElementById("stat-alpa-count");
    if(elAlpaCount) elAlpaCount.textContent = countAlpa;
    const elAlpaPct = document.getElementById("stat-alpa-pct");
    if(elAlpaPct) elAlpaPct.textContent = `${pctAlpa}% dari total`;
    
    // 3. Average Attendance Senin & Kamis
    // Filter out only dates that are Monday (1) or Thursday (4)
    const uniqueDates = [...new Set(state.attendance.map(log => log.date))];
    const uniqueSeninKamis = uniqueDates.filter(d => {
        const day = new Date(d).getDay();
        return day === 1 || day === 4;
    });
    
    const last30SeninKamis = uniqueSeninKamis.slice(-30);
    let avgSeninKamisPct = 0;
    
    if (last30SeninKamis.length > 0 && totalJamaah > 0) {
        let sumPct = 0;
        last30SeninKamis.forEach(date => {
            const count = state.attendance.filter(log => log.date === date && (log.status === "Hadir" || log.present)).length;
            sumPct += (count / totalJamaah) * 100;
        });
        avgSeninKamisPct = Math.round(sumPct / last30SeninKamis.length);
    }
    const elAvgSeninKamis = document.getElementById("stat-avg-senin-kamis");
    if(elAvgSeninKamis) elAvgSeninKamis.textContent = `${avgSeninKamisPct}%`;
    
    // Recent logs list rendering
    const recentList = document.getElementById("recent-activities-list");
    recentList.innerHTML = "";
    
    const sortedLogs = [...state.attendance]
        .filter(log => log.status === "Hadir" || log.status === "Sakit" || log.status === "Ijin" || log.status === "Izin" || log.status === "Alpa" || log.present)
        .sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            // If same date, sort by created_at or id (which has timestamp) to put newest clicks on top
            const aTime = a.created_at || a.id;
            const bTime = b.created_at || b.id;
            if (aTime && bTime) return bTime.localeCompare(aTime);
            return 0;
        });
        
    const limitLogs = sortedLogs.slice(0, 5);
    
    if (limitLogs.length === 0) {
        recentList.innerHTML = `
            <div class="empty-state">
                <i data-lucide="info"></i>
                <p>Belum ada data kehadiran terekam.</p>
            </div>
        `;
    } else {
        limitLogs.forEach(log => {
            const memberId = log.member_id || log.memberId;
            const member = state.jamaah.find(m => m.id === memberId);
            if (member) {
                const initials = member.name.substring(0, 2).toUpperCase();
                const status = log.status || "Hadir";
                
                let badgeClass = "emerald";
                if (status === "Sakit") badgeClass = "blue";
                else if (status === "Ijin" || status === "Izin") badgeClass = "gold";
                else if (status === "Alpa") badgeClass = "red";
                
                const item = document.createElement("div");
                item.className = "activity-item";
                item.innerHTML = `
                    <div class="activity-avatar">${initials}</div>
                    <div class="activity-details">
                        <div class="activity-name">${member.name}</div>
                        <div class="activity-meta">Absensi dicatat: <strong>${status}</strong></div>
                    </div>
                    <div class="flex-row items-center gap-2">
                        <span class="activity-badge ${badgeClass}">${status}</span>
                        <span class="activity-time">${formatDateString(log.date)}</span>
                    </div>
                `;
                recentList.appendChild(item);
            }
        });
    }
    
    updateChartsData();
    lucide.createIcons();
}

function formatDateString(dateStr) {
    const d = new Date(dateStr);
    const options = { day: 'numeric', month: 'short' };
    return d.toLocaleDateString('id-ID', options);
}

// ==========================================================================
// 6. TAB 2: ATTENDANCE INTERACTIVE CONTROLS
// ==========================================================================
function renderAttendanceTab() {
    const dateVal = document.getElementById("attendance-date").value;
    const cardsContainer = document.getElementById("jamaah-attendance-cards");
    
    cardsContainer.innerHTML = "";
    
    if (state.jamaah.length === 0) {
        cardsContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i data-lucide="users"></i>
                <h3>Belum Ada Data Jamaah</h3>
                <p>Silakan daftarkan jamaah terlebih dahulu di tab 'Data Jamaah' atau isi mock data di 'Pengaturan'.</p>
            </div>
        `;
        document.getElementById("attendance-summary-text").textContent = "Menampilkan 0 Jamaah | 0 Hadir";
        document.getElementById("attendance-progress").style.width = "0%";
        lucide.createIcons();
        return;
    }
    
    // Extract checked members for this date
    const logs = state.attendance.filter(log => log.date === dateVal);
    const statusMap = {};
    logs.forEach(log => {
        statusMap[log.memberId] = log.status || (log.present ? "Hadir" : "");
    });
    
    // Sort jamaah by name
    const sortedJamaah = [...state.jamaah].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedJamaah.forEach(m => {
        const currentStatus = statusMap[m.id] || "";
        let statusClass = "";
        if (currentStatus === "Hadir") statusClass = "status-hadir";
        else if (currentStatus === "Sakit") statusClass = "status-sakit";
        else if (currentStatus === "Ijin") statusClass = "status-ijin";
        
        const card = document.createElement("div");
        card.className = `attendance-card ${statusClass}`;
        card.setAttribute("data-member-id", m.id);
        card.setAttribute("data-member-name", m.name.toLowerCase());
        
        let ageClass = "dewasa";
        if (m.category === "Anak-anak") ageClass = "anak";
        else if (m.category === "Remaja") ageClass = "remaja";
        else if (m.category === "Lansia") ageClass = "lansia";
        

        let waSakit = '';
        if (currentStatus === 'Sakit') {
            const waText = encodeURIComponent("Assalamualaikum, kami dari pengurus Kelompok Assalam mendoakan semoga lekas sembuh, selalu dalam lindungan Allah.");
            let phoneStr = m.phone ? m.phone.replace(/[^0-9]/g, '') : '';
            if (phoneStr.startsWith('0')) phoneStr = '62' + phoneStr.slice(1);
            const waUrlSakit = phoneStr ? `https://wa.me/${phoneStr}?text=${waText}` : `https://wa.me/?text=${waText}`;
            waSakit = `<a href="${waUrlSakit}" target="_blank" class="btn-status" style="background:#25D366;color:white;min-width:40px;padding:8px" title="Doakan Sakit via WA"><i data-lucide="message-circle"></i></a>`;
        }
        let waIzin = '';
        if (currentStatus === 'Ijin') {
            const waTextIzin = encodeURIComponent("Assalamualaikum, kami dari pengurus Kelompok Assalam sudah mencatat izin Bapak/Ibu untuk pengajian hari ini.");
            let phoneStrIzin = m.phone ? m.phone.replace(/[^0-9]/g, '') : '';
            if (phoneStrIzin.startsWith('0')) phoneStrIzin = '62' + phoneStrIzin.slice(1);
            const waUrlIzin = phoneStrIzin ? `https://wa.me/${phoneStrIzin}?text=${waTextIzin}` : `https://wa.me/?text=${waTextIzin}`;
            waIzin = `<a href="${waUrlIzin}" target="_blank" class="btn-status" style="background:#25D366;color:white;min-width:40px;padding:8px" title="Balas Izin via WA"><i data-lucide="message-circle"></i></a>`;
        }

        const streak = calculateMemberStreak(m.id);
        
        card.innerHTML = `
            <div class="attendance-card-top">
                <div class="attendance-card-info">
                    <span class="attendance-card-name">${m.name}</span>
                    <span class="attendance-card-category ${ageClass}">${m.category}</span>
                </div>
                ${streak > 0 ? `
                <div class="stat-trend purple" title="Streak Kehadiran Harian">
                    <i data-lucide="zap" style="fill: var(--color-purple)"></i> <strong>${streak} Hari</strong>
                </div>` : ''}
            </div>
            <div class="attendance-card-meta mb-4">
                <i data-lucide="map-pin"></i> <span>${m.address || '-'}</span>
            </div>
            <div class="attendance-actions-group">
                ${waSakit}
                ${waIzin}
                <button class="btn-status btn-status-hadir ${currentStatus === 'Hadir' ? 'active' : ''}" onclick="setAttendanceStatus('${m.id}', 'Hadir')" title="Tandai Hadir">
                    <i data-lucide="check-circle-2"></i> Hadir
                </button>
                <button class="btn-status btn-status-sakit ${currentStatus === 'Sakit' ? 'active' : ''}" onclick="setAttendanceStatus('${m.id}', 'Sakit')" title="Tandai Sakit">
                    <i data-lucide="thermometer"></i> Sakit
                </button>
                <button class="btn-status btn-status-ijin ${currentStatus === 'Ijin' ? 'active' : ''}" onclick="setAttendanceStatus('${m.id}', 'Ijin')" title="Tandai Izin">
                    <i data-lucide="info"></i> Izin
                </button>
                <button class="btn-status btn-status-alpa ${currentStatus === 'Alpa' ? 'active' : ''}" onclick="setAttendanceStatus('${m.id}', 'Alpa')" title="Tandai Alpa">
                    <i data-lucide="x-circle"></i> Alpa
                </button>
            </div>
        `;
        cardsContainer.appendChild(card);
    });
    
    const presentCount = logs.filter(log => log.status === "Hadir" || log.present).length;
    // Apply search filter immediately on render
    window.filterAttendanceCards();
    lucide.createIcons();
}

function updateAttendanceStatsBar() {
    const dateVal = document.getElementById("attendance-date").value;
    const totalCount = state.jamaah.length;
    
    let countHadir = 0;
    let countIzin = 0;
    let countSakit = 0;
    let countAlpa = 0;
    
    state.attendance.forEach(log => {
        if (log.date === dateVal) {
            if (log.status === "Hadir" || log.present) countHadir++;
            else if (log.status === "Ijin" || log.status === "Izin") countIzin++;
            else if (log.status === "Sakit") countSakit++;
            else if (log.status === "Alpa") countAlpa++;
        }
    });
    
    document.getElementById("attendance-summary-text").innerHTML = `<b>Total:</b> ${totalCount} | <b>Hadir:</b> ${countHadir} | <b>Izin:</b> ${countIzin} | <b>Sakit:</b> ${countSakit} | <b>Alpa:</b> <span style="color:var(--danger)">${countAlpa}</span>`;
    
    let pct = 0;
    if (totalCount > 0) {
        pct = Math.round((countHadir / totalCount) * 100);
    }
    document.getElementById("attendance-progress").style.width = `${pct}%`;
}

// Attach directly to window to guarantee HTML oninput can find it
window.filterAttendanceCards = function(searchValue) {
    let q = "";
    if (typeof searchValue === 'string') {
        q = searchValue.toLowerCase().trim();
    } else {
        const searchInput = document.getElementById("attendance-search");
        if (searchInput) {
            q = (searchInput.value || "").toLowerCase().trim();
        }
    }
    
    const cards = document.querySelectorAll(".attendance-card");
    if (!cards || cards.length === 0) return;
    
    let matchCount = 0;
    
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        try {
            const name = (card.getAttribute("data-member-name") || "").toLowerCase();
            if (q === "") {
                card.style.setProperty("display", "none", "important");
            } else if (name.indexOf(q) !== -1) {
                card.style.setProperty("display", "flex", "important");
                matchCount++;
            } else {
                card.style.setProperty("display", "none", "important");
            }
        } catch (e) {
            console.error(e);
        }
    }
    

    try {
        updateAttendanceStatsBar();
    } catch (e) {
        console.error("Error updating stats bar:", e);
    }
};

// New status setter (Hadir / Sakit / Ijin)
window.setAttendanceStatus = function(memberId, status) {
    const dateVal = document.getElementById("attendance-date").value;
    
    const logIndex = state.attendance.findIndex(log => log.date === dateVal && log.memberId === memberId);
    const member = state.jamaah.find(m => m.id === memberId);
    const memberName = member ? member.name : "Jamaah";
    
    if (logIndex > -1) {
        const currentStatus = state.attendance[logIndex].status || (state.attendance[logIndex].present ? "Hadir" : "");
        const logId = state.attendance[logIndex].id;
        
        if (currentStatus === status) {
            // Toggle off: remove log
            state.attendance.splice(logIndex, 1);
            if (window.db) window.db.deleteAttendance(logId);
            showToast(`${memberName}: Kehadiran dibatalkan`, "info");
        } else {
            // Update status
            state.attendance[logIndex].status = status;
            state.attendance[logIndex].present = (status === "Hadir"); // backward compatibility
            if (window.db) window.db.updateAttendanceStatus(logId, status, status === "Hadir");
            showToast(`${memberName}: Ditandai ${status}`, status === "Hadir" ? "success" : (status === "Sakit" ? "info" : "warning"));
        }
    } else {
        // Create new log entry
        const newLog = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            date: dateVal,
            memberId: memberId,
            status: status,
            present: (status === "Hadir")
        };
        state.attendance.push(newLog);
        if (window.db) window.db.insertAttendance(newLog);
        showToast(`${memberName}: Ditandai ${status}`, status === "Hadir" ? "success" : (status === "Sakit" ? "info" : "warning"));
    }
    
    saveToLocalStorage();
    renderAttendanceTab();
    filterAttendanceCards(); // Preserve search query!
};

// Calculate active consecutive days of attendance (Streak)
function calculateMemberStreak(memberId) {
    // Fetch unique dates this member was present (Hadir)
    const memberLogs = state.attendance.filter(log => log.memberId === memberId && (log.status === "Hadir" || log.present));
    const uniqueDates = [...new Set(memberLogs.map(log => log.date))].sort((a, b) => b.localeCompare(a));
    
    if (uniqueDates.length === 0) return 0;
    
    // Find yesterday's data based on local time
    const todayStr = getLocalYMD();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalYMD(yesterday);
    
    // If last attendance was not today or yesterday, streak is broken (0)
    const lastDate = uniqueDates[0];
    if (lastDate !== todayStr && lastDate !== yesterdayStr) {
        return 0;
    }
    
    let streak = 1;
    let currentDate = new Date(lastDate);
    
    for (let i = 1; i < uniqueDates.length; i++) {
        const prevDateStr = uniqueDates[i];
        const prevDate = new Date(prevDateStr);
        
        // Check if date difference is exactly 1 day
        const diffTime = Math.abs(currentDate - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            streak++;
            currentDate = prevDate;
        } else {
            break;
        }
    }
    
    return streak;
}

// Count total attendance logs across all time for a member
function countMemberAttendance(memberId) {
    return state.attendance.filter(log => log.memberId === memberId && (log.status === "Hadir" || log.present)).length;
}

// ==========================================================================
// 7. TAB 3: MEMBER DIRECTORY (CRUD)
// ==========================================================================
function renderMembersTab() {
    const tbody = document.getElementById("member-table-body");
    tbody.innerHTML = "";
    
    if (state.jamaah.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8">
                    <div class="empty-state">
                        <i data-lucide="users"></i>
                        <p>Belum ada data jamaah terdaftar.</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    const uniqueDates = [...new Set(state.attendance.map(log => log.date))];
    const totalMeetings = uniqueDates.length;
    
    const sorted = [...state.jamaah].sort((a, b) => a.name.localeCompare(b.name));
    
    sorted.forEach(m => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-member-id", m.id);
        tr.setAttribute("data-searchable", `${m.name.toLowerCase()} ${m.phone || ''}`);
        tr.setAttribute("data-gender", m.gender);
        tr.setAttribute("data-category", m.category);
        
        const initials = m.name.substring(0, 2).toUpperCase();
        
        let hadir = 0, izin = 0, sakit = 0, explicitAlpa = 0;
        state.attendance.forEach(log => {
            if (log.member_id === m.id || log.memberId === m.id) {
                if (log.status === 'Hadir' || log.present) hadir++;
                else if (log.status === 'Ijin' || log.status === 'Izin') izin++;
                else if (log.status === 'Sakit') sakit++;
                else if (log.status === 'Alpa') explicitAlpa++;
            }
        });
        
        // Calculate implicit Alpa (missed meetings)
        const totalAlpa = explicitAlpa + Math.max(0, totalMeetings - (hadir + izin + sakit + explicitAlpa));
        
        const pctHadir = totalMeetings > 0 ? Math.round((hadir / totalMeetings) * 100) : 0;
        const pctIzin = totalMeetings > 0 ? Math.round((izin / totalMeetings) * 100) : 0;
        const pctSakit = totalMeetings > 0 ? Math.round((sakit / totalMeetings) * 100) : 0;
        const pctAlpa = totalMeetings > 0 ? Math.round((totalAlpa / totalMeetings) * 100) : 0;
        
        tr.innerHTML = `
            <td>
                <div class="member-avatar-cell">
                    <div class="member-initials">${initials}</div>
                    <div class="member-name-text">${m.name}</div>
                </div>
            </td>
            <td>${m.gender}</td>
            <td>${m.category}</td>
            <td>${m.phone || '<span class="text-muted">-</span>'}</td>
            <td>${m.address || '<span class="text-muted">-</span>'}</td>
            <td class="text-center"><strong>${hadir}</strong><br><span style="font-size: 0.8em; color: #16a34a;">(${pctHadir}%)</span></td>
            <td class="text-center"><strong>${izin}</strong><br><span style="font-size: 0.8em; color: #ca8a04;">(${pctIzin}%)</span></td>
            <td class="text-center"><strong>${sakit}</strong><br><span style="font-size: 0.8em; color: #2563eb;">(${pctSakit}%)</span></td>
            <td class="text-center"><strong>${totalAlpa}</strong><br><span style="font-size: 0.8em; color: #dc2626;">(${pctAlpa}%)</span></td>
            <td>
                <div class="action-buttons-group">
                    <button class="btn btn-icon edit" onclick="editMember('${m.id}')" title="Edit Data">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn btn-icon delete" onclick="deleteMember('${m.id}')" title="Hapus Jamaah">
                        <i data-lucide="trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    lucide.createIcons();
}

function filterMembersTable() {
    const q = document.getElementById("member-search").value.toLowerCase();
    const gender = document.getElementById("member-filter-gender").value;
    const category = document.getElementById("member-filter-category").value;
    
    const rows = document.querySelectorAll("#member-table-body tr[data-member-id]");
    
    rows.forEach(row => {
        const searchVal = row.getAttribute("data-searchable");
        const gVal = row.getAttribute("data-gender");
        const cVal = row.getAttribute("data-category");
        
        const matchesQuery = searchVal.includes(q);
        const matchesGender = (gender === "all" || gVal === gender);
        const matchesCategory = (category === "all" || cVal === category);
        
        if (matchesQuery && matchesGender && matchesCategory) {
            row.style.display = "table-row";
        } else {
            row.style.display = "none";
        }
    });
}

function openMemberModal(member = null) {
    const modal = document.getElementById("modal-member");
    const modalTitle = document.getElementById("modal-member-title");
    const form = document.getElementById("form-member");
    
    // Reset values
    form.reset();
    document.getElementById("member-id").value = "";
    
    if (member) {
        modalTitle.textContent = "Edit Detail Jamaah";
        document.getElementById("member-id").value = member.id;
        document.getElementById("member-name").value = member.name;
        document.getElementById("member-gender").value = member.gender;
        document.getElementById("member-category").value = member.category;
        document.getElementById("member-phone").value = member.phone || "";
        document.getElementById("member-address").value = member.address || "";
    } else {
        modalTitle.textContent = "Tambah Jamaah Baru";
    }
    
    modal.classList.add("active");
}

function closeMemberModal() {
    document.getElementById("modal-member").classList.remove("active");
}

function saveMemberSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById("member-id").value;
    const name = document.getElementById("member-name").value.trim();
    const gender = document.getElementById("member-gender").value;
    const category = document.getElementById("member-category").value;
    const phone = document.getElementById("member-phone").value.trim();
    const address = document.getElementById("member-address").value.trim();
    
    if (!name || !gender || !category) {
        showToast("Mohon lengkapi formulir wajib (*)", "warning");
        return;
    }
    
    let targetMember = null;
    
    if (id) {
        // Edit Mode
        const index = state.jamaah.findIndex(m => m.id === id);
        if (index > -1) {
            state.jamaah[index] = {
                ...state.jamaah[index],
                name,
                gender,
                category,
                phone,
                address
            };
            targetMember = state.jamaah[index];
            showToast("Data jamaah berhasil diperbarui", "success");
        }
    } else {
        // Create Mode
        const newMember = {
            id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name,
            gender,
            category,
            phone,
            address
        };
        state.jamaah.push(newMember);
        targetMember = newMember;
        showToast("Jamaah baru berhasil didaftarkan", "success");
    }
    
    saveToLocalStorage();
    if (window.db && targetMember) {
        window.db.upsertJamaah(targetMember);
    }
    
    closeMemberModal();
    renderMembersTab();
}

window.editMember = function(id) {
    const member = state.jamaah.find(m => m.id === id);
    if (member) {
        openMemberModal(member);
    }
};

window.deleteMember = function(id) {
    const member = state.jamaah.find(m => m.id === id);
    if (!member) return;
    
    if (confirm(`Apakah Anda yakin ingin menghapus data jamaah "${member.name}"? Semua data riwayat kehadiran bersangkutan juga akan dihapus.`)) {
        // Remove member
        state.jamaah = state.jamaah.filter(m => m.id !== id);
        // Remove attendance logs
        state.attendance = state.attendance.filter(log => log.memberId !== id);
        
        saveToLocalStorage();
        if (window.db) {
            window.db.deleteJamaah(id);
        }
        
        renderMembersTab();
        showToast("Data jamaah berhasil dihapus", "danger");
    }
};

// ==========================================================================
// 8. TAB 4: LEADERBOARD / ISTIQAMAH RANKING
// ==========================================================================
function renderLeaderboardTab() {
    const sortedList = state.jamaah.map(m => {
        const streak = calculateMemberStreak(m.id);
        const total = countMemberAttendance(m.id);
        return {
            ...m,
            streak: streak,
            total: total
        };
    }).sort((a, b) => {
        // Sort by streak first, then total attendance
        if (b.streak !== a.streak) {
            return b.streak - a.streak;
        }
        return b.total - a.total;
    });
    
    // Set up Podiums for Rank 1, 2, 3
    const podiumNames = ["podium-1-name", "podium-2-name", "podium-3-name"];
    const podiumStreaks = ["podium-1-streak", "podium-2-streak", "podium-3-streak"];
    
    // Clear podium
    for (let i = 0; i < 3; i++) {
        document.getElementById(podiumNames[i]).textContent = "-";
        document.getElementById(podiumStreaks[i]).textContent = "0";
    }
    
    // Populate podium if data available and they have actually attended at least once
    if (sortedList.length > 0 && sortedList[0].total > 0) {
        document.getElementById("podium-1-name").textContent = sortedList[0].name;
        document.getElementById("podium-1-streak").textContent = sortedList[0].streak;
    }
    if (sortedList.length > 1 && sortedList[1].total > 0) {
        document.getElementById("podium-2-name").textContent = sortedList[1].name;
        document.getElementById("podium-2-streak").textContent = sortedList[1].streak;
    }
    if (sortedList.length > 2 && sortedList[2].total > 0) {
        document.getElementById("podium-3-name").textContent = sortedList[2].name;
        document.getElementById("podium-3-streak").textContent = sortedList[2].streak;
    }
    
    // Populate Rank Table
    const tbody = document.getElementById("leaderboard-table-body");
    tbody.innerHTML = "";
    
    if (sortedList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8">
                    <div class="empty-state">
                        <i data-lucide="award"></i>
                        <p>Papan peringkat masih kosong.</p>
                    </div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }
    
    sortedList.forEach((m, index) => {
        const tr = document.createElement("tr");
        const rank = index + 1;
        
        let rankClass = "regular";
        if (rank === 1) rankClass = "top1";
        else if (rank === 2) rankClass = "top2";
        else if (rank === 3) rankClass = "top3";
        
        // Determine Keaktifan Badge
        let statusBadge = `<span class="badge">Perlu Ditingkatkan</span>`;
        if (m.streak >= 7 || m.total > 50) {
            statusBadge = `<span class="badge emerald"><i data-lucide="zap"></i> Istiqamah</span>`;
        } else if (m.streak >= 3 || m.total > 20) {
            statusBadge = `<span class="badge gold">Aktif</span>`;
        } else if (m.total > 5) {
            statusBadge = `<span class="badge">Konsisten</span>`;
        }
        
        tr.innerHTML = `
            <td><span class="rank-badge ${rankClass}">${rank}</span></td>
            <td><strong>${m.name}</strong></td>
            <td>${m.gender}</td>
            <td>${m.category}</td>
            <td class="text-center"><strong>${m.total}</strong></td>
            <td class="text-center text-purple"><i data-lucide="zap" style="width:14px; display:inline-block; margin-right:4px;"></i> <strong>${m.streak} Hari</strong></td>
            <td>${statusBadge}</td>
        `;
        
        tbody.appendChild(tr);
    });
    
    lucide.createIcons();
}

// ==========================================================================
// 9. TAB 5: SETTINGS & DATABASE SYSTEM
// ==========================================================================
function loadSettingsTab() {
    document.getElementById("settings-mosque-name").value = state.mosque.name;
    document.getElementById("settings-mosque-address").value = state.mosque.address;
}

function saveMosqueSettings(e) {
    e.preventDefault();
    
    const name = document.getElementById("settings-mosque-name").value.trim();
    const address = document.getElementById("settings-mosque-address").value.trim();
    
    if (!name) {
        showToast("Nama masjid tidak boleh kosong", "warning");
        return;
    }
    
    state.mosque = { name, address };
    saveToLocalStorage();
    
    // Update sidebar brand text
    document.querySelector(".brand-text h1").textContent = name;
    
    showToast("Profil masjid diperbarui", "success");
}

function exportDataJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `database-absen-jamaah-${getLocalYMD()}.json`);
    dlAnchorElem.click();
    showToast("Ekspor database JSON berhasil", "success");
}

function exportDataCSV() {
    if (state.jamaah.length === 0) {
        showToast("Database kosong. Tidak ada data untuk diekspor.", "warning");
        return;
    }
    
    // Use BOM \uFEFF to force UTF-8 in Excel, and semicolon (;) as delimiter which is standard for Indonesian Excel
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Nama;Gender;Kategori Umur;Telepon;Alamat;Total Hadir;Total Izin;Total Sakit;Total Alpa\n";
    
    // Calculate total meetings to determine implicit Alpa
    const uniqueDates = [...new Set(state.attendance.map(log => log.date))];
    const totalMeetings = uniqueDates.length;

    state.jamaah.forEach(m => {
        const name = `"${m.name.replace(/"/g, '""')}"`;
        const addr = `"${(m.address || '').replace(/"/g, '""')}"`;
        const phone = `"${m.phone || ''}"`;
        
        let hadir = 0;
        let izin = 0;
        let sakit = 0;
        let explicitAlpa = 0;
        
        state.attendance.forEach(log => {
            if (log.member_id === m.id || log.memberId === m.id) {
                if (log.status === 'Hadir' || log.present) hadir++;
                else if (log.status === 'Ijin' || log.status === 'Izin') izin++;
                else if (log.status === 'Sakit') sakit++;
                else if (log.status === 'Alpa') explicitAlpa++;
            }
        });
        
        const totalAlpa = explicitAlpa + Math.max(0, totalMeetings - (hadir + izin + sakit + explicitAlpa));
        
        csvContent += `${name};${m.gender};${m.category};${phone};${addr};${hadir};${izin};${sakit};${totalAlpa}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan-jamaah-${getLocalYMD()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Ekspor CSV laporan berhasil", "success");
}

function importDataJSON(e) {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    
    if (!file) return;
    
    fileReader.onload = function(event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (parsed.jamaah && parsed.attendance && parsed.mosque) {
                state = parsed;
                saveToLocalStorage();
                
                // Update brand text immediately
                document.querySelector(".brand-text h1").textContent = state.mosque.name;
                updateDashboard();

                if (window.db) {
                    showToast("Mengunggah data ke Server Pusat... Mohon tunggu.", "warning");
                    Promise.all([
                        ...state.jamaah.map(m => window.db.upsertJamaah(m)),
                        ...state.attendance.map(a => window.db.insertAttendance(a))
                    ]).then(() => {
                        showToast("Data 100% Berhasil Disinkronkan!", "success");
                    }).catch(err => {
                        showToast("Beberapa data mungkin gagal sinkron.", "danger");
                    });
                } else {
                    showToast("Database berhasil diimpor (Lokal)!", "success");
                }
            } else {
                showToast("Format file JSON tidak sesuai database valid.", "danger");
            }
        } catch (error) {
            showToast("Gagal membaca file JSON.", "danger");
        }
    };
    
    fileReader.readAsText(file);
    // Reset file input value
    e.target.value = "";
}

function handleClearDatabase() {
    if (confirm("Apakah Anda yakin ingin menghapus SELURUH database? Tindakan ini akan menghapus semua jamaah, profil masjid, dan riwayat absensi. Tindakan ini tidak dapat dibatalkan.")) {
        state = {
            mosque: {
                name: "Kelompok Assalam",
                address: "Jl. Assalam No. 45, Jakarta Selatan"
            },
            jamaah: [],
            attendance: []
        };
        saveToLocalStorage();
        
        // Reset sidebar UI
        document.querySelector(".brand-text h1").textContent = state.mosque.name;
        
        updateDashboard();
        showToast("Database dibersihkan sepenuhnya", "danger");
    }
}

async function handleResetLeaderboard() {
    if (confirm("Apakah Anda yakin ingin me-reset Papan Peringkat? Ini akan menghapus semua riwayat kehadiran jamaah, tetapi data nama jamaah tetap aman. Gunakan ini untuk memulai musim/bulan baru.")) {
        state.attendance = [];
        saveToLocalStorage();
        updateDashboard();
        renderLeaderboardTab();
        
        if (window.db) {
            showToast("Menghapus riwayat absen di server... Mohon tunggu.", "warning");
            try {
                if (typeof window.db.deleteAllAttendance === 'function') {
                    await window.db.deleteAllAttendance();
                } else {
                    console.warn("Fungsi deleteAllAttendance tidak ditemukan, mungkin supabase-client.js belum diupdate.");
                }
            } catch (err) {
                console.error("Gagal menghapus di server:", err);
            }
            showToast("Papan Peringkat berhasil di-reset!", "success");
        } else {
            showToast("Papan Peringkat berhasil di-reset (Lokal)!", "success");
        }
    }
}

// ==========================================================================
// 10. MOCK DATA GENERATOR (DEMO MODE)
// ==========================================================================
function handleGenerateMock() {
    showToast("Sedang membuat simulasi data...", "info");
    
    const mockNames = [
        { name: "H. Ahmad Fauzi", gender: "Laki-laki", category: "Lansia", addr: "RT 01/RW 03" },
        { name: "Hj. Siti Rahma", gender: "Perempuan", category: "Lansia", addr: "RT 01/RW 03" },
        { name: "Abdurrahman Hakim", gender: "Laki-laki", category: "Dewasa", addr: "RT 02/RW 03" },
        { name: "M. Yusuf Al-Fatih", gender: "Laki-laki", category: "Remaja", addr: "RT 03/RW 03" },
        { name: "Aisyah Azzahra", gender: "Perempuan", category: "Anak-anak", addr: "RT 03/RW 03" },
        { name: "Budi Santoso", gender: "Laki-laki", category: "Dewasa", addr: "RT 01/RW 04" },
        { name: "Eko Prasetyo", gender: "Laki-laki", category: "Dewasa", addr: "RT 02/RW 04" },
        { name: "Farhan Maulana", gender: "Laki-laki", category: "Remaja", addr: "RT 03/RW 04" },
        { name: "Fatimah Zahra", gender: "Perempuan", category: "Dewasa", addr: "RT 02/RW 03" },
        { name: "Khairul Anam", gender: "Laki-laki", category: "Lansia", addr: "RT 04/RW 03" },
        { name: "Luthfi Al-Ghazali", gender: "Laki-laki", category: "Anak-anak", addr: "RT 01/RW 03" },
        { name: "Maryam Jamilah", gender: "Perempuan", category: "Remaja", addr: "RT 04/RW 03" },
        { name: "Rahmat Hidayat", gender: "Laki-laki", category: "Dewasa", addr: "RT 05/RW 03" },
        { name: "Siti Aminah", gender: "Perempuan", category: "Lansia", addr: "RT 05/RW 03" },
        { name: "Zulkifli Lubis", gender: "Laki-laki", category: "Dewasa", addr: "RT 01/RW 04" },
        { name: "Hasan Basri", gender: "Laki-laki", category: "Lansia", addr: "RT 02/RW 04" },
        { name: "Ali Ridho", gender: "Laki-laki", category: "Remaja", addr: "RT 03/RW 03" },
        { name: "Siti Khadijah", gender: "Perempuan", category: "Dewasa", addr: "RT 03/RW 03" },
        { name: "Rizky Ramadhan", gender: "Laki-laki", category: "Anak-anak", addr: "RT 04/RW 04" },
        { name: "Sarah Nabila", gender: "Perempuan", category: "Remaja", addr: "RT 05/RW 04" }
    ];
    
    // Clear current state first
    state.jamaah = [];
    state.attendance = [];
    
    // Create members
    mockNames.forEach((item, index) => {
        state.jamaah.push({
            id: `m_mock_${index + 1}`,
            name: item.name,
            gender: item.gender,
            category: item.category,
            phone: `0812${Math.floor(10000000 + Math.random() * 90000000)}`,
            address: item.addr
        });
    });
    
    // Generate 30 days of future history (demo)
    const today = new Date();
    
    // Member attendance probabilities (to make streaks/leaderboards interesting)
    const memberProfiles = state.jamaah.map(m => {
        let prob = 0.5; // default
        if (m.name.includes("H. ") || m.name.includes("Hj. ")) prob = 0.92; // Haji & Hajah are very active
        else if (m.category === "Lansia") prob = 0.75;
        else if (m.category === "Anak-anak") prob = 0.35;
        else if (m.category === "Remaja") prob = 0.55;
        else prob = 0.65; // dewasa
        
        return { id: m.id, probability: prob };
    });
    
    // Loop through next 30 days (starting from today)
    for (let d = 0; d < 30; d++) {
        const date = new Date();
        date.setDate(today.getDate() + d);
        const dateStr = getLocalYMD(date);
        
        memberProfiles.forEach(prof => {
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const boost = isWeekend ? 0.08 : 0;
            const finalProb = Math.min(0.98, prof.probability + boost);
            
            if (Math.random() < finalProb) {
                const rand = Math.random();
                let status = "Hadir";
                if (rand < 0.04) status = "Sakit";
                else if (rand < 0.09) status = "Ijin";
                
                state.attendance.push({
                    id: `log_mock_${dateStr}_${prof.id}`,
                    date: dateStr,
                    memberId: prof.id,
                    status: status,
                    present: (status === "Hadir")
                });
            }
        });
    }
    
    saveToLocalStorage();
    updateDashboard();
    
    // Switch to dashboard tab to show graphs
    document.querySelector('[data-tab="dashboard"]').click();
    
    showToast("Berhasil memuat 20 jamaah dan rencana kehadiran 30 hari ke depan!", "success");
}

// ==========================================================================
// 11. ANALYTICAL CHARTS INTEGRATION (CHART.JS)
// ==========================================================================
function initializeCharts() {
    // 1. Line Chart: Trend Kehadiran Bulanan
    const ctxTrend = document.getElementById("attendanceTrendChart").getContext("2d");
    
    // Custom gradient for line chart
    const primaryGradient = ctxTrend.createLinearGradient(0, 0, 0, 300);
    primaryGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    primaryGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    
    trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: [], // Populated dynamically
            datasets: [
                {
                    label: 'Hadir',
                    data: [], // Populated dynamically
                    borderColor: '#10b981',
                    borderWidth: 3,
                    backgroundColor: primaryGradient,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff'
                },
                {
                    label: 'Izin',
                    data: [], // Populated dynamically
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.35,
                    pointBackgroundColor: '#3b82f6'
                },
                {
                    label: 'Sakit',
                    data: [], // Populated dynamically
                    borderColor: '#a855f7',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.35,
                    pointBackgroundColor: '#a855f7'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: '#1e293b',
                    titleColor: '#94a3b8',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
                    min: 0
                }
            }
        }
    });
    
}

function updateChartsData() {
    if (!trendChart) return;
    
    // Compute PAST 30 occurrences of Senin (Monday) & Kamis (Thursday)
    const dates = [];
    const totalsHadir = [];
    const totalsIzin = [];
    const totalsSakit = [];
    
    // Find past 30 valid dates
    const today = new Date();
    let currentD = new Date(today);
    const validDates = [];
    
    while(validDates.length < 15) { // Show last 15 meetings
        const day = currentD.getDay();
        if (day === 1 || day === 4) {
            validDates.unshift(new Date(currentD)); // Insert at beginning to reverse order
        }
        currentD.setDate(currentD.getDate() - 1);
    }
    
    validDates.forEach(d => {
        const dStr = getLocalYMD(d);
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        dates.push(label);
        
        const countHadir = state.attendance.filter(log => log.date === dStr && (log.status === "Hadir" || log.present)).length;
        const countIzin = state.attendance.filter(log => log.date === dStr && (log.status === "Ijin" || log.status === "Izin")).length;
        const countSakit = state.attendance.filter(log => log.date === dStr && log.status === "Sakit").length;
        
        totalsHadir.push(countHadir);
        totalsIzin.push(countIzin);
        totalsSakit.push(countSakit);
    });
    
    trendChart.data.labels = dates;
    trendChart.data.datasets[0].data = totalsHadir;
    trendChart.data.datasets[1].data = totalsIzin;
    trendChart.data.datasets[2].data = totalsSakit;
    trendChart.update();
}


// ==========================================================================
// SCHEDULE (JADWAL PENGAJIAN)
// ==========================================================================
function renderScheduleTab() {
    const container = document.getElementById("schedule-list");
    if (!container) return;
    
    container.innerHTML = "<div style='background:yellow;padding:10px;text-align:center;font-weight:bold;margin-bottom:10px;color:black;'>INI VERSI 52 - JADWAL BERHASIL DIMUAT!</div>";
    
    // Sort schedules by date descending
    const sortedSchedules = [...state.schedules].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedSchedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar" class="empty-icon"></i>
                <p>Belum ada jadwal pengajian.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    sortedSchedules.forEach(sch => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.position = "relative";
        
        let materiHtml = '';
        if (sch.materi1) materiHtml += `<li style="margin-bottom:6px;"><strong>${sch.materi1}</strong><br><span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="user" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i>${sch.guru1 || 'Pengurus'}</span></li>`;
        if (sch.materi2) materiHtml += `<li style="margin-bottom:6px;"><strong>${sch.materi2}</strong><br><span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="user" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i>${sch.guru2 || 'Pengurus'}</span></li>`;
        if (sch.materi3) materiHtml += `<li style="margin-bottom:6px;"><strong>${sch.materi3}</strong><br><span style="color:var(--text-muted); font-size:0.8rem;"><i data-lucide="user" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i>${sch.guru3 || 'Pengurus'}</span></li>`;
        
        card.innerHTML = `
            <div class="flex-row justify-between align-center mb-2">
                <h3 style="margin: 0; color: var(--primary-dark);">${formatDateIndo(sch.date)}</h3>
                <span class="badge" style="background: var(--accent-color); color: white;">${sch.time} WIB</span>
            </div>
            
            
            <div style="background: var(--bg-color); padding: 12px; border-radius: 8px;">
                <p style="margin-top: 0; margin-bottom: 8px; font-weight: 500; font-size: 0.9rem;">Agenda Kajian:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 0.9rem;">
                    ${materiHtml}
                </ul>
            </div>
            
            ${currentUserRole === 'admin' ? `
            <div style="position: absolute; bottom: 16px; right: 16px; display: flex; gap: 8px;">
                <button class="btn-icon" onclick="deleteSchedule('${sch.id}')" title="Hapus Jadwal">
                    <i data-lucide="trash-2" style="color: var(--danger-color);"></i>
                </button>
            </div>
            ` : ''}
        `;
        
        container.appendChild(card);
    });
    
    lucide.createIcons();
}

function formatDateIndo(dateStr) {
    const d = new Date(dateStr);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('id-ID', options);
}

function saveSchedule() {
    const id = document.getElementById("schedule-id").value;
    const date = document.getElementById("schedule-date").value;
    const time = document.getElementById("schedule-time").value;
    const materi1 = document.getElementById("schedule-materi-1").value;
    const guru1 = document.getElementById("schedule-guru-1").value;
    const materi2 = document.getElementById("schedule-materi-2").value;
    const guru2 = document.getElementById("schedule-guru-2").value;
    const materi3 = document.getElementById("schedule-materi-3").value;
    const guru3 = document.getElementById("schedule-guru-3").value;
    
    if (id) {
        // Edit
        const index = state.schedules.findIndex(s => s.id === id);
        if (index > -1) {
            state.schedules[index] = { id, date, time, materi1, guru1, materi2, guru2, materi3, guru3 };
        }
    } else {
        // Create
        const newId = 'sch-' + Date.now();
        state.schedules.push({ id: newId, date, time, materi1, guru1, materi2, guru2, materi3, guru3 });
    }
    
    localStorage.setItem('assalam_schedules', JSON.stringify(state.schedules));
    document.getElementById("schedule-modal").classList.remove("active");
    renderScheduleTab();
    showToast("Jadwal berhasil disimpan!", "success");
}

function deleteSchedule(id) {
    if (confirm("Yakin ingin menghapus jadwal ini?")) {
        state.schedules = state.schedules.filter(s => s.id !== id);
        localStorage.setItem('assalam_schedules', JSON.stringify(state.schedules));
        renderScheduleTab();
        showToast("Jadwal dihapus", "warning");
    }
}
