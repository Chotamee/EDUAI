// State
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timerInterval = null;
let secondsElapsed = 0;
let selectedAnswers = [];
let isShowingBackFace = false; // Tracks which face of the card we are on
let currentStudentName = ""; // Store the student's name for the session

// DOM Elements
const createModalBtn = document.getElementById('toggle-creator-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const toggleCreatorBtn = document.getElementById('toggle-creator-btn');
const creatorModal = document.getElementById('creator-modal');
const closeCreatorBtn = document.getElementById('close-creator-btn');

const generateBtn = document.getElementById('generate-btn');
const statusMessage = document.getElementById('generation-status');
const startScreen = document.getElementById('start-screen');
const testScreen = document.getElementById('test-screen');
const resultScreen = document.getElementById('result-screen');
const testBankContainer = document.getElementById('test-bank-container');
const selectedTestArea = document.getElementById('selected-test-area');
const selectedTestTitle = document.getElementById('selected-test-title');
const selectedTestInfo = document.getElementById('selected-test-info');
const startTestBtn = document.getElementById('start-test-btn');
const cancelTestBtn = document.getElementById('cancel-test-btn');

const cardContainer = document.getElementById('card-container');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');

const progressBar = document.getElementById('progress-fill');
const questionCounter = document.getElementById('question-counter');
const timerDisplay = document.getElementById('timer');

// --- Initialization & Theme ---
document.addEventListener('DOMContentLoaded', () => {
    // Check saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Load tests from Google Sheets
    loadTestBank();
});

// Helper to render math across the page
let mathQueue = [];
window.renderMath = function(element = document.body) {
    if (window.MathJax && window.MathJax.typesetPromise && window.mathJaxReady) {
        window.MathJax.typesetPromise([element]).catch((err) => console.warn('MathJax error', err));
    } else {
        mathQueue.push(element);
    }
};

window.onMathJaxReady = function() {
    while(mathQueue.length > 0) {
        window.renderMath(mathQueue.shift());
    }
};

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function updateThemeIcon(theme) {
    themeToggleBtn.textContent = theme === 'light' ? '🌙' : '☀️';
}

// --- Creator Mode ---
toggleCreatorBtn.addEventListener('click', () => {
    creatorModal.classList.remove('hidden');
});

closeCreatorBtn.addEventListener('click', () => {
    creatorModal.classList.add('hidden');
    // Reset to auth section when closed
    document.getElementById('creator-auth-section').classList.remove('hidden');
    document.getElementById('creator-form-section').classList.add('hidden');
    document.getElementById('teacher-password').value = '';
    document.getElementById('auth-error-message').style.display = 'none';
});

// --- Teacher Authentication ---
const loginTeacherBtn = document.getElementById('login-teacher-btn');
const authSection = document.getElementById('creator-auth-section');
const formSection = document.getElementById('creator-form-section');
const passwordInput = document.getElementById('teacher-password');
const authError = document.getElementById('auth-error-message');

loginTeacherBtn.addEventListener('click', verifyTeacherPassword);
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyTeacherPassword();
});

function verifyTeacherPassword() {
    if (passwordInput.value === '123') {
        authSection.classList.add('hidden');
        formSection.classList.remove('hidden');
        authError.style.display = 'none';
    } else {
        authError.style.display = 'block';
        passwordInput.style.borderColor = 'var(--wrong-color)';
        setTimeout(() => {
            passwordInput.style.borderColor = '';
        }, 1000);
    }
}

// --- Difficulty Selector ---
const diffChips = document.querySelectorAll('.diff-chip');
const diffInput = document.getElementById('difficulty');

diffChips.forEach(chip => {
    chip.addEventListener('click', () => {
        diffChips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        diffInput.value = chip.getAttribute('data-diff');
    });
});

// --- Config and API Keys ---
// Now using Cloudflare Worker Proxy to keep keys secure!
const WORKER_URL = window.CONFIG ? window.CONFIG.WORKER_URL : "";

if (!WORKER_URL) {
    console.error("CRITICAL: WORKER_URL is missing! Please create config.js with your worker URL.");
    alert("Қате: Cloudflare Worker URL табылмады. config.js файлын тексеріңіз.");
}

