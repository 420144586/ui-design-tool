<template>
  <section class="canvas-root">
  <div class="el-1774343507452-0028b4">1</div>
  <div class="el-1774343508987-346a6c">2</div>
  <div class="el-1774343581551-976c23">3</div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const message = ref('由设计器生成的 Vue 组件')
</script>

<style scoped>
.canvas-root {
  position: relative;
  display: grid;
  grid-template-columns: repeat(192, 10px);
  grid-template-rows: repeat(108, 10px);
  width: 1920px;
  height: 1080px;
}

.el-1774343507452-0028b4 {
  grid-column: 1 / span 5;
  grid-row: 1 / span 5;
  width: 50px;
  height: 50px;
  background: #4f7cff;
  opacity: 0.9;
  z-index: 1;
}
.el-1774343508987-346a6c {
  grid-column: 6 / span 5;
  grid-row: 6 / span 5;
  width: 50px;
  height: 50px;
  background: #4f7cff;
  opacity: 0.9;
  z-index: 2;
}
.el-1774343581551-976c23 {
  grid-column: 28 / span 30;
  grid-row: 39 / span 30;
  width: 300px;
  height: 300px;
  background: #ff8f3e;
  opacity: 0.9;
  z-index: 3;
}
</style>