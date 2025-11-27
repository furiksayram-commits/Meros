
// ============= АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM =============
let currentUser = JSON.parse(localStorage.getItem('telegram_user')) || null;

// Проверка авторизации при загрузке
function checkAuth() {
  console.log('checkAuth called, currentUser:', currentUser);
  if (currentUser) {
    showUserInfo();
  } else {
    showLoginButton();
  }
}

// Показать информацию о пользователе
function showUserInfo() {
  document.getElementById('user-info').style.display = 'block';
  document.getElementById('user-name').textContent = currentUser.first_name;
  document.getElementById('telegram-login-btn').style.display = 'none';
  document.getElementById('desktop-info-btn').style.display = 'inline-flex';
}

// Показать кнопку входа
function showLoginButton() {
  console.log('showLoginButton called');
  const btn = document.getElementById('telegram-login-btn');
  const userInfo = document.getElementById('user-info');
  const infoBtn = document.getElementById('desktop-info-btn');
  
  if (btn) {
    btn.style.display = 'inline-flex';
    console.log('Login button display set to inline-flex');
  } else {
    console.error('telegram-login-btn element not found');
  }
  
  if (infoBtn) {
    infoBtn.style.display = 'inline-flex';
  }
  
  if (userInfo) {
    userInfo.style.display = 'none';
  }
}

// Открыть модальное окно Telegram авторизации
function openTelegramModal() {
  const modal = document.getElementById('telegram-login-modal');
  modal.style.display = 'grid';
  
  // Загружаем виджет Telegram, если еще не загружен
  const widget = document.getElementById('telegram-login-widget');
  if (!widget.hasChildNodes()) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'MerosSayramBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    widget.appendChild(script);
  }
}

// Закрыть модальное окно
function closeTelegramModal() {
  document.getElementById('telegram-login-modal').style.display = 'none';
}

// Callback после успешной авторизации через Telegram
function onTelegramAuth(user) {
  console.log('Telegram auth:', user);
  
  // Отправляем данные на сервер для проверки
  fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      currentUser = user;
      localStorage.setItem('telegram_user', JSON.stringify(user));
      showUserInfo();
      closeTelegramModal();
      showToastNotification(`Добро пожаловать, ${user.first_name}! 👋`);
    } else {
      alert('Ошибка авторизации');
    }
  })
  .catch(err => {
    console.error('Ошибка:', err);
    alert('Ошибка при авторизации');
  });
}

// Выход
function logout() {
  if (confirm('Выйти из аккаунта?')) {
    currentUser = null;
    localStorage.removeItem('telegram_user');
    showLoginButton();
    showToastNotification('Вы вышли из аккаунта');
  }
}

// Показать корзину с товарами
function showCart() {
  const modal = document.getElementById('cart');
  modal.style.display = 'block';
  renderCart(); // Отрисовываем товары в корзине
}

// ============= ОСНОВНОЙ КОД =============

let PRODUCTS = [];
let CATEGORIES = [];
let currentCategoryId = null;
let currentPage = 1;
const itemsPerPage = 12; // Товаров на странице

const cart = JSON.parse(localStorage.getItem('cart')||'{}');

// Загрузка категорий
async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    if (!response.ok) throw new Error('Ошибка загрузки категорий');
    CATEGORIES = await response.json();
    renderCategories();
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

