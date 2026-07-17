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
    } else if (window.currentAppMode === 'task' && typeof handleTaskInput === 'function') {
        handleTaskInput(text); // Обработка ответа на задание
    }
});

// Запрос профиля
apiFetch(`/profile?chat_id=${user.id}`)
    .then(data => {
        if (data.is_new_user) {
            switchScreen('screen-onboarding');
        } else if (window.currentAppMode === 'training') {
    handleTrainingInput(text);
        }
        else {
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

function showFullDictionary() {
    window.currentAppMode = 'dictionary';
    document.getElementById('top-bar').innerText = '📚 Мой словарь';

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = '<i>Загрузка словаря...</i>';

    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    document.getElementById('dictionary-keyboard').style.display = 'grid';

    apiFetch(`/words/all?chat_id=${user.id}`)
        .then(data => {
            document.getElementById('chat-messages').innerHTML = '';

            if (data.success && data.words && data.words.length > 0) {
                let html = '<b>Твои слова:</b><br><br>';

                data.words.forEach(w => {
                    let foreign = w.word_foreign || w.foreign || w[0];
                    let ru = w.word_ru || w.ru || w[1];
                    let score = w.score !== undefined ? w.score : (w[2] || 0);
                    let percent = Math.round((score / 5) * 100);

                    html += `• <b>${foreign}</b> — <i>${ru}</i> [${percent}%]<br>`;
                });

                addMessageToOutput(html);
            } else {
                addMessageToOutput("Словарь пока пуст. Самое время добавить новое слово! ✍️");
            }
        })
        .catch(err => {
            console.error(err);
            document.getElementById('chat-messages').innerHTML = '<i>❌ Ошибка при загрузке словаря.</i>';
        });
}

function showDummyMode(title) {
    window.currentAppMode = 'dummy';
    document.getElementById('top-bar').innerText = title;

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = `<i>Раздел "${title}" находится в разработке 🛠</i>`;

    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';

    document.getElementById('dummy-keyboard').style.display = 'grid';
}

function exitToMainMenu() {
    window.currentAppMode = 'menu';
    document.getElementById('top-bar').innerText = 'Главное меню';

    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('profile-card').style.display = 'block';

    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';
    if (document.getElementById('training-menu-keyboard')) document.getElementById('training-menu-keyboard').style.display = 'none';
    if (document.getElementById('training-active-keyboard')) document.getElementById('training-active-keyboard').style.display = 'none';

    // Скрываем кнопку задания
    if (document.getElementById('btn-next-task')) document.getElementById('btn-next-task').style.display = 'none';

    document.getElementById('action-keyboard').style.display = 'grid';
    document.getElementById('user-input').placeholder = "Напиши слово...";
    document.getElementById('text-input-row').style.display = 'flex';
}