// src/types/agent.ts

export interface DesignDataPayload {
  // 🟢 修改为 snake_case 以匹配后端 JSON
  geometry_data: string;          
  metrics?: Record<string, any>; 
  analysis_image?: string[];      
  action_type?: string;           
}

export interface DesignResponse {
  // 🟢 修改为 snake_case
  reply: string;
  status: string;
  data_payload?: DesignDataPayload;
}

export interface DesignRequest {
  session_id: string;
  query: string;
  context?: string; 
}

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  image?: string; 
  time: string;
}