// Отображение категорий
function renderCategories() {
  const container = document.getElementById('categories-list');
  
  // Добавляем "Все товары"
  let html = `
    <div class="category-item ${!currentCategoryId ? 'active' : ''}" data-category="all" onclick="filterByCategory(null)">
      <span class="category-icon">🏪</span>
      <span>Все товары</span>
    </div>
  `;
  
  // Добавляем остальные категории
  CATEGORIES.forEach(cat => {
    html += `
      <div class="category-item ${currentCategoryId === cat.id ? 'active' : ''}" data-category="${cat.id}" onclick="filterByCategory(${cat.id})">
        <span class="category-icon">${cat.icon || '📦'}</span>
        <span>${cat.name}</span>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Фильтрация по категории
async function filterByCategory(categoryId) {
  currentCategoryId = categoryId;
  currentPage = 1; // Сбрасываем на первую страницу
  renderCategories(); // Обновляем активную категорию
  await loadProducts(categoryId);
  
  // Закрываем мобильное меню после выбора категории
  if (window.innerWidth <= 768) {
    toggleCategoriesMenu();
  }
}

// Переключение мобильного меню категорий
function toggleCategoriesMenu() {
  const sidebar = document.getElementById('categories-sidebar');
  const overlay = document.getElementById('categories-overlay');
  const btn = document.getElementById('hamburger-btn');
  
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
  
  if (sidebar.classList.contains('open')) {
    btn.classList.add('open');
  } else {
    btn.classList.remove('open');
  }
}

// Загрузка товаров из базы данных
async function loadProducts(categoryId = null) {
  try {
    let url = '/api/products';
    if (categoryId) {
      url += `?category_id=${categoryId}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Ошибка загрузки товаров');
    PRODUCTS = await response.json();
    
    // Перемешиваем товары только если показываем все категории
    if (!categoryId) {
      // Fisher-Yates shuffle для всех товаров
      for (let i = PRODUCTS.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [PRODUCTS[i], PRODUCTS[j]] = [PRODUCTS[j], PRODUCTS[i]];
      }
    }
    // Если выбрана конкретная категория - товары остаются по порядку
    
    renderProducts(PRODUCTS);
  } catch (error) {
    console.error('Ошибка:', error);
    alert('Не удалось загрузить товары');
  }
}

function saveCart(){
  localStorage.setItem('cart', JSON.stringify(cart)); 
  renderCart();
}

function renderProducts(list){
  const out = document.getElementById('products'); 
  out.innerHTML='';
  
  // Вычисляем индексы для текущей страницы
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedList = list.slice(startIndex, endIndex);
  
  paginatedList.forEach(p=>{
    const el = document.createElement('div'); 
    el.className='card';
    
    // Используем placeholder если нет изображения
      const imageUrl = p.image || p.img || '/assets/pch.webp';
    
    // Проверяем наличие товара
    const inStock = p.stock === 1 || p.stock === true;
    const priceHtml = inStock 
      ? `<div class="price" style="flex-shrink:0">${p.price.toLocaleString('ru-RU')} ₸</div>`
      : `<div class="out-of-stock" style="flex-shrink:0;color:#ef4444;font-weight:700;font-size:14px">Нет в наличии</div>`;
    
   el.innerHTML = `
  <img src="${imageUrl}" alt="${p.name}" onerror="this.src='/assets/pch.webp'" />
  <div class="body">
    <div style="margin-bottom:8px">
      <div style="font-weight:700;margin-bottom:6px">${p.name}</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center">
      ${priceHtml}
      <button class="btn cart-btn" data-id="${p.id}" ${!inStock ? 'disabled' : ''} title="${inStock ? 'Добавить в корзину' : 'Товар недоступен'}">
        Купить
      </button>
    </div>
  </div>
`;
    out.appendChild(el);
  });
  
  // Обработчики для кнопок "В корзину"
  document.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',e=>{
    const id = Number(e.currentTarget.getAttribute('data-id')); 
    addToCart(id);
  }));
  
  // Рендерим пагинацию
  renderPagination(list.length);
}

// Отрисовка пагинации
function renderPagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginationContainer = document.getElementById('pagination');
  
  if (!paginationContainer) return;
  
  // Скрываем пагинацию если товаров мало
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  let html = '<div class="pagination-wrapper">';
  
  // Кнопка "Предыдущая"
  html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">‹ Назад</button>`;
  
  // Номера страниц
  for (let i = 1; i <= totalPages; i++) {
    // Показываем первую, последнюю и ближайшие к текущей
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="pagination-dots">...</span>`;
    }
  }
  
  // Кнопка "Следующая"
  html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Вперед ›</button>`;
  
  html += '</div>';
  paginationContainer.innerHTML = html;
}

