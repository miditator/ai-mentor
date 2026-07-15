// js/onboarding.js
let onboardingState = {
    step: 'language', // Текущий шаг: 'language' -> 'difficulty'
    language: null,
    difficulty: null
};

// Выбор языка (вызывается при клике на флаги)
function selectLanguage(lang) {
    onboardingState.language = lang;
    document.querySelectorAll('#step-language .option-btn').forEach(b => b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    document.getElementById('btn-next').disabled = false; // Разблокируем кнопку "Далее"
}

// Выбор сложности (вызывается при клике на уровни)
function selectDifficulty(diff) {
    onboardingState.difficulty = diff;
    document.querySelectorAll('#step-difficulty .option-btn').forEach(b => b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    document.getElementById('btn-next').disabled = false; // Разблокируем кнопку "Начать"
}

// Обработка кнопки "Далее / Начать обучение"
function handleNextStep() {
    if (onboardingState.step === 'language') {
        // Переключаем интерфейс на шаг выбора сложности
        onboardingState.step = 'difficulty';
        document.getElementById('step-language').style.display = 'none';
        document.getElementById('step-difficulty').style.display = 'block';

        document.getElementById('onboard-title').innerText = 'Сложность';
        document.getElementById('onboard-subtitle').innerText = 'Шаг 2 из 2: Твой текущий уровень?';
        document.getElementById('btn-next').innerText = 'Начать обучение 🚀';
        document.getElementById('btn-next').disabled = true; // Снова блокируем, пока не выберет уровень
    } else if (onboardingState.step === 'difficulty') {
        saveOnboardingData();
    }
}

// Отправка результатов опроса в FastAPI
function saveOnboardingData() {
    const btn = document.getElementById('btn-next');
    btn.disabled = true;
    btn.innerText = 'Настраиваем ИИ... ⚙️';

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
            // Запрашиваем свежий профиль после сохранения настроек
            return apiFetch(`/profile?chat_id=${user.id}`);
        } else {
            throw new Error('Не удалось сохранить настройки бэкэндом');
        }
    })
    .then(profileData => {
        showProfileData(profileData);
        switchScreen('screen-main'); // Переключаем на личный кабинет
    })
    .catch(err => {
        alert('Ошибка при сохранении: ' + err.message);
        btn.disabled = false;
        btn.innerText = 'Начать обучение 🚀';
    });
}