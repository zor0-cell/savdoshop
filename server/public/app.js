const som = (n) => Number(n).toLocaleString('ru-RU') + " so'm";
// escape user text before putting it into HTML (prevents XSS attacks)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// ---------- Cart is stored in the browser (localStorage) ----------
const getCart = () => JSON.parse(localStorage.getItem('cart') || '[]');
const saveCart = (cart) => { localStorage.setItem('cart', JSON.stringify(cart)); updateCartCount(); };
function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (el) el.textContent = getCart().reduce((s, i) => s + i.quantity, 0);
}
function addToCart(p) {
  const cart = getCart();
  const line = cart.find((i) => i.productId === p.product_id);
  if (line) line.quantity++;
  else cart.push({ productId: p.product_id, name: p.name, price: Number(p.price), quantity: 1 });
  saveCart(cart);
}

// ---------- Home page ----------
async function loadHome() {
  const cats = await api('/api/categories');
  document.getElementById('category').innerHTML += cats
    .map((c) => `<option value="${c.category_id}">${esc(c.name)}</option>`).join('');

  async function search() {
    const params = new URLSearchParams({
      q: document.getElementById('q').value,
      category: document.getElementById('category').value
    });
    const products = await api('/api/products?' + params);
    document.getElementById('products').innerHTML = products.map((p) => `
      <a class="card product" href="/product.html?id=${p.product_id}">
        <img src="${esc(p.image_url)}" alt="${esc(p.name)}">
        <h3>${esc(p.name)}</h3>
        <p class="muted">${esc(p.category)}</p>
        <p class="price">${som(p.price)}</p>
      </a>`).join('') || '<p>No products found.</p>';
  }
  document.getElementById('filters').addEventListener('submit', (e) => { e.preventDefault(); search(); });
  search();
}

// ---------- Product page: PostgreSQL data + MongoDB reviews ----------
async function loadProduct() {
  const id = new URLSearchParams(location.search).get('id') || 1;
  const p = await api('/api/products/' + id);

  document.getElementById('product').innerHTML = `
    <div class="detail">
      <img src="${esc(p.image_url)}" alt="${esc(p.name)}">
      <div>
        <h1>${esc(p.name)}</h1>
        <p class="muted">${esc(p.category)} &middot; ${p.stock} pcs in stock</p>
        <p>${esc(p.description || '')}</p>
        <p class="price">${som(p.price)}</p>
        <p class="rating">${p.avgRating ? p.avgRating.toFixed(1) + ' / 5' : 'No reviews yet'}</p>
        <button id="add">Add to cart</button>
        <a class="card link" href="/cart.html">Go to cart</a>
      </div>
    </div>`;

  document.getElementById('add').addEventListener('click', () => {
    addToCart(p);
    updateCartCount();
    document.getElementById('add').textContent = 'Added to cart';
  });

  document.getElementById('review-form').innerHTML = `
    <h2>Write a review</h2>
    <form id="review">
      <select id="rating">
        <option value="5">5 - excellent</option>
        <option value="4">4</option>
        <option value="3">3</option>
        <option value="2">2</option>
        <option value="1">1 - poor</option>
      </select>
      <input id="author" placeholder="Your name">
      <textarea id="comment" placeholder="What did you like or dislike?" required></textarea>
      <button>Send review</button>
    </form>
    <p id="message" class="message"></p>`;

  function renderReviews(reviews, avg) {
    document.getElementById('reviews').innerHTML = `
      <p class="muted">${reviews.length} review(s), average ${avg ? avg.toFixed(1) : '-'} / 5</p>` +
      reviews.map((r) => `
        <div class="card review">
          <b>${esc(r.author || 'Guest')}</b> <span class="stars">${'&#9733;'.repeat(r.rating)}</span>
          <p>${esc(r.comment)}</p>
          ${(r.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
          ${(r.photos || []).length ? `<p class="muted">${r.photos.length} photo(s)</p>` : ''}
        </div>`).join('') || '<p>No reviews yet.</p>';
  }
  renderReviews(p.reviews, p.avgRating);

  document.getElementById('review').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('message');
    try {
      await api(`/api/products/${id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          rating: Number(document.getElementById('rating').value),
          comment: document.getElementById('comment').value,
          author: document.getElementById('author').value
        })
      });
      msg.textContent = 'Thanks! Your review was saved in MongoDB.';
      const fresh = await api('/api/products/' + id);
      renderReviews(fresh.reviews, fresh.avgRating);
      document.getElementById('comment').value = '';
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
    }
  });
}

// ---------- Cart page: localStorage + POST /api/orders ----------
async function loadCart() {
  function render() {
    const cart = getCart();
    document.getElementById('cart').innerHTML = cart.map((i, n) => `
      <div class="card line">
        <span>${esc(i.name)}</span>
        <span class="muted">${som(i.price)} x</span>
        <input type="number" min="1" value="${i.quantity}" data-n="${n}" class="qty">
        <span class="price">${som(i.price * i.quantity)}</span>
        <button data-remove="${n}" class="remove">Remove</button>
      </div>`).join('') || '<p>Your cart is empty. <a href="/">Browse products</a></p>';

    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    document.getElementById('cart-total').textContent = cart.length ? 'Total: ' + som(total) : '';

    document.querySelectorAll('.qty').forEach((el) => el.addEventListener('change', () => {
      const cart = getCart();
      cart[Number(el.dataset.n)].quantity = Math.max(1, Number(el.value));
      saveCart(cart); render();
    }));
    document.querySelectorAll('.remove').forEach((el) => el.addEventListener('click', () => {
      const cart = getCart();
      cart.splice(Number(el.dataset.remove), 1);
      saveCart(cart); render();
    }));
    updateCartCount();
  }
  render();

  document.getElementById('checkout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('message');
    const val = (id) => document.getElementById(id).value;
    try {
      const result = await api('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer: { fullName: val('fullName'), email: val('email'), phone: val('phone'), city: val('city') },
          items: getCart().map(({ productId, quantity }) => ({ productId, quantity })),
          paymentMethod: val('paymentMethod')
        })
      });
      saveCart([]); render();
      msg.textContent = `Thank you! Order #${result.orderId}, total ${som(result.total)}`;
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
    }
  });
}

