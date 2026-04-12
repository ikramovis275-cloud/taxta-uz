const getStore = (key, defaultVal) => JSON.parse(localStorage.getItem(key)) || defaultVal;
const setStore = (key, val) => localStorage.setItem(key, JSON.stringify(val));

function mockResponse(data, status = 200) {
  return Promise.resolve({ data, status });
}

function mockError(message, status = 400) {
  return Promise.reject({ response: { data: { error: message }, status } });
}

const api = {
  get: async (url) => {
    url = url.replace('https://taxta-crm-2.onrender.com/api', '');
    if (url === '/auth/me') return mockResponse({ user: { id: 1, email: '1983', name: 'Admin' } });
    if (url === '/settings') return mockResponse({ usd_rate: getStore('usd_rate', 12800) });
    if (url === '/products') return mockResponse(getStore('products', []));
    if (url === '/sales') return mockResponse(getStore('sales', []));
    if (url === '/stats') {
      const products = getStore('products', []);
      const sales = getStore('sales', []);
      let totalSum = 0;
      sales.forEach(s => totalSum += s.total_sum);
      let totalVolume = 0;
      products.forEach(p => totalVolume += (Number(p.volume) || 0));
      
      const dailySales = [];
      const today = new Date().toISOString().split('T')[0];
      const todaySales = sales.filter(s => s.sold_at.startsWith(today));
      if (todaySales.length > 0) {
        let todaysTotal = 0;
        todaySales.forEach(s => todaysTotal += s.total_sum);
        dailySales.push({ date: today, total: todaysTotal, count: todaySales.length });
      }
      
      return mockResponse({
        totalProducts: products.length,
        totalSales: sales.length,
        totalRevenue: totalSum,
        totalVolume: totalVolume,
        dailySales: dailySales
      });
    }
    return mockResponse({});
  },

  post: async (url, body = {}) => {
    url = url.replace('https://taxta-crm-2.onrender.com/api', '');
    if (url === '/auth/login') {
      if (body.email === '1983' && body.password === '1983') {
        localStorage.setItem('token', 'local-token');
        return mockResponse({ token: 'local-token', user: { id: 1, email: '1983', name: 'Admin' } });
      } else {
        return mockError("Email yoki parol noto'g'ri", 401);
      }
    }
    if (url === '/products') {
      const products = getStore('products', []);
      if (products.some(p => p.code === body.code)) return mockError("Bu koddagi mahsulot mavjud");
      const newProduct = { ...body, id: Date.now() };
      products.push(newProduct);
      setStore('products', products);
      return mockResponse(newProduct, 201);
    }
    if (url === '/sales') {
      const sales = getStore('sales', []);
      const products = getStore('products', []);
      
      let totalSum = 0;
      body.items.forEach(i => totalSum += (Number(i.total_sum) || 0));
      const usdRate = Number(body.usd_rate) || 12800;
      const totalDollar = totalSum / usdRate;
      const paidSum = Number(body.paid_sum) || 0;
      const debtSum = totalSum - paidSum;
      
      const newSale = { 
        id: Date.now(),
        client_name: body.client_name,
        client_phone: body.client_phone,
        total_sum: totalSum,
        paid_sum: paidSum,
        debt_sum: debtSum,
        total_dollar: totalDollar,
        usd_rate: usdRate,
        sold_at: new Date().toISOString(),
        items: body.items.map((i, idx) => ({ ...i, id: Date.now() + idx }))
      };
      
      // Update inventory
      body.items.forEach(i => {
        const prodIdx = products.findIndex(p => p.id === i.product_id);
        if (prodIdx > -1) {
          products[prodIdx].quantity -= (Number(i.qty) || 0);
          products[prodIdx].volume -= (Number(i.volume) || 0);
          if (products[prodIdx].quantity <= 0) products.splice(prodIdx, 1);
        }
      });
      
      sales.unshift(newSale); // eng yangisi birinchi keladi
      setStore('sales', sales);
      setStore('products', products);
      
      return mockResponse(newSale, 201);
    }
    if (url.startsWith('/sales/') && url.endsWith('/return')) {
      const saleId = Number(url.split('/')[2]);
      const sales = getStore('sales', []);
      const products = getStore('products', []);
      
      const saleIdx = sales.findIndex(s => s.id === saleId);
      if (saleIdx === -1) return mockError("Sotuv topilmadi");
      
      const sale = sales[saleIdx];
      const items = sale.items || [];
      const itemIdx = items.findIndex(i => i.id === body.item_id);
      if (itemIdx === -1) return mockError("Mahsulot topilmadi");
      
      const item = items[itemIdx];
      const returnQty = parseFloat(body.return_qty);
      const returnVol = parseFloat(body.return_volume);
      
      if (returnQty > item.qty) return mockError("Qaytarish miqdori noto'g'ri");
      
      // Update inventory
      const prodIdx = products.findIndex(p => p.id === item.product_id);
      if (prodIdx > -1) {
        products[prodIdx].quantity += returnQty;
        products[prodIdx].volume += returnVol;
      }
      
      // Update item
      item.qty -= returnQty;
      item.volume -= returnVol;
      const refundAmount = returnQty * item.price_per_unit_sum;
      item.total_sum -= refundAmount;
      if (item.qty <= 0) items.splice(itemIdx, 1);
      
      // Update sale
      sale.total_sum -= refundAmount;
      sale.total_dollar = sale.total_sum / sale.usd_rate;
      sale.debt_sum -= refundAmount;
      if (sale.debt_sum < 0) {
        sale.paid_sum += sale.debt_sum;
        sale.debt_sum = 0;
      }
      
      setStore('products', products);
      setStore('sales', sales);
      return mockResponse({ message: "Qaytarildi" });
    }
    return mockError("Not Found!", 404);
  },

  put: async (url, body = {}) => {
    url = url.replace('https://taxta-crm-2.onrender.com/api', '');
    if (url === '/settings/usd-rate') {
      setStore('usd_rate', body.rate);
      return mockResponse({ usd_rate: Number(body.rate) });
    }
    if (url.startsWith('/products/')) {
      const id = Number(url.split('/')[2]);
      const products = getStore('products', []);
      const idx = products.findIndex(p => p.id === id);
      if (idx > -1) {
        products[idx] = { ...products[idx], ...body, id };
        setStore('products', products);
        return mockResponse(products[idx]);
      }
      return mockError("Topilmadi");
    }
    if (url.startsWith('/sales/')) {
      const id = Number(url.split('/')[2]);
      const sales = getStore('sales', []);
      const idx = sales.findIndex(s => s.id === id);
      if (idx > -1) {
        sales[idx].paid_sum = Number(body.paid_sum);
        sales[idx].debt_sum = sales[idx].total_sum - sales[idx].paid_sum;
        setStore('sales', sales);
        return mockResponse(sales[idx]);
      }
      return mockError("Sotuv topilmadi");
    }
    return mockError("Not Found!", 404);
  },

  delete: async (url) => {
    url = url.replace('https://taxta-crm-2.onrender.com/api', '');
    if (url.startsWith('/products/')) {
      const id = Number(url.split('/')[2]);
      const products = getStore('products', []);
      setStore('products', products.filter(p => p.id !== id));
      return mockResponse({ message: "O'chirildi" });
    }
    if (url.startsWith('/sales/')) {
      const id = Number(url.split('/')[2]);
      const sales = getStore('sales', []);
      setStore('sales', sales.filter(s => s.id !== id));
      return mockResponse({ message: "O'chirildi" });
    }
    return mockError("Not Found!", 404);
  }
};

// Request/Response interseptorlar kerak emas sababi backend yo'q
api.interceptors = {
  request: { use: () => {} },
  response: { use: () => {} }
};

export default api;
