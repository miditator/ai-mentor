// js/app.js
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Растягиваем Mini App на весь экран телефона

// Извлекаем данные пользователя из Telegram (или ставим тестовый ID для локальных тестов в браузере)
let user = tg.initDataUnsafe?.user || { id: 8407744578, first_name: "Пользователь (Резерв)" };
document.getElementById('username').innerText = user.first_name;

// Функция для плавного переключения экранов
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Заполнение профиля данными на главном экране
function showProfileData(data) {
    const diffMap = { "1": "Легкий (A1-A2)", "2": "Средний (B1-B2)", "3": "Сложный (C1-C2)" };
    const langMap = { "en": "Английский 🇬🇧", "de": "Немецкий 🇩🇪" };

    document.getElementById('user-lang').innerText = langMap[data.language] || data.language;
    document.getElementById('user-diff').innerText = diffMap[data.difficulty] || data.difficulty;
    document.getElementById('user-words').innerText = data.words_count;
    document.getElementById('user-limit').innerText = `${data.words_per_day} шт.`;
}

// ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ПРИ СТАРТЕ ПРИЛОЖЕНИЯ
apiFetch(`/profile?chat_id=${user.id}`)
    .then(data => {
        if (data.is_new_user) {
            // Если профиль не настроен — отправляем на онбординг
            switchScreen('screen-onboarding');
        } else {
            // Если уже заполнен — показываем личный кабинет
            showProfileData(data);
            switchScreen('screen-main');
        }
    })
    .catch(err => {
        document.getElementById('screen-loading').innerHTML = `
            <div class="loader" style="color: #ff4d4d;">
                ⚠️ Ошибка подключения: ${err.message}<br>
                <small style="color: #708499; font-size:11px;">Проверь, запущен ли твой FastAPI и активен ли ngrok туннель</small>
            </div>
        `;
    });