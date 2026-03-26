import { reactive } from 'vue'

/** 测试页顶栏「动画调试」与生成预览子组件之间的状态桥（仅 /test/generated 激活） */
export const testAnimDebugBridge = reactive({
  active: false,
  replayAppear: (): void => {},
  setAll: (_v: boolean): void => {},
  setOne: (_id: string, _v: boolean): void => {},
  hasAnimShow: false,
  animIds: [] as string[],
  animShowJson: ''
})

export function resetTestAnimDebugBridge(): void {
  testAnimDebugBridge.active = false
  testAnimDebugBridge.hasAnimShow = false
  testAnimDebugBridge.animIds = []
  testAnimDebugBridge.animShowJson = ''
  testAnimDebugBridge.replayAppear = (): void => {}
  testAnimDebugBridge.setAll = (): void => {}
  testAnimDebugBridge.setOne = (): void => {}
}
