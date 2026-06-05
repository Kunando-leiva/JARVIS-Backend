// server/services/aiProviders/geminiProvider.js

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider } from './baseProvider.js';

export class GeminiProvider extends BaseProvider {
  constructor(apiKey) {
    super('Gemini', {
      rpm: 10,
      rpd: 250,
      models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro']
    });
    
    if (!apiKey) {
      throw new Error('Gemini API key no proporcionada');
    }
    
    this.client = new GoogleGenerativeAI(apiKey);
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.requestsToday = 0;
    
    // Resetear contadores
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.requestsToday = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    // Verificar rate limits
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Gemini rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsToday >= this.config.rpd) {
      throw new Error(`Gemini daily limit: ${this.config.rpd} RPD`);
    }

    try {
      // Convertir mensajes al formato de Gemini
      const model = this.client.getGenerativeModel({ 
        model: options.model || this.currentModel 
      });
      
      // Extraer el último mensaje del usuario
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${lastUserMessage?.content || ''}` : lastUserMessage?.content || '';
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 500,
          topP: options.topP || 0.9
        }
      });
      
      const response = result.response;
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.requestsToday++;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: response.text(),
        provider: this.name,
        model: options.model || this.currentModel,
        responseTime: responseTime
      };
      
    } catch (error) {
      this.recordFailure(error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }
}