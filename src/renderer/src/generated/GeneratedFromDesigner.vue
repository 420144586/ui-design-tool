<template>
  <section class="canvas-root">
    <table class="el-1774432521093-847c37">
      <tr>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
      </tr>
      <tr>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
      </tr>
      <tr>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
      </tr>
      <tr>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
      </tr>
      <tr>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
        <td>
        </td>
      </tr>
    </table>
    <div class="el-1774432610604-aebfb5">
      <DButton class="el-1774432612592-5fe7b8" />
      <DButton class="el-1774434444066-584a43" />
    </div>
  </section>
</template>

<script setup lang="ts">

import DButton from '@renderer/D-components/DButton.vue'

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

.el-1774432521093-847c37 {
  grid-column: 46 / span 25;
  grid-row: 17 / span 25;
  width: 250px;
  height: 250px;
  background: #1a1f2b;
  opacity: 1;
  position: relative;
  border-collapse: collapse;
  table-layout: fixed;
  box-sizing: border-box;
}
.el-1774432521093-847c37 td {
  border: 1px solid #d0d0d0;
  position: relative;
  vertical-align: top;
}
.el-1774432610604-aebfb5 {
  grid-column: 42 / span 30;
  grid-row: 52 / span 30;
  width: 300px;
  height: 300px;
  background: #ff8f3e;
  opacity: 0.9;
  position: relative;
  display: grid;
  grid-template-columns: repeat(30, 10px);
  grid-template-rows: repeat(30, 10px);
}
.el-1774432612592-5fe7b8 {
  grid-column: 11 / span 12;
  grid-row: 10 / span 4;
  width: 120px;
  height: 40px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.el-1774434444066-584a43 {
  grid-column: 11 / span 12;
  grid-row: 14 / span 4;
  width: 120px;
  height: 40px;
  background: red;
  opacity: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

</style>