// ==========================================
// ФАЙЛ: frontend/js/settings.js
// ==========================================

function showSettingsMode() {
    window.currentAppMode = 'settings';
    document.getElementById('top-bar').innerText = '⚙️ Настройки';

    // Прячем всё лишнее
    document.getElementById('profile-card').style.display = 'none';
    document.getElementById('action-keyboard').style.display = 'none';
    if (document.getElementById('dictionary-keyboard')) document.getElementById('dictionary-keyboard').style.display = 'none';
    if (document.getElementById('dummy-keyboard')) document.getElementById('dummy-keyboard').style.display = 'none';
    if (document.getElementById('training-menu-keyboard')) document.getElementById('training-menu-keyboard').style.display = 'none';
    if (document.getElementById('input-container')) document.getElementById('input-container').style.display = 'none';

    renderSettingsMenu();
}

// 🎯 Главное меню настроек
function renderSettingsMenu() {
    const chatContainer = document.getElementById('chat-messages');

    const diffMap = { "A1": "Начальный (A1)", "A2": "Элементарный (A2)", "B1": "Средний (B1)", "B2": "Выше среднего (B2)", "C1": "Продвинутый (C1)" };
    const langMap = { "en": "Английский 🇬🇧", "de": "Немецкий 🇩🇪" };

    // Берем данные из профиля
    const currentLang = langMap[window.userProfile?.language] || "Не задан";
    const currentDiff = diffMap[window.userProfile?.difficulty] || "Не задана";
    const currentLimit = window.userProfile?.words_per_day || 10;

    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; width: 100%; box-sizing: border-box;">
            <div style="font-size: 40px; margin-bottom: 15px;">⚙️</div>
            <div style="font-size: 22px; font-weight: bold; color: var(--text-color); margin-bottom: 20px;">Настройки</div>
            
            <!-- СЕКЦИЯ: ЯЗЫК -->
            <div style="width: 100%; text-align: left; margin-bottom: 10px; background: rgba(112, 132, 153, 0.1); padding: 10px; border-radius: 8px; box-sizing: border-box;">
                <span style="color: var(--hint-color); font-size: 13px;">Изучаемый язык:</span><br>
                <b style="color: var(--text-color);">${currentLang}</b>
            </div>
            <button onclick="showLanguageSelector()" style="width: 100%; margin-bottom: 20px; padding: 12px; background: var(--button-color); border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; transition: 0.2s;">
                🌍 Изменить язык
            </button>

            <!-- СЕКЦИЯ: СЛОЖНОСТЬ -->
            <div style="width: 100%; text-align: left; margin-bottom: 10px; background: rgba(112, 132, 153, 0.1); padding: 10px; border-radius: 8px; box-sizing: border-box;">
                <span style="color: var(--hint-color); font-size: 13px;">Текущий уровень:</span><br>
                <b style="color: var(--text-color);">${currentDiff}</b>
            </div>
            <button onclick="showDifficultySelector()" style="width: 100%; margin-bottom: 20px; padding: 12px; background: var(--button-color); border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; transition: 0.2s;">
                📈 Изменить уровень сложности
            </button>
            
            <!-- СЕКЦИЯ: ЛИМИТ -->
            <div style="width: 100%; text-align: left; margin-bottom: 10px; background: rgba(112, 132, 153, 0.1); padding: 10px; border-radius: 8px; box-sizing: border-box;">
                <span style="color: var(--hint-color); font-size: 13px;">Лимит слов в день:</span><br>
                <b style="color: var(--text-color);">${currentLimit} шт.</b>
            </div>
            <button onclick="showLimitSelector()" style="width: 100%; margin-bottom: 25px; padding: 12px; background: var(--button-color); border: none; border-radius: 10px; color: #fff; font-size: 14px; cursor: pointer; transition: 0.2s;">
                🎯 Изменить лимит слов
            </button>
            
            <button onclick="exitToMainMenu()" style="width: 100%; padding: 12px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: 10px; color: #ff3b30; font-size: 14px; cursor: pointer; transition: 0.2s;">
                ❌ Выход в главное меню
            </button>
        </div>
    `;
}

// 🎯 Выбор языка
function showLanguageSelector() {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; width: 100%; box-sizing: border-box;">
            <div style="font-size: 20px; font-weight: bold; color: var(--text-color); margin-bottom: 15px;">Выбери язык обучения</div>
            
            <button onclick="saveSetting('source_lang', 'en')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">🇬🇧 Английский язык</button>
            <button onclick="saveSetting('source_lang', 'de')" class="btn-primary" style="width: 100%; margin-bottom: 20px;">🇩🇪 Немецкий язык</button>

            <button onclick="renderSettingsMenu()" style="width: 100%; padding: 12px; background: rgba(112, 132, 153, 0.1); border: none; border-radius: 10px; color: var(--text-color); font-size: 14px; cursor: pointer;">
                ⬅️ Назад
            </button>
        </div>
    `;
}

