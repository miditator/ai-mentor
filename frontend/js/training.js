// frontend/js/training.js

let trainingState = {
    words: [],
    currentIndex: 0,
    swapped: true // По умолчанию Русский -> Иностранный
};

function showTrainingMenu() {
    window.currentAppMode = 'training';
    document.getElementById('top-bar').innerText = '📚 Тренировка';

    // Скрываем все лишнее
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('dictionary-keyboard').style.display = 'none';

    // Показываем меню
    document.getElementById('training-menu-keyboard').style.display = 'grid';
    document.getElementById('chat-messages').innerHTML = 'Выберите количество слов для тренировки:';
}

function toggleSwap() {
    trainingState.swapped = !trainingState.swapped;
    // При смене языка просто перерисовываем карточку
    if (trainingState.words.length > 0 && trainingState.currentIndex < trainingState.words.length) {
        showCurrentWord();
    }
}

function startTraining(count) {
    document.getElementById('training-menu-keyboard').style.display = 'none';
    document.getElementById('training-active-keyboard').style.display = 'grid';
    document.getElementById('input-container').style.display = 'flex';
    document.getElementById('user-input').placeholder = "Перевод...";

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--hint-color);"><i>⏳ Загрузка слов...</i></div>';

    apiFetch(`/train/start?chat_id=${user.id}&count=${count}`)
        .then(data => {
            if (data.success && data.words && data.words.length > 0) {
                trainingState.words = data.words.map(w => ({ ...w, correctGuesses: 0 }));
                trainingState.currentIndex = 0;
                showCurrentWord();
            } else {
                chatContainer.innerHTML = '<div style="text-align:center; padding: 20px;">Нет слов для тренировки.</div>';
            }
        })
        .catch(err => {
            chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Ошибка сети при загрузке.</div>`;
        });
}

// 🎯 Функция для отображения промежуточных экранов (Успех/Ошибка/Подсказка)
function showFlashMessage(htmlContent, delay = 1000) {
    const chatContainer = document.getElementById('chat-messages');

    // Рисуем карточку с результатом
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px;">
            ${htmlContent}
        </div>`;

    // Ждем delay миллисекунд и показываем следующее слово
    setTimeout(() => {
        trainingState.currentIndex++;
        showCurrentWord();
    }, delay);
}

function showCurrentWord() {
    const chatContainer = document.getElementById('chat-messages');

    // Если слова закончились
    if (trainingState.currentIndex >= trainingState.words.length) {
        chatContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px;">
                <div style="font-size: 60px; margin-bottom: 15px;">🎉</div>
                <div style="font-size: 22px; font-weight: bold; color: var(--text-color);">Тренировка завершена!</div>
            </div>`;
        document.getElementById('input-container').style.display = 'none';
        return;
    }

    const wordObj = trainingState.words[trainingState.currentIndex];
    const question = trainingState.swapped ? wordObj.ru : wordObj.foreign;
    const leftToGuess = 3 - (wordObj.correctGuesses || 0);

    // Рисуем главную карточку со словом по центру
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px;">
            <div style="font-size: 13px; color: var(--hint-color); margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Переведи слово:</div>
            <div style="font-size: 32px; font-weight: bold; color: var(--text-color); text-align: center; margin-bottom: 25px; word-wrap: break-word; width: 100%;">${question}</div>
            <div style="font-size: 14px; color: var(--hint-color); background: rgba(112, 132, 153, 0.1); padding: 6px 14px; border-radius: 12px;">Осталось угадать: <b>${leftToGuess}</b></div>
        </div>`;
}

function handleTrainingInput(text) {
    try {
        if (trainingState.currentIndex >= trainingState.words.length) return;

        const wordObj = trainingState.words[trainingState.currentIndex];
        const correctAnswer = String(trainingState.swapped ? wordObj.foreign : wordObj.ru || '');
        const isCorrect = text.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

        if (isCorrect) {
            wordObj.correctGuesses = (wordObj.correctGuesses || 0) + 1;

            if (wordObj.correctGuesses >= 3) {
                // Если угадали 3 раза
                showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">✅</div><div style="font-size: 22px; font-weight: bold; color: #34c759; text-align: center;">Слово выучено!</div>`, 1000);

                apiFetch('/train/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: true })
                });
            } else {
                // Если угадали 1 или 2 раза
                showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">✅</div><div style="font-size: 22px; font-weight: bold; color: #34c759; text-align: center;">Верно!</div>`, 800);
                trainingState.words.push({ ...wordObj }); // Карусель
            }
        } else {
            // Ошибка
            showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">❌</div><div style="font-size: 16px; color: #ff3b30; text-align: center;">Ошибка! Правильно:</div><div style="font-size: 26px; font-weight: bold; color: var(--text-color); margin-top: 10px; text-align: center;">${correctAnswer}</div>`, 2000);

            apiFetch('/train/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
            });

            wordObj.correctGuesses = 0; // Сброс
            trainingState.words.push({ ...wordObj }); // Карусель
        }
    } catch (error) {
        document.getElementById('chat-messages').innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Внутренняя ошибка скрипта.</div>`;
    }
}

function showHelp() {
    try {
        if (trainingState.currentIndex >= trainingState.words.length) return;

        const wordObj = trainingState.words[trainingState.currentIndex];
        const answer = String(trainingState.swapped ? wordObj.foreign : wordObj.ru || '');

        // Показываем подсказку на 2 секунды, затем АВТОМАТИЧЕСКИ переходим дальше
        showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">💡</div><div style="font-size: 16px; color: var(--hint-color); text-align: center;">Подсказка:</div><div style="font-size: 28px; font-weight: bold; color: var(--button-color); margin-top: 5px; text-align: center;">${answer}</div>`, 2000);

        apiFetch('/train/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
        });

        wordObj.correctGuesses = 0;
        trainingState.words.push({ ...wordObj });
    } catch (error) {
        document.getElementById('chat-messages').innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Внутренняя ошибка скрипта.</div>`;
    }
}