// server/generate-api-key.js
import crypto from 'crypto';

const apiKey = `jarvis_${crypto.randomBytes(32).toString('hex')}_${Date.now()}`;
console.log('\n🔑 API KEY GENERADA:\n');
console.log(apiKey);
console.log('\n📝 Agrega esta línea a tu .env.production:\n');
console.log(`JARVIS_API_KEY=${apiKey}\n`);