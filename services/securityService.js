// server/services/securityService.js
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const securityService = {
  
  // Detectar intentos de inyección SQL/XSS
  detectInjection(input) {
    if (!input) return { detected: false };
    
    const patterns = [
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bUNION\b.*\bSELECT\b)/i,
      /(<script.*>.*<\/script>)/i,
      /(\bexec\b.*\bxp_cmdshell\b)/i,
      /(\bALTER\b.*\bDATABASE\b)/i,
      /(\bCREATE\b.*\bTABLE\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bOR\s+1\s*=\s*1\b)/i,
      /(\bOR\s+1\s*=\s*1\b)/i,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          pattern: pattern.source,
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  },
  
  // Sanitizar entrada de usuario
  sanitizeInput(input) {
    if (!input) return '';
    
    let sanitized = input;
    sanitized = sanitized.replace(/[<>]/g, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+=/gi, '');
    sanitized = sanitized.replace(/&#/g, '');
    sanitized = sanitized.slice(0, 1000); // Limitar longitud
    
    return sanitized;
  },
  
 // Headers de seguridad para HTTP
securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP modificado para permitir Google Translate
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' https:; " +
    "script-src 'self' 'unsafe-inline' https://translate.googleapis.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://www.gstatic.com; " +
    "font-src 'self' data: https://www.gstatic.com; " +
    "connect-src 'self' https://translate.googleapis.com;"
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
},
  
  // Log de actividades sospechosas
  async logSecurityEvent(event) {
    const logFile = path.join(process.cwd(), 'security_logs.json');
    let logs = [];
    
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      logs = JSON.parse(content);
    } catch {
      // Archivo no existe
    }
    
    logs.push({
      id: crypto.randomBytes(8).toString('hex'),
      timestamp: new Date().toISOString(),
      ip: event.ip,
      type: event.type,
      details: event.details,
      severity: event.severity || 'medium'
    });
    
    // Mantener solo últimos 1000 logs
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    
    // Alertar en consola si es severidad alta
    if (event.severity === 'high') {
      console.error('🚨 ALERTA DE SEGURIDAD:', event);
    }
  },
  
  // Verificar integridad de archivos críticos
  async checkFileIntegrity() {
    const criticalFiles = [
      'server/server.js',
      'server/services/groqService.js',
      'server/services/actionsService.js',
      '.env'
    ];
    
    const results = [];
    
    for (const file of criticalFiles) {
      try {
        const fullPath = path.join(process.cwd(), file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        results.push({
          file,
          hash,
          status: 'ok'
        });
      } catch (error) {
        results.push({
          file,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  },
  
  // Verificar que el comando está permitido en producción
  isCommandAllowed(command) {
    const allowedCommands = [
      'SPOTIFY_PLAY',
      'SPOTIFY_PAUSE',
      'SPOTIFY_NEXT',
      'SPOTIFY_PREVIOUS',
      'SPOTIFY_VOLUME_UP',
      'SPOTIFY_VOLUME_DOWN',
      'LIGHT_ON',
      'LIGHT_OFF',
      'PS4_ON',
      'PS4_OFF',
      'AC_ON',
      'AC_OFF',
      'AC_TEMP_UP',
      'AC_TEMP_DOWN',
      'BUSCAR_PODCAST',
      'BUSCAR_CANCION',
      'BUSCAR_EN_INTERNET',
      'CLIMA',
      'HORA',
      'CHISTE',
      'TIMER'
    ];
    
    return allowedCommands.includes(command);
  }
};