// --- Auto Model Selection ---
async function getBestAvailableModel() {
    try {
        const response = await fetch(`${WORKER_URL}/models`);
        if (!response.ok) return "gemini-2.5-flash"; // Fallback if list fails

        const data = await response.json();
        const validModels = data.models
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
            .map(m => m.name.replace('models/', ''));

        // Preference order
        if (validModels.includes('gemini-1.5-pro-latest')) return 'gemini-1.5-pro-latest';
        if (validModels.includes('gemini-1.5-pro')) return 'gemini-1.5-pro';
        if (validModels.includes('gemini-1.5-flash-latest')) return 'gemini-1.5-flash-latest';
        if (validModels.includes('gemini-1.5-flash')) return 'gemini-1.5-flash';
        if (validModels.includes('gemini-pro')) return 'gemini-pro';

        // Ultimate fallback to whatever is first available
        return validModels.length > 0 ? validModels[0] : "gemini-1.5-flash";
    } catch (e) {
        console.warn("Could not fetch models automatically, defaulting.", e);
        return "gemini-1.5-flash-latest";
    }
}

// --- AI Generation ---
generateBtn.addEventListener('click', async () => {
    const topic = document.getElementById('test-topic').value.trim();
    const count = parseInt(document.getElementById('question-count').value);
    const difficulty = document.getElementById('difficulty').value;

    if (!topic || count < 1) {
        statusMessage.textContent = '❌ Тест тақырыбын толтырыңыз.';
        statusMessage.style.color = 'var(--wrong-color)';
        return;
    }

    statusMessage.textContent = '⏳ Сұрақтар генерациялануда...';
    statusMessage.style.color = 'var(--text-color)';
    generateBtn.disabled = true;

    try {
        const modelName = await getBestAvailableModel();
        console.log(`Using model: ${modelName}`);

        const generatedQuestions = await generateQuestionsWithGemini(modelName, topic, count, difficulty);
        if (generatedQuestions && generatedQuestions.length > 0) {
            statusMessage.textContent = '✅ Сұрақтар дайын! Базаға сақталуда...';

            // Send new test to Google Sheets Database
            await saveTestToBank(topic, difficulty, count, generatedQuestions);

            statusMessage.textContent = '✅ Тест сәтті жасалып, базаға қосылды!';
            statusMessage.style.color = 'var(--correct-color)';

            // Reload the Test Bank UI so the new test appears!
            loadTestBank();

            setTimeout(() => {
                creatorModal.classList.add('hidden');
                statusMessage.textContent = '';
            }, 2000);
        } else {
            throw new Error("Жауап форматы қате");
        }
    } catch (error) {
        console.error("Ошибка:", error);
        statusMessage.textContent = '❌ Сұрақтарды жасау кезінде қате кетті. Қайтадан көріңіз.';
        statusMessage.style.color = 'var(--wrong-color)';
    } finally {
        generateBtn.disabled = false;
    }
});

