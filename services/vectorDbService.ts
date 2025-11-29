
import { VectorDocument, MemoryContext } from '../types';
import { encryptData, decryptData, getPersistentKey } from './securityUtils';
import { getEmbedding } from './geminiService';

const DB_NAME = 'harmony-vectors';
const STORE_NAME = 'vectors';

// --- Math Utilities ---
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function magnitude(a: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// --- DB Service ---
class VectorDbService {
  private dbPromise: Promise<IDBDatabase>;
  private keyPromise: Promise<CryptoKey>;

  constructor() {
    this.keyPromise = getPersistentKey();
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Add text to the vector store (generates embedding + encrypts content)
  async addDocument(text: string, type: 'chat' | 'memory' = 'chat'): Promise<void> {
    const db = await this.dbPromise;
    const key = await this.keyPromise;
    
    // Parallelize embedding and encryption
    const [vector, encryptedContent] = await Promise.all([
      getEmbedding(text),
      encryptData(text, key)
    ]);

    const doc: VectorDocument = {
      id: crypto.randomUUID(),
      content: encryptedContent,
      vector,
      timestamp: Date.now(),
      type
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Semantic search
  async search(query: string, limit: number = 3): Promise<MemoryContext[]> {
    const db = await this.dbPromise;
    const key = await this.keyPromise;
    const queryVector = await getEmbedding(query);

    // Fetch all vectors (Client-side optimization: For <10k items, full scan is fast enough)
    const allDocs = await new Promise<VectorDocument[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (allDocs.length === 0) return [];

    // Calculate similarities
    const scoredDocs = allDocs.map(doc => ({
      ...doc,
      score: cosineSimilarity(queryVector, doc.vector)
    }));

    // Sort by score descending
    scoredDocs.sort((a, b) => b.score - a.score);

    // Take top K and Decrypt
    const topDocs = scoredDocs.slice(0, limit);
    
    // Decrypt contents
    const results = await Promise.all(
      topDocs.map(async (doc) => {
        try {
          const text = await decryptData(doc.content, key);
          return {
            text,
            timestamp: doc.timestamp,
            score: doc.score
          };
        } catch (e) {
          console.error("Decryption failed for doc", doc.id, e);
          return {
            text: "[Encrypted Memory]",
            timestamp: doc.timestamp,
            score: doc.score
          };
        }
      })
    );

    return results;
  }

  // Clear all memories (Privacy feature)
  async clear(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const vectorDb = new VectorDbService();
