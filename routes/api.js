// server/routes/api.js
import express from 'express';
import { groqService } from '../services/groqService.js';
import { edgeTtsService } from '../services/edgeTtsService.js';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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

export default router;