// 🎯 Выбор уровня сложности
function showDifficultySelector() {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; width: 100%; box-sizing: border-box;">
            <div style="font-size: 20px; font-weight: bold; color: var(--text-color); margin-bottom: 15px;">Выбери новый уровень</div>
            
            <button onclick="saveSetting('difficulty', 'A1')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">🟢 Начальный (A1)</button>
            <button onclick="saveSetting('difficulty', 'A2')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">🟢 Элементарный (A2)</button>
            <button onclick="saveSetting('difficulty', 'B1')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">🟡 Средний (B1)</button>
            <button onclick="saveSetting('difficulty', 'B2')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">🟡 Выше среднего (B2)</button>
            <button onclick="saveSetting('difficulty', 'C1')" class="btn-primary" style="width: 100%; margin-bottom: 15px;">🔴 Продвинутый (C1)</button>

            <button onclick="renderSettingsMenu()" style="width: 100%; padding: 12px; background: rgba(112, 132, 153, 0.1); border: none; border-radius: 10px; color: var(--text-color); font-size: 14px; cursor: pointer;">
                ⬅️ Назад
            </button>
        </div>
    `;
}

// 🎯 Выбор лимита слов
function showLimitSelector() {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; width: 100%; box-sizing: border-box;">
            <div style="font-size: 20px; font-weight: bold; color: var(--text-color); margin-bottom: 15px;">Слов в день</div>
            
            <button onclick="saveSetting('words_per_day', '5')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">Легко (5 слов)</button>
            <button onclick="saveSetting('words_per_day', '10')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">Нормально (10 слов)</button>
            <button onclick="saveSetting('words_per_day', '15')" class="btn-primary" style="width: 100%; margin-bottom: 8px;">Сложно (15 слов)</button>
            <button onclick="saveSetting('words_per_day', '20')" class="btn-primary" style="width: 100%; margin-bottom: 15px;">Интенсив (20 слов)</button>

            <button onclick="renderSettingsMenu()" style="width: 100%; padding: 12px; background: rgba(112, 132, 153, 0.1); border: none; border-radius: 10px; color: var(--text-color); font-size: 14px; cursor: pointer;">
                ⬅️ Назад
            </button>
        </div>
    `;
}

// 🎯 Сохранение любой настройки
function saveSetting(key, value) {
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--secondary-bg-color); border-radius: 16px; border: 1px solid rgba(112, 132, 153, 0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 20px; margin-top: 20px; width: 100%; box-sizing: border-box;">
            <div style="font-size: 40px; margin-bottom: 15px;">⏳</div>
            <div style="font-size: 16px; color: var(--hint-color);">Сохраняем изменения...</div>
        </div>
    `;

    apiFetch('/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.id, setting_key: key, setting_value: String(value) })
    }).then(data => {
        if(data.success) {
            // 🎯 Синхронизируем локальный стейт
            if (key === 'source_lang') {
                window.userProfile['language'] = value; // В UI профиля ключ называется language
            } else {
                window.userProfile[key] = value;
            }

            // Перерисовываем UI главного экрана и возвращаемся в меню настроек
            updateProfileUI(window.userProfile);
            renderSettingsMenu();
        } else {
            chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">❌ Ошибка: ${data.error}</div>`;
            setTimeout(renderSettingsMenu, 2000);
        }
    }).catch(err => {
        chatContainer.innerHTML = `<div style="text-align:center; padding: 20px;">⚠️ Ошибка сети.</div>`;
        setTimeout(renderSettingsMenu, 2000);
    });
}