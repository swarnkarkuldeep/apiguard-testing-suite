// IGuard Store front end: plain JavaScript, no framework.
// It talks to the API on the same origin, so it works on :3000 (local) and :3001 (staging).
// Security note: API data is always inserted with textContent / createElement,
// never innerHTML, because product names are user input.
(() => {
  const $ = (id) => document.getElementById(id);

  // The login token lives in sessionStorage: survives a refresh, gone when the tab closes.
  const state = {
    token: sessionStorage.getItem('token'),
    email: sessionStorage.getItem('email'),
    registerMode: false,
    products: new Map(), // id -> product, used to show names in order details
  };

  // ---------- helpers ----------
  const money = (n) => '$' + Number(n).toFixed(2);

  // Tiny element builder: el('p', { class: 'x', text: 'hello' }, [children])
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    if (props.class) node.className = props.class;
    if (props.text !== undefined) node.textContent = props.text;
    for (const [k, v] of Object.entries(props.attrs || {})) node.setAttribute(k, v);
    children.forEach((c) => node.appendChild(c));
    return node;
  }

  function showMessage(type, text) {
    const box = $('message');
    box.className = `message ${type}`;
    box.textContent = text;
    box.setAttribute('role', type === 'err' ? 'alert' : 'status');
    box.hidden = false;
  }
  const clearMessage = () => { $('message').hidden = true; };

  // One place for every API call. Throws an Error that carries the API's error code.
  async function api(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const e = (data && data.error) || { code: `HTTP_${res.status}`, message: res.statusText };
      const err = new Error(`${e.code}: ${e.message}`);
      err.code = e.code;
      throw err;
    }
    return data;
  }

  // Wraps a user action: runs it, shows API errors in the banner, logs out if the token is rejected.
  async function run(action) {
    try {
      await action();
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_INVALID') logout();
      showMessage('err', err.message);
    }
  }

  // The token's payload says whether we are a user or an admin (display only; the API enforces it).
  function roleFromToken(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64)).role;
    } catch { return 'user'; }
  }

  // ---------- account ----------
  function renderAccount() {
    const loggedIn = Boolean(state.token);
    $('authForm').hidden = loggedIn;
    $('userBox').hidden = !loggedIn;
    $('ordersSection').hidden = !loggedIn;
    if (loggedIn) {
      $('userEmail').textContent = state.email;
      $('userRole').textContent = roleFromToken(state.token);
    }
    $('nameRow').hidden = !state.registerMode;
    $('name').required = state.registerMode;
    $('authSubmit').textContent = state.registerMode ? 'Create account' : 'Log in';
    $('authToggle').textContent = state.registerMode ? 'Have an account? Log in' : 'Need an account? Register';
    $('password').autocomplete = state.registerMode ? 'new-password' : 'current-password';
  }

  async function login(email, password) {
    const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
    state.token = token;
    state.email = email;
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('email', email);
  }

  function logout() {
    state.token = null;
    state.email = null;
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('email');
    $('ordersList').replaceChildren();
    renderAccount();
    renderProducts([...state.products.values()]); // order buttons become disabled
  }

  $('authToggle').addEventListener('click', () => {
    state.registerMode = !state.registerMode;
    clearMessage();
    renderAccount();
  });

  $('authForm').addEventListener('submit', (event) => {
    event.preventDefault();
    run(async () => {
      clearMessage();
      const email = $('email').value.trim();
      const password = $('password').value;
      const wasRegistering = state.registerMode;
      if (wasRegistering) {
        await api('/auth/register', { method: 'POST', body: { name: $('name').value, email, password } });
      }
      await login(email, password);
      $('password').value = '';
      state.registerMode = false;
      renderAccount();
      showMessage('ok', wasRegistering ? `Account created. Welcome, ${email}.` : `Welcome, ${email}.`);
      await Promise.all([loadProducts(), loadOrders()]);
    });
  });

  $('logout').addEventListener('click', () => {
    logout();
    showMessage('ok', 'Logged out.');
  });

  // ---------- products ----------
  function renderProducts(products) {
    const grid = $('productGrid');
    grid.replaceChildren();
    if (!products.length) grid.appendChild(el('p', { class: 'muted', text: 'No products yet.' }));

    for (const p of products) {
      const qty = el('input', { attrs: { type: 'number', min: '1', value: '1', 'aria-label': `Quantity for ${p.name}` } });
      const btn = el('button', { text: 'Order' });
      btn.disabled = !state.token || p.stock < 1;
      btn.title = !state.token ? 'Log in to order' : p.stock < 1 ? 'Out of stock' : '';
      btn.addEventListener('click', () => run(() => placeOrder(p, qty.value)));

      grid.appendChild(el('article', { class: 'card' }, [
        el('h3', { text: p.name }),
        el('span', { class: 'sku', text: p.sku }),
        el('span', { class: 'price', text: money(p.price) }),
        el('span', { class: p.stock < 10 ? 'stock low' : 'stock', text: p.stock < 1 ? 'Out of stock' : `${p.stock} in stock` }),
        el('div', { class: 'buy' }, [qty, btn]),
      ]));
    }
  }

  async function loadProducts() {
    const products = await api('/products');
    state.products = new Map(products.map((p) => [p.id, p]));
    renderProducts(products);
  }

  async function placeOrder(product, qtyText) {
    clearMessage();
    // Sent as typed (a number). The API validates it and answers with a clear error if it is wrong.
    const order = await api('/orders', { method: 'POST', body: { items: [{ productId: product.id, qty: Number(qtyText) }] } });
    showMessage('ok', `Order #${order.id} placed for ${money(order.total)}.`);
    await Promise.all([loadProducts(), loadOrders()]);
  }

  // ---------- orders ----------
  async function loadOrders() {
    if (!state.token) return;
    const orders = await api('/orders');
    const list = $('ordersList');
    list.replaceChildren();
    if (!orders.length) list.appendChild(el('li', { class: 'muted', text: 'No orders yet.' }));

    for (const o of orders.slice().reverse()) { // newest first
      const detailsBtn = el('button', { class: 'secondary', text: 'Details' });
      const itemsBox = el('ul', { class: 'order-items' });
      itemsBox.hidden = true;
      detailsBtn.addEventListener('click', () => run(async () => {
        if (itemsBox.hidden) {
          const full = await api(`/orders/${o.id}`);
          itemsBox.replaceChildren(...full.items.map((i) => {
            const name = state.products.has(i.productId) ? state.products.get(i.productId).name : `product #${i.productId}`;
            return el('li', { text: `${name} x ${i.qty} at ${money(i.unitPrice)}` });
          }));
        }
        itemsBox.hidden = !itemsBox.hidden;
        detailsBtn.textContent = itemsBox.hidden ? 'Details' : 'Hide';
      }));

      list.appendChild(el('li', {}, [
        el('div', { class: 'order-row' }, [
          el('span', { text: `Order #${o.id} - ${money(o.total)} - ${new Date(o.createdAt).toLocaleString()}` }),
          detailsBtn,
        ]),
        itemsBox,
      ]));
    }
  }

  // ---------- start ----------
  async function start() {
    renderAccount();
    // Environment badge: which API (local or staging) is this page talking to?
    try {
      const { env } = await api('/health');
      const badge = $('envBadge');
      badge.textContent = env;
      badge.classList.add(`env-${env}`);
    } catch {
      $('envBadge').textContent = 'API unreachable';
    }
    await run(async () => { await loadProducts(); await loadOrders(); });
  }
  start();
})();
