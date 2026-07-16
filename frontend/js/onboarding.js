let onboardingState = { language: null, difficulty: null };

function selectLanguage(lang) {
    onboardingState.language = lang;

    // Подсвечиваем кнопку
    document.querySelectorAll('#step-language .option-btn').forEach(b => b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    // Автоматический переход через 0.4 секунды для плавности
    setTimeout(() => {
        document.getElementById('step-language').style.display = 'none';
        document.getElementById('step-difficulty').style.display = 'flex';

        document.getElementById('onboard-title').innerText = 'Сложность';
        document.getElementById('onboard-subtitle').innerText = 'Шаг 2 из 2: Какой у тебя уровень?';
    }, 400);
}

function selectDifficulty(diff) {
    onboardingState.difficulty = diff;

    // Подсвечиваем кнопку
    document.querySelectorAll('#step-difficulty .option-btn').forEach(b => b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    // Автоматическое сохранение через 0.4 секунды
    setTimeout(saveOnboardingData, 400);
}

function saveOnboardingData() {
    switchScreen('screen-loading'); // Показываем экран загрузки

    apiFetch('/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: user.id,
            language: onboardingState.language,
            difficulty: onboardingState.difficulty
        })
    })
    .then(data => {
        if (data.success) {
            return apiFetch(`/profile?chat_id=${user.id}`);
        } else {
            throw new Error('Не удалось сохранить настройки');
        }
    })
    .then(profileData => {
        updateProfileUI(profileData);
        switchScreen('screen-main'); // Открываем главное меню!
    })
    .catch(err => {
        alert('Ошибка при сохранении: ' + err.message);
        switchScreen('screen-onboarding'); // Возвращаем, если ошибка
    });
}