// Переключение страницы
function changePage(page) {
  const totalPages = Math.ceil(PRODUCTS.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderProducts(PRODUCTS);
  
  // Прокручиваем к началу списка товаров
  document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Переменная для хранения ID товара при выборе количества
let selectedProductId = null;

// Открыть модальное окно выбора количества
function openQuantityModal(id) {
  selectedProductId = id;
  const product = PRODUCTS.find(p => p.id === id);
  
  if (!product) return;
  
  // Заполняем информацию о товаре
  document.getElementById('quantity-product-image').src = product.image || product.img || '/assets/pch.webp';
  document.getElementById('quantity-product-name').textContent = product.name;
  document.getElementById('quantity-product-price').textContent = product.price.toLocaleString('ru-RU') + ' ₸';
  
  // Сбрасываем количество на 1
  const quantityInput = document.getElementById('quantity-input');
  quantityInput.value = 1;
  
  // Показываем модальное окно
  document.getElementById('quantity-modal').style.display = 'grid';
  
  // Автоматически фокусируемся на поле ввода и выделяем текст
  setTimeout(() => {
    quantityInput.focus();
    quantityInput.select();
  }, 100);
}

// Закрыть модальное окно выбора количества
function closeQuantityModal() {
  document.getElementById('quantity-modal').style.display = 'none';
  selectedProductId = null;
}

// Увеличить количество
function increaseQuantity() {
  const input = document.getElementById('quantity-input');
  input.value = parseInt(input.value) + 1;
}

// Уменьшить количество
function decreaseQuantity() {
  const input = document.getElementById('quantity-input');
  if (parseInt(input.value) > 1) {
    input.value = parseInt(input.value) - 1;
  }
}

// Подтвердить добавление в корзину
function confirmAddToCart() {
  if (!selectedProductId) return;
  
  const quantity = parseInt(document.getElementById('quantity-input').value);
  
  if (quantity > 0) {
    cart[selectedProductId] = (cart[selectedProductId] || 0) + quantity;
    saveCart(); 
    updateCartCount();
    flashCartCount();
    showToastNotification(`Добавлено ${quantity} шт. в корзину!`);
  }
  
  closeQuantityModal();
}

function addToCart(id){ 
  // Открываем модальное окно выбора количества вместо прямого добавления
  openQuantityModal(id);
}

function removeFromCart(id){ 
  delete cart[id]; 
  saveCart();
  updateCartCount();
}

function changeQty(id, delta){ 
  const newQty = Math.max(0, (cart[id]||0) + delta); 
  if(newQty === 0) {
    delete cart[id]; 
  } else {
    cart[id] = newQty;
  }
  saveCart();
  updateCartCount();
}

function setQty(id, newQty) {
  newQty = parseInt(newQty) || 0;
  if (newQty <= 0) {
    delete cart[id];
  } else {
    cart[id] = newQty;
  }
  saveCart();
  updateCartCount();
}

function renderCart(){
  const itemsBox = document.getElementById('cart-items'); 
  itemsBox.innerHTML='';
  let total=0, count=0;
  
  for(const idStr in cart){
    const id = Number(idStr); 
    const qty = cart[id];
    const p = PRODUCTS.find(x=>x.id===id); 
    if(!p) continue;
    
    count += qty; 
    total += p.price * qty;
    
  // Используем дефолт, если нет изображения
  const imageUrl = p.image || p.img || '/assets/pch.webp';
    
    const it = document.createElement('div'); 
    it.className='cart-item';
    it.innerHTML = `
  <img src="${imageUrl}" onerror="this.src='/assets/pch.png'" />
      <div class="meta">
        <div style="font-weight:700">${p.name}</div>
        <div class="muted">${p.price.toLocaleString('ru-RU')} ₸ × ${qty} = <strong>${(p.price*qty).toLocaleString('ru-RU')} ₸</strong></div>
      </div>
      <div style="text-align:right">
        <div class="qty">
          <button class="btn secondary" data-action="dec" data-id="${id}">-</button>
          <input type="number" inputmode="numeric" pattern="[0-9]*" class="qty-input" value="${qty}" min="1" data-id="${id}" />
          <button class="btn secondary" data-action="inc" data-id="${id}">+</button>
        </div>
        <div style="margin-top:6px">
          <button class="btn secondary" data-action="del" data-id="${id}">Удалить</button>
        </div>
      </div>
    `;
    itemsBox.appendChild(it);
  }
  
  document.getElementById('cart-total').textContent = total.toLocaleString('ru-RU') + ' ₸';
  
  // Обработчики для кнопок +/-
  document.querySelectorAll('[data-action]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const id = Number(e.currentTarget.getAttribute('data-id')); 
      const act = e.currentTarget.getAttribute('data-action');
      if(act==='inc') changeQty(id, 1);
      if(act==='dec') changeQty(id, -1);
      if(act==='del') removeFromCart(id);
    });
  });
  


  
  // Обработчики для ручного ввода количества
  document.querySelectorAll('.qty-input').forEach(input=>{
    // Сохраняем предыдущее значение на случай отмены
    let previousValue = input.value;
    
    input.addEventListener('focus', () => {
      previousValue = input.value;
    });
    
    input.addEventListener('change', e=>{
      const id = Number(e.target.getAttribute('data-id'));
      const newQty = parseInt(e.target.value) || 0;
      
      if (newQty <= 0) {
        // Восстанавливаем предыдущее значение если ввели 0 или отрицательное
        e.target.value = previousValue;
        return;
      }
      
      setQty(id, newQty);
    });
    
    input.addEventListener('keydown', e=>{
      if (e.key === 'Enter') {
        e.target.blur(); // Сохраняем при нажатии Enter
      }
    });
  });
}

function flashCartCount(){ 
  const el = document.getElementById('cart-count'); 
  el.animate([
    {transform:'scale(1)'},
    {transform:'scale(1.25)'},
    {transform:'scale(1)'}
  ], {duration:300}); 
}

// Обновить счетчик корзины
function updateCartCount() {
  let count = 0;
  for (const id in cart) {
    count += cart[id];
  }
  document.getElementById('cart-count').textContent = count;
  
  // Обновляем мобильный счетчик, если он есть
  const mobileCount = document.getElementById('mobile-cart-count');
  if (mobileCount) {
    mobileCount.textContent = count;
    mobileCount.style.display = count > 0 ? 'flex' : 'none';
  }
}

// Инициализация
loadCategories();
loadProducts();
renderCart();

// Поиск
document.getElementById('search').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const filtered = PRODUCTS.filter(p=> (p.name + ' ').toLowerCase().includes(q));
  renderProducts(filtered);
});

document.getElementById('reset').addEventListener('click', ()=>{
  document.getElementById('search').value='';
  currentCategoryId = null;
  renderCategories();
  loadProducts();
});

// Корзина
document.getElementById('open-cart').addEventListener('click', ()=>{ 
  showCart();
});

document.getElementById('clear-cart').addEventListener('click', ()=>{ 
  for(const k in cart) delete cart[k]; 
  saveCart();
  updateCartCount();
});

// Закрытие корзины
document.getElementById('close-cart').addEventListener('click', ()=>{ 
  document.getElementById('cart').style.display = 'none';
});

