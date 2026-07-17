// frontend/js/training.js

let trainingState = {
    words: [],
    currentIndex: 0,
    swapped: false,       // Направление перевода
    guessesNeeded: 3,     // Сколько раз угадать
    currentGuesses: 0     // Сколько раз уже угадали это слово
};

// Функция переключения направления
function toggleSwap() {
    trainingState.swapped = !trainingState.swapped;
    addMessageToOutput(`<i>Режим изменен: ${trainingState.swapped ? "🇷🇺 Русский → 🇬🇧 Иностр." : "🇬🇧 Иностр. → 🇷🇺 Русский"}</i>`);
    showCurrentWord();
}

function startTraining(count) {
    document.getElementById('training-menu-keyboard').style.display = 'none';
    document.getElementById('training-active-keyboard').style.display = 'grid';
    document.getElementById('input-container').style.display = 'flex';
    document.getElementById('user-input').placeholder = "Перевод...";

    apiFetch(`/train/start?chat_id=${user.id}&count=${count}`)
        .then(data => {
            if (data.success && data.words && data.words.length > 0) {
                trainingState.words = data.words;
                trainingState.currentIndex = 0;
                trainingState.currentGuesses = 0;
                showCurrentWord();
            } else {
                addMessageToOutput("Нет слов для тренировки.");
            }
        });
}

function showCurrentWord() {
    const word = trainingState.words[trainingState.currentIndex];
    const question = trainingState.swapped ? word.ru : word.foreign;
    addMessageToOutput(`Слово ${trainingState.currentIndex + 1}/${trainingState.words.length} (Осталось угадать: ${trainingState.guessesNeeded - trainingState.currentGuesses}):<br><b>${question}</b>`);
}

function handleTrainingInput(text) {
    const word = trainingState.words[trainingState.currentIndex];
    const correctAnswer = trainingState.swapped ? word.foreign : word.ru;

    const isCorrect = text.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    if (isCorrect) {
        trainingState.currentGuesses++;
        addMessageToOutput(`✅ Верно! (${trainingState.currentGuesses}/${trainingState.guessesNeeded})`);

        // Если угадали нужное кол-во раз
        if (trainingState.currentGuesses >= trainingState.guessesNeeded) {
            // Отправляем результат в БД
            apiFetch('/train/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: user.id, word_id: word.id, is_correct: true })
            });

            trainingState.currentIndex++;
            trainingState.currentGuesses = 0;

            if (trainingState.currentIndex < trainingState.words.length) {
                setTimeout(showCurrentWord, 1000);
            } else {
                addMessageToOutput("🎉 Тренировка завершена!");
                document.getElementById('input-container').style.display = 'none';
            }
        }
    } else {
        addMessageToOutput(`❌ Ошибка. Правильно: <b>${correctAnswer}</b>. Попробуй еще раз.`);
    }
}

function showHelp() {
    const word = trainingState.words[trainingState.currentIndex];
    const answer = trainingState.swapped ? word.foreign : word.ru;
    addMessageToOutput(`💡 Подсказка: <b>${answer}</b>. Продолжаем тренировку!`);
}