
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
    const imageUrl = p.image || p.img || '/assets/placeholder.svg';
    
   el.innerHTML = `
  <img src="${imageUrl}" alt="${p.name}" onerror="this.src='/assets/placeholder.svg'" />
  <div class="body">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div style="flex:1">
        <div style="font-weight:700;margin-bottom:4px">${p.name}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="price" style="white-space:nowrap">${p.price.toLocaleString('ru-RU')} ₸</div>
      </div>
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;justify-content:space-between;align-items:center">
      <div class="muted">В наличии: ${p.stock ? 'да' : 'нет'}</div>
      <div><button class="btn" data-id="${p.id}" ${!p.stock ? 'disabled' : ''}>В корзину</button></div>
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

function addToCart(id){ 
  cart[id] = (cart[id]||0)+1; 
  saveCart(); 
  flashCartCount(); 
}

function removeFromCart(id){ 
  delete cart[id]; 
  saveCart(); 
}

function changeQty(id, delta){ 
  const newQty = Math.max(0, (cart[id]||0) + delta); 
  if(newQty === 0) {
    delete cart[id]; 
  } else {
    cart[id] = newQty;
  }
  saveCart(); 
}

function setQty(id, newQty) {
  newQty = parseInt(newQty) || 0;
  if (newQty <= 0) {
    delete cart[id];
  } else {
    cart[id] = newQty;
  }
  saveCart();
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
    
    // Используем placeholder если нет изображения
    const imageUrl = p.image || p.img || '/assets/placeholder.svg';
    
    const it = document.createElement('div'); 
    it.className='cart-item';
    it.innerHTML = `
      <img src="${imageUrl}" onerror="this.src='/assets/placeholder.svg'" />
      <div class="meta">
        <div style="font-weight:700">${p.name}</div>
        <div class="muted">${p.price.toLocaleString('ru-RU')} ₸ × ${qty} = <strong>${(p.price*qty).toLocaleString('ru-RU')} ₸</strong></div>
      </div>
      <div style="text-align:right">
        <div class="qty">
          <button class="btn secondary" data-action="dec" data-id="${id}">-</button>
          <input type="number" class="qty-input" value="${qty}" min="1" data-id="${id}" />
          <button class="btn" data-action="inc" data-id="${id}">+</button>
        </div>
        <div style="margin-top:6px">
          <button class="btn secondary" data-action="del" data-id="${id}">Удалить</button>
        </div>
      </div>
    `;
    itemsBox.appendChild(it);
  }
  
  document.getElementById('cart-total').textContent = total.toLocaleString('ru-RU') + ' ₸';
  document.getElementById('cart-count').textContent = count;
  
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
  const c = document.getElementById('cart'); 
  c.style.display = c.style.display === 'none' ? 'block' : 'none'; 
});

document.getElementById('clear-cart').addEventListener('click', ()=>{ 
  for(const k in cart) delete cart[k]; 
  saveCart(); 
});

// Закрытие корзины
document.getElementById('close-cart').addEventListener('click', ()=>{ 
  document.getElementById('cart').style.display = 'none';
});

// Оформление заказа
document.getElementById('checkout').addEventListener('click', ()=>{
  const keys = Object.keys(cart);
  if (keys.length === 0) {
    alert('Корзина пустая');
    return;
  }

  const cartEl = document.getElementById('cart');
  const modalEl = document.getElementById('modal');

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
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if(!name || !phone){
    alert('Введите имя и телефон');
    return;
  }

  const total = calculateTotal();
  
  const orderData = {
    name: name,
    phone: phone,
    address: address,
    location: userLocation, // Добавляем координаты если есть
    items: {...cart},
    total: total
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

    // Показываем чек
    let receiptHTML = `
      <h3 style="text-align:center">🧾 Чек заказа</h3>
      <p><strong>Имя:</strong> ${name}</p>
      <p><strong>Телефон:</strong> ${phone}</p>
      <p><strong>Адрес:</strong> ${address || '—'}</p>
      <hr>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><th style="text-align:left">Товар</th><th>Кол-во</th><th style="text-align:right">Сумма</th></tr>
    `;

    for (const idStr in cart) {
      const id = Number(idStr);
      const qty = cart[id];
      const p = PRODUCTS.find(x => x.id === id);
      if (p) {
        const line = (p.price * qty).toLocaleString('ru-RU');
        receiptHTML += `
          <tr>
            <td>${p.name}</td>
            <td style="text-align:center">${qty}</td>
            <td style="text-align:right">${line} ₸</td>
          </tr>`;
      }
    }

    receiptHTML += `
      </table>
      <hr>
      <h4 style="text-align:right">Итого: ${total.toLocaleString('ru-RU')} ₸</h4>
      <div style="text-align:center;margin-top:12px">
        <strong>✅ Заказ №${result.id} успешно оформлен!</strong>
      </div>
      <div style="text-align:center;margin-top:12px;display:flex;gap:10px;justify-content:center">
        <button id="download-pdf" class="btn secondary">Скачать PDF</button>
        <button id="close-receipt" class="btn">Закрыть</button>
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
  }
});

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
      
      // Показываем координаты
      coordinatesSpan.textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      locationInfo.style.display = 'block';
      
      // Ссылка на Google Maps
      mapLink.href = `https://www.google.com/maps?q=${lat},${lon}`;
      
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
