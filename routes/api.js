// server/routes/api.js
import express from 'express';
import { groqService } from '../services/groqService.js';
import { edgeTtsService } from '../services/edgeTtsService.js';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { weatherService } from '../services/weatherService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ===== ENDPOINTS PARA LEER CÓDIGO DEL SERVIDOR =====

// Listar archivos del proyecto
router.get('/list-files', async (req, res) => {
  try {
    const directories = ['services', 'routes', 'middleware', 'services/aiProviders'];
    const allFiles = [];
    
    for (const dir of directories) {
      const fullPath = path.join(__dirname, '../', dir);
      try {
        const files = await fs.readdir(fullPath);
        const jsFiles = files.filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`);
        allFiles.push(...jsFiles);
      } catch (e) {
        // Directorio no existe
      }
    }
    
    res.json({
      success: true,
      files: allFiles,
      total: allFiles.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leer código de un archivo
router.post('/read-code', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || !filePath.endsWith('.js')) {
      return res.status(400).json({ error: 'Solo se permiten archivos .js' });
    }
    
    // Evitar acceso a archivos del sistema
    if (filePath.includes('..') || filePath.includes('env')) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    
    const fullPath = path.join(__dirname, '../', filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    const maxLength = 5000;
    const truncated = content.length > maxLength;
    
    res.json({
      success: true,
      filePath: filePath,
      content: truncated ? content.substring(0, maxLength) + '\n... (código truncado)' : content,
      totalLines: content.split('\n').length,
      truncated: truncated
    });
  } catch (error) {
    res.status(404).json({ error: `No se pudo leer el archivo: ${error.message}` });
  }
});

// Estadísticas de un archivo
router.post('/code-stats', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || !filePath.endsWith('.js')) {
      return res.status(400).json({ error: 'Solo se permiten archivos .js' });
    }
    
    const fullPath = path.join(__dirname, '../', filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    const functionMatches = content.match(/function\s+\w+\s*\(|async\s+function\s+\w+\s*\(|const\s+\w+\s*=\s*async?\s*\(/g) || [];
    const commentMatches = content.match(/\/\/.*/g) || [];
    
    res.json({
      success: true,
      filePath: filePath,
      stats: {
        totalLines: lines.length,
        functions: functionMatches.length,
        comments: commentMatches.length,
        sizeKB: (content.length / 1024).toFixed(2)
      }
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Endpoint para procesar texto (CON TTS INTEGRADO)
router.post('/ask', async (req, res) => {
  try {
    const { text, history = [], userName } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Decí algo' });
    }
    
    const response = await groqService.getJarvisResponse(text, userName, history);
    
    // ⚠️ NO llamar a localhost en producción
    if (response.text && response.text.trim() !== '') {
      if (process.env.NODE_ENV !== 'production') {
        // Solo en desarrollo, llamar al TTS local
        fetch('http://127.0.0.1:3001/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: response.text })
        }).catch(err => console.error('Error TTS:', err.message));
      } else {
        // En producción, el frontend maneja el TTS
        console.log('Producción: el frontend manejará el TTS');
      }
    }
    
    res.json({ success: true, text: response.text, action: response.action });
  } catch (error) {
    console.error('Error en /ask:', error);
    res.status(500).json({ error: 'Jarvis tuvo un problema' });
  }
});

// Endpoint para transcribir audio
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No enviaste audio' });
    }
    const text = await groqService.transcribeAudio(req.file.buffer);
    res.json({ success: true, text });
  } catch (error) {
    console.error('Error en /transcribe:', error);
    res.status(500).json({ error: 'No pude entender el audio' });
  }
});

// Endpoint para texto a voz (TTS)
// server/routes/api.js - ENDPOINT /speak MODIFICADO

router.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'No hay texto para hablar' });
    }
    
    console.log(`🎤 Generando voz para: "${text.substring(0, 50)}..."`);
    
    // En producción, usamos el fallback del navegador
    if (process.env.NODE_ENV === 'production') {
      return res.json({ fallback: true, text });
    }
    
    // En desarrollo, intentar con edge-tts
    try {
      const audioBuffer = await edgeTtsService.textToSpeech(text);
      if (audioBuffer) {
        res.set('Content-Type', 'audio/mpeg');
        return res.send(audioBuffer);
      }
    } catch (error) {
      console.log('Edge TTS falló, usando fallback');
    }
    
    // Fallback para todos los casos
    res.json({ fallback: true, text });
    
  } catch (error) {
    console.error('Error en /speak:', error);
    // En producción, devolver fallback en lugar de error
    if (process.env.NODE_ENV === 'production') {
      res.json({ fallback: true, text });
    } else {
      res.status(500).json({ error: 'No pude generar la voz' });
    }
  }
});

// Endpoint para estadísticas de proveedores
router.get('/providers/stats', async (req, res) => {
  try {
    const stats = await groqService.getProviderStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para reiniciar proveedores
router.post('/providers/reset', async (req, res) => {
  try {
    const { providerManager } = await import('../services/aiProviders/providerManager.js');
    providerManager.resetProviders();
    res.json({ success: true, message: 'Todos los proveedores reiniciados' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints de programación
import { codingService } from '../services/codingService.js';

router.post('/coding/learn-from-github', async (req, res) => {
  const { language, topic } = req.body;
  const result = await codingService.learnFromGitHub(language, topic);
  res.json(result);
});

router.post('/coding/exercise', async (req, res) => {
  const { language, level } = req.body;
  const exercise = codingService.generateExercise(language, level);
  res.json(exercise);
});

router.post('/coding/analyze', async (req, res) => {
  const { code, language } = req.body;
  const analysis = await codingService.analyzeCode(code, language);
  res.json(analysis);
});

router.get('/coding/resources/:language', async (req, res) => {
  const { language } = req.params;
  const resources = await codingService.getLearningResources(language);
  res.json(resources);
});

router.post('/coding/evaluate', async (req, res) => {
  const { code, language, requirements } = req.body;
  const evaluation = await codingService.evaluateCode(code, language, requirements);
  res.json(evaluation);
});

router.get('/search/stats', async (req, res) => {
  try {
    const stats = searchService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de prueba (sin dependencias complejas)
router.get('/ping', (req, res) => {
  res.json({ success: true, message: 'pong', timestamp: Date.now() });
});


// Servir archivo de voz personalizado
router.get('/voice/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Validar seguridad (solo archivos .mp3 en la carpeta voices)
  if (!filename.endsWith('.mp3')) {
    return res.status(400).json({ error: 'Solo se permiten archivos MP3' });
  }
  
  const filePath = path.join(__dirname, '../voices', filename);
  
  // Verificar si el archivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo de voz no encontrado' });
  }
  
  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(filePath);
});

// Endpoint para listar voces disponibles
router.get('/voice-list', (req, res) => {
  const voicesDir = path.join(__dirname, '../voices');
  try {
    const files = fs.readdirSync(voicesDir);
    const mp3Files = files.filter(f => f.endsWith('.mp3'));
    res.json({ success: true, voices: mp3Files });
  } catch (error) {
    res.json({ success: true, voices: [] });
  }
});


// ===== ENDPOINT PARA CREAR ARCHIVOS (solo en desarrollo/local) =====
router.post('/create-file', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    
    if (!filePath || !content) {
      return res.status(400).json({ error: 'Faltan parámetros: filePath y content' });
    }
    
    // Validar seguridad - solo archivos .js en carpetas permitidas
    if (!filePath.endsWith('.js')) {
      return res.status(400).json({ error: 'Solo se permiten archivos .js' });
    }
    
    // Evitar accesos peligrosos
    if (filePath.includes('..') || filePath.includes('.env') || filePath.includes('node_modules')) {
      return res.status(403).json({ error: 'Acceso denegado por seguridad' });
    }
    
    const fullPath = path.join(__dirname, '../', filePath);
    
    // Crear directorio si no existe
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Escribir archivo
    await fs.writeFile(fullPath, content, 'utf-8');
    
    res.json({ 
      success: true, 
      message: `✅ Archivo ${filePath} creado correctamente`,
      path: fullPath
    });
  } catch (error) {
    console.error('Error creando archivo:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ENDPOINT PARA AGREGAR CÓDIGO A UN ARCHIVO EXISTENTE =====
router.post('/append-to-file', async (req, res) => {
  try {
    const { filePath, content, position = 'end' } = req.body;
    
    if (!filePath || !content) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }
    
    const fullPath = path.join(__dirname, '../', filePath);
    
    // Crear backup automático
    const backupPath = `${fullPath}.backup_${Date.now()}`;
    const originalContent = await fs.readFile(fullPath, 'utf-8').catch(() => '');
    await fs.writeFile(backupPath, originalContent);
    
    let newContent;
    if (position === 'end') {
      newContent = originalContent + '\n\n// ===== AGREGADO POR JARVIS =====\n' + content;
    } else {
      newContent = '// ===== AGREGADO POR JARVIS =====\n' + content + '\n\n' + originalContent;
    }
    
    await fs.writeFile(fullPath, newContent, 'utf-8');
    
    res.json({ 
      success: true, 
      message: `✅ Código agregado a ${filePath}`,
      backup: path.basename(backupPath)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para clima
router.get('/weather/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const weather = await weatherService.getCurrentWeather(city);
    res.json(weather);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

