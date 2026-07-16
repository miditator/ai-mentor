// ==========================================
// ФАЙЛ: frontend/js/add_word.js
// ==========================================

let isWaitingForAi = false;
let pendingForeignWord = "";
let pendingRuWord = "";

function enterAddWordMode() {
    window.currentAppMode = 'add_word';
    isWaitingForAi = false;

    // 🎯 ДОБАВИЛИ: Скрываем плашку профиля при входе в режим
    document.getElementById('profile-card').style.display = 'none';

    document.getElementById('top-bar').innerText = '➕ Добавление слова';
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'flex';

    showTextInput();

    addMessageToOutput('Напиши слово на иностранном языке, а ИИ сам переведет его 🧠✍️');
    document.getElementById('user-input').focus();
}

// Переключатели интерфейса
function showTextInput() {
    document.getElementById('text-input-row').style.display = 'flex';
    document.getElementById('confirm-row').style.display = 'none';
}

function showConfirmButtons() {
    document.getElementById('text-input-row').style.display = 'none';
    document.getElementById('confirm-row').style.display = 'flex';
}

// 1. Отправляем слово на ПЕРЕВОД
function handleAddWordInput(text) {
    if (isWaitingForAi) return;

    isWaitingForAi = true;
    pendingForeignWord = text;

    addMessageToOutput(`<i>⏳ ИИ переводит <b>${pendingForeignWord}</b>...</i>`);

    apiFetch('/words/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, foreign: pendingForeignWord })
    })
    .then(data => {
        isWaitingForAi = false;
        if(data.success) {
            pendingRuWord = data.ru;
            addMessageToOutput(`🤖 Перевод: <b>${pendingRuWord}</b><br><br>Сохраняем в словарь?`);
            showConfirmButtons(); // Прячем инпут, показываем кнопки Да/Нет
        } else {
            addMessageToOutput(`❌ Ошибка на сервере: ${data.error}`);
            showTextInput();
        }
    })
    .catch(err => {
        isWaitingForAi = false;
        addMessageToOutput(`❌ Ошибка сети: ${err.message}`);
        showTextInput();
    });
}

// 2. Пользователь нажал "✅ Сохранить"
function confirmAddWord() {
    addMessageToOutput(`<i>⏳ Сохраняем в словарь...</i>`);
    showTextInput(); // Сразу возвращаем поле ввода для следующего слова

    apiFetch('/words/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: user.id,
            foreign: pendingForeignWord,
            ru: pendingRuWord
        })
    })
    .then(data => {
        if(data.success) {
            // Пишем об успехе и предлагаем ввести еще!
            addMessageToOutput(`✅ Отлично! Слово <b>${pendingForeignWord} — ${pendingRuWord}</b> добавлено в словарь.<br><br>Можешь написать следующее слово 👇`);
            apiFetch(`/profile?chat_id=${user.id}`).then(showProfileData); // Обновляем стату
        } else {
            addMessageToOutput(`❌ Ошибка сохранения: ${data.error}`);
        }
        document.getElementById('user-input').focus();
    })
    .catch(err => {
        addMessageToOutput(`❌ Ошибка сети: ${err.message}`);
    });
}

// 3. Пользователь нажал "🔄 Другое"
function rejectAddWord() {
    addMessageToOutput("<i>Отменено. Введи другое слово 👇</i>");
    showTextInput();
    document.getElementById('user-input').focus();
}

// ==========================================
// Логика отмены и выхода
// ==========================================
function cancelAddWord() {
    if (isWaitingForAi) {
        addMessageToOutput("⚠️ Дождись ответа от ИИ перед выходом.");
        return;
    }
    exitAddWordMode();
}

function exitAddWordMode() {
    window.currentAppMode = 'menu';
    isWaitingForAi = false;

    // 🧹 Очистка чата
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) chatContainer.innerHTML = '';
    document.getElementById('user-input').value = '';

    // 🎯 ДОБАВИЛИ: Возвращаем плашку профиля при выходе в меню
    document.getElementById('profile-card').style.display = 'block';

    document.getElementById('top-bar').innerText = 'Главное меню';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'grid';
}