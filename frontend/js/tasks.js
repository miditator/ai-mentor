// ==========================================
// РЕЖИМ: НОВОЕ ЗАДАНИЕ (tasks.js)
// ==========================================

let taskState = {
    helpClicks: 0,
    isRequestingHint: false
};

// 🎯 Вспомогательная функция для отрисовки карточки задания
function showTaskCard(htmlContent, showHelpBtn = false) {
    const chatContainer = document.getElementById('chat-messages');

    let helpBtnHtml = '';
    // Показываем кнопку Help, только если она нужна и кликов меньше 2
    if (showHelpBtn && taskState.helpClicks < 2) {
        let helpText = taskState.helpClicks === 0 ? "💡 Дай подсказку (Словарь)" : "🆘 Сдаюсь (Показать ответ)";
        let btnColor = taskState.helpClicks === 0 ? "rgba(112, 132, 153, 0.1)" : "rgba(255, 59, 48, 0.1)";
        let textColor = taskState.helpClicks === 0 ? "var(--text-color)" : "#ff3b30";

        helpBtnHtml = `
            <button onclick="showTaskHelp()" style="margin-top: 20px; padding: 10px 20px; background: ${btnColor}; border: 1px solid rgba(112, 132, 153, 0.2); border-radius: 10px; color: ${textColor}; font-size: 14px; cursor: pointer; transition: 0.2s;">
                ${helpText}
            </button>
        `;
    }

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            ${htmlContent}
            ${helpBtnHtml}
        </div>`;
}

function showNewTaskMode(forceNew = false) {
    window.currentAppMode = 'task';
    document.getElementById('top-bar').innerText = '🎯 Новое задание';

    // Сбрасываем стейт для нового задания
    taskState.helpClicks = 0;
    taskState.isRequestingHint = false;

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';

    const inputContainer = document.getElementById('input-container');
    inputContainer.style.display = 'flex';
    document.getElementById('text-input-row').style.display = 'flex';
    document.getElementById('confirm-row').style.display = 'none';

    const nextTaskBtn = document.getElementById('btn-next-task');
    nextTaskBtn.style.display = 'block';
    nextTaskBtn.onclick = () => showNewTaskMode(true); // Принудительный сброс задания

    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.placeholder = "Напиши перевод...";

    // 🎨 Карточка загрузки
    showTaskCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
        <div style="font-size: 16px; color: var(--hint-color);">ИИ составляет предложение и правило...</div>
    `);

    const url = `/tasks/new?chat_id=${user.id}${forceNew ? '&force=true' : ''}`;

    apiFetch(url)
        .then(data => {
            if (data.success) {
                // 🎨 Карточка с заданием И ПРАВИЛОМ
                showTaskCard(`
                    <div style="font-size: 13px; color: var(--hint-color); margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Переведи на изучаемый язык:</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-color); margin-bottom: 20px;">${data.phrase}</div>
                    <div style="font-size: 14px; color: var(--text-color); background: rgba(112, 132, 153, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid var(--button-color); text-align: left; width: 100%;">
                        <b>📚 Правило:</b><br>${data.rule || "Общая грамматика"}
                    </div>
                `, true);
                userInput.focus();
            } else {
                showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">❌</div><div>Ошибка генерации: ${data.error}</div>`);
            }
        })
        .catch(err => {
            showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Ошибка связи с сервером.</div>`);
        });
}

// Двухступенчатая кнопка Help
function showTaskHelp() {
    taskState.isRequestingHint = true;

    if (taskState.helpClicks === 0) {
        taskState.helpClicks = 1;
        handleTaskInput("Я не знаю как перевести. Дай подсказку: напиши начальные формы нужных слов (словарь) и объясни правило подробнее. СТРОГО НЕ ПИШИ готовый перевод всего предложения!");
    } else if (taskState.helpClicks === 1) {
        taskState.helpClicks = 2;
        handleTaskInput("Я сдаюсь. Напиши правильный полный перевод этого предложения и коротко объясни почему так.");
    }
}

function handleTaskInput(text) {
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
                // 🎨 Карточка успеха
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">✅</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5;">${data.feedback}</div>
                `);
            } else {
                // Обработка разных типов ответов с ошибкой (реальная ошибка или ответ на хелп)
                if (taskState.isRequestingHint && taskState.helpClicks === 1) {
                    // Это был первый клик по Хелпу (Подсказка)
                    showTaskCard(`
                        <div style="font-size: 50px; margin-bottom: 10px;">💡</div>
                        <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                        <div style="font-size: 13px; color: var(--hint-color);">Теперь попробуй перевести 👇</div>
                    `, true);
                } else if (taskState.isRequestingHint && taskState.helpClicks === 2) {
                    // Это был второй клик по Хелпу (Сдаюсь)
                    showTaskCard(`
                        <div style="font-size: 50px; margin-bottom: 10px;">📖</div>
                        <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                        <div style="font-size: 13px; color: var(--hint-color);">Прочитай объяснение и переходи к новому заданию!</div>
                    `, false);
                } else {
                    // Это реальная ошибка пользователя при попытке перевода
                    showTaskCard(`
                        <div style="font-size: 50px; margin-bottom: 10px;">❌</div>
                        <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                        <div style="font-size: 13px; color: var(--hint-color);">Можешь попробовать еще раз 👇</div>
                    `, true);
                }

                taskState.isRequestingHint = false;
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