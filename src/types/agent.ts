// src/types/agent.ts

export interface DesignDataPayload {
  GeometryData: string;  // 后端生成的模型数据 (假设为 OBJ 字符串)
  Metrics?: Record<string, any>;
  AnalysisImage?: string[];
}

export interface DesignResponse {
  Reply: string;
  Status: string;
  DataPayload?: DesignDataPayload;
}

export interface DesignRequest {
  session_id: string;
  query: string;
  context?: string; 
}

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  time: string;
}