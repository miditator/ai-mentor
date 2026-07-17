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

    // Прячем верхний профиль и меняем заголовок
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('top-bar').innerText = '➕ Добавление слова';

    // 🔥 Скрываем ВСЕ возможные клавиатуры перед открытием инпута
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('training-menu-keyboard')) document.getElementById('training-menu-keyboard').style.display = 'none';

    // Показываем поле ввода
    document.getElementById('input-container').style.display = 'flex';

    showTextInput();

    // 🎯 Динамически определяем название языка
    const langName = window.userProfile?.language === 'de' ? 'немецком' : 'английском';

    // 🎨 Показываем стартовую карточку
    showAddCard(`
        <div style="font-size: 50px; margin-bottom: 15px;">✍️</div>
        <div style="font-size: 22px; font-weight: bold; color: var(--text-color); margin-bottom: 10px;">Новое слово</div>
        <div style="font-size: 14px; color: var(--hint-color);">Напиши слово на <b>${langName}</b> или <b>русском</b> языке, а ИИ найдет его перевод.</div>
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

// 1. Отправляем слово на ПЕРЕВОД (ЗДЕСЬ ИДЕТ ПРОВЕРКА ОШИБОК И БЕЛИБЕРДЫ)
function handleAddWordInput(text) {
    if (isWaitingForAi) return;

    isWaitingForAi = true;

    // 🎨 Карточка ожидания
    showAddCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🧠</div>
        <div style="font-size: 16px; color: var(--hint-color);">Переводим слово <b>${text}</b>...</div>
    `);

    apiFetch('/words/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, foreign: text })
    })
    .then(data => {
        isWaitingForAi = false;

        if(data.success) {
            // 🔥 Сохраняем в память ИСПРАВЛЕННОЕ слово и перевод от ИИ
            pendingForeignWord = data.original;
            pendingRuWord = data.translation;

            // 🔥 Проверяем, была ли опечатка
            let typoNotice = "";
            if (data.is_typo) {
                typoNotice = `
                    <div style="background: rgba(255, 159, 10, 0.1); border: 1px solid rgba(255, 159, 10, 0.3); color: #ff9f0a; padding: 10px; border-radius: 8px; font-size: 13px; margin-bottom: 15px; width: 100%; box-sizing: border-box;">
                        ✨ <b>ИИ исправил опечатку!</b>
                    </div>
                `;
            }

            // 🎨 Отрисовываем карточку с результатом (и плашкой, если она есть)
            showAddCard(`
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                    ${typoNotice}
                    <div style="font-size: 14px; color: var(--hint-color); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Перевод ИИ:</div>
                    <div style="font-size: 28px; font-weight: bold; color: var(--text-color); margin-bottom: 5px;">${pendingForeignWord}</div>
                    <div style="font-size: 24px; color: var(--button-color); margin-bottom: 20px;">${pendingRuWord}</div>
                    <div style="font-size: 15px; color: var(--text-color);">Сохраняем в словарь?</div>
                </div>
            `);
            showConfirmButtons();

        } else if (data.error === "nonsense") {
            // 🔥 Обработка белиберды (возвращаем поле ввода, чтобы можно было ввести заново)
            showAddCard(`
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; text-align: center;">
                    <div style="font-size: 50px; margin-bottom: 15px;">🤨</div>
                    <div style="font-size: 20px; font-weight: bold; color: #ff3b30; margin-bottom: 10px;">Эмм... Что это?</div>
                    <div style="font-size: 14px; color: var(--hint-color); margin-bottom: 25px; line-height: 1.4;">
                        Кажется, это белиберда или опечатка. ИИ не смог перевести "<b>${text}</b>".
                    </div>
                    <div style="font-size: 14px; color: var(--button-color);">Введи нормальное слово 👇</div>
                </div>
            `);
            showTextInput();
            document.getElementById('user-input').value = '';
            document.getElementById('user-input').focus();

        } else {
            // Обычная ошибка
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

// 2. Пользователь нажал "✅ Сохранить" (просто сохраняем в БД)
// 2. Пользователь нажал "✅ Сохранить" (просто сохраняем в БД)


// 3. Пользователь нажал "🔄 Другое"
function rejectAddWord() {
    showAddCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🔄</div>
        <div style="font-size: 18px; font-weight: bold; color: var(--text-color); margin-bottom: 10px;">Отменено</div>
        <div style="font-size: 14px; color: var(--hint-color);">Введи другое слово 👇</div>
    `);
    showTextInput();
    document.getElementById('user-input').value = '';
    document.getElementById('user-input').focus();
}

function cancelAddWord() {
    if (isWaitingForAi) return;
    exitAddWordMode();
}

// 2. Пользователь нажал "✅ Сохранить" (просто сохраняем в БД)
// 2. Пользователь нажал "✅ Сохранить" (просто сохраняем в БД)
function confirmAddWord() {
    showAddCard(`<div style="font-size: 40px; margin-bottom: 15px;">💾</div><div style="color: var(--hint-color);">Сохраняем...</div>`);

    // Прячем поле ввода на секунду, пока идет сохранение
    document.getElementById('text-input-row').style.display = 'none';
    document.getElementById('confirm-row').style.display = 'none';

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
            // 🎨 Показываем галочку по центру и возвращаем строку ввода!
            showAddCard(`
                <div style="font-size: 60px; margin-bottom: 10px;">✅</div>
                <div style="font-size: 20px; font-weight: bold; color: var(--text-color); margin-bottom: 5px;">Добавлено в словарь!</div>
                <div style="font-size: 16px; color: var(--button-color); margin-bottom: 25px;">${pendingForeignWord} — ${pendingRuWord}</div>
                <div style="font-size: 14px; color: var(--hint-color);">Введи следующее слово 👇</div>
            `);

            // Возвращаем инпут, чтобы юзер мог сразу печатать
            showTextInput();
            document.getElementById('user-input').value = '';
            document.getElementById('user-input').focus();

        } else {
            showAddCard(`❌ Ошибка сохранения: ${data.error}`);
            showTextInput();
            document.getElementById('user-input').focus();
        }
    })
    .catch(err => {
        showAddCard(`❌ Ошибка сети: ${err.message}`);
        showTextInput();
        document.getElementById('user-input').focus();
    });
}

// 4. Выход в меню (обновляем статы только здесь)
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

    // 🔥 Обновляем счетчик слов только в момент возврата в главное меню
    if (user && user.id) {
        apiFetch(`/profile?chat_id=${user.id}`).then(profileData => {
            if (typeof updateProfileUI === 'function') {
                updateProfileUI(profileData);
            }
        });
    }
}