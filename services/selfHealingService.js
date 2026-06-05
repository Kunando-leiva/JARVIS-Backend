import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ERROR_LOG_PATH = path.join(__dirname, '../../error_log.json');
const FIXES_PATH = path.join(__dirname, '../../auto_fixes.json');

// Cargar errores previos
async function loadErrorLog() {
  try {
    const data = await fs.readFile(ERROR_LOG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { errors: [], fixes: [] };
  }
}

// Guardar error
async function logError(errorType, errorMessage, context) {
  const log = await loadErrorLog();
  log.errors.push({
    id: Date.now(),
    type: errorType,
    message: errorMessage,
    context: context,
    timestamp: new Date().toISOString(),
    resolved: false
  });
  await fs.writeFile(ERROR_LOG_PATH, JSON.stringify(log, null, 2));
  console.log('📝 Error registrado para auto-corrección');
}

// Buscar solución para un error
async function findSolution(errorType, errorMessage) {
  const log = await loadErrorLog();
  
  // Buscar si ya resolvimos este error antes
  const existingFix = log.fixes.find(f => 
    f.errorType === errorType || 
    errorMessage.includes(f.keyword)
  );
  
  if (existingFix) {
    console.log(`✅ Solución encontrada para: ${errorType}`);
    return existingFix.solution;
  }
  
  return null;
}

// Guardar una solución exitosa
async function saveFix(errorType, errorMessage, solution, modelUsed) {
  const log = await loadErrorLog();
  
  // Extraer palabra clave del error
  const keyword = errorMessage.split(' ').slice(0, 5).join(' ');
  
  log.fixes.push({
    id: Date.now(),
    errorType: errorType,
    keyword: keyword,
    solution: solution,
    modelUsed: modelUsed,
    timestamp: new Date().toISOString(),
    successCount: 1
  });
  
  await fs.writeFile(ERROR_LOG_PATH, JSON.stringify(log, null, 2));
  console.log(`💡 Auto-corrección guardada para: ${errorType}`);
}

// Auto-corregir errores comunes
export async function autoHeal(error, context) {
  const errorMessage = error.message || error.toString();
  const errorType = error.code || error.status || 'unknown';
  
  // Registrar el error
  await logError(errorType, errorMessage, context);
  
  // Buscar solución conocida
  let solution = await findSolution(errorType, errorMessage);
  
  if (solution) {
    console.log('🔧 Aplicando auto-corrección...');
    return { healed: true, solution: solution };
  }
  
  // Casos específicos conocidos
  if (errorMessage.includes('model_decommissioned')) {
    solution = { action: 'change_model', value: 'openai/gpt-oss-20b' };
    await saveFix(errorType, errorMessage, solution, 'auto');
    return { healed: true, solution: solution };
  }
  
  if (errorMessage.includes('over capacity')) {
    const alternativeModels = [
      'openai/gpt-oss-20b',
      'llama-3.1-8b-instant', 
      'mixtral-8x7b-32768'
    ];
    solution = { action: 'rotate_model', value: alternativeModels };
    await saveFix(errorType, errorMessage, solution, 'auto');
    return { healed: true, solution: solution };
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    solution = { action: 'wait_and_retry', value: 5000 };
    await saveFix(errorType, errorMessage, solution, 'auto');
    return { healed: true, solution: solution };
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    solution = { action: 'increase_timeout', value: 30000 };
    return { healed: true, solution: solution };
  }
  
  return { healed: false, solution: null };
}

// Aplicar la corrección
export async function applyFix(solution, originalFunction, ...args) {
  switch (solution.action) {
    case 'change_model':
      // Cambiar el modelo en la configuración global
      process.env.ACTIVE_MODEL = solution.value;
      console.log(`🔄 Modelo cambiado a: ${solution.value}`);
      return await originalFunction(...args);
      
    case 'rotate_model':
      // Probar modelos alternativos
      for (const model of solution.value) {
        try {
          process.env.ACTIVE_MODEL = model;
          console.log(`🔄 Probando modelo: ${model}`);
          return await originalFunction(...args);
        } catch (err) {
          console.log(`❌ Modelo ${model} falló, probando siguiente...`);
          continue;
        } 
      }
      throw new Error('Todos los modelos fallaron');
      
    case 'wait_and_retry':
      console.log(`⏳ Esperando ${solution.value/1000} segundos antes de reintentar...`);
      await new Promise(resolve => setTimeout(resolve, solution.value));
      return await originalFunction(...args);
      
    default:
      return await originalFunction(...args);
  }
}

export async function learnFromError(error, context) {
  console.log(`📚 JARVIS aprendiendo del error: ${error.message}`);
  
  // Usar la IA para analizar el error
  const messages = [
    { role: 'system', content: 'Eres un experto debugger. Analiza este error y explica cómo solucionarlo de manera simple.' },
    { role: 'user', content: `Error: ${error.message}\nContexto: ${JSON.stringify(context)}` }
  ];
  
  // Usar el provider manager para obtener respuesta
  const { providerManager } = await import('./aiProviders/providerManager.js');
  const response = await providerManager.chat(messages);
  
  if (response.success) {
    // Guardar la solución aprendida
    const solution = {
      error: error.message,
      solution: response.content,
      context: context,
      timestamp: new Date().toISOString()
    };
    
    // Guardar en archivo o DB
    const fs = await import('fs/promises');
    const solutionsFile = path.join(process.cwd(), 'learned_solutions.json');
    
    let solutions = [];
    try {
      const data = await fs.readFile(solutionsFile, 'utf-8');
      solutions = JSON.parse(data);
    } catch (e) {}
    
    solutions.push(solution);
    await fs.writeFile(solutionsFile, JSON.stringify(solutions, null, 2));
    
    return { learned: true, solution: response.content };
  }
  
  return { learned: false };
}