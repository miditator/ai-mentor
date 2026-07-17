// ==========================================
// ФАЙЛ: frontend/js/intensity.js
// ==========================================

let intensityState = {
    word: "",
    phrases: [],
    currentIndex: 0,
    score: 0,
    langName: "" // 'английский' или 'немецкий'
};

// 1. ВХОД В РЕЖИМ (ОЖИДАНИЕ СЛОВА)
function showIntensitySetupMode() {
    window.currentAppMode = 'intensity_setup';
    document.getElementById('top-bar').innerText = '🔥 Интенсив';

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('training-menu-keyboard')) document.getElementById('training-menu-keyboard').style.display = 'none';

    document.getElementById('input-container').style.display = 'flex';
    document.getElementById('text-input-row').style.display = 'flex';

    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.placeholder = "Введите слово...";

    // 🎯 Определяем текущий язык
    const langCode = window.userProfile?.language || 'en';
    const langName = langCode === 'de' ? 'Немецкий' : 'Английский';
    const langFlag = langCode === 'de' ? '🇩🇪' : '🇬🇧';
    const langPrepositional = langCode === 'de' ? 'немецком' : 'английском';

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            <div style="font-size: 50px; margin-bottom: 15px;">🔥</div>
            <div style="font-size: 22px; font-weight: bold; color: var(--text-color); margin-bottom: 15px;">Режим Интенсива</div>
            
            <div style="background: rgba(112, 132, 153, 0.1); padding: 10px 16px; border-radius: 10px; margin-bottom: 15px; font-size: 15px; color: var(--text-color); border: 1px solid rgba(112, 132, 153, 0.2);">
                Тренируем: <b>${langName} ${langFlag}</b>
            </div>

            <div style="font-size: 14px; color: var(--hint-color); line-height: 1.4;">
                Напиши любое слово на <b>${langPrepositional}</b> языке. ИИ придумает с ним 5 предложений возрастающей сложности!
            </div>
        </div>
    `;
    userInput.focus();
}

// 2. ЗАПУСК ГЕНЕРАЦИИ (КОГДА ЮЗЕР ВВЕЛ СЛОВО)
function startIntensity(word) {
    intensityState.word = word.trim();
    if (!intensityState.word) return; // Защита от пустой отправки

    const langCode = window.userProfile?.language || 'en';
    const chatContainer = document.getElementById('chat-messages');

    // 🛡️ ЗАЩИТА: Проверяем раскладку регулярными выражениями
    const isEnglishOnly = /^[a-zA-Z\s\-']+$/.test(intensityState.word);
    const isGermanOnly = /^[a-zA-ZäöüÄÖÜß\s\-']+$/.test(intensityState.word);

    // Если английский, но введены не английские буквы (например, русские)
    if (langCode === 'en' && !isEnglishOnly) {
        document.getElementById('text-input-row').style.display = 'none';
        chatContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; padding: 20px; margin-top: 20px; text-align: center;">
                <div style="font-size: 50px; margin-bottom: 15px;">⚠️</div>
                <div style="font-size: 16px; color: #ff3b30; font-weight: bold;">Упс! Нужна английская раскладка.</div>
                <div style="font-size: 14px; color: var(--hint-color); margin-top: 10px;">Пожалуйста, введи слово на английском языке.</div>
            </div>
        `;
        setTimeout(showIntensitySetupMode, 2500);
        return;
    }

    // Если немецкий, но введены не немецкие буквы
    if (langCode === 'de' && !isGermanOnly) {
        document.getElementById('text-input-row').style.display = 'none';
        chatContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; padding: 20px; margin-top: 20px; text-align: center;">
                <div style="font-size: 50px; margin-bottom: 15px;">⚠️</div>
                <div style="font-size: 16px; color: #ff3b30; font-weight: bold;">Упс! Нужна немецкая раскладка.</div>
                <div style="font-size: 14px; color: var(--hint-color); margin-top: 10px;">Пожалуйста, введи слово на немецком языке.</div>
            </div>
        `;
        setTimeout(showIntensitySetupMode, 2500);
        return;
    }

    // Если проверка пройдена, запускаем ИИ
    intensityState.score = 0;
    intensityState.currentIndex = 0;
    intensityState.langName = langCode === 'de' ? 'немецкий' : 'английский';

    window.currentAppMode = 'intensity_active';
    document.getElementById('text-input-row').style.display = 'none';

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 15px;">🧠</div>
            <div style="font-size: 16px; color: var(--hint-color);">ИИ генерирует 5 фраз со словом <b>${intensityState.word}</b>...<br>Это может занять 5-10 секунд.</div>
        </div>
    `;

    apiFetch('/intensity/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, word: intensityState.word })
    }).then(data => {
        if (data.success) {
            intensityState.phrases = data.phrases;
            showNextIntensityPhrase();
        } else {
            chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">❌ Ошибка: ${data.error}</div>`;
            document.getElementById('text-input-row').style.display = 'flex';
            window.currentAppMode = 'intensity_setup';
        }
    }).catch(err => {
        chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Ошибка сети.</div>`;
        document.getElementById('text-input-row').style.display = 'flex';
        window.currentAppMode = 'intensity_setup';
    });
}

// 3. ПОКАЗ ОЧЕРЕДНОЙ ФРАЗЫ
// 3. ПОКАЗ ОЧЕРЕДНОЙ ФРАЗЫ
function showNextIntensityPhrase() {
    if (intensityState.currentIndex >= 5) {
        showIntensityResult();
        return;
    }

    const currentTask = intensityState.phrases[intensityState.currentIndex];
    const chatContainer = document.getElementById('chat-messages');

    document.getElementById('text-input-row').style.display = 'flex';
    const userInput = document.getElementById('user-input');
    userInput.value = '';
    userInput.placeholder = "Перевод...";
    userInput.focus();

    // 🎯 Определяем язык и флаг из профиля
    const langCode = window.userProfile?.language || 'en';
    const langName = langCode === 'de' ? 'немецкий' : 'английский';
    const langFlag = langCode === 'de' ? '🇩🇪' : '🇬🇧';

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center; position: relative;">
            
            <div style="position: absolute; top: 15px; left: 0; width: 100%; text-align: center; font-size: 12px; color: var(--hint-color); text-transform: uppercase; letter-spacing: 1px;">
                Фраза <b>${intensityState.currentIndex + 1}</b> из 5
            </div>

            <!-- 🔥 Указатель языка с флажком -->
            <div style="font-size: 13px; color: var(--hint-color); margin-top: 20px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;">
                Переведи на ${langName} ${langFlag}:
            </div>

            <div style="font-size: 20px; font-weight: bold; color: var(--text-color); margin-bottom: 20px;">
                ${currentTask.translation}
            </div>

            <div style="font-size: 14px; color: var(--text-color); background: rgba(112, 132, 153, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid var(--button-color); text-align: left; width: 100%; box-sizing: border-box;">
                <b>⚙️ Задание:</b><br>${currentTask.rule}
            </div>
            
            <!-- КНОПКА ПОМОЩИ -->
            <button onclick="showIntensityHelp()" style="width: 100%; margin-top: 15px; padding: 10px; background: rgba(255, 159, 10, 0.1); border: 1px solid rgba(255, 159, 10, 0.3); border-radius: 8px; color: #ff9f0a; font-size: 14px; cursor: pointer; transition: 0.2s;">
                💡 Не знаю (показать ответ)
            </button>
        </div>
    `;
}

// 4. ПРОВЕРКА ОТВЕТА ПОЛЬЗОВАТЕЛЯ
// 4. ПРОВЕРКА ОТВЕТА ПОЛЬЗОВАТЕЛЯ
function handleIntensityInput(text) {
    const currentTask = intensityState.phrases[intensityState.currentIndex];

    document.getElementById('text-input-row').style.display = 'none';
    const chatContainer = document.getElementById('chat-messages');

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
            <div style="font-size: 16px; color: var(--hint-color);">ИИ-Ментор проверяет твой перевод...</div>
        </div>
    `;

    apiFetch('/intensity/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: user.id,
            original_foreign_phrase: currentTask.phrase,
            russian_task_phrase: currentTask.translation,
            user_answer: text
        })
    }).then(data => {
        if (data.success) {
            if (data.is_correct) intensityState.score++;

            const emoji = data.is_correct ? '✅' : '❌';
            const color = data.is_correct ? '#34c759' : '#ff3b30';

            // Если это 5-я фраза (индекс 4), меняем текст на кнопке
            const btnText = (intensityState.currentIndex === 4) ? "Завершить интенсив 🏆" : "Далее ➡️";

            chatContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center; width: 100%; box-sizing: border-box;">
                    <div style="font-size: 50px; margin-bottom: 10px;">${emoji}</div>
                    <div style="font-size: 16px; color: var(--text-color); text-align: left; margin-bottom: 15px; width: 100%;">${data.feedback}</div>
                    <div style="font-size: 14px; color: ${color}; background: rgba(${data.is_correct ? '52, 199, 89' : '255, 59, 48'}, 0.1); padding: 12px; border-radius: 8px; text-align: center; width: 100%; box-sizing: border-box; margin-bottom: 20px;">
                        🎯 <b>Эталон:</b><br>${currentTask.phrase}
                    </div>
                    
                    <button onclick="nextIntensityStep()" style="width: 100%; padding: 12px; background: var(--button-color); border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; transition: 0.2s;">
                        ${btnText}
                    </button>
                </div>
            `;
            // Убрали автоматический переход (setTimeout). Теперь ждем клика!

        } else {
            // При ошибке сервера тоже даем кнопку, а не перекидываем автоматом
            chatContainer.innerHTML = `
                <div style="text-align:center; padding: 20px;">
                    ❌ Ошибка: ${data.error}<br><br>
                    <button onclick="showNextIntensityPhrase()" style="padding: 10px 20px; background: var(--button-color); border: none; border-radius: 8px; color: #fff; cursor: pointer;">Повторить попытку</button>
                </div>`;
        }
    }).catch(err => {
        chatContainer.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                ⚠️ Ошибка сети.<br><br>
                <button onclick="showNextIntensityPhrase()" style="padding: 10px 20px; background: var(--button-color); border: none; border-radius: 8px; color: #fff; cursor: pointer;">Повторить попытку</button>
            </div>`;
    });
}

// ФУНКЦИЯ ДЛЯ КНОПКИ "ДАЛЕЕ"
function nextIntensityStep() {
    intensityState.currentIndex++;
    showNextIntensityPhrase();
}

// 5. ФИНАЛЬНЫЙ ЭКРАН
function showIntensityResult() {
    const chatContainer = document.getElementById('chat-messages');
    document.getElementById('text-input-row').style.display = 'none';

    let medal = "";
    if (intensityState.score === 5) medal = "🥇 Великолепно! Истинный мастер контекста!";
    else if (intensityState.score >= 3) medal = "🥈 Хороший результат! Но есть над чем поработать.";
    else medal = "🥉 Нужно повторить правила, ИИ заметил много ошибок.";

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            <div style="font-size: 60px; margin-bottom: 10px;">🏆</div>
            <div style="font-size: 20px; font-weight: bold; color: var(--text-color); margin-bottom: 15px;">Интенсив завершен!</div>
            <div style="font-size: 16px; color: var(--text-color); margin-bottom: 10px;">Твой результат: <b>${intensityState.score} из 5</b></div>
            <div style="font-size: 14px; color: var(--hint-color); margin-bottom: 25px;">${medal}</div>
            
            <button onclick="exitToMainMenu()" style="width: 100%; padding: 12px; background: var(--button-color); border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer;">
                Вернуться в меню
            </button>
        </div>
    `;
}

// 6. ФУНКЦИЯ ПОМОЩИ (СДАЧИ)
function showIntensityHelp() {
    const currentTask = intensityState.phrases[intensityState.currentIndex];

    // Прячем поле ввода
    document.getElementById('text-input-row').style.display = 'none';
    const chatContainer = document.getElementById('chat-messages');

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
            <div style="font-size: 16px; color: var(--hint-color);">ИИ готовит разбор грамматики...</div>
        </div>
    `;

    apiFetch('/intensity/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: user.id,
            russian_phrase: currentTask.translation,
            foreign_phrase: currentTask.phrase
        })
    }).then(data => {
        if (data.success) {
            const btnText = (intensityState.currentIndex === 4) ? "Завершить интенсив 🏆" : "Далее ➡️";

            chatContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; text-align: center; width: 100%; box-sizing: border-box;">
                    <div style="font-size: 50px; margin-bottom: 10px;">💡</div>
                    
                    <div style="font-size: 14px; color: var(--text-color); text-align: left; margin-bottom: 15px; width: 100%;">
                        <b>Разбор грамматики:</b><br>${data.explanation}
                    </div>
                    
                    <div style="font-size: 14px; color: #ff9f0a; background: rgba(255, 159, 10, 0.1); padding: 12px; border-radius: 8px; text-align: center; width: 100%; box-sizing: border-box; margin-bottom: 20px;">
                        🎯 <b>Правильный ответ:</b><br>${currentTask.phrase}
                    </div>
                    
                    <button onclick="nextIntensityStep()" style="width: 100%; padding: 12px; background: var(--button-color); border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; transition: 0.2s;">
                        ${btnText}
                    </button>
                </div>
            `;
        } else {
            chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">❌ Ошибка: ${data.error}</div>`;
            setTimeout(showNextIntensityPhrase, 2000);
        }
    }).catch(err => {
        chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Ошибка сети.</div>`;
        setTimeout(showNextIntensityPhrase, 2000);
    });
}