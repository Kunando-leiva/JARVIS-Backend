import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let db;

export async function initLearningDB() {
  db = await open({
    filename: path.join(__dirname, '../jarvis_memory.db'),
    driver: sqlite3.Database
  });
  
  // Crear tablas si no existen
  await db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_input TEXT NOT NULL,
      jarvis_response TEXT NOT NULL,
      action_taken TEXT,
      user_satisfied BOOLEAN DEFAULT 1,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT,
      preference_key TEXT NOT NULL,
      preference_value TEXT NOT NULL,
      confidence INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS learned_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fact TEXT NOT NULL UNIQUE,
      category TEXT,
      source TEXT,
      confidence INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS custom_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_phrase TEXT NOT NULL UNIQUE,
      action_type TEXT NOT NULL,
      action_param TEXT,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS learning_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stat_name TEXT UNIQUE,
      stat_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Verificar y agregar columna action_taken si no existe
  try {
    const tableInfo = await db.all(`PRAGMA table_info(conversations)`);
    const hasActionTaken = tableInfo.some(col => col.name === 'action_taken');
    if (!hasActionTaken) {
      console.log('📝 Agregando columna action_taken...');
      await db.exec(`ALTER TABLE conversations ADD COLUMN action_taken TEXT`);
    }
    
    const hasUserSatisfied = tableInfo.some(col => col.name === 'user_satisfied');
    if (!hasUserSatisfied) {
      console.log('📝 Agregando columna user_satisfied...');
      await db.exec(`ALTER TABLE conversations ADD COLUMN user_satisfied BOOLEAN DEFAULT 1`);
    }
    
    // Verificar columna category en learned_facts
    const factsInfo = await db.all(`PRAGMA table_info(learned_facts)`);
    const hasCategory = factsInfo.some(col => col.name === 'category');
    if (!hasCategory) {
      console.log('📝 Agregando columna category a learned_facts...');
      await db.exec(`ALTER TABLE learned_facts ADD COLUMN category TEXT`);
    }
    
    const hasSource = factsInfo.some(col => col.name === 'source');
    if (!hasSource) {
      console.log('📝 Agregando columna source a learned_facts...');
      await db.exec(`ALTER TABLE learned_facts ADD COLUMN source TEXT`);
    }
    
    const hasConfidence = factsInfo.some(col => col.name === 'confidence');
    if (!hasConfidence) {
      console.log('📝 Agregando columna confidence a learned_facts...');
      await db.exec(`ALTER TABLE learned_facts ADD COLUMN confidence INTEGER DEFAULT 1`);
    }
    
  } catch (error) {
    console.error('Error actualizando tablas:', error);
  }
  
  await initStats();
  console.log('🧠 Base de datos de aprendizaje inicializada');
}

async function initStats() {
  const stats = ['total_conversations', 'learned_facts', 'custom_commands', 'user_preferences'];
  for (const stat of stats) {
    try {
      await db.run(`INSERT OR IGNORE INTO learning_stats (stat_name, stat_value) VALUES (?, ?)`, [stat, '0']);
    } catch (error) {
      console.error(`Error inicializando stat ${stat}:`, error);
    }
  }
}

export async function saveInteraction(userInput, jarvisResponse, action = null, userSatisfied = true) {
  if (!db) await initLearningDB();
  try {
    const actionStr = action ? JSON.stringify(action) : null;
    await db.run(
      `INSERT INTO conversations (user_input, jarvis_response, action_taken, user_satisfied) VALUES (?, ?, ?, ?)`,
      [userInput, jarvisResponse, actionStr, userSatisfied ? 1 : 0]
    );
    await db.run(`UPDATE learning_stats SET stat_value = CAST(stat_value AS INTEGER) + 1 WHERE stat_name = 'total_conversations'`);
  } catch (error) {
    console.error('Error guardando interacción:', error);
  }
}

export async function findSimilarPastResponse(userInput, limit = 3) {
  if (!db) await initLearningDB();
  try {
    const words = userInput.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return [];
    
    let query = `SELECT user_input, jarvis_response, timestamp, action_taken FROM conversations WHERE user_satisfied = 1 AND (`;
    const params = [];
    
    words.forEach((word, i) => {
      query += `user_input LIKE ? ${i < words.length - 1 ? ' OR ' : ')'}`;
      params.push(`%${word}%`);
    });
    
    query += ` ORDER BY timestamp DESC LIMIT ${limit}`;
    const results = await db.all(query, params);
    return results;
  } catch (error) {
    console.error('Error buscando respuestas similares:', error);
    return [];
  }
}

