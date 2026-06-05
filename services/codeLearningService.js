import axios from 'axios';
import { db, saveCustomCommand } from './learningService.js';

// Explicar código con Groq
export async function explainCodeWithGroq(code) {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Eres un experto en desarrollo web. Explica el código de forma clara y didáctica.' },
        { role: 'user', content: `Explica este código:\n\n${code.substring(0, 1500)}` }
      ]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    return 'No pude analizar el código. ¿Podrías compartir el código que quieres explicar?';
  }
}

// Auto-análisis para mejorar
export async function analyzeAndImproveSelf() {
  const mejoras = [
    '✅ **Mejoras identificadas:**',
    '',
    '1. **Reconocimiento de contexto**: Puedo mejorar mi memoria de conversación usando embeddings.',
    '2. **Más comandos**: Agregar comandos para manejo de archivos y proyectos.',
    '3. **Integración con GitHub**: Podría clonar repositorios y analizar código.',
    '4. **Generación de proyectos**: Crear estructura de proyectos web completos.',
    '5. **Debugging asistido**: Analizar errores y sugerir soluciones.',
    '',
    '📝 **¿Quieres que implemente alguna de estas mejoras?**'
  ];
  
  return mejoras.join('\n');
}

// Guardar patrones de código aprendidos
export async function saveCodePattern(codePattern, userName) {
  if (!db) return;
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS code_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL,
        description TEXT,
        learned_from TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.run(`INSERT INTO code_patterns (pattern, learned_from) VALUES (?, ?)`, 
      [codePattern.substring(0, 500), userName]);
    
    console.log('📚 Nuevo patrón de código aprendido');
  } catch (error) {
    console.error('Error guardando patrón:', error);
  }
  export async function debugCode(code) {
  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Eres un experto debugger. Analiza el código, encuentra errores y sugiere correcciones.' },
        { role: 'user', content: `Debuggea este código y explica los errores:\n\n${code.substring(0, 1500)}` }
      ]
    }, {
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    return 'No pude analizar el código. Comparte el código que quieres revisar.';
  }
}

}