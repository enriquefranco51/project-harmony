
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the client once
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Models
const MODEL_CHAT = 'gemini-2.5-flash';
const MODEL_VISION = 'gemini-2.5-flash';
const MODEL_IMAGE = 'gemini-2.5-flash-image';
const MODEL_EMBEDDING = 'text-embedding-004';

// Provider Configuration
export type AIProvider = 'GEMINI' | 'OLLAMA';
let currentProvider: AIProvider = 'GEMINI';
let localModelName = 'llama3';
let localBaseUrl = 'http://localhost:11434';

export const setProviderConfig = (provider: AIProvider, model?: string, url?: string) => {
  currentProvider = provider;
  if (model) localModelName = model;
  if (url) localBaseUrl = url;
  console.log(`[AI Service] Provider set to ${provider} (${provider === 'OLLAMA' ? localModelName : MODEL_CHAT})`);
};

// --- OLLAMA IMPLEMENTATION ---

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  response?: string; // Fallback for /generate or different API versions
  done: boolean;
}

export const getOllamaModels = async (baseUrl: string = localBaseUrl): Promise<string[]> => {
  try {
    // Normalize URL
    const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const response = await fetch(`${url}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch models');
    
    const data = await response.json();
    // Ollama returns { models: [{ name: 'llama3:latest', ... }] }
    return data.models.map((m: any) => m.name);
  } catch (error) {
    console.warn("Failed to fetch Ollama models:", error);
    return [];
  }
};

const streamOllamaChat = async (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  onChunk: (text: string) => void
) => {
  try {
    // Convert Gemini history format to Ollama format
    const messages: OllamaMessage[] = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.parts[0].text
    }));
    
    // Add new message
    messages.push({ role: 'user', content: newMessage });

    const response = await fetch(`${localBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: localModelName,
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last partial line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line) as OllamaResponse;
          // Handle both 'message' (chat) and 'response' (generate) formats
          if (json.message?.content) {
            onChunk(json.message.content);
          } else if (json.response) {
             onChunk(json.response);
          }
        } catch (e) {
          console.warn("Error parsing Ollama JSON chunk", e);
        }
      }
    }
  } catch (error) {
    console.error("Ollama Chat Error:", error);
    onChunk(`\n\n[System Error]: Could not connect to Local LLM at ${localBaseUrl}.\n\nPotential fixes:\n1. Ensure Ollama is running ('ollama serve').\n2. Allow browser requests by setting environment variable: OLLAMA_ORIGINS="*"`);
    throw error;
  }
};

// --- MAIN CHAT FUNCTION ---

export const streamChat = async (
  history: { role: string; parts: { text: string }[] }[],
  newMessage: string,
  onChunk: (text: string) => void
) => {
  // ROUTING LOGIC
  if (currentProvider === 'OLLAMA') {
    return streamOllamaChat(history, newMessage, onChunk);
  }

  // GEMINI LOGIC
  try {
    const chat = ai.chats.create({
      model: MODEL_CHAT,
      history: history,
      config: {
        systemInstruction: "You are Project Harmony AI, a sophisticated creative assistant for musicians and artists. Your goal is to help users write lyrics, compose chord progressions, understand music theory, and conceptualize full-length songs. Use the provided Memory Context to recall previous lyrics, themes, or musical ideas. Be encouraging, creative, and precise with musical terminology.",
      }
    });

    const result = await chat.sendMessageStream({ message: newMessage });
    
    for await (const chunk of result) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        onChunk(c.text);
      }
    }
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

export const getEmbedding = async (text: string): Promise<number[]> => {
  // Note: Local embeddings could be implemented via Ollama's /api/embeddings endpoint
  // For now, we stick to Gemini for high-quality vector search unless strictly offline
  try {
    // FIX: Use 'contents' instead of 'content' for the SDK
    const result = await ai.models.embedContent({
      model: MODEL_EMBEDDING,
      contents: text 
    });
    if (result && result.embedding && result.embedding.values) {
        return result.embedding.values;
    }
    throw new Error("Invalid embedding response structure");
  } catch (error) {
    console.error("Embedding Error:", error);
    throw error; 
  }
};

export const analyzeImage = async (
  base64Image: string, 
  prompt: string
): Promise<string> => {
  if (currentProvider === 'OLLAMA') {
    return "Visual analysis is currently optimized for Gemini Cloud. Please switch provider to use Vision features.";
  }
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_VISION,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', 
              data: base64Image
            }
          },
          { text: prompt }
        ]
      }
    });
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Vision Error:", error);
    throw error;
  }
};

export const generateImage = async (prompt: string): Promise<string[]> => {
  if (currentProvider === 'OLLAMA') {
    // Ollama doesn't do generation natively typically
    throw new Error("Image generation requires Gemini Cloud.");
  }
  
  try {
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
        }
      }
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                images.push(`data:image/png;base64,${part.inlineData.data}`);
            }
        }
    }
    return images;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

export const editImage = async (base64Image: string, prompt: string): Promise<string[]> => {
  if (currentProvider === 'OLLAMA') throw new Error("Image editing requires Gemini Cloud.");
  
  try {
    const base64Data = base64Image.split(',')[1] || base64Image;
    
    const response = await ai.models.generateContent({
      model: MODEL_IMAGE,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
        }
      }
    });

    const images: string[] = [];
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                images.push(`data:image/png;base64,${part.inlineData.data}`);
            }
        }
    }
    return images;
  } catch (error) {
    console.error("Image Edit Error:", error);
    throw error;
  }
};
