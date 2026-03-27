<template>
    <Transition name="setting-pannel">
      <div v-if="settingsVisible" class="setting-pannel-transition-root">
        <div class="el-1774523251182-f9b037">
        <div class="el-1774581017466-e40ca6">
          <div class="el-1774581053684-405c41">
            <div class="el-1774581066038-65ac77">
              <img class="el-1774581066038-3d98b7" src="" alt="" />
              <div class="el-1774581066038-c9709f">界面样式</div>
            </div>
          </div>
          <div class="el-1774581053684-2f2f1e">
            <div class="el-1774581238205-954284">
              <img class="el-1774581238206-c7e8b1" src="" alt="" />
              <div class="el-1774581238206-c016b1">设备调试</div>
            </div>
          </div>
          <div class="el-1774581053684-63ecb8">
            <div class="el-1774581234457-732199">
              <img class="el-1774581234457-29c5fa" src="" alt="" />
              <div class="el-1774581234457-8fe6e5">演示模式</div>
            </div>
          </div>
          <div class="el-1774581053684-b273a5">
            <div class="el-1774581230985-d06633">
              <img class="el-1774581230985-b20e1d" src="" alt="" />
              <div class="el-1774581230985-65bd6e">导出密码</div>
            </div>
          </div>
          <div class="el-1774581053684-1f8bf5">
            <div class="el-1774581226505-bd91e4">
              <img class="el-1774581226505-871d58" src="" alt="" />
              <div class="el-1774581226505-b93859">功能权限</div>
            </div>
          </div>
          <div class="el-1774581053684-7d8cbb">
            <div class="el-1774581216473-6dd2a0">
              <img class="el-1774581216473-a13c8f" src="" alt="" />
              <div class="el-1774581216473-02912f">关于优理</div>
            </div>
          </div>
        </div>
        <div class="el-1774523370017-f38503">
          <div class="el-1774581276678-91e4e5">
            <img class="el-1774581296893-08ef00" src="" alt="" />
          </div>
        </div>
        <div class="el-1774580969200-761321">
          <img class="el-1774581253837-ef3031" src="" alt="" />
        </div>
        <div class="el-1774580999063-f6ab05">
          <img class="el-1774581254934-9e0a59" src="" alt="" />
        </div>
        </div>
      </div>
    </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'

/** 本仓库使用 Pinia，未安装 vuex；占位预览用本地状态，避免 Vite 无法解析 vuex。 */
const settingsVisible = ref(true)
</script>

<style scoped>
.setting-pannel-transition-root {
  position: absolute;
  bottom: 60px;
  left: 10px;
  width: 960px;
  height: 420px;
  box-sizing: border-box;
}

