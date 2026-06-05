// server/middleware/auth.js
import crypto from 'crypto';

// Generar token seguro (para crear tu API key)
export function generateSecureToken() {
  return `jarvis_${crypto.randomBytes(32).toString('hex')}_${Date.now()}`;
}

// Middleware de autenticación principal
export function authMiddleware(req, res, next) {
  // En desarrollo, permitir localhost sin autenticación
  const isLocalRequest = req.socket.localAddress === req.socket.remoteAddress ||
                         req.headers.host?.includes('localhost') ||
                         req.headers.host?.includes('127.0.0.1');
  
  if (process.env.NODE_ENV !== 'production' && isLocalRequest) {
    return next();
  }
  
  // En producción, requerir API key
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.JARVIS_API_KEY;
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'No autorizado',
      message: 'Se requiere API key. Incluye el header: x-api-key'
    });
  }
  
  if (apiKey !== validKey) {
    return res.status(403).json({ 
      error: 'Acceso denegado',
      message: 'API key inválida'
    });
  }
  
  next();
}

// Rate limiting por IP (para prevenir ataques)
const requestCounts = new Map();

export function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 30; // máximo 30 peticiones por minuto
  
  // Limpiar entradas antiguas
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.firstRequest > windowMs) {
      requestCounts.delete(key);
    }
  }
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, firstRequest: now });
    return next();
  }
  
  const userRequests = requestCounts.get(ip);
  
  if (userRequests.count >= maxRequests) {
    return res.status(429).json({ 
      error: 'Demasiadas peticiones',
      message: `Has excedido el límite de ${maxRequests} peticiones por minuto`,
      retryAfter: Math.ceil((windowMs - (now - userRequests.firstRequest)) / 1000)
    });
  }
  
  userRequests.count++;
  requestCounts.set(ip, userRequests);
  next();
}

// Validación de comandos peligrosos
export function validateCommand(command) {
  const blockedCommands = [
    'APAGAR_PC',
    'REINICIAR_PC',
    'EJECUTAR_CODIGO',
    'MODIFY_CODE',
    'RESTORE_BACKUP'
  ];
  
  if (blockedCommands.includes(command)) {
    return { 
      allowed: false, 
      reason: `Comando ${command} no permitido en producción por seguridad` 
    };
  }
  
  return { allowed: true };
}