// Оформление заказа
document.getElementById('checkout').addEventListener('click', async ()=>{
  const keys = Object.keys(cart);
  if (keys.length === 0) {
    alert('Корзина пустая');
    return;
  }

  const cartEl = document.getElementById('cart');
  const modalEl = document.getElementById('modal');

  // Если пользователь авторизован, загружаем его данные
  if (currentUser) {
    try {
      const response = await fetch(`/api/user/${currentUser.id}`);
      if (response.ok) {
        const userData = await response.json();
        console.log('User data loaded:', userData);
        
        // Автоматически заполняем поля
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        document.getElementById('name').value = fullName || currentUser.first_name;
        document.getElementById('phone').value = userData.phone || '';
        document.getElementById('address').value = userData.address || '';
        
        // Меняем подсказку
        const desc = document.getElementById('order-description');
        if (desc) {
          if (userData.phone) {
            desc.textContent = '✅ Ваши данные загружены автоматически. Вы можете их изменить.';
            desc.style.color = '#10b981';
          } else {
            desc.textContent = '📱 Введите ваш номер телефона - он сохранится для следующих заказов.';
            desc.style.color = '#2b6cb0';
          }
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  } else {
    // Очищаем поля для гостя
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('address').value = '';
    
    // Обычная подсказка для гостя
    const desc = document.getElementById('order-description');
    if (desc) {
      desc.textContent = 'Войдите через Telegram, чтобы не вводить данные каждый раз.';
      desc.style.color = '#6b7280';
    }
  }

  cartEl.classList.add('fade-out');

  cartEl.addEventListener('animationend', () => {
    cartEl.style.display = 'none';
    cartEl.classList.remove('fade-out');

    modalEl.style.display = 'grid';
    modalEl.classList.add('fade-in');

    modalEl.addEventListener('animationend', () => {
      modalEl.classList.remove('fade-in');
    }, { once: true });
  }, { once: true });
});

document.getElementById('cancel').addEventListener('click', ()=>{
  document.getElementById('modal').style.display='none';
});

document.getElementById('place').addEventListener('click', async ()=>{
  const placeBtn = document.getElementById('place');
  
  // Проверяем, не обрабатывается ли уже заказ
  if (placeBtn.disabled) {
    return;
  }
  
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if(!name || !phone){
    alert('Введите имя и телефон');
    return;
  }

  // Блокируем кнопку и меняем текст
  placeBtn.disabled = true;
  const originalText = placeBtn.textContent;
  placeBtn.textContent = 'Отправка...';
  placeBtn.style.opacity = '0.6';
  placeBtn.style.cursor = 'not-allowed';

  const total = calculateTotal();
  
  // Добавляем стоимость доставки к общей сумме, если есть геолокация
  const totalWithDelivery = deliveryCost > 0 ? total + deliveryCost : total;
  
  const orderData = {
    name: name,
    phone: phone,
    address: address,
    location: userLocation, // Добавляем координаты если есть
    items: {...cart},
    total: totalWithDelivery,
    delivery_cost: deliveryCost, // Добавляем стоимость доставки
    telegram_id: currentUser?.id || null // Добавляем telegram_id если пользователь авторизован
  };

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      throw new Error('Ошибка сервера');
    }

    const result = await response.json();
    console.log('Заказ сохранен с ID:', result.id);

    // Получаем текущую дату и время
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU');
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Показываем чек
    let receiptHTML = `
      <div style="font-family: 'MS Sans Serif', Arial, sans-serif; max-width: 320px; margin: 0 auto; padding: 20px; background: white;">
        <!-- Шапка -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">" МЕРОС "</div>
          <div style="font-size: 13px;">Телефон: +7 702 913 13 39</div>
        </div>

        <div style="height: 20px;"></div>

        <!-- Номер чека -->
        <div style="text-align: center; font-weight: bold; font-size: 13px; margin-bottom: 5px;">
          ЧЕК НА ПРОДАЖУ № ${result.id}
        </div>
        <div style="text-align: center; font-size: 12px; margin-bottom: 15px;">
          от ${dateStr} ${timeStr}
        </div>

        <!-- Таблица товаров -->
        <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 8px 0; font-size: 12px; margin-bottom: 10px;">
          <div style="margin-bottom: 5px;">Наименование&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Кол-во&nbsp;&nbsp;Цена&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Итог</div>
        </div>

        <!-- Товары -->
        <div style="font-size: 12px;">
    `;

    let itemCount = 0;
    for (const idStr in cart) {
      const id = Number(idStr);
      const qty = cart[id];
      const p = PRODUCTS.find(x => x.id === id);
      if (p) {
        itemCount++;
        const itemTotal = (p.price * qty).toLocaleString('ru-RU');
        const pricePerUnit = p.price.toLocaleString('ru-RU');
        receiptHTML += `
          <div style="margin-bottom: 8px;">
            ${itemCount}). ${p.name} / ${qty} шт. х ${pricePerUnit} = ${itemTotal} ₸
          </div>
        `;
      }
    }

    // Сумма прописью (упрощенная версия)
    const totalInWords = numberToWords(totalWithDelivery);

    receiptHTML += `
        </div>

        <!-- Итого наименований -->
        <div style="font-size: 12px; margin-bottom: 15px;">
          Всего наименований: ${itemCount}
        </div>

        <!-- Итого сумма -->
        <div style="border-top: 1px solid #000; padding-top: 10px; margin-bottom: 5px;">
    `;
    
    // Показываем подытог товаров, если есть доставка
    if (deliveryCost > 0) {
      receiptHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px;">
            <span>Товары:</span>
            <span>${total.toLocaleString('ru-RU')} ₸</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
            <span>Доставка:</span>
            <span>${deliveryCost.toLocaleString('ru-RU')} ₸</span>
          </div>
      `;
    }
    
    receiptHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: bold;">
            <span>ИТОГО:</span>
            <span>${totalWithDelivery.toLocaleString('ru-RU')} ₸</span>
          </div>
        </div>

        <!-- Сумма прописью -->
        <div style="text-align: right; font-size: 10px; color: #666; margin-bottom: 15px;">
          (${totalInWords})
        </div>

        <!-- Данные покупателя -->
        <div style="font-size: 12px; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
          <div style="margin-bottom: 5px;"><strong>Покупатель:</strong> ${name}</div>
          <div style="margin-bottom: 5px;"><strong>Телефон:</strong> ${phone}</div>
          ${address ? `<div><strong>Адрес доставки:</strong> ${address}</div>` : ''}
        </div>

        <!-- Спасибо -->
        <div style="text-align: center; font-weight: bold; font-size: 13px; margin: 20px 0;">
          СПАСИБО ЗА ПОКУПКУ!
        </div>

        <!-- Успешное оформление -->
        <div style="text-align: center; background: #10b981; color: white; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
          <strong>✅ Заказ №${result.id} успешно оформлен!</strong>
        </div>

        <!-- Кнопки -->
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="download-pdf" class="btn secondary">📥 Скачать PDF</button>
          <button id="close-receipt" class="btn">Закрыть</button>
        </div>

        <!-- Продавец -->
        <div style="text-align: center; font-size: 13px; margin-top: 20px; color: #666;">
          Частное лицо
        </div>
      </div>
    `;

    const receiptBox = document.createElement('div');
    receiptBox.className = 'receipt-modal';
    receiptBox.innerHTML = `<div class="receipt-card" id="receipt-card">${receiptHTML}</div>`;
    document.body.appendChild(receiptBox);

    document.getElementById('modal').style.display = 'none';

    // Очищаем корзину
    for (const k in cart) delete cart[k];
    saveCart();
    
    // Сбрасываем кнопку после успешного оформления
    placeBtn.disabled = false;
    placeBtn.textContent = originalText;
    placeBtn.style.opacity = '1';
    placeBtn.style.cursor = 'pointer';

    document.getElementById('close-receipt').addEventListener('click', ()=>{
      receiptBox.remove();
    });

    document.getElementById('download-pdf').addEventListener('click', ()=>{
      const element = document.getElementById('receipt-card');
      const opt = {
        margin:       10,
        filename:     `Чек_заказа_${result.id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a5', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    });

  } catch (error) {
    console.error('Ошибка при оформлении заказа:', error);
    alert('Произошла ошибка при оформлении заказа. Попробуйте еще раз.');
    
    // Разблокируем кнопку при ошибке
    placeBtn.disabled = false;
    placeBtn.textContent = originalText;
    placeBtn.style.opacity = '1';
    placeBtn.style.cursor = 'pointer';
  }
});

// Функция преобразования числа в слова (упрощенная)
function numberToWords(num) {
  const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const thousands = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  
  if (num === 0) return 'ноль тенге';
  
  let result = '';
  
  // Миллионы
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    result += convertLessThanThousand(millions, units, teens, tens, hundreds) + ' миллион ';
    num %= 1000000;
  }
  
  // Тысячи
  if (num >= 1000) {
    const thousandsNum = Math.floor(num / 1000);
    if (thousandsNum >= 100) {
      result += hundreds[Math.floor(thousandsNum / 100)] + ' ';
    }
    const rest = thousandsNum % 100;
    if (rest >= 10 && rest < 20) {
      result += teens[rest - 10] + ' ';
    } else {
      if (rest >= 20) result += tens[Math.floor(rest / 10)] + ' ';
      const lastDigit = rest % 10;
      if (lastDigit > 0) result += thousands[lastDigit] + ' ';
    }
    
    const lastDigit = thousandsNum % 10;
    const lastTwoDigits = thousandsNum % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      result += 'тысяч ';
    } else if (lastDigit === 1) {
      result += 'тысяча ';
    } else if (lastDigit >= 2 && lastDigit <= 4) {
      result += 'тысячи ';
    } else {
      result += 'тысяч ';
    }
    
    num %= 1000;
  }
  
  // Сотни, десятки, единицы
  result += convertLessThanThousand(num, units, teens, tens, hundreds);
  
  return (result.trim() + ' тенге').charAt(0).toUpperCase() + (result.trim() + ' тенге').slice(1);
}

function convertLessThanThousand(num, units, teens, tens, hundreds) {
  let result = '';
  
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)] + ' ';
    num %= 100;
  }
  
  if (num >= 10 && num < 20) {
    result += teens[num - 10] + ' ';
  } else {
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
    }
    if (num % 10 > 0) {
      result += units[num % 10] + ' ';
    }
  }
  
  return result;
}

function calculateTotal(){ 
  let total=0; 
  for(const idStr in cart){ 
    const id = Number(idStr); 
    const qty = cart[id]; 
    const p = PRODUCTS.find(x=>x.id===id); 
    if(p) total += p.price * qty; 
  } 
  return total; 
}

// Геолокация
let userLocation = null;
let deliveryCost = 0;

// Координаты магазина "Мерос" в Шымкенте
const STORE_LOCATION = {
  lat: 42.311041,
  lon: 69.78032
};

// Функция расчета расстояния между двумя точками (формула Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радиус Земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

// Функция расчета стоимости доставки
function calculateDeliveryCost(distance) {
  // Новый алгоритм расчета:
  // <2 км = 1000 ₸
  // 2-2.5 км = 1500 ₸
  // 2.5-3 км = 2000 ₸
  // 3-4 км = 3000 ₸
  // 4-5 км = 4000 ₸
  // 5-10 км = 5000 ₸
  // 10-13 км = 6000 ₸
  // 13-15 км = 7000 ₸
  // 15-20 км = 8000 ₸
  // >20 км = distance * 400 (округление до 100)
  if (distance < 2) {
    return 1000;
  } else if (distance >= 2 && distance < 2.5) {
    return 1500;
  } else if (distance >= 2.5 && distance < 3) {
    return 2000;
  } else if (distance >= 3 && distance < 4) {
    return 3000;
  } else if (distance >= 4 && distance < 5) {
    return 4000;
  } else if (distance >= 5 && distance < 10) {
    return 5000;
  } else if (distance >= 10 && distance < 13) {
    return 6000;
  } else if (distance >= 13 && distance < 15) {
    return 7000;
  } else if (distance >= 15 && distance < 20) {
    return 8000;
  } else {
    // Остальное: расстояние * 400, округление до 100
    return Math.ceil((distance * 400) / 100) * 100;
  }
}

// Выбор типа доставки
function selectDeliveryOption(type) {
  const deliveryBtn = document.getElementById('delivery-option');
  const pickupBtn = document.getElementById('pickup-option');
  const deliverySection = document.getElementById('delivery-section');
  const pickupSection = document.getElementById('pickup-section');
  
  if (type === 'delivery') {
    // Активировать доставку
    deliveryBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    deliveryBtn.style.color = 'white';
    deliveryBtn.style.border = 'none';
    
    pickupBtn.style.background = 'white';
    pickupBtn.style.color = '#333';
    pickupBtn.style.border = '2px solid #ddd';
    
    deliverySection.style.display = 'block';
    pickupSection.style.display = 'none';
    
    // Если есть геолокация, восстановить стоимость доставки
    if (userLocation) {
      const distance = calculateDistance(
        userLocation.lat, 
        userLocation.lon, 
        STORE_LOCATION.lat, 
        STORE_LOCATION.lon
      );
      deliveryCost = calculateDeliveryCost(distance);
    }
  } else if (type === 'pickup') {
    // Активировать самовывоз
    pickupBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    pickupBtn.style.color = 'white';
    pickupBtn.style.border = 'none';
    
    deliveryBtn.style.background = 'white';
    deliveryBtn.style.color = '#333';
    deliveryBtn.style.border = '2px solid #ddd';
    
    deliverySection.style.display = 'none';
    pickupSection.style.display = 'block';
    
    // Скрыть блок с координатами при самовывозе
    const locationInfo = document.getElementById('location-info');
    if (locationInfo) {
      locationInfo.style.display = 'none';
    }
    
    // Обнулить стоимость доставки для самовывоза
    deliveryCost = 0;
  }
}

// Yandex Maps автодополнение адресов
function initYandexSuggest() {
  ymaps.ready(function() {
    const addressInput = document.getElementById('address');
    const suggestionsDiv = document.getElementById('address-suggestions');
    
    let searchTimeout;
    
    addressInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      const query = this.value.trim();
      
      if (query.length < 3) {
        suggestionsDiv.style.display = 'none';
        return;
      }
      
      searchTimeout = setTimeout(() => {
        // Используем geocode для поиска адресов
        ymaps.geocode('Шымкент, ' + query, {
          results: 5,
          boundedBy: [[42.2, 69.6], [42.4, 69.9]], // Границы Шымкента
          strictBounds: false
        }).then(function(res) {
          const items = [];
          res.geoObjects.each(function(obj) {
            items.push({
              displayName: obj.properties.get('text'),
              coords: obj.geometry.getCoordinates(),
              description: obj.properties.get('name')
            });
          });
          showSuggestions(items);
        }).catch(function(err) {
          console.error('Geocode error:', err);
        });
      }, 300);
    });
    
    function showSuggestions(items) {
      if (!items || items.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
      }
      
      suggestionsDiv.innerHTML = '';
      items.forEach(function(item) {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;';
        
        // Убираем "Казахстан, " из адреса для компактности
        let displayText = item.displayName.replace('Казахстан, ', '');
        div.textContent = displayText;
        
        div.addEventListener('mouseenter', function() {
          this.style.background = '#f9fafb';
        });
        
        div.addEventListener('mouseleave', function() {
          this.style.background = 'white';
        });
        
        div.addEventListener('click', function() {
          // Убираем префикс "Шымкент, " если есть
          let cleanAddress = displayText.replace('Шымкент, ', '');
          addressInput.value = cleanAddress;
          suggestionsDiv.style.display = 'none';
          
          // Сохраняем координаты и рассчитываем доставку
          userLocation = {
            lat: item.coords[0],
            lon: item.coords[1]
          };
          
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lon,
            STORE_LOCATION.lat,
            STORE_LOCATION.lon
          );
          
          deliveryCost = calculateDeliveryCost(distance);
          
          // Показываем информацию о доставке
          const locationInfo = document.getElementById('location-info');
          const coordinatesSpan = document.getElementById('coordinates');
          const mapLink = document.getElementById('map-link');
          const deliveryInfo = document.getElementById('delivery-info');
          
          coordinatesSpan.textContent = item.coords[0].toFixed(6) + ', ' + item.coords[1].toFixed(6);
          mapLink.href = `https://yandex.ru/maps/?ll=${item.coords[1]},${item.coords[0]}&z=16&pt=${item.coords[1]},${item.coords[0]},pm2rdm`;
          
          deliveryInfo.innerHTML = `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #10b981;">
              <strong style="color: #065f46;">Расстояние:</strong> ${distance.toFixed(2)} км<br>
              <strong style="color: #065f46;">Стоимость доставки:</strong> ${deliveryCost} ₸
            </div>
          `;
          
          locationInfo.style.display = 'block';
        });
        
        suggestionsDiv.appendChild(div);
      });
      
      suggestionsDiv.style.display = 'block';
    }
    
    // Скрыть подсказки при клике вне поля
    document.addEventListener('click', function(e) {
      if (e.target !== addressInput && !suggestionsDiv.contains(e.target)) {
        suggestionsDiv.style.display = 'none';
      }
    });
  });
}

