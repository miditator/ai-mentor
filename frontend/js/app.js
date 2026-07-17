// js/app.js
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let user = tg.initDataUnsafe?.user || { id: 8407744578, first_name: "Пользователь (Резерв)" };

window.userProfile = null;
window.currentAppMode = 'menu';
let isProfileVisible = false;

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateProfileUI(data) {
    console.log("Данные от сервера:", data);
    window.userProfile = data;

    const diffMap = { "A1": "Начальный (A1)", "A2": "Элементарный (A2)", "B1": "Средний (B1)", "B2": "Выше среднего (B2)", "C1": "Продвинутый (C1)" };
    const langMap = { "en": "Английский 🇬🇧", "de": "Немецкий 🇩🇪" };

    const lang = data.language || "Не задан";
    const diff = data.difficulty || "Не задана";
    const count = (data.words_count !== undefined) ? data.words_count : 0;
    const limit = (data.words_per_day !== undefined) ? data.words_per_day : 10;

    document.getElementById('pc-lang').innerText = langMap[lang] || lang;
    document.getElementById('pc-diff').innerText = diffMap[diff] || diff;
    document.getElementById('pc-words').innerText = count;
    document.getElementById('pc-limit').innerText = limit + " шт.";

    document.getElementById('profile-card').style.display = 'block';
    isProfileVisible = true;
}

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

// Запрос профиля
apiFetch(`/profile?chat_id=${user.id}`)
    .then(data => {
        if (data.is_new_user) {
            switchScreen('screen-onboarding');
        } else {
            updateProfileUI(data);
            switchScreen('screen-main');
        }
    })
    .catch(err => {
        console.error(err);
    });

// ==========================================
// УПРАВЛЕНИЕ ИНТЕРФЕЙСАМИ (БЕЗ БЭКЕНДА)
// ==========================================

// 1. Режим "Словарь" (Демонстрационный)
function showFullDictionary() {
    window.currentAppMode = 'dictionary';
    document.getElementById('top-bar').innerText = '📚 Мой словарь';

    // Прячем профиль и выводим демо-данные
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = `
        <b>Список слов (Демо):</b><br><br>
        • <b>Apple</b> — <i>Яблоко</i><br>
        • <b>House</b> — <i>Дом</i><br>
        • <b>Water</b> — <i>Вода</i><br>
        • <b>Fire</b> — <i>Огонь</i>
    `;

    // Переключаем клавиатуры
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    document.getElementById('dictionary-keyboard').style.display = 'grid';
}

// 2. Режим-заглушка для остальных 4 разделов (Задания, Интенсив и т.д.)
function showDummyMode(title) {
    window.currentAppMode = 'dummy';
    // Меняем заголовок на название нажатой кнопки
    document.getElementById('top-bar').innerText = title;

    // Прячем профиль, выводим сообщение в чат
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = `<i>Раздел "${title}" находится в разработке 🛠</i>`;

    // Переключаем клавиатуры
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';

    // Показываем клавиатуру заглушки (с кнопкой выхода)
    document.getElementById('dummy-keyboard').style.display = 'grid';
}

// 3. Единый выход в Главное меню
function exitToMainMenu() {
    window.currentAppMode = 'menu';
    document.getElementById('top-bar').innerText = 'Главное меню';

    // Очищаем окно вывода и возвращаем нашу плашку с инфой
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('profile-card').style.display = 'block';

    // Прячем все побочные клавиатуры и инпуты
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    // Обязательно возвращаем основную клавиатуру
    document.getElementById('action-keyboard').style.display = 'grid';
}