.el-1774523251182-f9b037 {
  width: 100%;
  height: 100%;
  position: relative;
  display: grid;
  background: linear-gradient(180deg, #FFFFFF, #F2F8FF,  #F7FBFF );
  opacity: 0.9;
  place-items: center;
  grid-template-columns: repeat(96, 10px);
  grid-template-rows: repeat(42, 10px);
  border-top: 2px solid #A4B7CC;
  border-right: 2px solid #A4B7CC;
  border-bottom: 2px solid #A4B7CC;
  border-left: 2px solid #A4B7CC;
  box-sizing: border-box;
}
.el-1774581017466-e40ca6 {
  grid-column: 1 / span 14;
  grid-row: 1 / span 36;
  width: 140px;
  height: 360px;
  background: #7b5cff;
  opacity: 0.9;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  overflow: hidden;
  box-sizing: border-box;
}
.el-1774581053684-405c41 {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #7b5cff;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581066038-65ac77 {
  grid-column: 1 / span 13;
  grid-row: 2 / span 5;
  width: 130px;
  height: 50px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.el-1774581066038-c9709f {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
  height: 100%;
  background: rgba(255,255,255,0.08);
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581066038-3d98b7 {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: cover;
  display: block;
  opacity: 1;
  box-sizing: border-box;
}
.el-1774581053684-2f2f1e {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #7b5cff;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581238205-954284 {
  grid-column: 1 / span 13;
  grid-row: 2 / span 5;
  width: 130px;
  height: 50px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.el-1774581238206-c016b1 {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
  height: 100%;
  background: rgba(255,255,255,0.08);
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581238206-c7e8b1 {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: cover;
  display: block;
  opacity: 1;
  box-sizing: border-box;
}
.el-1774581053684-63ecb8 {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #7b5cff;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581234457-732199 {
  grid-column: 1 / span 13;
  grid-row: 2 / span 5;
  width: 130px;
  height: 50px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.el-1774581234457-8fe6e5 {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
  height: 100%;
  background: rgba(255,255,255,0.08);
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581234457-29c5fa {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: cover;
  display: block;
  opacity: 1;
  box-sizing: border-box;
}
.el-1774581053684-b273a5 {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #7b5cff;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581230985-d06633 {
  grid-column: 1 / span 13;
  grid-row: 2 / span 5;
  width: 130px;
  height: 50px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.el-1774581230985-65bd6e {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
  height: 100%;
  background: rgba(255,255,255,0.08);
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581230985-b20e1d {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: cover;
  display: block;
  opacity: 1;
  box-sizing: border-box;
}
.el-1774581053684-1f8bf5 {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #7b5cff;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581226505-bd91e4 {
  grid-column: 1 / span 13;
  grid-row: 2 / span 5;
  width: 130px;
  height: 50px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.el-1774581226505-b93859 {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
  height: 100%;
  background: rgba(255,255,255,0.08);
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581226505-871d58 {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: cover;
  display: block;
  opacity: 1;
  box-sizing: border-box;
}
.el-1774581053684-7d8cbb {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  background: #7b5cff;
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581216473-6dd2a0 {
  grid-column: 1 / span 13;
  grid-row: 2 / span 5;
  width: 130px;
  height: 50px;
  background: transparent;
  opacity: 1;
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.el-1774581216473-02912f {
  flex: 1 1 auto;
  min-width: 100px;
  max-width: none;
  height: 100%;
  background: rgba(255,255,255,0.08);
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.el-1774581216473-a13c8f {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: cover;
  display: block;
  opacity: 1;
  box-sizing: border-box;
}
.el-1774523370017-f38503 {
  grid-column: 1 / span 96;
  grid-row: 37 / span 6;
  width: 960px;
  height: 60px;
  background: transparent;
  opacity: 0.9;
  position: relative;
  display: grid;
  place-items: center;
  grid-template-columns: repeat(96, 10px);
  grid-template-rows: repeat(6, 10px);
  border-top: 2px solid #A4B7CC;
  border-right: none;
  border-bottom: none;
  border-left: none;
  box-sizing: border-box;
}
.el-1774580969200-761321 {
  grid-column: 1 / span 7;
  grid-row: 37 / span 6;
  width: 70px;
  height: 60px;
  background: transparent;
  opacity: 0.9;
  position: relative;
  display: grid;
  place-items: center;
  grid-template-columns: repeat(7, 10px);
  grid-template-rows: repeat(6, 10px);
  border-top: none;
  border-right: 2px solid #A4B7CC;
  border-bottom: none;
  border-left: none;
  box-sizing: border-box;
}
.el-1774580999063-f6ab05 {
  grid-column: 8 / span 7;
  grid-row: 37 / span 6;
  width: 70px;
  height: 60px;
  background: transparent;
  opacity: 0.9;
  position: relative;
  display: grid;
  place-items: center;
  grid-template-columns: repeat(7, 10px);
  grid-template-rows: repeat(6, 10px);
  border-top: none;
  border-right: 2px solid #A4B7CC;
  border-bottom: none;
  border-left: none;
  box-sizing: border-box;
}
.el-1774581276678-91e4e5 {
  grid-column: 90 / span 7;
  grid-row: 1 / span 6;
  width: 70px;
  height: 60px;
  background: transparent;
  opacity: 0.9;
  position: relative;
  display: grid;
  place-items: center;
  grid-template-columns: repeat(7, 10px);
  grid-template-rows: repeat(6, 10px);
  border-top: none;
  border-right: none;
  border-bottom: none;
  border-left: 2px solid #A4B7CC;
  box-sizing: border-box;
}
.el-1774581253837-ef3031 {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  place-self: center;
  width: 30px;
  height: 30px;
  opacity: 1;
  object-fit: cover;
  display: block;
  box-sizing: border-box;
}
.el-1774581254934-9e0a59 {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  place-self: center;
  width: 30px;
  height: 30px;
  opacity: 1;
  object-fit: cover;
  display: block;
  box-sizing: border-box;
}
.el-1774581296893-08ef00 {
  grid-column: 1 / -1;
  grid-row: 1 / -1;
  place-self: center;
  width: 30px;
  height: 30px;
  opacity: 1;
  object-fit: cover;
  display: block;
  box-sizing: border-box;
}
</style>

<!-- 过渡类由 Vue 动态添加，不用 scoped，避免哈希与 prefers-reduced-motion 全局 !important 叠加后仍无效 -->
<style>
.setting-pannel-enter-active,
.setting-pannel-leave-active {
  transition:
    opacity 400ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.setting-pannel-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.setting-pannel-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* main.css 在 prefers-reduced-motion: reduce 时对 * 使用 transition-duration: 0.01ms !important */
@media (prefers-reduced-motion: reduce) {
  .setting-pannel-enter-active,
  .setting-pannel-leave-active {
    transition-duration: 200ms !important;
  }
}
</style>