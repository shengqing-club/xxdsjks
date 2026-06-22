require('dotenv').config();
console.log('URL:', process.env.DATABASE_URL);
const u = new URL(process.env.DATABASE_URL);
console.log('host:', u.hostname, 'port:', u.port, 'user:', u.username, 'db:', u.pathname);
