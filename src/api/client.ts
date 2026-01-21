import axios from 'axios'
import type { AxiosInstance } from 'axios'

export interface HealthResponse {
  status: string
  timestamp: string
}

export interface SystemStatus {
  llm_server: string
  qdrant: string
  mcp_server: string
}

export interface ChatMessage {
  role: string
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  profile?: string
}

export interface ChatResponse {
  response: string
  model: string
  profile: string
}

export interface ChatHistoryItem {
  role: string
  content: string
  timestamp?: string
  cancelled?: boolean
}

export interface ServerStatus {
  llama_running: boolean
  mcp_running: boolean
  current_model: string | null
}

export interface Profile {
  name: string
  description: string
}

export interface Model {
  name: string
  description: string
}

export interface DocumentInfo {
  filename: string
  path: string
  size: number
  type: string
}

class ApiClient {
  private client: AxiosInstance

  constructor(baseURL: string = '/api/v1') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  // Health & Status
  async health(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health')
    return response.data
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const response = await this.client.get<SystemStatus>('/status')
    return response.data
  }

  // Server Management
  async startServers(modelName?: string): Promise<any> {
    const response = await this.client.post('/server/start', { model_name: modelName })
    return response.data
  }

  async stopServers(): Promise<any> {
    const response = await this.client.post('/server/stop')
    return response.data
  }

  async switchModel(modelName: string): Promise<any> {
    const response = await this.client.post('/server/switch-model', { model_name: modelName })
    return response.data
  }

  async getServerStatus(): Promise<ServerStatus> {
    const response = await this.client.get<ServerStatus>('/server/status')
    return response.data
  }

  // Config & Profiles
  async getConfig() {
    const response = await this.client.get('/current')
    return response.data
  }

  async getProfiles(): Promise<Profile[]> {
    const response = await this.client.get('/profiles')
    return response.data
  }

  async setProfile(profileName: string): Promise<any> {
    const response = await this.client.post(`/profile/${profileName}`)
    return response.data
  }

  async changeProfile(profileName: string): Promise<any> {
    return this.setProfile(profileName)
  }

  async getModels(): Promise<Model[]> {
    const response = await this.client.get('/models')
    return response.data.models || []
  }

  // Chat
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.post<ChatResponse>('/chat', request)
    return response.data
  }

  async getChatHistory(): Promise<{ history: ChatHistoryItem[] }> {
    const response = await this.client.get('/history')
    return response.data
  }

  async clearChatHistory(): Promise<any> {
    const response = await this.client.delete('/history')
    return response.data
  }

  // Documents
  async getDocuments(): Promise<DocumentInfo[]> {
    const response = await this.client.get('/documents')
    return response.data
  }

  async uploadDocument(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await this.client.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }

  async deleteDocument(filename: string): Promise<any> {
    const response = await this.client.delete(`/documents/${filename}`)
    return response.data
  }
}

export const apiClient = new ApiClient()

