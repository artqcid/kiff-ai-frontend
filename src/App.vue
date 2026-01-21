<template>
  <div class="app-container">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>🤖 KIFF AI Agent</h1>
        <p class="subtitle">Lokal, offline, mit llama.cpp + LangChain</p>
      </div>
      
      <div class="sidebar-divider"></div>
      
      <div class="sidebar-section">
        <h2>⚙️ Konfiguration</h2>
        
        <!-- Server Status & Controls -->
        <div class="control-group">
          <h3>🖥️ Server Status</h3>
          <div class="status-display">
            <div class="status-item">
              <span>LLM:</span>
              <span :class="['status-badge', serverStatus?.llama_running ? 'running' : 'stopped']">
                {{ serverStatus?.llama_running ? '🟢 Running' : '🔴 Stopped' }}
              </span>
            </div>
          </div>
          
          <div class="button-row">
            <button @click="startServers" :disabled="loading || serverStatus?.llama_running" class="btn btn-success">
              🟢 Starten
            </button>
            <button @click="stopServers" :disabled="loading || !serverStatus?.llama_running" class="btn btn-danger">
              🛑 Stoppen
            </button>
          </div>
          <p class="status-message">{{ statusMessage || 'Bereit' }}</p>
        </div>
        
        <!-- Model Selection -->
        <div class="control-group">
          <h3>🤖 Modell</h3>
          <select v-model="selectedModel" :disabled="loading" class="select-input">
            <option v-for="model in models" :key="model.name" :value="model.name">
              {{ model.description || model.name }}
            </option>
          </select>
          <button @click="switchModel" :disabled="loading || !selectedModel" class="btn btn-primary btn-block">
            Modell wechseln
          </button>
        </div>
        
        <!-- Profile Selection -->
        <div class="control-group">
          <h3>👤 Profil</h3>
          <select v-model="selectedProfile" :disabled="loading" class="select-input">
            <option v-for="profile in profiles" :key="profile.name" :value="profile.name">
              {{ profile.display_name || profile.name }}
            </option>
          </select>
          <button @click="changeProfile" :disabled="loading || !selectedProfile" class="btn btn-primary btn-block">
            Profil wechseln
          </button>
        </div>
        
        <!-- Chat Controls -->
        <div class="control-group">
          <h3>💬 Chat</h3>
          <button @click="clearChat" class="btn btn-danger btn-block">
            🗑️ Chat löschen
          </button>
        </div>

        <!-- Document Handling -->
        <div class="control-group">
          <h3>📄 Dokument</h3>
          <input
            ref="fileInputRef"
            type="file"
            accept=".docx"
            class="hidden-input"
            @change="handleDocxSelected"
          />
          <input
            ref="applyFileInputRef"
            type="file"
            accept=".docx"
            class="hidden-input"
            @change="handleDocxApplySelected"
          />
          <button @click="triggerDocxUpload" class="btn btn-primary btn-block" :disabled="loading">
            DOCX laden
          </button>
          <button @click="triggerDocxApply" class="btn btn-secondary btn-block" :disabled="loading || !currentDocSessionId">
            DOCX ersetzen
          </button>
          <button @click="exportDocx" class="btn btn-success btn-block" :disabled="loading || !currentDocSessionId">
            DOCX exportieren
          </button>
          <button @click="loadHistory" class="btn btn-ghost btn-block" :disabled="loading || !currentDocSessionId">
            Versionen anzeigen ({{ sessionHistory.length }})
          </button>
          <button @click="deleteSession" class="btn btn-ghost btn-block" :disabled="loading || !currentDocSessionId">
            Session löschen
          </button>

          <div v-if="sessionHistory.length" class="history-box">
            <div class="history-title">Versionen</div>
            <ul class="history-list">
              <li v-for="version in sessionHistory" :key="version.version_id">
                <span>{{ version.filename }}</span>
                <span class="muted">{{ new Date(version.created_at).toLocaleString() }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Google Docs -->
        <div class="control-group">
          <h3>☁️ Google Docs</h3>
          <input
            v-model="googleDocId"
            type="text"
            class="text-input"
            placeholder="Google Doc ID"
          />
          <button @click="importGoogleDoc" class="btn btn-primary btn-block" :disabled="loading || !googleDocId">
            Doc importieren → Session
          </button>
          <input
            v-model="googleAccessToken"
            type="text"
            class="text-input"
            placeholder="Access Token (Drive)"
          />
          <input
            v-model="googleFolderId"
            type="text"
            class="text-input"
            placeholder="Ordner-ID (optional)"
          />
          <input
            v-model="googleFilename"
            type="text"
            class="text-input"
            placeholder="Dateiname (optional)"
          />
          <button @click="exportGoogleDoc" class="btn btn-secondary btn-block" :disabled="loading || !currentDocSessionId || !googleAccessToken">
            Session → Google Drive
          </button>
        </div>
      </div>
    </aside>
    
    <!-- Main Content -->
    <main class="main-content">
      <router-view 
        :server-running="serverStatus?.llama_running || false"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, provide } from 'vue'
