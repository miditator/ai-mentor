// js/api.js
const BASE_URL = 'https://postal-detention-poker.ngrok-free.dev/api';

// Функция для выполнения запросов с обходом предупреждения ngrok
function apiFetch(endpoint, options = {}) {
    // Автоматически добавляем заголовок ngrok ко всем запросам
    options.headers = {
        ...options.headers,
        "ngrok-skip-browser-warning": "true"
    };

    return fetch(`${BASE_URL}${endpoint}`, options)
        .then(response => {
            if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
            return response.json();
        });
}