// Инициализация при загрузке страницы
if (typeof ymaps !== 'undefined') {
  initYandexSuggest();
} else {
  window.addEventListener('load', function() {
    if (typeof ymaps !== 'undefined') {
      initYandexSuggest();
    }
  });
}

document.getElementById('get-location').addEventListener('click', function(e) {
  e.preventDefault();
  
  if (!navigator.geolocation) {
    alert('Геолокация не поддерживается вашим браузером');
    return;
  }
  
  const btn = e.currentTarget;
  const addressInput = document.getElementById('address');
  const locationInfo = document.getElementById('location-info');
  const coordinatesSpan = document.getElementById('coordinates');
  const mapLink = document.getElementById('map-link');
  
  // Показываем загрузку
  btn.classList.add('loading');
  btn.textContent = '⏳';
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      userLocation = { lat, lon };
      
      // Рассчитываем расстояние от магазина
      const distance = calculateDistance(STORE_LOCATION.lat, STORE_LOCATION.lon, lat, lon);
      deliveryCost = calculateDeliveryCost(distance);
      
      // Показываем координаты и информацию о доставке
      coordinatesSpan.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      
      // Добавляем информацию о доставке
      const deliveryInfo = document.getElementById('delivery-info');
      if (deliveryInfo) {
        deliveryInfo.innerHTML = `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #10b981;">
            <div style="font-weight: 500; color: #065f46;">📦 Доставка: ${distance.toFixed(1)} км</div>
            <div style="font-size: 16px; font-weight: bold; color: #059669; margin-top: 3px;">Стоимость: ${deliveryCost.toLocaleString('ru-RU')} ₸</div>
          </div>
        `;
      }
      
      locationInfo.style.display = 'block';
      
      // Ссылка на Яндекс Карты
      mapLink.href = `https://yandex.ru/maps/?ll=${lon},${lat}&z=16&pt=${lon},${lat},pm2rdm`;
      
      // Пытаемся получить адрес через Nominatim (OpenStreetMap)
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ru`);
        const data = await response.json();
        
        if (data && data.display_name) {
          addressInput.value = data.display_name;
        } else {
          addressInput.value = `Координаты: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
      } catch (error) {
        console.error('Ошибка получения адреса:', error);
        addressInput.value = `Координаты: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      }
      
      // Восстанавливаем кнопку
      btn.classList.remove('loading');
      btn.textContent = '✓';
      setTimeout(() => {
        btn.textContent = '📍';
      }, 2000);
    },
    (error) => {
      console.error('Ошибка геолокации:', error);
      
      let errorMessage = 'Не удалось получить местоположение';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Вы запретили доступ к геолокации. Разрешите в настройках браузера.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Информация о местоположении недоступна';
          break;
        case error.TIMEOUT:
          errorMessage = 'Время ожидания истекло';
          break;
      }
      
      alert(errorMessage);
      
      // Восстанавливаем кнопку
      btn.classList.remove('loading');
      btn.textContent = '📍';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
});

// ============================================
// НИЖНЯЯ НАВИГАЦИЯ ДЛЯ МОБИЛЬНЫХ
// ============================================

// Инициализация нижней навигации
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.bottom-nav .nav-item');
  const mobileCartCount = document.getElementById('mobile-cart-count');
  
  // Обработчики для кнопок навигации
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const page = item.getAttribute('data-page');
      handleBottomNavClick(page);
      
      // Обновляем активный элемент
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  // Синхронизация счетчика корзины
  const updateMobileCartCount = () => {
    const count = document.getElementById('cart-count').textContent;
    if (mobileCartCount) {
      mobileCartCount.textContent = count;
      mobileCartCount.style.display = count === '0' ? 'none' : 'flex';
    }
  };
  
  // Наблюдаем за изменениями в основном счетчике корзины
  const cartCountObserver = new MutationObserver(updateMobileCartCount);
  const cartCountElement = document.getElementById('cart-count');
  if (cartCountElement) {
    cartCountObserver.observe(cartCountElement, { childList: true, characterData: true, subtree: true });
  }
  
  // Первичная синхронизация
  updateMobileCartCount();
});

// Обработка кликов по нижней навигации
function handleBottomNavClick(page) {
  switch(page) {
    case 'home':
      // Возврат на главную - ТОЛЬКО прокрутка, без открытия каталога
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Закрываем каталог если он открыт
      const sidebar = document.getElementById('categories-sidebar');
      const overlay = document.getElementById('categories-overlay');
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      }
      break;
      
    case 'catalog':
      // Открываем меню категорий
      toggleCategoriesMenu();
      break;
      
    case 'cart':
      // Открываем корзину с товарами
      showCart();
      break;
      
    case 'info':
      // Открываем модальное окно с информацией о магазине
      document.getElementById('info-modal').style.display = 'grid';
      break;
      
    case 'profile':
      // Открываем профиль
      showProfileSection();
      break;
  }
}

// Показать секцию профиля
function showProfileSection() {
  if (!currentUser) {
    // Если не авторизован, открываем модальное окно входа
    openTelegramModal();
    return;
  }
  
  // Если авторизован, показываем профиль
  const modal = document.getElementById('profile-modal');
  modal.style.display = 'grid';
  
  // Заполняем данные профиля
  document.getElementById('profile-name').textContent = `${currentUser.first_name} ${currentUser.last_name || ''}`.trim();
  document.getElementById('profile-username').textContent = currentUser.username ? `@${currentUser.username}` : `ID: ${currentUser.id}`;
}

// Показать историю заказов из профиля
function showOrderHistoryFromProfile() {
  document.getElementById('profile-modal').style.display = 'none';
  showOrderHistory();
}

// Выход из аккаунта из профиля
function logoutFromProfile() {
  document.getElementById('profile-modal').style.display = 'none';
  logout();
}

// Вернуться в профиль из истории заказов
function backToProfile() {
  document.getElementById('order-history-modal').style.display = 'none';
  document.getElementById('profile-modal').style.display = 'grid';
}

// Показать историю заказов
async function showOrderHistory() {
  const modal = document.getElementById('order-history-modal');
  modal.style.display = 'grid';
  
  const content = document.getElementById('order-history-content');
  content.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка истории заказов...</div>';
  
  try {
    const response = await fetch(`/api/user/orders/${currentUser.id}`);
    const orders = await response.json();
    
    if (orders.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <p style="color: #6b7280; margin-bottom: 20px;">У вас пока нет заказов</p>
          <button class="btn" onclick="document.getElementById('order-history-modal').style.display='none'">
            Начать покупки
          </button>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    orders.forEach(order => {
      const statusText = {
        'new': '🆕 Новый',
        'processing': '⏳ В обработке',
        'completed': '✅ Завершен',
        'cancelled': '❌ Отменен'
      }[order.status] || order.status;
      
      const date = new Date(order.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      html += `
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid var(--accent);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="font-size: 16px;">Заказ #${order.id}</strong>
            <span style="background: #e0f2fe; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500;">
              ${statusText}
            </span>
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 12px;">
            ${date}
          </div>
          <div style="font-size: 14px; color: #374151; margin-bottom: 10px; line-height: 1.6;">
            ${Object.entries(order.items).map(([id, qty]) => {
              const product = PRODUCTS.find(p => p.id == id);
              return product ? `• ${product.name} × ${qty}` : `• Товар #${id} × ${qty}`;
            }).join('<br>')}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #e5e7eb;">
            <span style="color: #6b7280; font-size: 14px;">
              📍 ${order.address || 'Не указан'}
            </span>
            <strong style="font-size: 16px; color: var(--accent);">
              ${order.total.toLocaleString('ru-RU')} ₸
            </strong>
          </div>
        </div>
      `;
    });
    
    content.innerHTML = html;
    
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
    content.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #ef4444;">
        ❌ Ошибка загрузки истории заказов
      </div>
    `;
  }
}

