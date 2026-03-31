<script setup lang="ts">
import { computed } from 'vue'
import { useDesignStore } from '@renderer/store/design'

const store = useDesignStore()

const list = computed(() => store.designStash)

const canAddStash = computed(() => {
  if (store.selectedElementIds.length !== 1) return false
  const el = store.selectedElement
  if (!el) return false
  if (el.isFlexPageShell) return false
  return true
})

const onAdd = (): void => {
  if (!canAddStash.value) return
  store.stashSelectedSubtreeToPanel()
}

const onRemove = (stashId: string): void => {
  if (!window.confirm('确定从暂存区删除该项？其中的快照将丢弃，可通过「撤销」恢复刚才的删除。')) return
  store.removeDesignStashEntry(stashId)
}

const onRestore = (stashId: string): void => {
  store.restoreDesignStashToSelectedParent(stashId)
}
</script>

<template>
  <section class="stash-panel" aria-label="暂存区">
    <div class="stash-header">
      <h3 class="stash-title">暂存区</h3>
      <button
        type="button"
        class="stash-add"
        :disabled="!canAddStash"
        :title="
          canAddStash
            ? '将当前选中元素及子树移入暂存（画布中暂时移除）'
            : '请单选一项元素，且不能是画布容器'
        "
        @click="onAdd"
      >
        +
      </button>
    </div>
    <p v-if="list.length === 0" class="stash-empty">暂无暂存。选中画布中的元素后点「+」加入。</p>
    <ul v-else class="stash-list">
      <li v-for="entry in list" :key="entry.stashId" class="stash-card">
        <div class="stash-thumb-wrap">
          <iframe
            class="stash-thumb-frame"
            :srcdoc="entry.previewSrcdoc"
            :title="`预览：${entry.rootName}`"
            scrolling="no"
          />
        </div>
        <div class="stash-meta">{{ entry.rootName }}</div>
        <div class="stash-actions">
          <button type="button" class="stash-btn stash-btn-danger" @click="onRemove(entry.stashId)">
            删除
          </button>
          <button
            type="button"
            class="stash-btn stash-btn-primary"
            title="挂到当前在设计区选中的父容器内"
            @click="onRestore(entry.stashId)"
          >
            放回
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.stash-panel {
  flex: 0 0 auto;
  max-height: min(320px, 42vh);
  display: flex;
  flex-direction: column;
  border-top: 1px solid #2a2f3a;
  background: #141820;
  padding: 10px 12px 12px;
  min-height: 0;
}

.stash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.stash-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #c8d0df;
}

.stash-add {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #3d4d64;
  background: #1e2633;
  color: #9ecbff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.stash-add:hover:not(:disabled) {
  border-color: #4f7cff;
  color: #e8f0ff;
}

.stash-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stash-empty {
  margin: 0;
  font-size: 11px;
  color: #7a8499;
  line-height: 1.45;
  flex-shrink: 0;
}

.stash-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.stash-card {
  background: #1a1f28;
  border: 1px solid #2c3545;
  border-radius: 8px;
  padding: 8px;
}

.stash-thumb-wrap {
  width: 100%;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  background: #0d1016;
  border: 1px solid #252d3a;
}

.stash-thumb-frame {
  width: 200%;
  height: 200%;
  border: none;
  transform: scale(0.5);
  transform-origin: 0 0;
  pointer-events: none;
  display: block;
}

.stash-meta {
  margin-top: 6px;
  font-size: 11px;
  color: #aeb9cc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stash-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.stash-btn {
  flex: 1;
  padding: 6px 8px;
  font-size: 11px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #30384a;
  background: #232b38;
  color: #d2dbee;
}

.stash-btn:hover {
  border-color: #4a5570;
}

.stash-btn-danger {
  border-color: #5c3540;
  color: #f0c4cb;
}

.stash-btn-danger:hover {
  border-color: #a33d45;
}

.stash-btn-primary {
  border-color: #2f4a6e;
  color: #a8c8ff;
}

.stash-btn-primary:hover {
  border-color: #4f7cff;
}
</style>
