// test-env.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Intentar cargar .env desde diferentes ubicaciones
console.log('Buscando .env en:', path.join(__dirname, '.env'));
console.log('Buscando .env en:', path.join(__dirname, '../.env'));

// Probar carga
const result1 = dotenv.config({ path: path.join(__dirname, '.env') });
console.log('Carga desde server/.env:', result1.parsed ? '✅ Éxito' : '❌ Fallo');

const result2 = dotenv.config({ path: path.join(__dirname, '../.env') });
console.log('Carga desde .env (raíz):', result2.parsed ? '✅ Éxito' : '❌ Fallo');

console.log('\nVariables cargadas:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Ausente');