// ---------- Dashboard: 1 SQL route + 2 MongoDB routes ----------
async function loadDashboard() {
  const bar = (label, value, max, text) => `
    <div class="stat">
      <span class="stat-label">${esc(label)}</span>
      <span class="stat-bar"><i style="width:${max ? Math.round(value / max * 100) : 0}%"></i></span>
      <span class="stat-value">${esc(text)}</span>
    </div>`;

  const cities = await api('/api/stats/sales-by-city');
  const maxRev = Math.max(...cities.map((c) => c.revenue), 1);
  document.getElementById('sales-by-city').innerHTML = cities
    .map((c) => bar(c.city, c.revenue, maxRev, `${som(c.revenue)} / ${c.orders} order(s)`)).join('')
    || '<p class="muted">No orders yet.</p>';

  const viewed = await api('/api/stats/top-viewed');
  const maxViews = Math.max(...viewed.map((v) => v.views), 1);
  document.getElementById('top-viewed').innerHTML = viewed
    .map((v) => bar(v.name, v.views, maxViews, `${v.views} views`)).join('')
    || '<p class="muted">No events yet.</p>';

  const funnel = await api('/api/stats/funnel');
  const entries = Object.entries(funnel).sort((a, b) => b[1] - a[1]);
  const maxEvents = Math.max(...entries.map((e) => e[1]), 1);
  document.getElementById('funnel').innerHTML = entries
    .map(([type, count]) => bar(type, count, maxEvents, count.toLocaleString('ru-RU'))).join('')
    || '<p class="muted">No events yet.</p>';

  const health = await api('/api/health');
  document.getElementById('health').innerHTML = `
    <p>PostgreSQL: connected, server time ${esc(new Date(health.postgresTime).toLocaleString('ru-RU'))}</p>
    <p>MongoDB: connected, ${health.mongoReviews} reviews in the <code>reviews</code> collection</p>`;
}

// ---------- Which page am I on? ----------
const pages = { home: loadHome, product: loadProduct, cart: loadCart, dashboard: loadDashboard };

updateCartCount();
const start = pages[document.body.dataset.page];
if (start) start().catch((err) => {
  console.error(err);
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    `<p class="message">Error: ${esc(err.message)}</p>`);
});
