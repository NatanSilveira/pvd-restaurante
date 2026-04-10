async function test() {
  const res = await fetch('https://pvd-restaurante.onrender.com/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const data = await res.json();
  
  if (data.token) {
    const res2 = await fetch('https://pvd-restaurante.onrender.com/api/menu', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({ name: 'Test', category: 'Test', price: 10 })
    });
    const text = await res2.text();
    console.log('POST /api/menu response:', res2.status, text);
  }
}
test();