async function generateQuestionsWithGemini(modelName, topic, count, difficulty) {
    const endpoint = `${WORKER_URL}/ai`;
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    // We explicitly ask for a JSON array with 4 options and the correct index.
    // Also ask AI to use LaTeX formatting (with double dollar $$ for block, single $ for inline).
    const prompt = `Сіз қазақ тіліндегі тест генераторысыз. Пайдаланушының "${topic}" тақырыбы бойынша, "${difficulty}" қиындық деңгейінде ${count} сұрақтан тұратын тест жасаңыз.
    
    Қиындық деңгейлерінің мағынасы:
    - Жеңіл: Негізгі ұғымдар, қарапайым сұрақтар.
    - Орташа: Оқулық деңгейі, орташа қиындық.
    - Қиын: Тереңдетілген талдау, күрделі есептер.
    - Олимпиадалық: Өте күрделі, логикалық және шығармашылық есептер.

    Нұсқаулық:
    1. Барлық сұрақтар мен жауаптар ТОЛЫҒЫМЕН ҚАЗАҚ ТІЛІНДЕ болуы керек.
    2. Егер математикалық формулалар болса, оларды міндетті түрде MathJax форматында жазыңыз: \\\\( формула \\\\).
    3. Әр сұрақта 4 жауап нұсқасы болуы керек (A, B, C, D).
    4. Жауапты ТЕК КЕЛЕСІ JSON форматында қайтарыңыз:
    [
      {
        "question": "Сұрақ мәтіні",
        "options": ["A нұсқасы", "B нұсқасы", "C нұсқасы", "D нұсқасы"],
        "correctIndex": 0
      }
    ]
    (correctIndex - дұрыс жауаптың индексі, 0-ден 3-ке дейін).`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Target-URL': targetUrl // Worker uses this to know where to proxy
        },
        body: JSON.stringify({
            // Added explicit system instruction for JSON and escaping
            systemInstruction: {
                parts: [{ text: "You are a helpful education assistant. Always return valid JSON. When writing LaTeX, strictly escape all backslashes by using two backslashes (e.g., \\\\( and \\\\), \\\\frac)." }]
            },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1, // Even lower temp
                responseMimeType: "application/json" // Force JSON output so we don't get markdown back
            }
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "API-де белгісіз қате");
    }

    const data = await response.json();
    let textObj = data.candidates[0].content.parts[0].text;
    console.log("RAW AI RESPONSE:", textObj); // Logging for debugging

    try {
        // First try to parse it raw just in case it's perfect
        return JSON.parse(textObj);
    } catch (e) {
        console.log("Raw parse failed, applying sanitization...");
        // 1. Remove markdown blocks if they slipped through
        textObj = textObj.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 2. Fix unescaped backslashes and carriage returns that break JSON
        // Find every backslash that is NOT already escaping a valid JSON character
        // and double it.
        textObj = textObj.replace(/\\([^"\\/bfnrtu])/g, "\\\\$1");

        // 3. Convert actual newlines to escaped \n so they are legal in JSON strings
        textObj = textObj.replace(/\n/g, '\\n').replace(/\r/g, '');

        // 4. Remove trailing commas
        textObj = textObj.replace(/,\s*([\]}])/g, "$1");

        console.log("SANITIZED AI RESPONSE:", textObj);
        return JSON.parse(textObj);
    }
}

