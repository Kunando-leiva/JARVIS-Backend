import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function convertCertificate() {
  console.log('🔄 Convirtiendo certificado PFX a CRT/KEY...');
  
  const userProfile = os.homedir();
  const pfxPath = path.join(userProfile, 'localhost.pfx');
  const keyPath = path.join(__dirname, 'localhost.key');
  const crtPath = path.join(__dirname, 'localhost.crt');
  
  // Verificar si existe el archivo PFX
  if (!fs.existsSync(pfxPath)) {
    console.error('❌ No se encontró el archivo localhost.pfx');
    console.log('Generando nuevo certificado con OpenSSL...');
    await generateWithOpenSSL();
    return;
  }
  
  try {
    // Convertir PFX a PEM y luego extraer key y crt
    await execAsync(`openssl pkcs12 -in "${pfxPath}" -nocerts -out "${keyPath}" -nodes -password pass:temp123`, { shell: 'cmd.exe' });
    await execAsync(`openssl pkcs12 -in "${pfxPath}" -clcerts -nokeys -out "${crtPath}" -password pass:temp123`, { shell: 'cmd.exe' });
    
    console.log('✅ Certificado convertido correctamente');
    console.log(`📁 Key: ${keyPath}`);
    console.log(`📁 CRT: ${crtPath}`);
  } catch (error) {
    console.error('Error convirtiendo:', error.message);
    await generateWithOpenSSL();
  }
}

async function generateWithOpenSSL() {
  console.log('🔧 Generando certificado con OpenSSL...');
  
  // Buscar OpenSSL en rutas comunes de Windows
  const possiblePaths = [
    'C:/Program Files/Git/usr/bin/openssl.exe',
    'C:/Program Files/OpenSSL-Win64/bin/openssl.exe',
    'C:/OpenSSL-Win64/bin/openssl.exe',
    process.env.OPENSSL_CONF?.replace('openssl.cnf', 'openssl.exe') || ''
  ];
  
  let opensslPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      opensslPath = testPath;
      break;
    }
  }
  
  if (!opensslPath) {
    console.error('❌ OpenSSL no encontrado');
    console.log('\n💡 Solución rápida: Usar HTTP en lugar de HTTPS');
    console.log('Edita server/server.js y comenta las líneas de SSL');
    return;
  }
  
  try {
    // Generar clave privada
    await execAsync(`"${opensslPath}" genrsa -out localhost.key 2048`, { shell: 'cmd.exe' });
    
    // Generar certificado
    await execAsync(`"${opensslPath}" req -new -x509 -key localhost.key -out localhost.crt -days 365 -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`, { shell: 'cmd.exe' });
    
    console.log('✅ Certificado generado con OpenSSL');
  } catch (error) {
    console.error('Error generando certificado:', error.message);
  }
}

convertCertificate();