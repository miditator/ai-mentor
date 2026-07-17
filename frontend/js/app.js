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
    } else if (window.currentAppMode === 'task') {
        handleTaskInput(text); // Обработка ответа на задание
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
// 1. Режим "Словарь" (Реальные данные)
function showFullDictionary() {
    window.currentAppMode = 'dictionary';
    document.getElementById('top-bar').innerText = '📚 Мой словарь';

    // Прячем профиль и выводим статус загрузки
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = '<i>Загрузка словаря...</i>';

    // Переключаем клавиатуры
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    document.getElementById('dictionary-keyboard').style.display = 'grid';

    // Делаем реальный запрос к бэкенду
    apiFetch(`/words/all?chat_id=${user.id}`)
        .then(data => {
            document.getElementById('chat-messages').innerHTML = ''; // Очищаем статус

            if (data.success && data.words && data.words.length > 0) {
                let html = '<b>Твои слова:</b><br><br>';

                data.words.forEach(w => {
                    // Поддержка и массивов [en, ru, score], и объектов (на случай разных версий БД)
                    let foreign = w.word_foreign || w.foreign || w[0];
                    let ru = w.word_ru || w.ru || w[1];
                    let score = w.score !== undefined ? w.score : (w[2] || 0);

                    // Переводим score (0-5) в проценты (0-100%)
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
    if (document.getElementById('btn-next-task')) document.getElementById('btn-next-task').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'grid';
    document.getElementById('user-input').placeholder = "Напиши слово...";
    document.getElementById('text-input-row').style.display = 'flex';
}

// ==========================================
// РЕЖИМ: НОВОЕ ЗАДАНИЕ
// ==========================================

function showNewTaskMode() {
    window.currentAppMode = 'task';
    document.getElementById('top-bar').innerText = '🎯 Новое задание';

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = '<i>ИИ составляет предложение из твоих слов... ⏳</i>';

    // Прячем меню
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    // Показываем контейнер ввода
    const inputContainer = document.getElementById('input-container');
    inputContainer.style.display = 'flex';
    document.getElementById('text-input-row').style.display = 'flex';
    document.getElementById('confirm-row').style.display = 'none';

    // ВАЖНО: Показываем кнопку "Ещё 1 задание"
    document.getElementById('btn-next-task').style.display = 'block';

    const userInput = document.getElementById('user-input');
    userInput.value = ''; // Очищаем поле от старого ответа
    userInput.placeholder = "Напиши перевод...";
    userInput.focus();

    // Запрашиваем задание
    apiFetch(`/tasks/new?chat_id=${user.id}`)
        .then(data => {
            document.getElementById('chat-messages').innerHTML = '';
            if (data.success) {
                addMessageToOutput(`<b>Переведи на изучаемый язык:</b><br><br>🇷🇺 <i>${data.phrase}</i>`);
            } else {
                addMessageToOutput("❌ Ошибка генерации: " + data.error);
            }
        })
        .catch(err => {
            document.getElementById('chat-messages').innerHTML = '<i>❌ Ошибка сети.</i>';
        });
}

function handleTaskInput(text) {
    addMessageToOutput("<i>Проверка ИИ... ⏳</i>");
    document.getElementById('text-input-row').style.display = 'none'; // блокируем ввод временно

    apiFetch('/tasks/check', {
        method: 'POST',
        body: JSON.stringify({ chat_id: user.id, answer: text })
    }).then(data => {
        if (data.success) {
            addMessageToOutput(data.feedback);
            if (data.is_correct) {
                // Если ответ верный — ничего не делаем.
                // Пользователь сам нажмет "Ещё 1 задание" или "Выход в меню" внизу экрана.
            } else {
                // Если ошибка — разрешаем ввести заново
                document.getElementById('text-input-row').style.display = 'flex';
                document.getElementById('user-input').focus();
            }
        } else {
            addMessageToOutput("❌ Ошибка проверки: " + data.error);
            document.getElementById('text-input-row').style.display = 'flex';
        }
    }).catch(err => {
        addMessageToOutput("❌ Ошибка сети.");
        document.getElementById('text-input-row').style.display = 'flex';
    });
}{
    addMessageToOutput("<i>Проверка ИИ... ⏳</i>");
    document.getElementById('text-input-row').style.display = 'none'; // блокируем ввод временно

    apiFetch('/tasks/check', {
        method: 'POST',
        body: JSON.stringify({ chat_id: user.id, answer: text })
    }).then(data => {
        if (data.success) {
            addMessageToOutput(data.feedback);
            if (data.is_correct) {
                setTimeout(() => {
                   addMessageToOutput("🎉 <b>Задание выполнено!</b> Возвращаемся в меню...");
                   setTimeout(exitToMainMenu, 2500);
                }, 1000);
            } else {
                // Если ошибка — разрешаем ввести заново
                document.getElementById('text-input-row').style.display = 'flex';
                document.getElementById('user-input').focus();
            }
        } else {
            addMessageToOutput("❌ Ошибка проверки: " + data.error);
            document.getElementById('text-input-row').style.display = 'flex';
        }
    }).catch(err => {
        addMessageToOutput("❌ Ошибка сети.");
        document.getElementById('text-input-row').style.display = 'flex';
    });
}