// ==========================================
// РЕЖИМ: НОВОЕ ЗАДАНИЕ (tasks.js)
// ==========================================

let taskState = {
    helpClicks: 0
};

// 🎯 Функция для отрисовки карточки задания
function showTaskCard(htmlContent, showHelpBtn = false) {
    const chatContainer = document.getElementById('chat-messages');

    let helpBtnHtml = '';
    // Показываем кнопку Help, если кликов меньше 2
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

    taskState.helpClicks = 0; // Сбрасываем счетчик кликов

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';


    const inputContainer = document.getElementById('input-container');
    inputContainer.style.display = 'flex';
    document.getElementById('text-input-row').style.display = 'flex';
    document.getElementById('confirm-row').style.display = 'none';

    const nextTaskBtn = document.getElementById('btn-next-task');
    nextTaskBtn.style.display = 'block';
    nextTaskBtn.onclick = () => showNewTaskMode(true); // Принудительный сброс

    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.placeholder = "Напиши перевод...";

    showTaskCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
        <div style="font-size: 16px; color: var(--hint-color);">ИИ составляет предложение и тему...</div>
    `);

    const url = `/tasks/new?chat_id=${user.id}${forceNew ? '&force=true' : ''}`;

    apiFetch(url)
        .then(data => {
            if (data.success) {
                // 🎯 Динамически определяем название языка
                const langName = window.userProfile?.language === 'de' ? 'немецкий' : 'английский';

                // Выводим Topic на английском языке (взятый из ответа ИИ)
                showTaskCard(`
                    <div style="font-size: 13px; color: var(--hint-color); margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Переведи на ${langName}:</div>
                    <div style="font-size: 24px; font-weight: bold; color: var(--text-color); margin-bottom: 20px;">${data.phrase}</div>
                    <div style="font-size: 14px; color: var(--text-color); background: rgba(112, 132, 153, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid var(--button-color); text-align: left; width: 100%;">
                        <b>📚 Topic:</b> ${data.rule || "General Grammar"}
                    </div>
                `, true); // true = Показываем кнопку Help
                userInput.focus();
            } else {
                showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">❌</div><div>Ошибка генерации: ${data.error}</div>`);
            }
        })
        
        .catch(err => {
            showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Ошибка связи с сервером.</div>`);
        });
}

// 🎯 ПРАВИЛЬНАЯ ЛОГИКА ПОДСКАЗОК (обращается к /tasks/help)
function showTaskHelp() {
    taskState.helpClicks++;
    let step = taskState.helpClicks;

    showTaskCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🤖</div>
        <div style="font-size: 16px; color: var(--hint-color);">ИИ готовит ${step === 1 ? 'подсказку' : 'подробный ответ'}...</div>
    `);
    document.getElementById('text-input-row').style.display = 'none';

    apiFetch('/tasks/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, step: step })
    }).then(data => {
        if (data.success) {
            if (step === 1) {
                // Шаг 1: Подсказка (оставляем поле ввода открытым)
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">💡</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                    <div style="font-size: 13px; color: var(--hint-color);">Теперь попробуй перевести 👇</div>
                `, true); // Снова показываем кнопку Help, но уже "Сдаюсь"
                document.getElementById('text-input-row').style.display = 'flex';
                document.getElementById('user-input').focus();
            } else {
                // Шаг 2: Сдался (скрываем поле ввода)
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">📖</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                    <div style="font-size: 13px; color: var(--hint-color);">Прочитай объяснение и переходи к новому заданию!</div>
                `, false); // false = больше не показываем кнопку Help
            }
        } else {
            showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">❌</div><div>Ошибка: ${data.error}</div>`);
            document.getElementById('text-input-row').style.display = 'flex';
        }
    }).catch(err => {
        showTaskCard(`<div style="font-size: 40px; margin-bottom: 10px;">⚠️</div><div>Ошибка сети.</div>`);
        document.getElementById('text-input-row').style.display = 'flex';
    });
}

function handleTaskInput(text) {
    showTaskCard(`
        <div style="font-size: 40px; margin-bottom: 15px;">🤖</div>
        <div style="font-size: 16px; color: var(--hint-color);">ИИ проверяет твой вариант...</div>
    `);
    document.getElementById('text-input-row').style.display = 'none';

    apiFetch('/tasks/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, answer: text })
    }).then(data => {
        if (data.success) {
            if (data.is_correct) {
                // Ответ верный
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">✅</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5;">${data.feedback}</div>
                `);
            } else {
                // Ответ неверный — показываем ошибку и оставляем кнопку Help
                showTaskCard(`
                    <div style="font-size: 50px; margin-bottom: 10px;">❌</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; line-height: 1.5; margin-bottom: 15px;">${data.feedback}</div>
                    <div style="font-size: 13px; color: var(--hint-color);">Можешь попробовать еще раз 👇</div>
                `, true);
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