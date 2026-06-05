// server/services/codingService.js - NUEVO SERVICIO DE PROGRAMACIÓN

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodingService {
  constructor() {
    this.knowledgeBase = new Map();
    this.codeExamples = new Map();
    this.learningProgress = new Map();
    this.supportedLanguages = ['javascript', 'python', 'java', 'cpp', 'go', 'rust', 'html', 'css', 'sql'];
    this.initKnowledgeBase();
  }

  initKnowledgeBase() {
    // Base de conocimiento inicial
    this.knowledgeBase.set('javascript', {
      concepts: ['variables', 'functions', 'closures', 'promises', 'async/await', 'classes', 'modules', 'event-loop'],
      frameworks: ['react', 'node', 'express', 'vue', 'angular'],
      difficulty: 'intermediate'
    });
    
    this.knowledgeBase.set('python', {
      concepts: ['list-comprehension', 'decorators', 'generators', 'context-managers', 'duck-typing'],
      frameworks: ['django', 'flask', 'fastapi', 'pandas'],
      difficulty: 'beginner'
    });
    
    // Más lenguajes...
  }

  // 1. Aprender de repositorios de GitHub (gratis)
  async learnFromGitHub(language, topic) {
    try {
      const searchQuery = `${topic} language:${language} stars:>50`;
      const response = await axios.get(`https://api.github.com/search/repositories`, {
        params: {
          q: searchQuery,
          sort: 'stars',
          order: 'desc',
          per_page: 5
        },
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      const repos = response.data.items.map(repo => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language,
        topics: repo.topics
      }));
      
      return {
        success: true,
        repos: repos,
        message: `Encontré ${repos.length} repositorios populares de ${topic} en ${language}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 2. Obtener documentación oficial (gratis)
  async getDocumentation(language, topic) {
    const docsUrls = {
      javascript: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      python: 'https://docs.python.org/3/',
      react: 'https://react.dev/',
      node: 'https://nodejs.org/docs/',
      express: 'https://expressjs.com/',
      django: 'https://docs.djangoproject.com/'
    };
    
    const url = docsUrls[language.toLowerCase()] || docsUrls[topic.toLowerCase()];
    
    if (url) {
      return {
        success: true,
        documentation: url,
        message: `Documentación oficial: ${url}`
      };
    }
    
    // Búsqueda alternativa
    const searchUrl = `https://devdocs.io/#q=${topic || language}`;
    return {
      success: true,
      documentation: searchUrl,
      message: `Puedes encontrar documentación en: ${searchUrl}`
    };
  }

  // 3. Analizar y aprender de código
  async analyzeCode(code, language) {
    const analysis = {
      lines: code.split('\n').length,
      complexity: this.calculateComplexity(code),
      patterns: this.detectPatterns(code, language),
      suggestions: [],
      improvements: []
    };
    
    // Detectar patrones y dar sugerencias
    if (code.includes('console.log') && language === 'javascript') {
      analysis.suggestions.push('Consider usar debugging tools en lugar de console.log');
    }
    
    if (code.includes('setTimeout') && !code.includes('clearTimeout')) {
      analysis.suggestions.push('Asegúrate de limpiar los timeouts para evitar memory leaks');
    }
    
    // Guardar patrón aprendido
    await this.saveCodePattern(code, language);
    
    return analysis;
  }

  calculateComplexity(code) {
    let complexity = 0;
    complexity += (code.match(/if|else|switch|case/g) || []).length;
    complexity += (code.match(/for|while|map|filter|reduce/g) || []).length;
    complexity += (code.match(/function|=>/g) || []).length;
    return complexity;
  }

  detectPatterns(code, language) {
    const patterns = [];
    
    if (code.includes('async') && code.includes('await')) {
      patterns.push('async/await');
    }
    
    if (code.includes('Promise')) {
      patterns.push('promises');
    }
    
    if (code.includes('class') && code.includes('extends')) {
      patterns.push('inheritance');
    }
    
    return patterns;
  }

  async saveCodePattern(code, language) {
    const pattern = {
      code: code.substring(0, 500),
      language: language,
      timestamp: new Date().toISOString(),
      hash: this.hashCode(code)
    };
    
    // Guardar en archivo o base de datos
    const patternsFile = path.join(process.cwd(), 'learned_patterns.json');
    let patterns = [];
    
    try {
      const data = await fs.readFile(patternsFile, 'utf-8');
      patterns = JSON.parse(data);
    } catch (error) {
      // Archivo no existe, crear nuevo
    }
    
    patterns.push(pattern);
    await fs.writeFile(patternsFile, JSON.stringify(patterns, null, 2));
    
    console.log(`📚 Nuevo patrón de código aprendido en ${language}`);
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  // 4. Generar ejercicios de práctica
  generateExercise(language, level = 'beginner') {
    const exercises = {
      javascript: {
        beginner: [
          'Escribe una función que sume dos números',
          'Crea un array y ordénalo alfabéticamente',
          'Implementa un contador usando closures'
        ],
        intermediate: [
          'Implementa una función memoize para cachear resultados',
          'Crea un Observable básico',
          'Implementa un debounce function'
        ],
        advanced: [
          'Implementa un virtual DOM simple',
          'Crea tu propio Promise polyfill',
          'Implementa un sistema de reactive data binding'
        ]
      },
      python: {
        beginner: [
          'Implementa una función que invierta un string',
          'Crea una list comprehension para filtrar números pares',
          'Escribe un decorador simple'
        ],
        intermediate: [
          'Implementa un context manager personalizado',
          'Crea un generator para números de Fibonacci',
          'Implementa un decorador con parámetros'
        ]
      }
    };
    
    const langExercises = exercises[language.toLowerCase()];
    if (langExercises && langExercises[level]) {
      const exerciseList = langExercises[level];
      const randomExercise = exerciseList[Math.floor(Math.random() * exerciseList.length)];
      
      return {
        language: language,
        level: level,
        exercise: randomExercise,
        hint: this.getHintForExercise(randomExercise, language),
        solution: this.getSolutionForExercise(randomExercise, language)
      };
    }
    
    return null;
  }

  getHintForExercise(exercise, language) {
    const hints = {
      'suma': 'Usa la función reduce o un loop simple',
      'array': 'Investiga el método sort()',
      'contador': 'Considera usar una variable dentro de la closure',
      'invierta': 'Puedes usar slicing: string[::-1]',
      'pares': 'Filtra con condition: x % 2 == 0'
    };
    
    for (const [key, hint] of Object.entries(hints)) {
      if (exercise.includes(key)) {
        return hint;
      }
    }
    return 'Revisa la documentación oficial del lenguaje';
  }

  getSolutionForExercise(exercise, language) {
    // Soluciones predefinidas (simplificado)
    if (exercise.includes('suma dos números')) {
      return language === 'javascript' 
        ? 'const sum = (a, b) => a + b;'
        : 'def sum(a, b): return a + b';
    }
    return 'La solución dependerá de tu implementación. ¡Inténtalo primero!';
  }

  // 5. Aprender de sitios web gratuitos
  async getLearningResources(language) {
    const resources = {
      javascript: [
        { name: 'JavaScript.info', url: 'https://javascript.info', free: true },
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', free: true },
        { name: 'FreeCodeCamp', url: 'https://freecodecamp.org', free: true },
        { name: 'The Odin Project', url: 'https://theodinproject.com', free: true }
      ],
      python: [
        { name: 'Python.org Tutorial', url: 'https://docs.python.org/3/tutorial/', free: true },
        { name: 'Real Python', url: 'https://realpython.com', free: true },
        { name: 'PyNative', url: 'https://pynative.com', free: true }
      ],
      general: [
        { name: 'GitHub Learning Lab', url: 'https://lab.github.com', free: true },
        { name: 'Exercism', url: 'https://exercism.org', free: true },
        { name: 'Codecademy (Free tier)', url: 'https://codecademy.com', free: true },
        { name: 'W3Schools', url: 'https://w3schools.com', free: true }
      ]
    };
    
    const langResources = resources[language.toLowerCase()] || [];
    return [...langResources, ...resources.general];
  }

  // 6. Evaluar código y dar feedback
  async evaluateCode(code, language, requirements = []) {
    const evaluation = {
      score: 0,
      feedback: [],
      errors: [],
      warnings: [],
      improvements: []
    };
    
    // Verificar sintaxis básica
    if (language === 'javascript') {
      if (!code.includes('function') && !code.includes('=>') && !code.includes('class')) {
        evaluation.warnings.push('No se detectaron funciones o estructuras principales');
      }
      
      if (code.includes('var ')) {
        evaluation.improvements.push('Consider usar let/const en lugar de var');
      }
      
      if (code.length < 50) {
        evaluation.feedback.push('El código es muy corto, ¿consideras agregar más funcionalidad?');
      } else {
        evaluation.score += 30;
      }
    }
    
    // Evaluar según requisitos
    for (const req of requirements) {
      if (code.toLowerCase().includes(req.toLowerCase())) {
        evaluation.score += 20;
        evaluation.feedback.push(`✅ Implementaste correctamente: ${req}`);
      } else {
        evaluation.feedback.push(`❌ Falta implementar: ${req}`);
      }
    }
    
    evaluation.score = Math.min(evaluation.score, 100);
    
    return evaluation;
  }
}

export const codingService = new CodingService();