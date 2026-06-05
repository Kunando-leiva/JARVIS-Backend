// server/services/aiProviders/cohereProvider.js

import { BaseProvider } from './baseProvider.js';

export class CohereProvider extends BaseProvider {
  constructor(apiKey) {
    super('Cohere', {
      rpm: 20,
      monthlyLimit: 1000,
      models: ['command-r-plus', 'command-r']
    });
    
    if (!apiKey) {
      throw new Error('Cohere API key no proporcionada');
    }
    
    this.apiKey = apiKey;
    this.baseURL = 'https://api.cohere.ai/v1';
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.requestsThisMonth = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    // Reset mensual (aproximado)
    setInterval(() => { this.requestsThisMonth = 0; }, 30 * 24 * 60 * 60 * 1000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Cohere rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsThisMonth >= this.config.monthlyLimit) {
      throw new Error(`Cohere monthly limit reached: ${this.config.monthlyLimit}`);
    }

    try {
      // Cohere usa un formato diferente
      const chatHistory = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content
      }));
      
      const lastMessage = messages[messages.length - 1];
      
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: lastMessage.content,
          chat_history: chatHistory,
          model: options.model || this.currentModel,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
          p: options.topP || 0.9
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.requestsThisMonth++;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: data.text,
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