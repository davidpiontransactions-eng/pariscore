const http = require('http');

http.get('http://localhost:3005/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('sports-athlete:', (data.match(/sports-athlete/g) || []).length);
    console.log('has PARI:', data.includes('PARI') ? 'yes' : 'no');
    console.log('has shield:', data.includes('logo-header.svg') ? 'yes' : 'no');
    console.log('has Top Matchs:', data.includes('Top Matchs') ? 'yes' : 'no');
    console.log('has hero:', data.includes('hero') ? 'yes' : 'no');
  });
}).on('error', console.error);