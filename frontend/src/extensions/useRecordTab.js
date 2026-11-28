import { computed, unref } from 'vue'
import { useSessionStorage } from '@vueuse/core'
import { sessionStore } from '@/stores/session'

export function useRecordTab(doctype, name, tabs) {
  const key = JSON.stringify(['crm-record-tab', sessionStore().user, doctype, name])
  const selected = useSessionStorage(key, '', { writeDefaults: false, flush: 'sync' })
  return computed({
    get() {
      const available = unref(tabs)
      return available.find(tab => tab.value === selected.value)?.value ?? available[0]?.value ?? ''
    },
    set(value) {
      if (unref(tabs).some(tab => tab.value === value)) selected.value = value
    },
  })
}
