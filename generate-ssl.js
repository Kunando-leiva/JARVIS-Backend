import { writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateSSL() {
  console.log('🔐 Generando certificado SSL autofirmado...');
  
  // Comando para generar certificado con PowerShell (Windows)
  const psCommand = `
    $cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\\LocalMachine\\My" -KeyLength 2048 -KeySpec KeyExchange
    $certPath = Join-Path -Path $env:USERPROFILE -ChildPath "localhost.pfx"
    $securePassword = ConvertTo-SecureString -String "temp123" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $securePassword
    Write-Host "Certificado generado en: $certPath"
  `;
  
  try {
    await execAsync(`powershell -c "${psCommand}"`, { shell: 'powershell.exe' });
    console.log('✅ Certificado generado');
    console.log('📝 Para usar HTTPS, necesitas exportar a .crt y .key');
  } catch (error) {
    console.error('Error generando certificado:', error.message);
    console.log('\n💡 Alternativa: Usar HTTP (ya funciona, solo ignora la advertencia)');
  }
}

generateSSL();