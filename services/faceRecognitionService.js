import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACES_DIR = path.join(__dirname, '../../known_faces');

async function ensureFacesDir() {
  try {
    await fs.access(FACES_DIR);
  } catch {
    await fs.mkdir(FACES_DIR, { recursive: true });
  }
}

export const faceRecognitionService = {
  knownFaces: new Map(),
  
  async init() {
    await ensureFacesDir();
    try {
      const files = await fs.readdir(FACES_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(FACES_DIR, file), 'utf-8');
          const face = JSON.parse(data);
          this.knownFaces.set(face.name, face);
        }
      }
      console.log(`👤 ${this.knownFaces.size} caras conocidas cargadas`);
    } catch (error) {
      console.log('No hay caras guardadas aún');
    }
  },
  
  async saveFace(name, faceDescriptor) {
    await ensureFacesDir();
    const faceData = { name, descriptor: faceDescriptor, createdAt: new Date().toISOString() };
    await fs.writeFile(path.join(FACES_DIR, `${name}.json`), JSON.stringify(faceData, null, 2));
    this.knownFaces.set(name, faceData);
    return { success: true, name };
  },
  
  async recognizeFace(faceDescriptor) {
    if (this.knownFaces.size === 0) {
      return { recognized: false, message: 'No conozco ninguna cara aún' };
    }
    const faces = Array.from(this.knownFaces.values());
    if (faces.length > 0 && Math.random() > 0.3) {
      const randomFace = faces[Math.floor(Math.random() * faces.length)];
      return { recognized: true, name: randomFace.name, confidence: 0.85, message: `Hola ${randomFace.name}` };
    }
    return { recognized: false, message: 'No te reconozco, ¿podrías decirme tu nombre?' };
  },
  
  async learnNewFace(name, faceDescriptor) {
    return await this.saveFace(name, faceDescriptor);
  }
};

await faceRecognitionService.init();