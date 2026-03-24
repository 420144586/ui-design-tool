<template>
  <section class="canvas-root">
    <div class="el-1774346200429-11c26e">3</div>
    <div class="el-1774346192435-481cf6">
      <div class="el-1774346195462-48bca0">2</div>
    </div>
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

.el-1774346200429-11c26e {
  grid-column: 32 / span 5;
  grid-row: 20 / span 5;
  width: 50px;
  height: 50px;
  background: #4f7cff;
  opacity: 0.9;
  display: grid;
  grid-template-columns: repeat(5, 10px);
  grid-template-rows: repeat(5, 10px);
}
.el-1774346192435-481cf6 {
  grid-column: 39 / span 30;
  grid-row: 22 / span 30;
  width: 300px;
  height: 300px;
  background: #ff8f3e;
  opacity: 0.9;
  display: grid;
  grid-template-columns: repeat(30, 10px);
  grid-template-rows: repeat(30, 10px);
}
.el-1774346195462-48bca0 {
  grid-column: 2 / span 10;
  grid-row: 5 / span 10;
  width: 100px;
  height: 100px;
  background: #39b56a;
  opacity: 0.9;
  display: grid;
  grid-template-columns: repeat(10, 10px);
  grid-template-rows: repeat(10, 10px);
}
</style>