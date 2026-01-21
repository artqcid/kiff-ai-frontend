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
            <button @click="startServers" :disabled="loading" class="btn btn-success">
              🟢 Starten
            </button>
            <button @click="stopServers" :disabled="loading" class="btn btn-danger">
              🛑 Stoppen
            </button>
          </div>
          <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
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
              {{ profile.description || profile.name }}
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
      </div>
    </aside>
    
    <!-- Main Content -->
    <main class="main-content">
      <router-view 
        @clear-chat="handleClearChat"
        :server-running="serverStatus?.llama_running || false"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiClient, type ServerStatus, type Profile, type Model } from './api/client'

const serverStatus = ref<ServerStatus | null>(null)
const profiles = ref<Profile[]>([])
const models = ref<Model[]>([])
const selectedProfile = ref<string>('')
const selectedModel = ref<string>('')
const loading = ref(false)
const statusMessage = ref('')

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
    
    if (models.value.length > 0 && !selectedModel.value) {
      selectedModel.value = models.value[0].name
    }
    if (profiles.value.length > 0 && !selectedProfile.value) {
      selectedProfile.value = profiles.value[0].name
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
  }, 5000)
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
    setTimeout(() => statusMessage.value = '', 3000)
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
    setTimeout(() => statusMessage.value = '', 3000)
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
    setTimeout(() => statusMessage.value = '', 3000)
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
    setTimeout(() => statusMessage.value = '', 3000)
  }
}

const clearChat = async () => {
  if (!confirm('Chat-Verlauf wirklich löschen?')) return
  handleClearChat()
}

const handleClearChat = async () => {
  try {
    await apiClient.clearChatHistory()
    statusMessage.value = '✅ Chat gelöscht'
  } catch (error: any) {
    statusMessage.value = `❌ Fehler: ${error.message}`
  } finally {
    setTimeout(() => statusMessage.value = '', 3000)
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

.status-message {
  font-size: 0.875rem;
  padding: 0.5rem;
  background-color: #0a0a0a;
  border-radius: 4px;
  text-align: center;
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