export async function savePreference(userName, key, value) {
  if (!db) await initLearningDB();
  try {
    const existing = await db.get(`SELECT * FROM user_preferences WHERE user_name = ? AND preference_key = ?`, [userName, key]);
    if (existing) {
      await db.run(`UPDATE user_preferences SET preference_value = ?, confidence = confidence + 1 WHERE user_name = ? AND preference_key = ?`, [value, userName, key]);
    } else {
      await db.run(`INSERT INTO user_preferences (user_name, preference_key, preference_value) VALUES (?, ?, ?)`, [userName, key, value]);
      await db.run(`UPDATE learning_stats SET stat_value = CAST(stat_value AS INTEGER) + 1 WHERE stat_name = 'user_preferences'`);
    }
  } catch (error) {
    console.error('Error guardando preferencia:', error);
  }
}

export async function getUserPreferences(userName) {
  if (!db) await initLearningDB();
  try {
    const prefs = await db.all(`SELECT preference_key, preference_value FROM user_preferences WHERE user_name = ? ORDER BY confidence DESC`, [userName]);
    return prefs;
  } catch (error) {
    console.error('Error obteniendo preferencias:', error);
    return [];
  }
}

export async function learnFact(fact, source = 'conversation', category = 'general') {
  if (!db) await initLearningDB();
  try {
    const cleanFact = fact.trim().toLowerCase();
    await db.run(`INSERT OR IGNORE INTO learned_facts (fact, source, category) VALUES (?, ?, ?)`, [cleanFact, source, category]);
    await db.run(`UPDATE learned_facts SET confidence = confidence + 1 WHERE fact = ?`, [cleanFact]);
    await db.run(`UPDATE learning_stats SET stat_value = CAST(stat_value AS INTEGER) + 1 WHERE stat_name = 'learned_facts'`);
  } catch (error) {
    console.error('Error aprendiendo hecho:', error);
  }
}

export async function saveCustomCommand(triggerPhrase, actionType, actionParam) {
  if (!db) await initLearningDB();
  try {
    const cleanTrigger = triggerPhrase.toLowerCase().trim();
    await db.run(`INSERT OR REPLACE INTO custom_commands (trigger_phrase, action_type, action_param) VALUES (?, ?, ?)`, [cleanTrigger, actionType, actionParam]);
    await db.run(`UPDATE learning_stats SET stat_value = CAST(stat_value AS INTEGER) + 1 WHERE stat_name = 'custom_commands'`);
  } catch (error) {
    console.error('Error guardando comando personalizado:', error);
  }
}

export async function findCustomCommand(userInput) {
  if (!db) await initLearningDB();
  try {
    const commands = await db.all(`SELECT trigger_phrase, action_type, action_param, usage_count FROM custom_commands ORDER BY usage_count DESC`);
    for (const cmd of commands) {
      if (userInput.toLowerCase().includes(cmd.trigger_phrase)) {
        await db.run(`UPDATE custom_commands SET usage_count = usage_count + 1 WHERE trigger_phrase = ?`, [cmd.trigger_phrase]);
        return { action: { type: cmd.action_type, param: cmd.action_param }, matched: cmd.trigger_phrase };
      }
    }
    return null;
  } catch (error) {
    console.error('Error buscando comando personalizado:', error);
    return null;
  }
}

export async function getLearningStats() {
  if (!db) await initLearningDB();
  try {
    const stats = await db.all(`SELECT stat_name, stat_value FROM learning_stats`);
    const result = {};
    stats.forEach(s => result[s.stat_name] = s.stat_value);
    return result;
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return {};
  }
}

export async function findFact(query) {
  if (!db) await initLearningDB();
  try {
    const facts = await db.all(`SELECT fact, confidence, category FROM learned_facts WHERE fact LIKE ? ORDER BY confidence DESC LIMIT 3`, [`%${query.toLowerCase()}%`]);
    return facts;
  } catch (error) {
    console.error('Error buscando hechos:', error);
    return [];
  }
}

export async function clearDatabase() {
  if (!db) await initLearningDB();
  try {
    await db.exec(`DELETE FROM conversations`);
    await db.exec(`DELETE FROM user_preferences`);
    await db.exec(`DELETE FROM learned_facts`);
    await db.exec(`DELETE FROM custom_commands`);
    await db.exec(`UPDATE learning_stats SET stat_value = '0'`);
    console.log('🗑️ Base de datos limpiada');
    return { success: true, message: 'Base de datos limpiada' };
  } catch (error) {
    console.error('Error limpiando base de datos:', error);
    return { success: false, message: error.message };
  }
}
