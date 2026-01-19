import axios, { AxiosInstance } from 'axios'

export interface HealthResponse {
  status: string
  timestamp: string
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

  async health(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health')
    return response.data
  }

  async getConfig() {
    const response = await this.client.get('/config/current')
    return response.data
  }

  async getProfiles() {
    const response = await this.client.get('/config/profiles')
    return response.data
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.post<ChatResponse>('/chat', request)
    return response.data
  }

  async getDocuments() {
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
}

export const apiClient = new ApiClient()
