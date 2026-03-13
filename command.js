// --- State ---
let rawResults = [];
let testBank = [];
const SHEET_URL = "https://script.google.com/macros/s/AKfycbztNCzTA-nwomQ6_yga7XdhrkByC21HIITsBOUTxKol4lzJ9PyQouEuTqtTm282ahJ8/exec";


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupAuth();
});

function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const passInput = document.getElementById('command-password');
    const errorMsg = document.getElementById('login-error');

    loginBtn.addEventListener('click', () => {
        if (passInput.value === '123') {
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('main-dashboard').style.display = 'flex';
            setupEventListeners();
            fetchData();
        } else {
            errorMsg.style.display = 'block';
            passInput.style.borderColor = 'var(--wrong-color)';
            setTimeout(() => { passInput.style.borderColor = ''; }, 1000);
        }
    });

    passInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeUI(savedTheme);
}

function updateThemeUI(theme) {
    const themeBtn = document.getElementById('theme-shortcut');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = themeBtn.querySelector('span');

    if (theme === 'light') {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Түнгі режим';
    } else {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Күндізгі режим';
    }
}

function setupEventListeners() {
    // Theme Toggle
    document.getElementById('theme-shortcut').addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
    });

    // Refresh Data
    document.getElementById('refresh-data').addEventListener('click', () => fetchData());

    // Search
    document.getElementById('student-search').addEventListener('input', (e) => filterTable(e.target.value));

    // Export CSV
    document.getElementById('export-csv').addEventListener('click', exportToCSV);

    // Inspector Close
    document.getElementById('close-inspector').addEventListener('click', () => {
        document.getElementById('inspector-modal').style.display = 'none';
    });

    // Close on click outside
    window.onclick = (e) => {
        if (e.target === document.getElementById('inspector-modal')) {
            document.getElementById('inspector-modal').style.display = 'none';
        }
    };
}

