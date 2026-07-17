// frontend/js/tasks.js

let trainingState = {
    words: [],
    currentIndex: 0,
    swapped: false,       // Направление перевода
    guessesNeeded: 3,     // Сколько раз угадать
    currentGuesses: 0     // Сколько уже угадали
};

// Функция переключения направления
function toggleSwap() {
    trainingState.swapped = !trainingState.swapped;
    addMessageToOutput(`<i>Режим изменен: ${trainingState.swapped ? "🇷🇺 Русский → 🇬🇧 Иностр." : "🇬🇧 Иностр. → 🇷🇺 Русский"}</i>`);
    showCurrentWord();
}

function showNewTaskMode() {
    // ... (код инициализации тот же, что был)
    window.currentAppMode = 'training'; // Меняем режим на тренировочный
    document.getElementById('top-bar').innerText = '📚 Тренировка';
    // ...
    // Запрос слов с сервера (используем тот же endpoint)
    apiFetch(`/train/start?chat_id=${user.id}&count=5`)
        .then(data => {
            trainingState.words = data.words;
            trainingState.currentIndex = 0;
            trainingState.currentGuesses = 0;
            showCurrentWord();
        });
}

function showCurrentWord() {
    const word = trainingState.words[trainingState.currentIndex];
    // Отображаем вопрос в зависимости от режима swap
    const question = trainingState.swapped ? word.ru : word.foreign;
    addMessageToOutput(`Слово ${trainingState.currentIndex + 1}/${trainingState.words.length} (Осталось угадать: ${trainingState.guessesNeeded - trainingState.currentGuesses}):<br><b>${question}</b>`);
}

function handleTaskInput(text) {
    const word = trainingState.words[trainingState.currentIndex];
    // Ответ ожидаем тот, который не является вопросом
    const correctAnswer = trainingState.swapped ? word.foreign : word.ru;

    const isCorrect = text.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    if (isCorrect) {
        trainingState.currentGuesses++;
        addMessageToOutput(`✅ Верно! (${trainingState.currentGuesses}/${trainingState.guessesNeeded})`);

        // Если угадали 3 раза
        if (trainingState.currentGuesses >= trainingState.guessesNeeded) {
            // Отправляем результат в БД через API
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
            }
        }
    } else {
        addMessageToOutput(`❌ Ошибка. Правильно: <b>${correctAnswer}</b>. Попробуйте еще раз.`);
    }
}

function showHelp() {
    const word = trainingState.words[trainingState.currentIndex];
    const answer = trainingState.swapped ? word.foreign : word.ru;
    addMessageToOutput(`💡 Подсказка: <b>${answer}</b>. Продолжаем!`);
}