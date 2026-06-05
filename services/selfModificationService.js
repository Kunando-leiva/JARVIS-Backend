// server/services/selfModificationService.js

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../..');


export const selfModificationService = {
  
    // Agregar este método para listar archivos reales del proyecto
async listProjectFiles() {
  const directories = [
    'server/services',
    'server/services/aiProviders',
    'server/routes',
    'server'
  ];
  
  const allFiles = [];
  
  for (const dir of directories) {
    try {
      const fullPath = path.join(PROJECT_ROOT, dir);
      const files = await fs.readdir(fullPath);
      const jsFiles = files.filter(f => f.endsWith('.js')).map(f => `${dir}/${f}`);
      allFiles.push(...jsFiles);
    } catch (error) {
      // Ignorar directorios que no existen
    }
  }
  
  return allFiles;
},

// Verificar si un archivo existe
async fileExists(filePath) {
  try {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
},

// Buscar función en archivo
async searchFunctionInFile(filePath, functionName) {
  const exists = await this.fileExists(filePath);
  if (!exists) {
    return { success: false, error: `El archivo ${filePath} no existe` };
  }
  
  const result = await this.readFile(filePath);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const content = result.content;
  const functionPattern = new RegExp(`(function\\s+${functionName}\\s*\\(|const\\s+${functionName}\\s*=\\s*function|async\\s+function\\s+${functionName}\\s*\\(|${functionName}\\s*:\\s*async\\s*\\()`, 'g');
  
  if (functionPattern.test(content)) {
    // Encontrar la función completa (aproximadamente)
    const lines = content.split('\n');
    let startLine = -1;
    let braceCount = 0;
    let functionContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(functionPattern)) {
        startLine = i;
        break;
      }
    }
    
    if (startLine !== -1) {
      for (let i = startLine; i < lines.length; i++) {
        functionContent += lines[i] + '\n';
        braceCount += (lines[i].match(/{/g) || []).length;
        braceCount -= (lines[i].match(/}/g) || []).length;
        if (braceCount === 0 && functionContent.includes('{')) {
          break;
        }
      }
    }
    
    return { success: true, content: functionContent, line: startLine + 1 };
  }
  
  return { success: false, error: `La función "${functionName}" no existe en ${filePath}` };
},


  // Leer cualquier archivo del proyecto
  async readFile(filePath) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, content, path: fullPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Modificar un archivo
  async modifyFile(filePath, newContent) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      
      // Crear backup antes de modificar
      const backupPath = `${fullPath}.backup_${Date.now()}`;
      const originalContent = await fs.readFile(fullPath, 'utf-8');
      await fs.writeFile(backupPath, originalContent);
      
      // Escribir nuevo contenido
      await fs.writeFile(fullPath, newContent, 'utf-8');
      
      return { 
        success: true, 
        message: `✅ Archivo modificado: ${filePath}\n📦 Backup: ${path.basename(backupPath)}`,
        backupPath 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Agregar una nueva función a un archivo
  async addFunction(filePath, functionName, functionCode) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const currentContent = await fs.readFile(fullPath, 'utf-8');
      
      const newFunction = `
// ===== FUNCIÓN AGREGADA POR JARVIS: ${functionName} =====
${functionCode}

`;
      
      // Insertar antes del último export
      const lastExportIndex = currentContent.lastIndexOf('export');
      let newContent;
      
      if (lastExportIndex !== -1) {
        newContent = currentContent.slice(0, lastExportIndex) + newFunction + currentContent.slice(lastExportIndex);
      } else {
        newContent = currentContent + newFunction;
      }
      
      return await this.modifyFile(filePath, newContent);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Agregar un nuevo comando a detectCommandLocally
  async addVoiceCommand(commandPhrase, responseText, actionType) {
    try {
      const filePath = 'server/services/groqService.js';
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      const newCommand = `
  // ===== COMANDO AGREGADO POR JARVIS: ${commandPhrase} =====
  if (msg.includes('${commandPhrase.toLowerCase()}')) {
    return {
      action: { type: '${actionType}', param: '' },
      response: '${responseText}'
    };
  }
`;
      
      // Buscar el final de la función detectCommandLocally
      const functionEnd = content.indexOf('return null;', content.indexOf('function detectCommandLocally'));
      const insertPosition = content.lastIndexOf('}', functionEnd);
      
      const newContent = content.slice(0, insertPosition) + newCommand + content.slice(insertPosition);
      
      return await this.modifyFile(filePath, newContent);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Restaurar backup
  async restoreBackup(filePath, backupName) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const backupPath = path.join(path.dirname(fullPath), backupName);
      
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      await fs.writeFile(fullPath, backupContent);
      
      return { success: true, message: `✅ Restaurado backup: ${backupName}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Listar backups disponibles
  async listBackups(filePath) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const dir = path.dirname(fullPath);
      const files = await fs.readdir(dir);
      const backups = files.filter(f => f.includes('.backup_'));
      return { success: true, backups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Crear una nueva función personalizada
  async createCustomFunction(functionName, functionCode, filePath = 'server/services/customFunctions.js') {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      
      // Verificar si el archivo existe, si no, crearlo
      let content;
      try {
        content = await fs.readFile(fullPath, 'utf-8');
      } catch {
        content = `// server/services/customFunctions.js\n// Funciones personalizadas creadas por JARVIS\n\n`;
        await fs.writeFile(fullPath, content);
      }
      
      const newFunction = `
export async function ${functionName}() {
  ${functionCode}
}
`;
      
      const newContent = content + newFunction;
      return await this.modifyFile(filePath, newContent);
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // Obtener estadísticas del código
  async getCodeStats(filePath) {
    try {
      const fullPath = path.join(PROJECT_ROOT, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const functions = content.match(/function\s+\w+\s*\(/g) || [];
      const asyncFunctions = content.match(/async\s+function\s+\w+\s*\(/g) || [];
      const comments = content.match(/\/\/.*/g) || [];
      
      return {
        success: true,
        stats: {
          lines: lines.length,
          functions: functions.length,
          asyncFunctions: asyncFunctions.length,
          comments: comments.length,
          sizeKB: (content.length / 1024).toFixed(2)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
};