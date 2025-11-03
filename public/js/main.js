
const PRODUCTS = [
  {id:1,name:'Цемент Шымкент 450',price:2000,img:'/assets/450ch.jpg'},
  {id:2,name:'Цемент Шымкент 500',price:2100,img:'/assets/500ch.jpg'},
  {id:3,name:'Цемент Стандарт 450',price:2000,img:'/assets/450st.jpg'},
  {id:4,name:'Цемент Аккерман 500',price:2200,img:'/assets/500akk.jpg'},
];

const cart = JSON.parse(localStorage.getItem('cart')||'{}');

function saveCart(){
  localStorage.setItem('cart', JSON.stringify(cart)); 
  renderCart();
}

function renderProducts(list){
  const out = document.getElementById('products'); 
  out.innerHTML='';
  list.forEach(p=>{
    const el = document.createElement('div'); 
    el.className='card';
   el.innerHTML = `
  <img src="${p.img}" alt="${p.name}" />
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
      <div class="muted">В наличии: да</div>
      <div><button class="btn" data-id="${p.id}">В корзину</button></div>
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
    
    const it = document.createElement('div'); 
    it.className='cart-item';
    it.innerHTML = `
      <img src="${p.img}" />
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
renderProducts(PRODUCTS);
renderCart();

// Поиск
document.getElementById('search').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const filtered = PRODUCTS.filter(p=> (p.name + ' ').toLowerCase().includes(q));
  renderProducts(filtered);
});

document.getElementById('reset').addEventListener('click', ()=>{
  document.getElementById('search').value='';
  renderProducts(PRODUCTS);
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
