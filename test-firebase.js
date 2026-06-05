// test-firebase.js
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔄 Probando conexión a Firebase...');

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

console.log('Project ID:', serviceAccount.projectId);
console.log('Client Email:', serviceAccount.clientEmail);
console.log('Private Key exists:', !!serviceAccount.privateKey);

try {
  // Inicializar solo si no está ya inicializado
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase inicializado correctamente');
  }
  
  const db = admin.firestore();
  
  // Probar escritura
  const testRef = db.collection('test').doc('test_' + Date.now());
  await testRef.set({
    message: 'Test exitoso desde JARVIS',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✅ Escritura en Firestore exitosa!');
  
  // Probar lectura
  const doc = await testRef.get();
  console.log('✅ Lectura exitosa:', doc.data());
  
  console.log('\n🎉 TODO FUNCIONA CORRECTAMENTE!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Detalles:', error);
}

process.exit(0);
