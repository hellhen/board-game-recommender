// Simple test without external dependencies
const http = require('http');

async function testAPI() {
  console.log('Testing API with Patchwork and Targi...');
  
  const postData = JSON.stringify({
    preferences: 'I love puzzly games like Patchwork, Targi, and want something with similar mechanics'
  });
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/recommend',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('API Response received successfully');
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Raw response:', data);
        }
      } else {
        console.error(`API Error: ${res.statusCode} ${res.statusMessage}`);
        console.error('Response:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('Request failed:', error.message);
  });
  
  req.write(postData);
  req.end();
}

testAPI();
