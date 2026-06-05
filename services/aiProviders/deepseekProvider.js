// server/services/aiProviders/deepseekProvider.js

import { BaseProvider } from './baseProvider.js';

export class DeepSeekProvider extends BaseProvider {
  constructor(apiKey) {
    super('DeepSeek', {
      rpm: 5,
      rpd: 100,
      models: ['deepseek-chat', 'deepseek-coder']
    });
    
    if (!apiKey) {
      throw new Error('DeepSeek API key no proporcionada');
    }
    
    this.apiKey = apiKey;
    this.baseURL = 'https://api.deepseek.com/v1';
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.requestsToday = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.requestsToday = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`DeepSeek rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsToday >= this.config.rpd) {
      throw new Error(`DeepSeek daily limit: ${this.config.rpd} RPD`);
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          model: options.model || this.currentModel,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
          top_p: options.topP || 0.9,
          stream: false
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.requestsToday++;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: data.choices[0]?.message?.content || '',
        provider: this.name,
        model: options.model || this.currentModel,
        responseTime: responseTime,
        usage: data.usage
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