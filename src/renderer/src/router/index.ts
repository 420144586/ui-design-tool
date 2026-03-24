import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'designer',
      component: () => import('@renderer/views/DesignerView.vue')
    },
    {
      path: '/test',
      name: 'test',
      component: () => import('@renderer/test.vue'),
      children: [
        {
          path: 'generated',
          name: 'test-generated',
          component: () => import('@renderer/generated/GeneratedFromDesigner.vue')
        }
      ]
    }
  ]
})

export default router
