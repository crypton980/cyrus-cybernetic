const https = require('https');

const url = process.argv[2] || 'http://localhost:5000';

console.log(`Checking health of ${url}...`);

const checkHealth = (url) => {
  return new Promise((resolve, reject) => {
    const req = https.get(url + '/health/live', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ status: 'healthy', data });
        } else {
          resolve({ status: 'unhealthy', statusCode: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

checkHealth(url)
  .then(result => {
    if (result.status === 'healthy') {
      console.log('✅ System is healthy!');
    } else {
      console.log('❌ System is unhealthy:', result);
    }
  })
  .catch(err => {
    console.log('❌ Health check failed:', err.message);
  });