// --- Data Fetching (Feature 14) ---
async function fetchData() {
    const syncStatus = document.getElementById('sync-status');
    const tableLoading = document.getElementById('table-loading');

    syncStatus.textContent = "⏳ Жаңаруда...";
    tableLoading.style.display = 'block';

    try {
        const response = await fetch(SHEET_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "get_command_data" }), // We'll need to update script.js to support this or fetch twice
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        // Fallback: If "get_command_data" isn't implemented yet, we might get an error.
        // For now, let's assume we fetch tests and results separately if needed, 
        // but it's more efficient to combine. I'll use the existing save_result/get_tests logic as a base.

        // To keep this compatible without rewriting the backend immediately, 
        // I'll fetch 'get_tests' and we need an action to 'get_results'.

        // Let's implement one more action in Apps Script: get_results

        const resultsResponse = await fetch(SHEET_URL, {
            method: 'POST', body: JSON.stringify({ action: "get_results" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const resultsData = await resultsResponse.json();

        const testsResponse = await fetch(SHEET_URL, {
            method: 'POST', body: JSON.stringify({ action: "get_tests" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const testsData = await testsResponse.json();

        if (resultsData.result === 'success' && testsData.result === 'success') {
            rawResults = resultsData.results;
            testBank = testsData.tests;

            processAndRenderData();

            const now = new Date();
            syncStatus.textContent = `Синхрондалды: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
            showToast("🎁 Деректер сәтті жаңартылды!");
        }
    } catch (e) {
        console.error("Fetch error", e);
        syncStatus.textContent = "❌ Қате";
        showToast("⚠️ Деректерді жүктеу кезінде қате кетті");
    } finally {
        tableLoading.style.display = 'none';
    }
}

// --- Data Processing (Feature 1, 3, 5, 8, 11, 12) ---
function processAndRenderData() {
    // 1. Update Metrics (Feature 1)
    const totalTests = testBank.length;
    const totalAttempts = rawResults.length;

    let avg = 0;
    let totalSecs = 0;
    rawResults.forEach(r => {
        const scoreMatch = r.score.match(/\((\d+)%\)/);
        if (scoreMatch) avg += parseInt(scoreMatch[1]);

        const timeParts = r.time.split(':');
        if (timeParts.length === 2) totalSecs += parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
    });

    document.getElementById('total-tests').textContent = totalTests;
    document.getElementById('total-attempts').textContent = totalAttempts;
    document.getElementById('avg-score').textContent = totalAttempts > 0 ? Math.round(avg / totalAttempts) + '%' : '0%';

    const avgSecsTotal = totalAttempts > 0 ? Math.round(totalSecs / totalAttempts) : 0;
    const amins = Math.floor(avgSecsTotal / 60);
    const asecs = avgSecsTotal % 60;
    document.getElementById('avg-time').textContent = `${amins}:${asecs.toString().padStart(2, '0')}`;

    // 2. Render Table (Feature 2)
    renderResultsTable(rawResults);

    // 3. Render Leaderboard (Feature 12)
    renderLeaderboard();

    // 4. Render Heatmap (Feature 10)
    renderHeatmap();
}

// --- UI Components ---

function renderResultsTable(data) {
    const body = document.getElementById('results-body');
    body.innerHTML = '';

    data.reverse().slice(0, 50).forEach(res => {
        const tr = document.createElement('tr');
        const scorePercent = parseInt(res.score.match(/\((\d+)%\)/)?.[1] || 0);
        const scoreClass = scorePercent >= 80 ? 'correct' : (scorePercent >= 50 ? 'warning' : 'wrong');

        const date = new Date(res.timestamp);
        const dateStr = `${date.getDate()}.${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td style="font-weight:600;">${res.studentName}</td>
            <td>${res.topic}</td>
            <td><span class="badge badge-diff ${res.difficulty}">${res.difficulty}</span></td>
            <td><span class="badge-status" style="background: var(--${scoreClass}-color); color: white;">${res.score}</span></td>
            <td>${res.time}</td>
            <td>
                <button class="icon-btn" onclick="inspectSession('${res.timestamp}')">🔍</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

function filterTable(query) {
    const filtered = rawResults.filter(r =>
        r.studentName.toLowerCase().includes(query.toLowerCase()) ||
        r.topic.toLowerCase().includes(query.toLowerCase())
    );
    renderResultsTable(filtered);
}

function renderLeaderboard() {
    const list = document.getElementById('top-students-list');
    list.innerHTML = '';

    // Calculate top scores per student
    const studentStats = {};
    rawResults.forEach(r => {
        const score = parseInt(r.score.match(/\((\d+)%\)/)?.[1] || 0);
        if (!studentStats[r.studentName] || studentStats[r.studentName] < score) {
            studentStats[r.studentName] = score;
        }
    });

    const sorted = Object.entries(studentStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sorted.forEach(([name, score], i) => {
        const item = document.createElement('div');
        item.style = "display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); padding:0.5rem 1rem; border-radius:10px;";
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.75rem;">
                <span style="font-weight:700; color:var(--primary-color);">#${i + 1}</span>
                <span>${name}</span>
            </div>
            <span style="font-weight:700;">${score}%</span>
        `;
        list.appendChild(item);
    });
}

function renderHeatmap() {
    const hm = document.getElementById('heatmap');
    hm.innerHTML = '';
    // Mock 100 days squares
    for (let i = 0; i < 100; i++) {
        const sq = document.createElement('div');
        sq.style = `width:12px; height:12px; border-radius:2px; background:rgba(16, 185, 129, ${Math.random() * 0.8 + 0.1});`;
        hm.appendChild(sq);
    }
}

// --- Features (Feature 9, 15, 10) ---

function exportToCSV() {
    let csv = "Дата,Имя,Тема,Сложность,Результат,Время\n";
    rawResults.forEach(r => {
        csv += `${r.timestamp},${r.studentName},${r.topic},${r.difficulty},${r.score},${r.time}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "results_export.csv";
    link.click();
}

window.inspectSession = (timestamp) => {
    const entry = rawResults.find(r => r.timestamp === timestamp);
    if (!entry) return;

    const modal = document.getElementById('inspector-modal');
    const content = document.getElementById('inspector-details');
    modal.style.display = 'flex';

    let detailsHtml = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
            <div>
                <p><strong>Оқушы:</strong> ${entry.studentName}</p>
                <p><strong>Тақырып:</strong> ${entry.topic}</p>
                <p><strong>Қиындық:</strong> ${entry.difficulty}</p>
            </div>
            <div>
                <p><strong>Жалпы ұпай:</strong> ${entry.score}</p>
                <p><strong>Жұмсалған уақыт:</strong> ${entry.time}</p>
            </div>
        </div>
        <h3>📝 Сұрақ-жауап логы</h3>
        <div style="margin-top:1rem;">
    `;

    try {
        const logs = JSON.parse(entry.details);
        logs.forEach((log, i) => {
            detailsHtml += `
                <div style="padding: 1rem; border-bottom: 1px solid var(--panel-border); background: ${log.isCorrect ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'}; margin-bottom:0.5rem; border-radius:10px;">
                    <p><strong>${i + 1}. ${log.question}</strong></p>
                    <p style="font-size:0.9rem;">Дұрыс жауап: <span style="color:#10b981;">${log.correctAnswer}</span></p>
                    <p style="font-size:0.9rem;">Оқушы жауабы: <span style="color:${log.isCorrect ? '#10b981' : '#ef4444'};">${log.userAnswer}</span></p>
                </div>
            `;
        });
    } catch (e) {
        detailsHtml += `<p>Логты оқу мүмкін емес.</p>`;
    }

    detailsHtml += `</div>`;
    content.innerHTML = detailsHtml;

    // Set up inspector features (Feature 10: Print)
    document.getElementById('print-result').onclick = () => window.print();
    document.getElementById('export-json').onclick = () => {
        const blob = new Blob([entry.details], { type: 'application/json' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `session_${entry.studentName}.json`;
        link.click();
    };
};

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