// --- Test Bank API Functions ---
async function loadTestBank() {
    try {
        const response = await fetch(`${WORKER_URL}/sheets`, {
            method: 'POST',
            body: JSON.stringify({ action: "get_tests" }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' } // Text plain prevents CORS preflight
        });
        const data = await response.json();

        if (data.result === 'success') {
            renderTestBank(data.tests);
        } else {
            throw new Error(data.error || "Белгісіз қате");
        }
    } catch (e) {
        console.error("Ошибка загрузки базы:", e);
        testBankContainer.innerHTML = `<div class="status-message" style="color: var(--wrong-color);">❌ Тесттерді жүктеу кезінде қате кетті. Web App URL мекенжайын тексеріңіз.</div>`;
    }
}

async function saveTestToBank(topic, difficulty, count, questionsArray) {
    try {
        const response = await fetch(`${WORKER_URL}/sheets`, {
            method: 'POST',
            body: JSON.stringify({
                action: "save_test",
                topic: topic,
                difficulty: difficulty,
                count: count,
                questions: JSON.stringify(questionsArray)
            }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const data = await response.json();
        if (data.result !== 'success') {
            console.error("Save test DB error:", data.error);
        }
    } catch (e) {
        console.error("Save test network error:", e);
    }
}

function renderTestBank(testsArray) {
    testBankContainer.innerHTML = '';

    if (!testsArray || testsArray.length === 0) {
        testBankContainer.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">База бос. Мұғалімнен бірінші тестті жасауды сұраңыз!</p>';
        return;
    }

    // Sort tests by latest first
    let accentIndex = 0;
    testsArray.reverse().forEach(test => {
        const card = document.createElement('div');
        // Add a cyclic accent class (1 to 5) for color variety
        accentIndex = (accentIndex % 5) + 1;
        card.className = `test-card-item accent-${accentIndex}`;

        // Format date if possible, else just use topic
        let subtitle = '📝 ' + test.topic;
        card.innerHTML = `
            <h3>${subtitle}</h3>
            <div class="test-badge-row">
                <span class="badge badge-diff ${test.difficulty}">⚡ ${test.difficulty}</span>
                <span class="badge badge-count">📌 ${test.count} сұрақ</span>
            </div>
            <div style="margin-top:0.5rem; display:flex; justify-content:flex-end;">
               <span style="font-size: 0.8rem; font-weight:600;" class="start-text">Бастау →</span>
            </div>
        `;

        card.addEventListener('click', () => {
            selectTestFromBank(test);
            // Visual selection highlight
            document.querySelectorAll('.test-card-item').forEach(c => c.style.borderColor = 'transparent');
            card.style.borderColor = 'var(--primary-color)';
        });

        testBankContainer.appendChild(card);
    });
}

function selectTestFromBank(test) {
    try {
        // Parse the JSON string from sheets back into a JS objects array
        questions = JSON.parse(test.questions);

        // Show the panel to start
        selectedTestTitle.textContent = test.topic;
        selectedTestInfo.textContent = `Қиындығы: ${test.difficulty} • Сұрақтар саны: ${test.count}`;
        selectedTestArea.classList.remove('hidden');

        // Prepare global variables for `saveResultsToSheets` to use later
        document.getElementById('test-topic').value = test.topic;
        document.getElementById('difficulty').value = test.difficulty;

        // Scroll down to the start button smoothly
        selectedTestArea.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
        alert("Тест деректерін оқу қатесі. Файл бүлінген.");
        console.error(e);
    }
}

cancelTestBtn.addEventListener('click', () => {
    selectedTestArea.classList.add('hidden');
    document.querySelectorAll('.test-card-item').forEach(c => c.style.borderColor = 'transparent');
});

// --- Test Flow ---
startTestBtn.addEventListener('click', () => {
    const studentInput = document.getElementById('student-name');
    const nameError = document.getElementById('student-name-error');

    currentStudentName = studentInput.value.trim();
    if (!currentStudentName) {
        studentInput.style.borderColor = 'var(--wrong-color)';
        nameError.style.display = 'block';
        return;
    }

    // Reset visual error state if valid
    studentInput.style.borderColor = '';
    nameError.style.display = 'none';

    startScreen.classList.remove('view-active');
    testScreen.classList.remove('hidden');
    testScreen.classList.add('view-active');

    currentQuestionIndex = 0;
    score = 0;
    selectedAnswers = new Array(questions.length).fill(null);
    secondsElapsed = 0;
    isShowingBackFace = false;
    cardContainer.classList.remove('is-flipped');

    // Start timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer(); // initial tick

    // Show first question
    renderQuestion(cardFront, questions[0], 0);
    updateTestMeta();
});

function handleNextQuestion() {
    // Record answer
    const currentActiveFace = isShowingBackFace ? cardBack : cardFront;
    const selectedOption = currentActiveFace.querySelector('.option-item.selected');
    if (selectedOption) {
        const index = parseInt(selectedOption.getAttribute('data-index'));
        selectedAnswers[currentQuestionIndex] = index;
    }

    currentQuestionIndex++;

    if (currentQuestionIndex < questions.length) {
        // Prepare next face and flip
        isShowingBackFace = !isShowingBackFace;
        const targetFace = isShowingBackFace ? cardBack : cardFront;

        // Clear previous selection and render new question
        renderQuestion(targetFace, questions[currentQuestionIndex], currentQuestionIndex);

        // Flip card
        if (isShowingBackFace) {
            cardContainer.classList.add('is-flipped');
        } else {
            cardContainer.classList.remove('is-flipped');
        }

        updateTestMeta();
    } else {
        // Finish test
        finishTest();
    }
}

function renderQuestion(element, questionData, index) {
    const letters = ['A', 'B', 'C', 'D'];
    let optionsHtml = '';

    questionData.options.forEach((opt, idx) => {
        optionsHtml += `
            <div class="option-item" data-index="${idx}">
                <div class="option-marker">${letters[idx]}</div>
                <div class="option-text">${opt}</div>
            </div>
        `;
    });

    element.innerHTML = `
        <div class="question-content">${questionData.question}</div>
        <div class="options-grid">
            ${optionsHtml}
        </div>
    `;

    // Process MathJax (with slight delay to ensure DOM is ready)
    setTimeout(() => window.renderMath(element), 50);

    // Add click listeners to options
    const options = element.querySelectorAll('.option-item');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            // Prevent multiple clicks if already transitioning
            if (element.classList.contains('locked')) return;
            element.classList.add('locked'); // Lock further inputs on this face

            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');

            // Auto advance after a short visual delay
            setTimeout(() => {
                element.classList.remove('locked');
                handleNextQuestion();
            }, 600); // 600ms to see the interaction
        });
    });
}

