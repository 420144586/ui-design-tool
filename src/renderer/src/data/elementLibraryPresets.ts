import type { ElementPreset } from '@renderer/types/design'

export const BASIC_ELEMENT_PRESETS: ElementPreset[] = [
  {
    kind: 'div',
    type: 'div',
    name: 'Div 50x50',
    width: 50,
    height: 50,
    background: '#4f7cff',
    text: '',
    opacity: 0.9
  },
  {
    kind: 'div',
    type: 'div',
    name: 'Div 100x100',
    width: 100,
    height: 100,
    background: '#39b56a',
    text: '',
    opacity: 0.9
  },
  {
    kind: 'div',
    type: 'div',
    name: 'Div 300x300',
    width: 300,
    height: 300,
    background: '#ff8f3e',
    text: '',
    opacity: 0.9
  },
  {
    kind: 'column',
    type: 'div',
    name: 'Column 容器',
    width: 200,
    height: 400,
    background: '#7b5cff',
    text: '',
    opacity: 0.9,
    childCount: 8
  },
  {
    kind: 'image',
    type: 'div',
    name: 'Image 块',
    width: 30,
    height: 30,
    background: 'transparent',
    text: '',
    opacity: 1,
    hasLabel: false,
    gap: 10,
    imageSrc: ''
  },
  {
    kind: 'table',
    type: 'table',
    name: 'Table 5×5',
    width: 250,
    height: 250,
    background: '#1a1f2b',
    text: '',
    opacity: 1,
    tableRows: 5,
    tableCols: 5,
    borderColor: '#d0d0d0'
  }
]

export const COMPONENT_LIBRARY_PRESETS: ElementPreset[] = [
  {
    kind: 'dcomponent',
    type: 'div',
    name: 'DButton',
    width: 120,
    height: 40,
    background: 'transparent',
    text: '',
    opacity: 1,
    componentKey: 'DButton'
  },
  {
    kind: 'dcomponent',
    type: 'div',
    name: 'DInput',
    width: 300,
    height: 50,
    background: '#ffffff',
    text: '',
    opacity: 1,
    componentKey: 'DInput'
  }
]
