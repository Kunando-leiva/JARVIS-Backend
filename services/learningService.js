// server/services/learningService.js (VERSIÓN SIMPLIFICADA)
import { firebaseService } from './firebaseService.js';

// Exportar funciones compatibles con el código existente
export const saveInteraction = async (userInput, jarvisResponse, action, userSatisfied = true) => {
  return await firebaseService.saveConversation('default', userInput, jarvisResponse, action);
};

export const findSimilarPastResponse = async (userInput, limit = 3) => {
  return await firebaseService.findSimilarResponses(userInput, limit);
};

export const savePreference = async (userName, key, value) => {
  return await firebaseService.savePreference(userName, key, value);
};

export const getUserPreferences = async (userName) => {
  const prefs = await firebaseService.getUserPreferences(userName);
  return Object.entries(prefs).map(([key, value]) => ({ preference_key: key, preference_value: value }));
};

export const learnFact = async (fact, source, category) => {
  return await firebaseService.learnFact(fact, source, category);
};

export const findFact = async (query) => {
  return await firebaseService.findFacts(query);
};

export const saveCustomCommand = async (triggerPhrase, actionType, actionParam) => {
  return await firebaseService.saveCustomCommand(triggerPhrase, actionType, actionParam);
};

export const findCustomCommand = async (userInput) => {
  return await firebaseService.findCustomCommand(userInput);
};

export const getLearningStats = async () => {
  return await firebaseService.getLearningStats();
};

export const initLearningDB = async () => {
  console.log('✅ Firebase Firestore listo para usar');
  return { success: true };
};

export const clearDatabase = async () => {
  return { success: false, message: 'No implementado en Firebase' };
};



