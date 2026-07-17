let trainingState = { words: [], currentIndex: 0 };

function showTrainingMenu() {
    window.currentAppMode = 'training';
    document.getElementById('top-bar').innerText = '📚 Тренировка';
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('chat-messages').innerHTML = 'Выберите количество слов:';

    document.getElementById('action-keyboard').style.display = 'none';
    document.getElementById('training-menu-keyboard').style.display = 'grid';
}

function startTraining(count) {
    document.getElementById('training-menu-keyboard').style.display = 'none';
    document.getElementById('training-active-keyboard').style.display = 'grid';
    document.getElementById('input-container').style.display = 'flex';
    document.getElementById('user-input').placeholder = "Перевод...";

    apiFetch(`/train/start?chat_id=${user.id}&count=${count}`)
        .then(data => {
            if (data.success && data.words.length > 0) {
                trainingState.words = data.words;
                trainingState.currentIndex = 0;
                showCurrentWord();
            } else {
                addMessageToOutput("Нет слов для тренировки.");
            }
        });
}

function showCurrentWord() {
    const word = trainingState.words[trainingState.currentIndex];
    addMessageToOutput(`Слово ${trainingState.currentIndex + 1}/${trainingState.words.length}:<br><b>${word.foreign}</b>`);
}

function handleTrainingInput(text) {
    const word = trainingState.words[trainingState.currentIndex];
    const isCorrect = text.toLowerCase().trim() === word.ru.toLowerCase().trim();

    // Отправляем результат на сервер
    apiFetch('/train/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, word_id: word.id, is_correct: isCorrect })
    });

    if (isCorrect) {
        addMessageToOutput("✅ Верно!");
    } else {
        addMessageToOutput(`❌ Ошибка. Правильно: <b>${word.ru}</b>`);
    }

    trainingState.currentIndex++;
    if (trainingState.currentIndex < trainingState.words.length) {
        setTimeout(showCurrentWord, 1500);
    } else {
        addMessageToOutput("🎉 Тренировка завершена!");
    }
}

function showHelp() {
    const word = trainingState.words[trainingState.currentIndex];
    addMessageToOutput(`💡 Подсказка: ${word.ru}`);
}