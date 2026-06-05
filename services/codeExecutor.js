// server/services/codeExecutor.js

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '../../temp_code');

// Asegurar directorio temporal
async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.log('Directorio temporal creado o ya existe');
  }
}

await ensureTempDir();

export const codeExecutor = {
  
  async executeJavaScript(code) {
    const tempFile = path.join(TEMP_DIR, `code_${Date.now()}.js`);
    
    try {
      console.log(`💾 Guardando código en: ${tempFile}`);
      await fs.writeFile(tempFile, code);
      
      console.log(`⚙️ Ejecutando código JavaScript...`);
      const { stdout, stderr } = await execAsync(`node "${tempFile}"`, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024 // 1MB de buffer
      });
      
      // Limpiar archivo temporal
      await fs.unlink(tempFile).catch(() => {});
      
      if (stderr) {
        console.log(`❌ Error: ${stderr}`);
        return {
          success: false,
          output: stderr,
          error: true
        };
      }
      
      console.log(`✅ Ejecución exitosa`);
      return {
        success: true,
        output: stdout || '✅ Código ejecutado correctamente (sin salida en consola)',
        error: false
      };
      
    } catch (error) {
      console.error(`💥 Error ejecutando: ${error.message}`);
      await fs.unlink(tempFile).catch(() => {});
      
      return {
        success: false,
        output: error.message,
        error: true
      };
    }
  },
  
  async executePython(code) {
    const tempFile = path.join(TEMP_DIR, `code_${Date.now()}.py`);
    
    try {
      await fs.writeFile(tempFile, code);
      
      console.log(`⚙️ Ejecutando código Python...`);
      const { stdout, stderr } = await execAsync(`python "${tempFile}"`, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024
      });
      
      await fs.unlink(tempFile).catch(() => {});
      
      if (stderr) {
        return {
          success: false,
          output: stderr,
          error: true
        };
      }
      
      return {
        success: true,
        output: stdout || '✅ Código ejecutado correctamente',
        error: false
      };
      
    } catch (error) {
      await fs.unlink(tempFile).catch(() => {});
      return {
        success: false,
        output: error.message,
        error: true
      };
    }
  },
  
  async executeCommand(command) {
    try {
      console.log(`⚙️ Ejecutando comando: ${command}`);
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 10000,
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
      });
      
      if (stderr) {
        return {
          success: false,
          output: stderr,
          error: true
        };
      }
      
      return {
        success: true,
        output: stdout || '✅ Comando ejecutado correctamente',
        error: false
      };
      
    } catch (error) {
      return {
        success: false,
        output: error.message,
        error: true
      };
    }
  }
};