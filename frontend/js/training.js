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
    addMessageToOutput(`<i>Режим изменен: ${trainingState.swapped ? "🇷🇺 Русский → 🇬🇧 Иностр." : "🇬🇧 Иностр. → 🇷🇺 Русский"}</i>`);

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
                trainingState.words = data.words.map(w => ({ ...w, correctGuesses: 0 }));
                trainingState.currentIndex = 0;
                showCurrentWord();
            } else {
                addMessageToOutput("Нет слов для тренировки.");
            }
        })
        .catch(err => addMessageToOutput(`⚠️ Ошибка сети при загрузке: ${err.message}`));
}

function showCurrentWord() {
    if (trainingState.currentIndex >= trainingState.words.length) {
        addMessageToOutput("🎉 <b>Тренировка успешно завершена!</b>");
        document.getElementById('input-container').style.display = 'none';
        return;
    }

    const wordObj = trainingState.words[trainingState.currentIndex];
    const question = trainingState.swapped ? wordObj.ru : wordObj.foreign;
    const leftToGuess = 3 - (wordObj.correctGuesses || 0);

    addMessageToOutput(`Слово ${trainingState.currentIndex + 1}/${trainingState.words.length} (Осталось угадать: ${leftToGuess}):<br><b>${question}</b>`);
}

function handleTrainingInput(text) {
    try {
        if (trainingState.currentIndex >= trainingState.words.length) return;

        const wordObj = trainingState.words[trainingState.currentIndex];

        // Надежно получаем правильный ответ в виде строки
        const correctAnswer = String(trainingState.swapped ? wordObj.foreign : wordObj.ru || '');

        const isCorrect = text.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

        if (isCorrect) {
            wordObj.correctGuesses = (wordObj.correctGuesses || 0) + 1;

            if (wordObj.correctGuesses >= 3) {
                addMessageToOutput(`✅ <b>Верно!</b> Слово пройдено!`);
                apiFetch('/train/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: true })
                });
            } else {
                addMessageToOutput(`✅ <b>Верно!</b>`);
                trainingState.words.push({ ...wordObj });
            }
        } else {
            addMessageToOutput(`❌ Ошибка. Правильно: <b>${correctAnswer}</b>.`);
            apiFetch('/train/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
            });

            wordObj.correctGuesses = 0;
            trainingState.words.push({ ...wordObj });
        }

        trainingState.currentIndex++;

        // Даем полсекунды паузы перед показом следующего слова
        setTimeout(showCurrentWord, 500);
    } catch (error) {
        // Если что-то сломается, бот напишет ошибку прямо на экран!
        addMessageToOutput(`⚠️ Внутренняя ошибка скрипта: ${error.message}`);
    }
}

function showHelp() {
    try {
        if (trainingState.currentIndex >= trainingState.words.length) return;

        const wordObj = trainingState.words[trainingState.currentIndex];
        const answer = String(trainingState.swapped ? wordObj.foreign : wordObj.ru || '');

        addMessageToOutput(`💡 Подсказка: <b>${answer}</b>.`);

        apiFetch('/train/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.id, word_id: wordObj.id, is_correct: false })
        });

        wordObj.correctGuesses = 0;
        trainingState.words.push({ ...wordObj });

        trainingState.currentIndex++;

        // Даем полсекунды паузы
        setTimeout(showCurrentWord, 500);
    } catch (error) {
        addMessageToOutput(`⚠️ Внутренняя ошибка скрипта: ${error.message}`);
    }
}