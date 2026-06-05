// server/services/firebaseService.js (VERSIÓN CON VARIABLES DIRECTAS - SIN DEPENDENCIA DE dotenv)
import admin from 'firebase-admin';

console.log('🔄 Inicializando Firebase con variables directas...');

// ============================================
// 🔥 CREDENCIALES DIRECTAS DE FIREBASE
// (Estas son las mismas que tienes en tu .env)
// ============================================
const projectId = 'jarvis-0-01';
const clientEmail = 'firebase-adminsdk-fbsvc@jarvis-0-01.iam.gserviceaccount.com';
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8VSjBsOKJ0m+e
U8jlYxWBHo8RP5iIPEC64Vv9PU+r6yB8egT0Lv51foL6goitiD1VeFUMM/BKsVbS
ZjQNxvrFhtN4CgtUyEmHJuVO6ZOch35FRF7YrVkxIOsc+L/witrnqLsvoRCi6RsL
/yh/sHcnWh7wO2RI7kuYClqPmU2vsOUvRxEyZNbvfdWN58SbUO9usNUnXfneFeZV
zJt+cT/gx1BmpLJoBCdxbknNYxy9stXnW8uKwy/xXwNQ3DHiAS/CWCR8PeehJjZN
qHaWDIuZA+acPw4VuoaXSx2f5n2mDWIJnzUlYbnPNlG9fMo8GK3K5MbqXG1McIUg
4buTc4AtAgMBAAECggEABgnP8vfeJ4+W8xNaIVquLZPif+nTVOjjpWpE1geBdrBk
/AC4iHC6SV+bSPdm9PNljgg759aBeY+aikfrGtb6otsqDBL8XoVGcD4jw4YzLKVe
e8+Pn/Bc5/mXeDgUhVyaXKuZBtOp8iM5sgaGEKQCigE2dTreQgVb6J3KXgjLCBs8
gtCWefbbGFTwx94IX8iwgAAlSaWdvoFFaj7gHPSSALyF8yT9yJnneUSEfzAvBcCU
pGKBVhGwnqiiST6vto+ljvhIdM5KFLkiydAahNxKG/j5eeqUyLE69CNijI9+9Svo
p8oSU5GnWJuRDmuOqvUK6dSW8+qJnTBKi1IvHvGfeQKBgQDj/tZkDzd4dnYnpUzg
SXo/Rn9VGIw32cCfzv0wADvFLDTmbvZU2e6kJVfS786JIdxudRvM5WhPEBHJtrYr
0C1kE1kQgGtMVG+niM5j8INNu5CycMxYNyX4vQApJdIJtWM0XfQhdSzexMiQf3Vq
vXTMC8Xd2fL7WM24Z2fX51UlFQKBgQDTdybXSPc1Fn5r7e1vK3vzDNrP2lJGEX03
PA+sVBAkkCQSeLVo9ywDI6P4gBzxLwdc8UXJB9pp7ektT9WPAmb0VLUiiCS8QPXZ
H5Gxy1uegcqf6cYE74svikTHlp0V5UoqS8oCGM1HMigblSAAvOa4+otGsQS3dbve
aC+rjZHkuQKBgAbNHFIhzhLO3dly6ecq6fWnQbclI1GrMj7SKuVarG3GUtGo77o6
Qg8tegA13SBkHTJCVhD3qvPo088Dn02RSTlaBmcinZDKWAZUY2vByfjwpnFcQgxD
oONZp/6SPUDC43G1d8njt/HxRtZgpv0HJ8vKch2bGc97p69fjk53fSe9AoGBALMl
sVkXbp6iBM4ozkqtGx/oVwNZ4PONY3hEwL5spRRkrLqdWoqnQ7kRG5ut5VcKUYGS
wV0y8v1k2XNSvAigr1n03VN45S47FkwwK3zlXCPnryJUqTaLPW40BFrWJRRkoLU+
ac/m9RmIy2O6rVcSsaAqWY2079sAuf0MZL5AfEW5AoGABpXPTJsYq93LVesZzOFZ
6YXWotX0XyjV0UshOwp6cMXsTzGccCfITpeUI2d/iEAHoMQVWX0cbJ0PEaTIHvce
w57d3p6mF1vK51UwsGv0kCtOldHYC7i40jFMGlcJOrsxNT3AsPT99vpXNJJbpPLZ
ZEL8Y0FGM64OTi3LHbzTPIs=
-----END PRIVATE KEY-----\n`;

let db;
let initialized = false;

try {
  const serviceAccount = {
    projectId: projectId,
    clientEmail: clientEmail,
    privateKey: privateKey,
  };
  
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase inicializado correctamente');
    initialized = true;
  }
  
  db = admin.firestore();
  console.log('✅ Firestore DB conectada');
} catch (error) {
  console.error('❌ Error inicializando Firebase:', error.message);
}

export const firebaseService = {
  isInitialized: () => initialized,
  
  async saveConversation(userId, userInput, jarvisResponse, action = null) {
    if (!initialized) return { success: false, error: 'Firebase no inicializado' };
    try {
      const convRef = db.collection('conversations').doc();
      await convRef.set({
        userId: userId || 'anonymous',
        userInput,
        jarvisResponse,
        action: action ? JSON.stringify(action) : null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Conversación guardada en Firebase');
      return { success: true, id: convRef.id };
    } catch (error) {
      console.error('Error guardando conversación:', error);
      return { success: false, error: error.message };
    }
  },
  
  async findSimilarResponses(userInput, limit = 3) {
    if (!initialized) return [];
    try {
      const words = userInput.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.length === 0) return [];
      
      const snapshot = await db
        .collection('conversations')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      
      const similar = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const userInputLower = data.userInput?.toLowerCase() || '';
        const matchCount = words.filter(word => userInputLower.includes(word)).length;
        if (matchCount >= words.length * 0.3) {
          similar.push({
            user_input: data.userInput,
            jarvis_response: data.jarvisResponse,
            timestamp: data.timestamp?.toDate?.() || new Date(),
            matchScore: matchCount / words.length
          });
        }
      });
      
      similar.sort((a, b) => b.matchScore - a.matchScore);
      return similar.slice(0, limit);
    } catch (error) {
      console.error('Error buscando respuestas similares:', error);
      return [];
    }
  },
  
  async savePreference(userId, key, value) {
    if (!initialized) return { success: false };
    try {
      const userRef = db.collection('users').doc(userId || 'anonymous');
      await userRef.set({
        [`preferences.${key}`]: value,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error guardando preferencia:', error);
      return { success: false };
    }
  },
  
  async getUserPreferences(userId) {
    if (!initialized) return {};
    try {
      const doc = await db.collection('users').doc(userId || 'anonymous').get();
      if (doc.exists) {
        const data = doc.data();
        return data.preferences || {};
      }
      return {};
    } catch (error) {
      console.error('Error obteniendo preferencias:', error);
      return {};
    }
  },
  
  async learnFact(fact, source = 'conversation', category = 'general') {
    if (!initialized) return { success: false, error: 'Firebase no inicializado' };
    try {
      const factRef = db.collection('learned_facts').doc();
      await factRef.set({
        fact: fact.toLowerCase(),
        source,
        category,
        confidence: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Hecho aprendido guardado en Firebase:', fact);
      return { success: true };
    } catch (error) {
      console.error('Error aprendiendo hecho:', error);
      return { success: false, error: error.message };
    }
  },
  
  async findFacts(query) {
    if (!initialized) return [];
    try {
      const snapshot = await db
        .collection('learned_facts')
        .where('fact', '>=', query.toLowerCase())
        .where('fact', '<=', query.toLowerCase() + '\uf8ff')
        .orderBy('confidence', 'desc')
        .limit(5)
        .get();
      
      const facts = [];
      snapshot.forEach(doc => {
        facts.push({ id: doc.id, ...doc.data() });
      });
      return facts;
    } catch (error) {
      console.error('Error buscando hechos:', error);
      return [];
    }
  },
  
  async saveCustomCommand(triggerPhrase, actionType, actionParam) {
    if (!initialized) return { success: false };
    try {
      const cmdRef = db.collection('custom_commands').doc(triggerPhrase.toLowerCase());
      await cmdRef.set({
        triggerPhrase: triggerPhrase.toLowerCase(),
        actionType,
        actionParam,
        usageCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      console.error('Error guardando comando:', error);
      return { success: false };
    }
  },
  
  async findCustomCommand(userInput) {
    if (!initialized) return null;
    try {
      const snapshot = await db
        .collection('custom_commands')
        .orderBy('usageCount', 'desc')
        .limit(20)
        .get();
      
      const commands = [];
      snapshot.forEach(doc => {
        commands.push({ id: doc.id, ...doc.data() });
      });
      
      for (const cmd of commands) {
        if (userInput.toLowerCase().includes(cmd.triggerPhrase)) {
          await db.collection('custom_commands').doc(cmd.id).update({
            usageCount: admin.firestore.FieldValue.increment(1),
          });
          return {
            action: { type: cmd.actionType, param: cmd.actionParam },
            matched: cmd.triggerPhrase
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error buscando comando:', error);
      return null;
    }
  },
  
  async getLearningStats() {
    if (!initialized) return { total_conversations: 0, learned_facts: 0, custom_commands: 0 };
    try {
      const [conversationsSnapshot, factsSnapshot, commandsSnapshot] = await Promise.all([
        db.collection('conversations').count().get(),
        db.collection('learned_facts').count().get(),
        db.collection('custom_commands').count().get(),
      ]);
      
      return {
        total_conversations: conversationsSnapshot.data().count,
        learned_facts: factsSnapshot.data().count,
        custom_commands: commandsSnapshot.data().count,
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { total_conversations: 0, learned_facts: 0, custom_commands: 0 };
    }
  },
  
  async healthCheck() {
    if (!initialized) return { success: false, status: 'unhealthy' };
    try {
      await db.collection('_health').doc('check').set({ timestamp: admin.firestore.FieldValue.serverTimestamp() });
      return { success: true, status: 'healthy' };
    } catch (error) {
      return { success: false, status: 'unhealthy', error: error.message };
    }
  }
};

export default firebaseService;