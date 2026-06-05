import ollama from 'ollama';

async function test() {
  console.log('🦙 Probando Ollama...');
  
  const response = await ollama.chat({
    model: 'llama3.2:3b',
    messages: [{ role: 'user', content: 'Decí "Hola, soy JARVIS funcionando con Ollama"' }],
    options: { temperature: 0.7, max_tokens: 50 }
  });
  
  console.log('✅ Respuesta:', response.message.content);
}

test();