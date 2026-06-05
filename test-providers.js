// test-keys.js
import dotenv from 'dotenv';
dotenv.config();

console.log('\n📊 VERIFICACIÓN DE API KEYS:\n');
console.log('='.repeat(60));

const keys = [
  { name: 'GROQ_API_KEY', value: process.env.GROQ_API_KEY, required: true },
  { name: 'TOGETHER_API_KEY', value: process.env.TOGETHER_API_KEY, required: false },
  { name: 'CEREBRAS_API_KEY', value: process.env.CEREBRAS_API_KEY, required: false },
  { name: 'OPENROUTER_API_KEY', value: process.env.OPENROUTER_API_KEY, required: false },
  { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY, required: false },
  { name: 'DEEPSEEK_API_KEY', value: process.env.DEEPSEEK_API_KEY, required: false },
  { name: 'MISTRAL_API_KEY', value: process.env.MISTRAL_API_KEY, required: false },
  { name: 'REPLICATE_API_KEY', value: process.env.REPLICATE_API_KEY, required: false },
  { name: 'COHERE_API_KEY', value: process.env.COHERE_API_KEY, required: false },
  { name: 'GOOGLE_API_KEY', value: process.env.GOOGLE_API_KEY, required: false },
];

for (const key of keys) {
  let status = '';
  let preview = '';
  
  if (!key.value) {
    status = '❌ NO CONFIGURADA';
  } else if (key.value === 'tu_key_aqui') {
    status = '❌ PLACEHOLDER (reemplazar)';
  } else if (key.value.length < 20) {
    status = '⚠️ DEMASIADO CORTA';
    preview = key.value;
  } else {
    status = '✅ CONFIGURADA';
    preview = key.value.substring(0, 20) + '...';
  }
  
  const requiredMark = key.required ? ' (REQUERIDA)' : '';
  console.log(`${key.name}${requiredMark}: ${status}`);
  if (preview) console.log(`   → Valor: ${preview}`);
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 RECOMENDACIONES:');
console.log('1. Las keys marcadas como "NO CONFIGURADA" deben agregarse al .env');
console.log('2. Las keys "PLACEHOLDER" deben reemplazarse con keys reales');
console.log('3. Para obtener keys gratuitas:');
console.log('   - OpenRouter: https://openrouter.ai/keys');
console.log('   - Gemini: https://aistudio.google.com/app/apikey');
console.log('   - DeepSeek: https://platform.deepseek.com/api_keys');
console.log('   - Mistral: https://console.mistral.ai/api-keys/');
console.log('\n✅ GROQ y OLLAMA son suficientes para funcionar básicamente\n');