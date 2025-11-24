
export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  image?: string; // Legacy/Fallback
  images?: string[]; // Support for multiple generated images
  attachment?: string; // User uploaded image (Base64)
  attachmentMimeType?: string;
  fileContent?: string; // Text content of uploaded files (code, txt, csv)
  fileName?: string;
  appContent?: Record<string, string>; // generated app files
  isStreaming?: boolean;
  groundingSources?: GroundingSource[];
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export interface AppSettings {
  customPersona: string;
  voiceEnabled: boolean;
  autoRead: boolean;
  theme: 'light' | 'dark';
}

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}