const http = require('http');

const data = JSON.stringify({
  username: 'admin',
  password: 'wrongpassword'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', responseData);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
