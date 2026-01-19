<template>
  <div class="settings-view">
    <h2>Settings</h2>
    <div class="settings-section">
      <h3>Current Configuration</h3>
      <pre v-if="config">{{ JSON.stringify(config, null, 2) }}</pre>
      <p v-else>Loading...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiClient } from '../api/client'

const config = ref<any>(null)

onMounted(async () => {
  try {
    config.value = await apiClient.getConfig()
  } catch (error) {
    console.error('Failed to load config:', error)
  }
})
</script>

<style scoped>
.settings-view {
  max-width: 800px;
}

h2 {
  margin-bottom: 2rem;
}

.settings-section {
  padding: 1.5rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  margin-bottom: 1rem;
}

h3 {
  margin-bottom: 1rem;
}

pre {
  background-color: #0a0a0a;
  padding: 1rem;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
