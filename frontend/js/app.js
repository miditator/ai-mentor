// js/app.js
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let user = tg.initDataUnsafe?.user || { id: 8407744578, first_name: "Пользователь (Резерв)" };

// Глобальные переменные
window.userProfile = null;
window.currentAppMode = 'menu';
let isProfileVisible = false; // 🎯 ИСПРАВЛЕНИЕ: Добавили переменную состояния профиля

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showProfileData(data) {
    window.userProfile = data;

    // Сразу заполняем данные в плашке
    const diffMap = { "A1": "Начальный (A1)", "A2": "Элементарный (A2)", "B1": "Средний (B1)", "B2": "Выше среднего (B2)", "C1": "Продвинутый (C1)" };
    const langMap = { "en": "Английский 🇬🇧", "de": "Немецкий 🇩🇪" };

    document.getElementById('pc-lang').innerText = langMap[data.language] || data.language;
    document.getElementById('pc-diff').innerText = diffMap[data.difficulty] || data.difficulty;
    document.getElementById('pc-words').innerText = data.words_count;
    document.getElementById('pc-limit').innerText = `${data.words_per_day} шт.`;

    // Показываем плашку профиля сразу при загрузке
    document.getElementById('profile-card').style.display = 'block';
    isProfileVisible = true;
}

// ==========================================
// Функция вывода сообщений чата
// ==========================================
function addMessageToOutput(text, isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const outputArea = document.getElementById('output-area');
    const msgDiv = document.createElement('div');

    msgDiv.style.padding = '12px 15px';
    msgDiv.style.borderRadius = '12px';
    msgDiv.style.marginBottom = '10px';
    msgDiv.style.fontSize = '15px';
    msgDiv.style.maxWidth = '85%';
    msgDiv.style.wordWrap = 'break-word';

    if (isUser) {
        msgDiv.style.backgroundColor = 'var(--button-color)';
        msgDiv.style.color = '#ffffff';
        msgDiv.style.alignSelf = 'flex-end';
    } else {
        msgDiv.style.backgroundColor = 'var(--secondary-bg-color)';
        msgDiv.style.border = '1px solid rgba(112, 132, 153, 0.2)';
        msgDiv.style.color = 'var(--text-color)';
        msgDiv.style.alignSelf = 'flex-start';
    }

    msgDiv.innerHTML = text;
    chatMessages.appendChild(msgDiv);
    outputArea.scrollTop = outputArea.scrollHeight;
}



// ==========================================
// Обработчик кнопки отправки (➡️)
// ==========================================
document.getElementById('btn-send').addEventListener('click', () => {
    const inputField = document.getElementById('user-input');
    const text = inputField.value.trim();
    if (!text) return;

    addMessageToOutput(text, true);
    inputField.value = '';

    if (window.currentAppMode === 'add_word' && typeof handleAddWordInput === 'function') {
        handleAddWordInput(text);
    }
});

// ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ПРИ СТАРТЕ ПРИЛОЖЕНИЯ
apiFetch(`/profile?chat_id=${user.id}`)
    .then(data => {
        if (data.is_new_user) {
            switchScreen('screen-onboarding');
        } else {
            showProfileData(data);
            switchScreen('screen-main');
        }
    })
    .catch(err => {
        document.getElementById('screen-loading').innerHTML = `
            <div class="loader" style="color: #ff4d4d;">
                ⚠️ Ошибка подключения: ${err.message}<br>
                <small style="color: #708499; font-size:11px;">Проверь, запущен ли твой FastAPI и активен ли ngrok туннель</small>
            </div>
        `;
    });