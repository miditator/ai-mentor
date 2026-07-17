// ==========================================
// РЕЖИМ: НОВОЕ ЗАДАНИЕ (tasks.js)
// ==========================================

// 🎯 Вспомогательная функция для отрисовки карточки задания
function showTaskCard(htmlContent) {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            ${htmlContent}
        </div>`;
}

function showNewTaskMode() {
    window.currentAppMode = 'task';
    document.getElementById('top-bar').innerText = '🎯 Новое задание';

    document.getElementById('profile-card').style.display = 'none';

    // Прячем меню
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    // Показываем контейнер ввода
    const inputContainer = document.getElementById('input-container');
    inputContainer.style.display = 'flex';
    document.getElementById('text-input-row').style.display = 'flex';
    document.getElementById('confirm-row').style.display = 'none';
    document.getElementById('btn-next-task').style.display = 'block';

    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.placeholder = "Напиши перевод...";

    // 🎨 Карточка загрузки
    showTaskCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
        <div style="font-size: 16px; color: var(--hint-color);">ИИ составляет предложение из твоих слов...</div>
    `);

    // Запрашиваем задание
    apiFetch(`/tasks/new?chat_id=${user.id}`)
        .then(data => {
            if (data.success) {
                // 🎨 Карточка с заданием
                showTaskCard(`
                    <div style="font-size: 13px; color: var(--hint-color); margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Переведи на изучаемый язык:</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-color); margin-bottom: 10px;">${data.phrase}</div>
                `);
                userInput.focus();
            } else {
                showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">❌</div><div>Ошибка генерации: ${data.error}</div>`);
            }
        })
        .catch(err => {
            showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Ошибка связи с сервером.</div>`);
        });
}

function handleTaskInput(text) {
    // 🎨 Карточка проверки
    showTaskCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🤖</div>
        <div style="font-size: 16px; color: var(--hint-color);">ИИ проверяет грамматику...</div>
    `);
    document.getElementById('text-input-row').style.display = 'none';

    apiFetch('/tasks/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, answer: text })
    }).then(data => {
        if (data.success) {
            if (data.is_correct) {
                // 🎨 Карточка успеха (ответ от ИИ)
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">✅</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5;">${data.feedback}</div>
                `);
            } else {
                // 🎨 Карточка ошибки (ответ от ИИ)
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">❌</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                    <div style="font-size: 13px; color: var(--hint-color);">Попробуй еще раз 👇</div>
                `);
                document.getElementById('text-input-row').style.display = 'flex';
                document.getElementById('user-input').focus();
            }
        } else {
            showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">❌</div><div>Ошибка проверки: ${data.error}</div>`);
            document.getElementById('text-input-row').style.display = 'flex';
        }
    }).catch(err => {
        showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Ошибка сети.</div>`);
        document.getElementById('text-input-row').style.display = 'flex';
    });
}