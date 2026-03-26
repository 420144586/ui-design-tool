<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { testAnimDebugBridge } from '@renderer/utils/testAnimDebugBridge'

const router = useRouter()
const route = useRoute()
</script>

<template>
  <main class="test-page">
    <header class="test-header">
      <div class="header-main">
        <div class="nav-actions">
          <button
            :class="{ active: route.path.endsWith('/generated') }"
            @click="router.push('/test/generated')"
          >
            生成子页面
          </button>
          <button @click="router.push('/')">返回设计器</button>
        </div>
        <div class="anim-debug" :class="{ inactive: !testAnimDebugBridge.active }">
          <span class="anim-label" title="visible：重播入场；hidden/v-if/v-show：切换 animShow">动画调试</span>
          <button
            type="button"
            class="btn-anim primary"
            title="visible（appear）：整页重挂载，再看一次入场动画"
            :disabled="!testAnimDebugBridge.active"
            @click="testAnimDebugBridge.replayAppear()"
          >
            重播入场
          </button>
          <button
            type="button"
            class="btn-anim"
            title="animShow 全部 true"
            :disabled="!testAnimDebugBridge.active || !testAnimDebugBridge.hasAnimShow"
            @click="testAnimDebugBridge.setAll(true)"
          >
            全部 true
          </button>
          <button
            type="button"
            class="btn-anim"
            title="animShow 全部 false"
            :disabled="!testAnimDebugBridge.active || !testAnimDebugBridge.hasAnimShow"
            @click="testAnimDebugBridge.setAll(false)"
          >
            全部 false
          </button>
          <code v-if="testAnimDebugBridge.active" class="anim-json" :title="testAnimDebugBridge.animShowJson">{{
            testAnimDebugBridge.animShowJson
          }}</code>
        </div>
      </div>
      <div
        v-if="testAnimDebugBridge.active && testAnimDebugBridge.hasAnimShow && testAnimDebugBridge.animIds.length"
        class="header-per-id"
      >
        <span class="per-id-label">按 id：</span>
        <span v-for="id in testAnimDebugBridge.animIds" :key="id" class="per-id-chip">
          <code>{{ id }}</code>
          <button type="button" class="btn-chip" @click="testAnimDebugBridge.setOne(id, true)">T</button>
          <button type="button" class="btn-chip" @click="testAnimDebugBridge.setOne(id, false)">F</button>
        </span>
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
  gap: 8px;
  background: #0b0f15;
  color: #dde5f3;
  padding: 10px 12px 12px;
  box-sizing: border-box;
}

.test-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.header-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

.nav-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.nav-actions button {
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #1a2230;
  color: #d2dbee;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
}

.nav-actions button.active {
  border-color: #4f7cff;
  color: #f0f4ff;
}

.anim-debug {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  flex: 1;
}

.anim-debug.inactive {
  opacity: 0.65;
}

.anim-label {
  font-size: 11px;
  font-weight: 600;
  color: #a5b2ca;
  flex-shrink: 0;
}

.btn-anim {
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #1a2230;
  color: #d2dbee;
  padding: 5px 10px;
  cursor: pointer;
  font-size: 11px;
}

.btn-anim:hover:not(:disabled) {
  border-color: #4a5570;
  background: #222b3a;
}

.btn-anim:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-anim.primary {
  border-color: #4f7cff66;
  color: #cfe0ff;
}

.anim-json {
  font-size: 9px;
  line-height: 1.3;
  color: #7eb8ff;
  max-width: min(420px, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 6px;
  background: #0f141c;
  border-radius: 4px;
  min-width: 0;
}

.header-per-id {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  font-size: 11px;
  padding-left: 2px;
}

.per-id-label {
  color: #6b7589;
  flex-shrink: 0;
}

.per-id-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.per-id-chip code {
  font-size: 9px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #b8d4ff;
}

.btn-chip {
  padding: 2px 6px;
  font-size: 10px;
  border: 1px solid #30384a;
  border-radius: 4px;
  background: #151b26;
  color: #c8d0df;
  cursor: pointer;
}

.btn-chip:hover {
  border-color: #4f7cff88;
}

.test-content {
  border: 1px solid #2a3140;
  border-radius: 8px;
  padding: 8px;
  overflow: auto;
  background: #101621;
  min-height: 0;
}
</style>
