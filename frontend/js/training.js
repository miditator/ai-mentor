// frontend/js/training.js

let trainingState = {
    words: [],
    currentIndex: 0,
    swapped: true // 1) ИЗМЕНЕНИЕ: Теперь по умолчанию стоит TRUE (Русский -> Иностранный)
};

function showTrainingMenu() {
    window.currentAppMode = 'training';
    document.getElementById('top-bar').innerText = '📚 Тренировка';

    // Скрываем все лишнее
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('input-container').style.display = 'none';
    document.getElementById('dictionary-keyboard').style.display = 'none';

    // Показываем меню выбора количества слов
    document.getElementById('training-menu-keyboard').style.display = 'grid';
    document.getElementById('chat-messages').innerHTML = 'Выберите количество слов для тренировки:';
}

function toggleSwap() {
    trainingState.swapped = !trainingState.swapped;
    addMessageToOutput(`<i>Режим изменен: ${trainingState.swapped ? "🇷🇺 Русский → 🇬🇧 Иностр." : "🇬🇧 Иностр. → 🇷🇺 Русский"}</i>`);

    // Если тренировка уже идет, обновляем интерфейс для текущего слова
    if (trainingState.words.length > 0 && trainingState.currentIndex < trainingState.words.length) {
        showCurrentWord();
    }
}

function startTraining(count) {
    document.getElementById('training-menu-keyboard').style.display = 'none';
    document.getElementById('training-active-keyboard').style.display = 'grid';
    document.getElementById('input-container').style.display = 'flex';
    document.getElementById('user-input').placeholder = "Перевод...";

    apiFetch(`/train/start?chat_id=${user.id}&count=${count}`)
        .then(data => {
            if (data.success && data.words && data.words.length > 0) {
                // Добавляем счетчик успешных угадываний (correctGuesses) каждому слову
                trainingState.words = data.words.map(w => ({ ...w, correctGuesses: 0 }));
                trainingState.currentIndex = 0;
                showCurrentWord();
            } else {
                addMessageToOutput("Нет слов для тренировки.");
            }
        });
}

function showCurrentWord() {
    // Проверяем, не закончились ли слова в очереди
    if (trainingState.currentIndex >= trainingState.words.length) {
        addMessageToOutput("🎉 <b>Тренировка успешно завершена!</b>");
        document.getElementById('input-container').style.display = 'none';
        return;
    }

    const wordObj = trainingState.words[trainingState.currentIndex];
    const question = trainingState.swapped ? wordObj.ru : wordObj.foreign;
    const leftToGuess = 3 - wordObj.correctGuesses;

    addMessageToOutput(`Слово ${trainingState.currentIndex + 1}/${trainingState.words.length} (Осталось угадать: ${leftToGuess}):<br><b>${question}</b>`);
}

function handleTrainingInput(text) {
    if (trainingState.currentIndex >= trainingState.words.length) return;

    const wordObj = trainingState.words[trainingState.currentIndex];
    const correctAnswer = trainingState.swapped ? wordObj.foreign : wordObj.ru;

    // Сравниваем текст
    const isCorrect = text.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

    if (isCorrect) {
        wordObj.correctGuesses++;

        if (wordObj.correctGuesses >= 3) {
            addMessageToOutput(`✅ <b>Верно!</b> Слово выучено!`);
            // Слово выучено 3 раза — фиксируем в базе данных
            apiFetch('/train/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: true })
            });
        } else {
            addMessageToOutput(`✅ <b>Верно!</b>`);
            // Угадали, но меньше 3 раз. Кидаем слово в конец очереди (Карусель)
            trainingState.words.push({ ...wordObj });
        }
    } else {
        addMessageToOutput(`❌ Ошибка. Правильно: <b>${correctAnswer}</b>.`);

        // Ошибка: фиксируем в базе (сброс прогресса интервального повторения)
        apiFetch('/train/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
        });

        // Сбрасываем локальный счетчик и кидаем слово в конец очереди
        wordObj.correctGuesses = 0;
        trainingState.words.push({ ...wordObj });
    }

    // 2) ИЗМЕНЕНИЕ: Убрана задержка. Сразу же переходим к следующему слову
    trainingState.currentIndex++;
    showCurrentWord();
}

function showHelp() {
    if (trainingState.currentIndex >= trainingState.words.length) return;

    const wordObj = trainingState.words[trainingState.currentIndex];
    const answer = trainingState.swapped ? wordObj.foreign : wordObj.ru;

    addMessageToOutput(`💡 Подсказка: <b>${answer}</b>.`);

    // Использование подсказки приравнивается к ошибке (сброс в БД)
    apiFetch('/train/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
    });

    // Сбрасываем счетчик и кидаем слово в конец очереди
    wordObj.correctGuesses = 0;
    trainingState.words.push({ ...wordObj });

    // 3) ИЗМЕНЕНИЕ: Убрана задержка. Сразу же переходим к следующему слову
    trainingState.currentIndex++;
    showCurrentWord();
}