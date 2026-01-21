<template>
  <div class="settings-view">
    <h2>⚙️ Einstellungen & Server-Management</h2>

    <!-- Server Status & Control -->
    <div class="settings-section">
      <h3>🖥️ Server Status</h3>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">LLM Server:</span>
          <span :class="['status', serverStatus?.llama_running ? 'running' : 'stopped']">
            {{ serverStatus?.llama_running ? '🟢 Running' : '🔴 Stopped' }}
          </span>
        </div>
        <div class="status-item">
          <span class="label">MCP Server:</span>
          <span :class="['status', serverStatus?.mcp_running ? 'running' : 'stopped']">
            {{ serverStatus?.mcp_running ? '🟢 Running' : '🔴 Stopped' }}
          </span>
        </div>
        <div class="status-item">
          <span class="label">Current Model:</span>
          <span class="value">{{ serverStatus?.current_model || 'None' }}</span>
        </div>
      </div>
      <div class="button-group">
        <button @click="startServers" :disabled="loading" class="btn-success">
          🟢 Starten
        </button>
        <button @click="stopServers" :disabled="loading" class="btn-danger">
          🛑 Stoppen
        </button>
      </div>
      <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
    </div>

    <!-- Model Selection -->
    <div class="settings-section">
      <h3>🤖 Modell-Auswahl</h3>
      <div class="form-group">
        <label for="model-select">Wechsle Modell:</label>
        <select id="model-select" v-model="selectedModel" :disabled="loading">
          <option v-for="model in models" :key="model.name" :value="model.name">
            {{ model.description }}
          </option>
        </select>
        <button @click="switchModel" :disabled="loading || !selectedModel" class="btn-primary">
          Modell wechseln
        </button>
      </div>
    </div>

    <!-- Profile Selection -->
    <div class="settings-section">
      <h3>👤 Agent-Profil</h3>
      <div class="form-group">
        <label for="profile-select">Wähle Profil:</label>
        <select id="profile-select" v-model="selectedProfile" :disabled="loading">
          <option v-for="profile in profiles" :key="profile.name" :value="profile.name">
            {{ profile.name }} - {{ profile.description }}
          </option>
        </select>
        <button @click="changeProfile" :disabled="loading || !selectedProfile" class="btn-primary">
          Profil wechseln
        </button>
      </div>
    </div>

    <!-- Current Configuration -->
    <div class="settings-section">
      <h3>📋 Aktuelle Konfiguration</h3>
      <div class="config-grid">
        <div class="config-item">
          <span class="label">Modell:</span>
          <span class="value">{{ config?.model || 'N/A' }}</span>
        </div>
        <div class="config-item">
          <span class="label">Profil:</span>
          <span class="value">{{ config?.profile || 'N/A' }}</span>
        </div>
        <div class="config-item">
          <span class="label">Temperature:</span>
          <span class="value">{{ config?.temperature || 'N/A' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiClient, type ServerStatus, type Profile, type Model } from '../api/client'

const config = ref<any>(null)
const serverStatus = ref<ServerStatus | null>(null)
const profiles = ref<Profile[]>([])
const models = ref<Model[]>([])
const selectedProfile = ref<string>('')
const selectedModel = ref<string>('')
const loading = ref(false)
const statusMessage = ref('')

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    // Load config
    config.value = await apiClient.getConfig()
    selectedProfile.value = config.value?.profile || 'default'
    selectedModel.value = config.value?.model || ''

    // Load server status
    serverStatus.value = await apiClient.getServerStatus()

    // Load profiles
    profiles.value = await apiClient.getProfiles()

    // Load models
    const modelsData = await apiClient.getModels()
    models.value = Array.isArray(modelsData) ? modelsData : (modelsData as any)?.models || []
  } catch (error) {
    console.error('Failed to load data:', error)
    statusMessage.value = `Fehler beim Laden: ${error}`
  }
}

const startServers = async () => {
  loading.value = true
  statusMessage.value = 'Starte Server...'
  try {
    await apiClient.startServers(selectedModel.value)
    statusMessage.value = '✅ Server erfolgreich gestartet!'
    await loadData()
  } catch (error) {
    console.error('Failed to start servers:', error)
    statusMessage.value = `❌ Fehler beim Starten: ${error}`
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
    statusMessage.value = '✅ Server erfolgreich gestoppt!'
    await loadData()
  } catch (error) {
    console.error('Failed to stop servers:', error)
    statusMessage.value = `❌ Fehler beim Stoppen: ${error}`
  } finally {
    loading.value = false
    setTimeout(() => statusMessage.value = '', 3000)
  }
}

const switchModel = async () => {
  if (!selectedModel.value) return
  
  loading.value = true
  statusMessage.value = `Wechsle zu ${selectedModel.value}...`
  try {
    await apiClient.switchModel(selectedModel.value)
    statusMessage.value = `✅ Modell gewechselt zu ${selectedModel.value}!`
    await loadData()
  } catch (error) {
    console.error('Failed to switch model:', error)
    statusMessage.value = `❌ Fehler beim Modell-Wechsel: ${error}`
  } finally {
    loading.value = false
    setTimeout(() => statusMessage.value = '', 3000)
  }
}

const changeProfile = async () => {
  if (!selectedProfile.value) return
  
  loading.value = true
  statusMessage.value = `Wechsle zu Profil ${selectedProfile.value}...`
  try {
    await apiClient.setProfile(selectedProfile.value)
    statusMessage.value = `✅ Profil gewechselt zu ${selectedProfile.value}!`
    await loadData()
  } catch (error) {
    console.error('Failed to change profile:', error)
    statusMessage.value = `❌ Fehler beim Profil-Wechsel: ${error}`
  } finally {
    loading.value = false
    setTimeout(() => statusMessage.value = '', 3000)
  }
}
</script>

<style scoped>
.settings-view {
  max-width: 900px;
}

h2 {
  margin-bottom: 2rem;
}

.settings-section {
  padding: 1.5rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

h3 {
  margin-bottom: 1rem;
  color: #646cff;
}

.status-grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: #0a0a0a;
  border-radius: 4px;
}

.label {
  font-weight: 500;
  color: #999;
}

.value {
  color: #fff;
}

.status.running {
  color: #4ade80;
}

.status.stopped {
  color: #f87171;
}

.button-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group label {
  font-weight: 500;
  color: #999;
}

.form-group select {
  padding: 0.75rem;
  background-color: #0a0a0a;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
}

.form-group select:focus {
  outline: none;
  border-color: #646cff;
}

.config-grid {
  display: grid;
  gap: 1rem;
}

.config-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: #0a0a0a;
  border-radius: 4px;
}

button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #646cff;
  color: white;
  width: 100%;
}

.btn-primary:hover:not(:disabled) {
  background-color: #535bf2;
}

.btn-success {
  background-color: #4ade80;
  color: #000;
  flex: 1;
}

.btn-success:hover:not(:disabled) {
  background-color: #22c55e;
}

.btn-danger {
  background-color: #f87171;
  color: #000;
  flex: 1;
}

.btn-danger:hover:not(:disabled) {
  background-color: #ef4444;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #0a0a0a;
  border-radius: 4px;
  color: #ffa500;
}
</style>
