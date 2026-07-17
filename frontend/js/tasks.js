// frontend/js/task.js

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
    apiFetch(`/tasks/new?chat_id=${user.id}&force=true`)
        .then(data => {
            document.getElementById('chat-messages').innerHTML = '';
            if (data.success) {
                addMessageToOutput(`<b>Переведи на изучаемый язык:</b><br><br>🇷🇺 <i>${data.phrase}</i>`);
            } else {
                addMessageToOutput("❌ Ошибка генерации: " + data.error);
            }
        })
        .catch(err => {
            console.error(err);
            document.getElementById('chat-messages').innerHTML = '<i>❌ Ошибка связи с сервером.</i>';
        });
}

function handleTaskInput(text) {
    addMessageToOutput("<i>Проверка ИИ... ⏳</i>");
    document.getElementById('text-input-row').style.display = 'none'; // блокируем ввод временно

    // ИСПРАВЛЕНИЕ: Добавлены headers, чтобы FastAPI (Pydantic BaseModel) не выдавал ошибку 422
    apiFetch('/tasks/check', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chat_id: user.id, answer: text })
    }).then(data => {
        if (data.success) {
            addMessageToOutput(data.feedback);
            if (data.is_correct) {
                // Верно — ничего не делаем, пользователь сам нажмет кнопку "Ещё 1 задание"
            } else {
                // Ошибка — разрешаем ввести заново
                document.getElementById('text-input-row').style.display = 'flex';
                document.getElementById('user-input').focus();
            }
        } else {
            addMessageToOutput("❌ Ошибка проверки: " + data.error);
            document.getElementById('text-input-row').style.display = 'flex';
        }
    }).catch(err => {
        console.error(err);
        addMessageToOutput("❌ Ошибка сети.");
        document.getElementById('text-input-row').style.display = 'flex';
    });
}