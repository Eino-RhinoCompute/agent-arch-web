// src/types/agent.ts

export interface DesignDataPayload {
  GeometryData: string;  // 假设后端返回的是Base64编码的模型数据或JSON字符串
  AnalysisImage: string[]; // 图片URL或Base64列表
  Metrics: Record<string, any>; // 各种指标
  ActionType: string;
}

export interface DesignResponse {
  Reply: string;
  Status: string;
  DataPayload?: DesignDataPayload;
}

export interface DesignRequest {
  session_id: string;
  query: string;
  context?: string; // 用于传递周边环境信息
}

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  time: string;
}