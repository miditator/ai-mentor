// ==========================================
// ФАЙЛ: frontend/js/add_word.js
// ==========================================

let addWordStep = null; // Шаги: 'waiting_foreign' -> 'waiting_ru'
let pendingForeignWord = "";

function enterAddWordMode() {
    window.currentAppMode = 'add_word';
    addWordStep = 'waiting_foreign';
    pendingForeignWord = "";

    // 1. Меняем шапку
    document.getElementById('top-bar').innerText = '➕ Добавление слова';

    // 2. Прячем клавиатуру меню и показываем поле ввода
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'flex';

    // 3. Выводим инструкцию в чат
    addMessageToOutput('Напиши слово (или фразу) на иностранном языке ✍️');

    // 4. Настраиваем поле ввода и ставим фокус
    const inputField = document.getElementById('user-input');
    inputField.placeholder = "Иностранное слово...";
    inputField.focus();
}

// Эта функция принимает текст из поля ввода (вызывается из app.js)
function handleAddWordInput(text) {
    if (addWordStep === 'waiting_foreign') {
        pendingForeignWord = text;
        addWordStep = 'waiting_ru';

        // Просим перевод
        addMessageToOutput(`Отлично! Теперь напиши перевод для <b>${text}</b> 🇷🇺`);

        const inputField = document.getElementById('user-input');
        inputField.placeholder = "Перевод на русский...";
        inputField.focus();

    } else if (addWordStep === 'waiting_ru') {
        const ruWord = text;
        addWordStep = null;

        // Отправляем готовую пару на FastAPI
        apiFetch('/words/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.id, // ID берем из глобальной переменной в app.js
                foreign: pendingForeignWord,
                ru: ruWord
            })
        })
        .then(data => {
            if(data.success) {
                // Выводим сообщение об успехе и предлагаем Интенсив!
                addMessageToOutput(
                    `✅ Слово <b>${pendingForeignWord}</b> успешно добавлено в словарь!<br><br>` +
                    `🔥 <i>Хочешь пройти Интенсив по этому слову и закрепить его в памяти? (Логика скоро появится)</i>`
                );

                // Обновляем статистику профиля в фоне (чтобы счетчик слов вырос)
                apiFetch(`/profile?chat_id=${user.id}`).then(showProfileData);
            } else {
                addMessageToOutput(`❌ Ошибка на сервере: ${data.error}`);
            }

            // Возвращаемся в главное меню через 3.5 секунды, чтобы юзер успел прочитать
            setTimeout(exitAddWordMode, 3500);
        })
        .catch(err => {
            addMessageToOutput(`❌ Ошибка сети: ${err.message}`);
            setTimeout(exitAddWordMode, 2000);
        });
    }
}

// Возврат к главному меню
function exitAddWordMode() {
    window.currentAppMode = 'menu';
    document.getElementById('top-bar').innerText = 'Главное меню';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'grid';
}