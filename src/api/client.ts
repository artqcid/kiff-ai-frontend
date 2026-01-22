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
  profile?: string
  model?: string
  provider?: string
}

export interface ServerStatus {
  llama_running: boolean
  mcp_running: boolean
  current_model: string | null
}

export interface Profile {
  name: string
  description: string
  display_name?: string
}

export interface Model {
  name: string
  description: string
  display_name?: string
  short_name?: string
  context_size?: number
  metadata?: {
    context?: string
    speed?: string
    cost?: string
    request_limit?: string
    token_limit?: string
  }
}

export interface Provider {
  name: string
  display_name: string
  type: string
  enabled: boolean
  description: string
  requires_api_key: boolean
  has_api_key: boolean
  is_current: boolean
  features: {
    streaming: boolean
    function_calling: boolean
    vision: boolean
  }
  rate_limits: {
    requests_per_minute?: number | null
    tokens_per_minute?: number | null
    note?: string
  }
}

export interface ProviderValidateResponse {
  valid: boolean
  message: string
  details?: any
}

export interface CurrentProviderResponse {
  provider: string
  profile: string
  model: string
  provider_display_name: string
  profile_display_name: string
  model_short_name: string
}

export interface ProfileModelsResponse {
  profile: string
  provider: string
  models: Model[]
}

export interface DocumentInfo {
  filename: string
  path: string
  size: number
  type: string
}

export interface DocumentSessionResponse {
  session_id: string
  filename: string
  message: string
}

export interface DocumentSessionMessage {
  session_id: string
  message: string
}

export interface DocumentVersionInfo {
  version_id: string
  filename: string
  size: number
  created_at: string
}

export interface DocumentSessionHistoryResponse {
  session_id: string
  versions: DocumentVersionInfo[]
}

export interface GoogleExportResponse {
  session_id: string
  file_id: string
  name: string
  message: string
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

  async getCurrentProfile(): Promise<{ profile: string; model?: string | null }> {
    const response = await this.client.get('/profile/current')
    return response.data
  }

  async changeProfile(profileName: string): Promise<any> {
    return this.setProfile(profileName)
  }

  async getModels(): Promise<Model[]> {
    const response = await this.client.get('/models')
    // API returns array directly, not wrapped
    return Array.isArray(response.data) ? response.data : (response.data.models || [])
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

  async deleteChatHistoryForContext(provider: string, profile: string): Promise<any> {
    const response = await this.client.delete(`/history/${provider}/${profile}`)
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

  async uploadDocumentSession(file: File): Promise<DocumentSessionResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await this.client.post<DocumentSessionResponse>('/documents/session', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }

  async exportDocumentSession(sessionId: string): Promise<{ blob: Blob; filename: string }> {
    const response = await this.client.get(`/documents/session/${sessionId}/export`, {
      responseType: 'blob'
    })

    let filename = 'export.docx'
    const disposition = response.headers['content-disposition']
    if (disposition) {
      const match = /filename="?([^";]+)"?/i.exec(disposition)
      if (match && match[1]) {
        filename = match[1]
      }
    }

    return { blob: response.data as Blob, filename }
  }

  async applyDocumentSession(sessionId: string, file: File): Promise<DocumentSessionMessage> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await this.client.post<DocumentSessionMessage>(`/documents/session/${sessionId}/apply`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  }

  async getDocumentSessionHistory(sessionId: string): Promise<DocumentSessionHistoryResponse> {
    const response = await this.client.get<DocumentSessionHistoryResponse>(`/documents/session/${sessionId}/history`)
    return response.data
  }

  async deleteDocumentSession(sessionId: string): Promise<DocumentSessionMessage> {
    const response = await this.client.delete<DocumentSessionMessage>(`/documents/session/${sessionId}`)
    return response.data
  }

  async importGoogleDoc(docId: string): Promise<DocumentSessionResponse> {
    const response = await this.client.post<DocumentSessionResponse>('/documents/google/import', { doc_id: docId })
    return response.data
  }

  async exportGoogleDoc(sessionId: string, payload: { access_token: string; folder_id?: string; name?: string }): Promise<GoogleExportResponse> {
    const response = await this.client.post<GoogleExportResponse>(`/documents/google/export/${sessionId}`, payload)
    return response.data
  }

  // Provider Management
  async getProviders(): Promise<Provider[]> {
    const response = await this.client.get<Provider[]>('/providers')
    return response.data
  }

  async validateProvider(providerName: string, apiKey?: string): Promise<ProviderValidateResponse> {
    const response = await this.client.post<ProviderValidateResponse>(
      `/provider/${providerName}/validate`,
      apiKey ? { api_key: apiKey } : {}
    )
    return response.data
  }

  async setProvider(providerName: string): Promise<any> {
    const response = await this.client.post(`/provider/${providerName}/set`)
    return response.data
  }

  async getCurrentProvider(): Promise<CurrentProviderResponse> {
    const response = await this.client.get<CurrentProviderResponse>('/provider/current')
    return response.data
  }

  async getProfileModels(profileName: string, provider?: string): Promise<ProfileModelsResponse> {
    const params = provider ? { provider } : {}
    const response = await this.client.get<ProfileModelsResponse>(
      `/profile/${profileName}/models`,
      { params }
    )
    return response.data
  }

  async setModel(modelId: string): Promise<any> {
    const response = await this.client.post(`/model/${modelId}/set`)
    return response.data
  }
}

export const apiClient = new ApiClient()