// Обновляем функцию закрытия корзины для сброса активной кнопки
const originalCloseCart = document.getElementById('close-cart');
if (originalCloseCart) {
  originalCloseCart.addEventListener('click', () => {
    // Сбрасываем активную кнопку на "Главная"
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const homeBtn = document.querySelector('.bottom-nav .nav-item[data-page="home"]');
    if (homeBtn) homeBtn.classList.add('active');
  });
}

// ============================================
// УВЕДОМЛЕНИЕ О ДОБАВЛЕНИИ В КОРЗИНУ
// ============================================

function showToastNotification(message) {
  // Удаляем предыдущее уведомление если есть
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  // Создаем новое уведомление
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  
  document.body.appendChild(toast);

  // Удаляем через 2 секунды
  setTimeout(() => {
    toast.remove();
  }, 1000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  checkAuth(); // Проверяем авторизацию
  loadCategories();
  loadProducts();
  updateCartCount();
  
  // Обработчик кнопки входа через Telegram
  const loginBtn = document.getElementById('telegram-login-btn');
  if (loginBtn) {
    console.log('Adding click handler to login button');
    loginBtn.addEventListener('click', () => {
      console.log('Login button clicked!');
      openTelegramModal();
    });
  } else {
    console.error('Login button not found in DOM');
  }
  
  // Обработчик клика по имени пользователя (выход)
  document.getElementById('user-info')?.addEventListener('click', logout);
});
