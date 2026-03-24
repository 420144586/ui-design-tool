<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
</script>

<template>
  <main class="test-page">
    <header class="test-header">
      <h1>测试页面</h1>
      <div class="actions">
        <button :class="{ active: route.path.endsWith('/generated') }" @click="router.push('/test/generated')">
          生成子页面
        </button>
        <button @click="router.push('/')">返回设计器</button>
      </div>
    </header>

    <section class="test-content">
      <router-view />
    </section>
  </main>
</template>

<style scoped>
.test-page {
  height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 10px;
  background: #0b0f15;
  color: #dde5f3;
  padding: 14px;
}

.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.actions {
  display: flex;
  gap: 8px;
}

.test-content {
  border: 1px solid #2a3140;
  border-radius: 8px;
  padding: 10px;
  overflow: auto;
  background: #101621;
}

button {
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #1a2230;
  color: #d2dbee;
  padding: 6px 12px;
  cursor: pointer;
}

button.active {
  border-color: #4f7cff;
  color: #f0f4ff;
}
</style>
