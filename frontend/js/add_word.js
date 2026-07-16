// ==========================================
// ФАЙЛ: frontend/js/add_word.js
// ==========================================

let isWaitingForAi = false; // Блокиратор, чтобы юзер не нажал кнопку 10 раз

function enterAddWordMode() {
    window.currentAppMode = 'add_word';
    isWaitingForAi = false;

    // 1. Меняем шапку
    document.getElementById('top-bar').innerText = '➕ Добавление слова';

    // 2. Прячем клавиатуру меню и показываем поле ввода
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'flex';

    // 3. Выводим инструкцию в чат
    addMessageToOutput('Напиши слово (или фразу) на иностранном языке, а ИИ сам переведет его и добавит в словарь 🧠✍️');

    // 4. Настраиваем поле ввода и ставим фокус
    const inputField = document.getElementById('user-input');
    inputField.placeholder = "Иностранное слово...";
    inputField.focus();
}

// Эта функция принимает текст из поля ввода
function handleAddWordInput(text) {
    if (isWaitingForAi) return; // Если уже ждем ответа, игнорируем новые отправки

    isWaitingForAi = true;
    const foreignWord = text;

    // Показываем индикатор загрузки
    addMessageToOutput(`<i>⏳ ИИ переводит и сохраняет <b>${foreignWord}</b>...</i>`);

    // Отправляем только иностранное слово на FastAPI
    apiFetch('/words/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: user.id,
            foreign: foreignWord
        })
    })
    .then(data => {
        if(data.success) {
            // Выводим сообщение об успехе с переводом от ИИ!
            addMessageToOutput(
                `✅ Слово <b>${foreignWord}</b> — <b>${data.ru}</b> добавлено в словарь!<br><br>` +
                `🔥 <i>Хочешь пройти Интенсив по этому слову и закрепить его? (Кнопки скоро появятся)</i>`
            );

            // Обновляем статистику профиля в фоне
            apiFetch(`/profile?chat_id=${user.id}`).then(showProfileData);
        } else {
            addMessageToOutput(`❌ Ошибка на сервере: ${data.error}`);
        }

        // Возвращаемся в главное меню через 3.5 секунды
        setTimeout(exitAddWordMode, 3500);
    })
    .catch(err => {
        addMessageToOutput(`❌ Ошибка сети: ${err.message}`);
        setTimeout(exitAddWordMode, 2000);
    });
}

// Возврат к главному меню
function exitAddWordMode() {
    window.currentAppMode = 'menu';
    document.getElementById('top-bar').innerText = 'Главное меню';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'grid';
}