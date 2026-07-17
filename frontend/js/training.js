// frontend/js/training.js

let trainingState = {
    activeRound: [],    // Слова в текущем круге
    nextRound: [],      // Слова, которые перейдут на следующий круг
    currentIndex: 0,
    swapped: true,      // По умолчанию Русский -> Иностранный
    totalWords: 0,      // Всего уникальных слов в начале тренировки
    completedWords: 0   // Сколько слов уже полностью выучено
};

// 🎯 Функция для перемешивания массива (Алгоритм Фишера-Йетса)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showTrainingMenu() {
    window.currentAppMode = 'training';
    document.getElementById('top-bar').innerText = '📚 Тренировка';

    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('dictionary-keyboard').style.display = 'none';

    document.getElementById('training-menu-keyboard').style.display = 'grid';
    document.getElementById('chat-messages').innerHTML = 'Выберите количество слов для тренировки:';
}

function toggleSwap() {
    trainingState.swapped = !trainingState.swapped;
    if (trainingState.activeRound.length > 0 && trainingState.currentIndex < trainingState.activeRound.length) {
        showCurrentWord();
    }
}

function startTraining(count) {
    console.log("Запуск тренировки. Выбрано слов (count):", count); // 🔥 ДЕБАГ
    document.getElementById('training-menu-keyboard').style.display = 'none';
    document.getElementById('training-active-keyboard').style.display = 'grid';
    document.getElementById('input-container').style.display = 'flex';
    document.getElementById('user-input').placeholder = "Перевод...";

    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--hint-color);"><i>⏳ Загрузка слов...</i></div>';

    const url = `/train/start?chat_id=${user.id}&count=${count}`;
    console.log("Уходящий URL:", url); // 🔥 ДЕБАГ

    apiFetch(`/train/start?chat_id=${user.id}&count=${count}`)
        .then(data => {
            if (data.success && data.words && data.words.length > 0) {
                // Инициализируем первый круг (можно сразу перемешать стартовые слова)
                trainingState.activeRound = shuffleArray(data.words.map(w => ({ ...w, correctGuesses: 0 })));
                trainingState.nextRound = [];
                trainingState.currentIndex = 0;

                trainingState.totalWords = data.words.length;
                trainingState.completedWords = 0;

                showCurrentWord();
            } else {
                chatContainer.innerHTML = '<div style="text-align:center; padding: 20px;">Нет слов для тренировки.</div>';
            }
        })
        .catch(err => {
            chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Ошибка сети при загрузке.</div>`;
        });
}

function showFlashMessage(htmlContent, delay = 1000) {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px;">
            ${htmlContent}
        </div>`;

    setTimeout(() => {
        trainingState.currentIndex++;
        showCurrentWord();
    }, delay);
}

function showCurrentWord() {
    const chatContainer = document.getElementById('chat-messages');

    // 🎯 Проверяем, закончился ли текущий круг
    if (trainingState.currentIndex >= trainingState.activeRound.length) {

        // Если слов на следующий круг не осталось — тренировка завершена
        if (trainingState.nextRound.length === 0) {
            chatContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px;">
                    <div style="font-size: 60px; margin-bottom: 15px;">🎉</div>
                    <div style="font-size: 22px; font-weight: bold; color: var(--text-color);">Тренировка завершена!</div>
                    <div style="font-size: 14px; color: var(--hint-color); margin-top: 10px;">Выучено слов: ${trainingState.totalWords}</div>
                </div>`;
            document.getElementById('input-container').style.display = 'none';
            return;
        } else {
            // Если слова остались: ПЕРЕМЕШИВАЕМ ИХ и запускаем новый круг!
            trainingState.activeRound = shuffleArray([...trainingState.nextRound]);
            trainingState.nextRound = [];
            trainingState.currentIndex = 0;
        }
    }

    const wordObj = trainingState.activeRound[trainingState.currentIndex];
    const question = trainingState.swapped ? wordObj.ru : wordObj.foreign;
    const leftToGuess = 3 - (wordObj.correctGuesses || 0);

    const wordsLeft = trainingState.totalWords - trainingState.completedWords;

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; position: relative;">
            
            <div style="position: absolute; top: 15px; left: 0; width: 100%; text-align: center; font-size: 12px; color: var(--hint-color); text-transform: uppercase; letter-spacing: 1px;">
                Осталось слов: <b>${wordsLeft}</b> из ${trainingState.totalWords}
            </div>

            <div style="font-size: 32px; font-weight: bold; color: var(--text-color); text-align: center; margin-top: 20px; margin-bottom: 25px; word-wrap: break-word; width: 100%;">${question}</div>
            
            <div style="font-size: 14px; color: var(--hint-color); background: rgba(112, 132, 153, 0.1); padding: 6px 14px; border-radius: 12px;">
                Осталось угадать: <b>${leftToGuess}</b>
            </div>
        </div>`;
}

function handleTrainingInput(text) {
    try {
        if (trainingState.currentIndex >= trainingState.activeRound.length) return;

        const wordObj = trainingState.activeRound[trainingState.currentIndex];
        const correctAnswer = String(trainingState.swapped ? wordObj.foreign : wordObj.ru || '');
        const isCorrect = text.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

        if (isCorrect) {
            wordObj.correctGuesses = (wordObj.correctGuesses || 0) + 1;

            if (wordObj.correctGuesses >= 3) {
                trainingState.completedWords++;

                showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">✅</div><div style="font-size: 22px; font-weight: bold; color: #34c759; text-align: center;">Слово выучено!</div>`, 1000);

                apiFetch('/train/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: true })
                });
            } else {
                showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">✅</div><div style="font-size: 22px; font-weight: bold; color: #34c759; text-align: center;">Верно!</div>`, 800);

                // Слово отгадано, но не до конца. Кидаем в следующий круг!
                trainingState.nextRound.push({ ...wordObj });
            }
        } else {
            showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">❌</div><div style="font-size: 16px; color: #ff3b30; text-align: center;">Ошибка! Правильно:</div><div style="font-size: 26px; font-weight: bold; color: var(--text-color); margin-top: 10px; text-align: center;">${correctAnswer}</div>`, 2000);

            apiFetch('/train/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
            });

            wordObj.correctGuesses = 0;
            // Ошибка. Кидаем в следующий круг!
            trainingState.nextRound.push({ ...wordObj });
        }
    } catch (error) {
        document.getElementById('chat-messages').innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Внутренняя ошибка скрипта.</div>`;
    }
}

function showHelp() {
    try {
        if (trainingState.currentIndex >= trainingState.activeRound.length) return;

        const wordObj = trainingState.activeRound[trainingState.currentIndex];
        const answer = String(trainingState.swapped ? wordObj.foreign : wordObj.ru || '');

        showFlashMessage(`<div style="font-size: 50px; margin-bottom: 10px;">💡</div><div style="font-size: 16px; color: var(--hint-color); text-align: center;">Подсказка:</div><div style="font-size: 28px; font-weight: bold; color: var(--button-color); margin-top: 5px; text-align: center;">${answer}</div>`, 2000);

        apiFetch('/train/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
        });

        wordObj.correctGuesses = 0;

        // Подсмотрел ответ. Кидаем в следующий круг!
        trainingState.nextRound.push({ ...wordObj });
    } catch (error) {
        document.getElementById('chat-messages').innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Внутренняя ошибка скрипта.</div>`;
    }
}