// server/services/aiProviders/mistralProvider.js

import { BaseProvider } from './baseProvider.js';

export class MistralProvider extends BaseProvider {
  constructor(apiKey) {
    super('Mistral', {
      rpm: 60, // 1 request per second = 60 RPM
      models: ['mistral-small-3.1-24b-instruct-2503', 'mistral-medium-latest']
    });
    
    if (!apiKey) {
      throw new Error('Mistral API key no proporcionada');
    }
    
    this.apiKey = apiKey;
    this.baseURL = 'https://api.mistral.ai/v1';
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.lastRequestTime = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    // Rate limiting: 1 request per second
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Mistral rate limit: ${this.config.rpm} RPM`);
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
          random_seed: Math.floor(Math.random() * 1000000)
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.lastRequestTime = Date.now();
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