function updateTestMeta() {
    questionCounter.textContent = `Сұрақ: ${currentQuestionIndex + 1} / ${questions.length}`;
    const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
    progressBar.style.width = `${progressPercent}%`;
}

function updateTimer() {
    secondsElapsed++;
    const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    timerDisplay.textContent = `Уақыт: ${mins}:${secs}`;
}

function finishTest() {
    const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    clearInterval(timerInterval);

    // Calculate Score
    score = 0;
    for (let i = 0; i < questions.length; i++) {
        if (selectedAnswers[i] === questions[i].correctIndex) {
            score++;
        }
    }

    testScreen.classList.remove('view-active');
    testScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    resultScreen.classList.add('view-active');

    // Render Results
    const scoreText = document.getElementById('score-text');
    const finalScore = document.getElementById('final-score');
    const finalTime = document.getElementById('final-time');
    const saveStatus = document.getElementById('save-status');
    const restartBtn = document.getElementById('restart-btn');

    const percentage = Math.round((score / questions.length) * 100);
    scoreText.textContent = `${percentage}%`;
    finalScore.textContent = `${score} / ${questions.length}`;
    finalTime.textContent = timerDisplay.textContent.replace('Уақыт: ', '');

    // Draw score circle
    const circle = document.getElementById('score-circle-fill');
    circle.setAttribute('stroke-dasharray', `${percentage}, 100`);

    circle.classList.remove('score-high', 'score-med', 'score-low');
    if (percentage >= 80) {
        circle.classList.add('score-high');
    } else if (percentage >= 50) {
        circle.classList.add('score-med');
    } else {
        circle.classList.add('score-low');
    }

    // Save to Google Sheets
    console.log(mins)
    saveResultsToSheets(percentage, mins, secs);
}

async function saveResultsToSheets(percentage, mins, secs) {
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = '⏳ Нәтижелер сақталуда...';
    saveStatus.style.color = 'var(--text-color)';

    // Prepare data payload
    const topic = document.getElementById('test-topic').value || "Тақырыпсыз";
    const difficulty = document.getElementById('difficulty') ? document.getElementById('difficulty').value : "Орташа";
    const timeStr = `${mins}:${secs}`;

    const sessionLog = questions.map((q, i) => ({
        question: q.question,
        correctAnswer: q.options[q.correctIndex],
        userAnswer: selectedAnswers[i] !== null ? q.options[selectedAnswers[i]] : "Жауап бермеді",
        isCorrect: selectedAnswers[i] === q.correctIndex
    }));

    const payload = {
        action: "save_result",
        testId: Math.random().toString(36).substring(7), // Just a random ID for tracing
        studentName: currentStudentName,
        topic: topic,
        difficulty: difficulty,
        score: `${score} / ${questions.length} (${percentage}%)`,
        time: timeStr,
        details: JSON.stringify(sessionLog)
    };

    try {
        // Now using text/plain to get a response back
        const response = await fetch(`${WORKER_URL}/sheets`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        const data = await response.json();
        if (data.result === 'success') {
            saveStatus.textContent = '✅ Нәтижелер Google кестесіне сәтті сақталды!';
            saveStatus.style.color = 'var(--correct-color)';
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error("Ошибка сохранения в таблицу:", error);
        saveStatus.textContent = '❌ Деректерді сақтау кезінде қате кетті.';
        saveStatus.style.color = 'var(--wrong-color)';
    }
}

document.getElementById('restart-btn').addEventListener('click', () => {
    resultScreen.classList.remove('view-active');
    resultScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    startScreen.classList.add('view-active');
    cardContainer.classList.remove('is-flipped');
    progressBar.style.width = '0%';

    // Clear student name and selection for the next test
    document.getElementById('student-name').value = '';

    // Deselect test
    selectedTestArea.classList.add('hidden');
    document.querySelectorAll('.test-card-item').forEach(c => c.style.borderColor = 'transparent');
});
