// server/services/selfLearningService.js

export class SelfLearningService {
  constructor() {
    this.learnedConcepts = new Set();
    this.codePatterns = [];
    this.skillLevel = {
      javascript: 0,
      python: 0,
      webdev: 0,
      algorithms: 0
    };
  }

  async learnFromConversation(topic, explanation) {
    // Guardar concepto aprendido
    this.learnedConcepts.add(topic);
    
    // Mejorar nivel según tema
    if (topic.includes('javascript') || topic.includes('react')) {
      this.skillLevel.javascript += 10;
    } else if (topic.includes('python')) {
      this.skillLevel.python += 10;
    }
    
    console.log(`🧠 JARVIS aprendió: ${topic}`);
    
    return {
      learned: true,
      topic: topic,
      skillLevels: this.skillLevel
    };
  }

  async suggestNextTopic() {
    const topics = {
      javascript: ['Closures', 'Promises', 'Event Loop', 'Prototypes', 'Modules'],
      python: ['Decorators', 'Generators', 'Context Managers', 'Metaclasses'],
      webdev: ['React Hooks', 'Next.js', 'Tailwind', 'GraphQL'],
      algorithms: ['Dynamic Programming', 'Graph Theory', 'Sorting Algorithms']
    };
    
    // Sugerir tema basado en nivel actual
    const lowestSkill = Object.entries(this.skillLevel)
      .sort((a, b) => a[1] - b[1])[0];
    
    const topicList = topics[lowestSkill[0]];
    const suggestedTopic = topicList[Math.floor(Math.random() * topicList.length)];
    
    return {
      topic: suggestedTopic,
      category: lowestSkill[0],
      reason: `Veo que quieres mejorar en ${lowestSkill[0]}`
    };
  }

  async generateCodeExample(concept, language) {
    const examples = {
      'Closures': `function createCounter() {
  let count = 0;
  return function() {
    count++;
    return count;
  }
}`,
      'Promises': `const fetchData = async () => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}`,
      'Decorators': `def timer_decorator(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        print(f"Tiempo: {time.time() - start}s")
        return result
    return wrapper`
    };
    
    return examples[concept] || `// Ejemplo de ${concept} en ${language}`;
  }
}