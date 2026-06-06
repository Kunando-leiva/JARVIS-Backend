// server/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import { actionService } from './services/actionsService.js';
import { securityService } from './services/securityService.js';
import { authMiddleware, rateLimitMiddleware } from './middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { initLearningDB } from './services/learningService.js';

dotenv.config();

// ===== INICIALIZAR APP PRIMERO =====
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Configuración de CORS - más permisiva para pruebas
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://jarvis-frontend-ten-tau.vercel.app',
  'https://jarvis-frontend-74pd.vercel.app',
  'https://jarvis-frontend.vercel.app',
  'https://jarvis-frontend-ochre.vercel.app'  // Agregado el que faltaba
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS bloqueado: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// ===== SECURITY HEADERS =====
app.use(securityService.securityHeaders);

// ===== LIMITAR TAMAÑO DE PETICIONES =====
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ===== RATE LIMITING GLOBAL =====
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Demasiadas peticiones, esperá un momento'
});
app.use('/api/', globalLimiter);
app.use('/api/', rateLimitMiddleware);

// ===== VALIDACIÓN DE INPUTS =====
app.use((req, res, next) => {
  if (req.body.text) {
    // Detectar inyección
    const injection = securityService.detectInjection(req.body.text);
    if (injection.detected) {
      securityService.logSecurityEvent({
        ip: req.ip,
        type: 'INJECTION_ATTEMPT',
        details: injection,
        severity: 'high'
      });
      return res.status(403).json({ error: 'Entrada no válida' });
    }
    
    // Sanitizar
    req.body.text = securityService.sanitizeInput(req.body.text);
  }
  next();
});

// ===== AUTENTICACIÓN (solo en producción) =====
if (process.env.NODE_ENV === 'production') {
  console.log('🔒 Modo producción: Autenticación requerida');
  app.use('/api', authMiddleware);
  app.use('/auth', authMiddleware);
} else {
  console.log('🔓 Modo desarrollo: Autenticación desactivada');
}

// ===== ROUTES =====
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);

// ===== HEALTH CHECK (público) =====
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Jarvis online', 
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ===== WEBSOCKET CON AUTENTICACIÓN =====
wss.on('connection', (ws, req) => {
  // Verificar API key en WebSocket (solo en producción)
  if (process.env.NODE_ENV === 'production') {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.JARVIS_API_KEY;
    
    if (!apiKey || apiKey !== validKey) {
      ws.close(1008, 'No autorizado');
      console.log('❌ WebSocket: Conexión rechazada por falta de API key');
      return;
    }
  }
  
  console.log('✅ Cliente conectado a Jarvis WebSocket');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Validar comando permitido en producción
      if (process.env.NODE_ENV === 'production') {
        const { validateCommand } = await import('./middleware/auth.js');
        const validation = validateCommand(data.action);
        if (!validation.allowed) {
          ws.send(JSON.stringify({ type: 'error', message: validation.reason }));
          return;
        }
      }
      
      if (data.type === 'execute_action') {
        const result = await actionService.execute(data.action, data.param, data.userName);
        ws.send(JSON.stringify({ type: 'action_result', result }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
  
  ws.send(JSON.stringify({ type: 'connected', message: 'Conectado a Jarvis' }));
});

// ===== VERIFICACIÓN DE INTEGRIDAD (cada hora en producción) =====
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    const integrity = await securityService.checkFileIntegrity();
    const issues = integrity.filter(i => i.status !== 'ok');
    if (issues.length > 0) {
      console.error('🚨 INTEGRIDAD COMPROMETIDA:', issues);
      await securityService.logSecurityEvent({
        ip: 'system',
        type: 'FILE_INTEGRITY_CHECK',
        details: issues,
        severity: 'high'
      });
    }
  }, 60 * 60 * 1000);
}

// ===== INICIALIZAR BASE DE DATOS =====
await initLearningDB();

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🟢 Jarvis backend corriendo en http://0.0.0.0:${PORT}`);
  console.log(`🛡️ Modo: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🔑 API Key requerida: ${process.env.JARVIS_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
  }
  console.log(`📡 WebSocket disponible en ws://0.0.0.0:${PORT}\n`);
});