// ==========================================
// ФАЙЛ: frontend/js/add_word.js
// ==========================================

let isWaitingForAi = false;
let pendingForeignWord = "";
let pendingRuWord = "";

// 🎯 Вспомогательная функция для отрисовки карточки
function showAddCard(htmlContent) {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            ${htmlContent}
        </div>`;
}

function enterAddWordMode() {
    window.currentAppMode = 'add_word';
    isWaitingForAi = false;

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('top-bar').innerText = '➕ Добавление слова';
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'flex';

    showTextInput();

    // 🎨 Показываем стартовую карточку
    showAddCard(`
        <div style="font-size: 50px; margin-bottom: 15px;">✍️</div>
        <div style="font-size: 22px; font-weight: bold; color: var(--text-color); margin-bottom: 10px;">Новое слово</div>
        <div style="font-size: 14px; color: var(--hint-color);">Напиши слово на иностранном языке, а ИИ сам его переведет</div>
    `);
    document.getElementById('user-input').focus();
}

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

    // 🎨 Карточка ожидания
    showAddCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🧠</div>
        <div style="font-size: 16px; color: var(--hint-color);">Переводим слово <b>${pendingForeignWord}</b>...</div>
    `);

    apiFetch('/words/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, foreign: pendingForeignWord })
    })
    .then(data => {
        isWaitingForAi = false;
        if(data.success) {
            pendingRuWord = data.ru;
            // 🎨 Карточка с результатом перевода
            showAddCard(`
                <div style="font-size: 14px; color: var(--hint-color); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Перевод ИИ:</div>
                <div style="font-size: 28px; font-weight: bold; color: var(--text-color); margin-bottom: 5px;">${pendingForeignWord}</div>
                <div style="font-size: 24px; color: var(--button-color); margin-bottom: 20px;">${pendingRuWord}</div>
                <div style="font-size: 15px; color: var(--text-color);">Сохраняем в словарь?</div>
            `);
            showConfirmButtons();
        } else {
            showAddCard(`<div style="font-size: 40px; margin-bottom: 10px;">❌</div><div>Ошибка: ${data.error}</div>`);
            showTextInput();
        }
    })
    .catch(err => {
        isWaitingForAi = false;
        showAddCard(`<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Ошибка сети: ${err.message}</div>`);
        showTextInput();
    });
}

// 2. Пользователь нажал "✅ Сохранить"
function confirmAddWord() {
    showAddCard(`<div style="font-size: 40px; margin-bottom: 15px;">💾</div><div style="color: var(--hint-color);">Сохраняем...</div>`);
    showTextInput();

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
            // 🎨 Карточка успеха
            showAddCard(`
                <div style="font-size: 50px; margin-bottom: 15px;">✅</div>
                <div style="font-size: 20px; font-weight: bold; color: #34c759; margin-bottom: 10px;">Добавлено!</div>
                <div style="font-size: 16px; color: var(--text-color); margin-bottom: 15px;"><b>${pendingForeignWord}</b> — ${pendingRuWord}</div>
                <div style="font-size: 14px; color: var(--hint-color);">Можешь написать следующее слово 👇</div>
            `);
            apiFetch(`/profile?chat_id=${user.id}`).then(updateProfileUI);
        } else {
            showAddCard(`❌ Ошибка сохранения: ${data.error}`);
        }
        document.getElementById('user-input').focus();
    })
    .catch(err => {
        showAddCard(`❌ Ошибка сети: ${err.message}`);
    });
}

// 3. Пользователь нажал "🔄 Другое"
function rejectAddWord() {
    showAddCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🔄</div>
        <div style="font-size: 18px; font-weight: bold; color: var(--text-color); margin-bottom: 10px;">Отменено</div>
        <div style="font-size: 14px; color: var(--hint-color);">Введи другое слово 👇</div>
    `);
    showTextInput();
    document.getElementById('user-input').focus();
}

function cancelAddWord() {
    if (isWaitingForAi) return;
    exitAddWordMode();
}

function exitAddWordMode() {
    window.currentAppMode = 'menu';
    isWaitingForAi = false;

    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) chatContainer.innerHTML = '';
    document.getElementById('user-input').value = '';

    document.getElementById('profile-card').style.display = 'block';
    document.getElementById('top-bar').innerText = 'Главное меню';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'grid';
}