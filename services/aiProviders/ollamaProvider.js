// server/services/aiProviders/ollamaProvider.js

import { BaseProvider } from './baseProvider.js';
import ollama from 'ollama';

export class OllamaProvider extends BaseProvider {
  constructor(apiKey = null) {
    super('Ollama', {
      rpm: Infinity, // Sin límites
      models: ['llama3.2:3b', 'llama3.1:8b', 'mistral:7b', 'phi3:mini']
    });
    
    this.currentModel = this.config.models[0];
    this.isAvailable = true;
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🦙 Usando Ollama (modelo local)...');
      
      const response = await ollama.chat({
        model: options.model || this.currentModel,
        messages: messages,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 500,
          top_p: options.topP || 0.9
        }
      });
      
      const responseTime = Date.now() - startTime;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: response.message.content,
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