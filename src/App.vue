<template>
  <div class="app-container">
    <!-- Sidebar with SettingsView -->
    <aside class="sidebar">
      <SettingsView />
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
import { apiClient, type ServerStatus } from './api/client'
import SettingsView from './views/SettingsView.vue'

const serverStatus = ref<ServerStatus | null>(null)
const clearChatTrigger = ref(0)

provide('clearChatTrigger', clearChatTrigger)

onMounted(async () => {
  startStatusPolling()
})

const startStatusPolling = () => {
  const pollStatus = async () => {
    try {
      serverStatus.value = await apiClient.getServerStatus()
    } catch {
      serverStatus.value = { llama_running: false, mcp_running: false, current_model: null }
    }
  }
  
  pollStatus()
  setInterval(pollStatus, 5000)
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
  width: auto;
  background-color: #1a1a1a;
  border-right: 1px solid #2a2a2a;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
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
