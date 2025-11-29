
export enum AppTab {
  CHAT = 'CHAT',
  LIVE = 'LIVE',
  VISION = 'VISION',
  STUDIO = 'STUDIO',
  MUSIC_HUB = 'MUSIC_HUB'
}

export enum Sender {
  USER = 'USER',
  MODEL = 'MODEL'
}

export interface MemoryContext {
  text: string;
  timestamp: number;
  score: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  image?: string; // base64
  contextUsed?: MemoryContext[]; // For UI to show what memories were accessed
}

export interface LiveStatus {
  isConnected: boolean;
  isStreaming: boolean;
  error?: string;
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  id: string;
}

export interface VectorDocument {
  id: string;
  content: string; // Encrypted text
  vector: number[];
  timestamp: number;
  type: 'chat' | 'memory';
}