import { apiClient, type ServerStatus, type Profile, type Model } from './api/client'

const serverStatus = ref<ServerStatus | null>(null)
const profiles = ref<Profile[]>([])
const models = ref<Model[]>([])
const selectedProfile = ref<string>('')
const selectedModel = ref<string>('')
const loading = ref(false)
const statusMessage = ref('')
const clearChatTrigger = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)
const applyFileInputRef = ref<HTMLInputElement | null>(null)
const currentDocSessionId = ref<string>('')
const sessionHistory = ref([] as { version_id: string; filename: string; size: number; created_at: string }[])
const googleDocId = ref('')
const googleAccessToken = ref('')
const googleFolderId = ref('')
const googleFilename = ref('')

provide('clearChatTrigger', clearChatTrigger);

onMounted(async () => {
  await loadData()
  startStatusPolling()
})

const loadData = async () => {
  try {
    const [statusRes, profilesRes, modelsRes] = await Promise.all([
      apiClient.getServerStatus().catch(() => ({ llama_running: false, mcp_running: false, current_model: null })),
      apiClient.getProfiles().catch(() => []),
      apiClient.getModels().catch(() => [])
    ])
    
    serverStatus.value = statusRes
    profiles.value = profilesRes
    models.value = modelsRes
    
    // Set initial status message based on server state (only if not already set)
    if (!statusMessage.value) {
      statusMessage.value = statusRes.llama_running ? '✅ Server gestartet' : 'Server gestoppt'
    }
    
    if (models.value.length > 0 && !selectedModel.value) {
      selectedModel.value = models.value[0]?.name || '';
    }
    if (profiles.value.length > 0 && !selectedProfile.value) {
      selectedProfile.value = profiles.value[0]?.name || '';
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  }
}

const startStatusPolling = () => {
  setInterval(async () => {
    try {
      serverStatus.value = await apiClient.getServerStatus()
    } catch (error) {
      // Silent fail
    }
  }, 15000) // Check every 15 seconds
}

const startServers = async () => {
  loading.value = true
  statusMessage.value = 'Starte Server...'
  try {
    await apiClient.startServers(selectedModel.value)
    statusMessage.value = '✅ Server gestartet'
    await loadData()
  } catch (error: any) {
    statusMessage.value = `❌ Fehler: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const stopServers = async () => {
  loading.value = true
  statusMessage.value = 'Stoppe Server...'
  try {
    await apiClient.stopServers()
    statusMessage.value = '✅ Server gestoppt'
    await loadData()
  } catch (error: any) {
    statusMessage.value = `❌ Fehler: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const switchModel = async () => {
  loading.value = true
  statusMessage.value = 'Wechsle Modell...'
  try {
    await apiClient.switchModel(selectedModel.value)
    statusMessage.value = '✅ Modell gewechselt'
    await loadData()
  } catch (error: any) {
    statusMessage.value = `❌ Fehler: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const changeProfile = async () => {
  loading.value = true
  statusMessage.value = 'Wechsle Profil...'
  try {
    await apiClient.changeProfile(selectedProfile.value)
    statusMessage.value = '✅ Profil gewechselt'
  } catch (error: any) {
    statusMessage.value = `❌ Fehler: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const clearChat = async () => {
  if (!confirm('Chat-Verlauf wirklich löschen?')) return
  await handleClearChat()
}

const handleClearChat = async () => {
  loading.value = true;
  statusMessage.value = 'Lösche Chat-Verlauf...';
  try {
    await apiClient.clearChatHistory();
    
    // Trigger clear in ChatView via inject
    clearChatTrigger.value++;
    
    statusMessage.value = '✅ Chat-Verlauf gelöscht';
  } catch (error: any) {
    statusMessage.value = `❌ Fehler: ${error?.message || 'Unknown error'}`;
  } finally {
    loading.value = false;
  }
}

// --- Document handling ---
const triggerDocxUpload = () => {
  fileInputRef.value?.click()
}

const triggerDocxApply = () => {
  if (!currentDocSessionId.value) {
    statusMessage.value = 'ℹ️ Bitte zuerst eine Session laden'
    return
  }
  applyFileInputRef.value?.click()
}

const handleDocxSelected = async (event: Event) => {
  const files = (event.target as HTMLInputElement)?.files
  if (!files || files.length === 0) return
  const file = files[0]
  if (!file || !file.name.toLowerCase().endsWith('.docx')) {
    statusMessage.value = '❌ Bitte eine DOCX-Datei wählen'
    return
  }
  loading.value = true
  statusMessage.value = '📤 Lade DOCX...'
  try {
    const response = await apiClient.uploadDocumentSession(file as File)
    currentDocSessionId.value = response.session_id
    sessionHistory.value = []
    statusMessage.value = `✅ ${response.filename} geladen (Session ${response.session_id.slice(0, 8)})`
  } catch (error: any) {
    statusMessage.value = `❌ Upload fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

const handleDocxApplySelected = async (event: Event) => {
  const files = (event.target as HTMLInputElement)?.files
  if (!files || files.length === 0) return
  if (!currentDocSessionId.value) {
    statusMessage.value = 'ℹ️ Keine aktive Session'
    return
  }
  const file = files[0]
  if (!file || !file.name.toLowerCase().endsWith('.docx')) {
    statusMessage.value = '❌ Bitte eine DOCX-Datei wählen'
    return
  }

  loading.value = true
  statusMessage.value = '✏️ Ersetze DOCX...'
  try {
    await apiClient.applyDocumentSession(currentDocSessionId.value, file as File)
    statusMessage.value = '✅ Session aktualisiert'
    await loadHistory()
  } catch (error: any) {
    statusMessage.value = `❌ Ersetzen fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}

const exportDocx = async () => {
  if (!currentDocSessionId.value) {
    statusMessage.value = 'ℹ️ Export: Bitte zuerst ein Dokument laden'
    return
  }

  loading.value = true
  statusMessage.value = '📦 Exportiere DOCX...'
  try {
    const { blob, filename } = await apiClient.exportDocumentSession(currentDocSessionId.value)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'export.docx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    statusMessage.value = `✅ Export fertig: ${filename}`
  } catch (error: any) {
    statusMessage.value = `❌ Export fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const loadHistory = async () => {
  if (!currentDocSessionId.value) {
    statusMessage.value = 'ℹ️ Keine aktive Session'
    return
  }
  loading.value = true
  statusMessage.value = '📚 Lade Versionen...'
  try {
    const response = await apiClient.getDocumentSessionHistory(currentDocSessionId.value)
    sessionHistory.value = response.versions
    statusMessage.value = `✅ ${response.versions.length} Version(en) geladen`
  } catch (error: any) {
    statusMessage.value = `❌ History fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const deleteSession = async () => {
  if (!currentDocSessionId.value) {
    statusMessage.value = 'ℹ️ Keine aktive Session'
    return
  }
  if (!confirm('Session wirklich löschen?')) return

  loading.value = true
  statusMessage.value = '🧹 Lösche Session...'
  try {
    await apiClient.deleteDocumentSession(currentDocSessionId.value)
    currentDocSessionId.value = ''
    sessionHistory.value = []
    statusMessage.value = '✅ Session gelöscht'
  } catch (error: any) {
    statusMessage.value = `❌ Löschen fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const importGoogleDoc = async () => {
  if (!googleDocId.value) {
    statusMessage.value = 'ℹ️ Bitte Doc ID angeben'
    return
  }
  loading.value = true
  statusMessage.value = '☁️ Importiere Google Doc...'
  try {
    const response = await apiClient.importGoogleDoc(googleDocId.value)
    currentDocSessionId.value = response.session_id
    sessionHistory.value = []
    statusMessage.value = `✅ Importiert: ${response.filename} (Session ${response.session_id.slice(0, 8)})`
  } catch (error: any) {
    statusMessage.value = `❌ Import fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const exportGoogleDoc = async () => {
  if (!currentDocSessionId.value) {
    statusMessage.value = 'ℹ️ Keine aktive Session'
    return
  }
  if (!googleAccessToken.value) {
    statusMessage.value = 'ℹ️ Access Token fehlt'
    return
  }

  loading.value = true
  statusMessage.value = '☁️ Lade nach Google Drive...'
  try {
    const response = await apiClient.exportGoogleDoc(currentDocSessionId.value, {
      access_token: googleAccessToken.value,
      folder_id: googleFolderId.value || undefined,
      name: googleFilename.value || undefined,
    })
    statusMessage.value = `✅ Hochgeladen: ${response.name} (File ID: ${response.file_id})`
  } catch (error: any) {
    statusMessage.value = `❌ Drive-Export fehlgeschlagen: ${error?.message || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  background-color: #0a0a0a;
  color: rgba(255, 255, 255, 0.87);
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 320px;
  background-color: #1a1a1a;
  border-right: 1px solid #2a2a2a;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem 1.5rem 0.5rem;
}

.sidebar-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 0.875rem;
  color: #888;
  font-style: italic;
}

.sidebar-divider {
  height: 1px;
  background-color: #2a2a2a;
  margin: 1rem 1.5rem;
}

.sidebar-section {
  padding: 0 1.5rem 1.5rem;
}

.sidebar-section > h2 {
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.control-group {
  margin-bottom: 1.5rem;
}

.control-group h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  color: #ccc;
}

.status-display {
  background-color: #0a0a0a;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.running {
  background-color: #1a4d1a;
  color: #4ade80;
}

.status-badge.stopped {
  background-color: #4d1a1a;
  color: #f87171;
}

.button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.select-input {
  width: 100%;
  padding: 0.625rem;
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.87);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
}

.text-input {
  width: 100%;
  padding: 0.625rem;
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.87);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.select-input:focus {
  outline: none;
  border-color: #646cff;
}

.select-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn {
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
}

.btn-primary {
  background-color: #646cff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #535bf2;
}

.btn-success {
  background-color: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #059669;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-secondary {
  background-color: #374151;
  color: #e5e7eb;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #2b3340;
}

.btn-ghost {
  background-color: transparent;
  color: #e5e7eb;
  border: 1px solid #2a2a2a;
}

.btn-ghost:hover:not(:disabled) {
  background-color: #111827;
}

.status-message {
  font-size: 0.875rem;
  padding: 0.5rem;
  background-color: #0a0a0a;
  border-radius: 4px;
  text-align: center;
}

.history-box {
  background: #0f0f0f;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
  padding: 0.75rem;
  margin-top: 0.75rem;
}

.history-title {
  font-size: 0.875rem;
  color: #bbb;
  margin-bottom: 0.5rem;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.history-list li {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.muted {
  color: #888;
  font-size: 0.8rem;
}

.main-content {
  flex: 1;
  overflow: hidden;
  background-color: #0a0a0a;
}

@media (max-width: 768px) {
  .app-container {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-height: 50vh;
    border-right: none;
    border-bottom: 1px solid #2a2a2a;
  }
}
</style>

