<template>
  <ErrorPage
    v-if="loadError"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <template v-else-if="document.doc">
    <LayoutHeader>
      <template #left-header>
        <Breadcrumbs :items="breadcrumbs" />
      </template>
      <template #right-header>
        <Button
          v-if="activeLinkedTab"
          :label="__(activeLinkedTab.linked.add_label || 'Add')"
          iconLeft="lucide-plus"
          @click="activeLinkedTab.linked.add()"
        />
      </template>
    </LayoutHeader>
    <div class="flex min-h-0 flex-1">
      <Resizer
        class="flex h-full flex-col overflow-hidden border-r"
      >
        <h1 class="truncate border-b px-5 py-4 text-xl-semibold" :title="title">
          {{ title }}
        </h1>
        <SidePanelLayout
          v-if="sections.data"
          :sections="sections.data"
          :doctype="page.doctype"
          :docname="docname"
          @reload="sections.reload"
          @beforeFieldChange="saveFieldChange"
        />
        <ErrorPage
          v-else-if="sections.error"
          :errorTitle="__('Error Occurred')"
          :errorMessage="sections.error.messages?.[0] || __('An Error Occurred')"
        />
        <div v-else class="flex items-center gap-2 px-5 py-4" role="status">
          <LoadingIndicator class="h-5 w-5" />
          {{ __('Loading...') }}
        </div>
      </Resizer>
      <Tabs
        v-if="tabs.length"
        v-model="activeTab"
        as="div"
        :tabs="tabs"
        class="flex min-w-0 flex-1 flex-col overflow-hidden [&_[role='tablist']]:min-h-[45px] [&_[role='tablist']]:px-5 [&>[data-slot=tab-panel]]:min-h-0 [&>[data-slot=tab-panel]]:grow [&>[data-slot=tab-panel]]:overflow-auto"
      >
        <template #tab-suffix="{ tab, active }">
          <Badge
            :class="active ? 'bg-surface-gray-10' : 'bg-gray-600'"
            variant="solid"
            theme="gray"
            size="sm"
          >
            {{ unref(tab.count) }}
          </Badge>
        </template>
        <template #tab-panel="{ tab }">
          <LinkedTab :tab="tab" :header="false" />
        </template>
      </Tabs>
      <EmptyState
        v-else
        :name="page.label"
        :title="__('No tabs yet')"
        :description="__('The record details are in the side panel.')"
      />
    </div>
  </template>
  <div v-else class="flex flex-1 items-center justify-center gap-3" role="status">
    <LoadingIndicator class="h-6 w-6" />
    {{ __('Loading...') }}
  </div>
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import Resizer from '@/components/Resizer.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import { useDocument } from '@/data/document'
import { getMeta } from '@/stores/meta'
import { getSettings } from '@/stores/settings'
import { call, createResource, Breadcrumbs, Tabs, usePageMeta } from 'frappe-ui'
import { computed, ref, shallowRef, unref, watch } from 'vue'
import LinkedTab from './LinkedTab.vue'
import { linkedTabs } from './linkedTabs'
import { getParentPage, getRecordRoute } from './pages'

const props = defineProps({
  page: { type: Object, required: true },
  docname: { type: String, required: true },
})

const { brand } = getSettings()
const { document } = useDocument(props.page.doctype, props.docname)
const { doctypeMeta } = getMeta(props.page.doctype)
const title = computed(() => document.doc?.[props.page.title_field] || props.docname)

const loadError = computed(() => document.get.error)
const errorTitle = computed(() => {
  if (loadError.value?.exc_type === 'PermissionError') return __('Not Permitted')
  if (loadError.value?.exc_type === 'DoesNotExistError') return __('Document Not Found')
  return __('Error Occurred')
})
const errorMessage = computed(() => {
  if (loadError.value?.exc_type === 'PermissionError') {
    return __('You do not have permission to access this document')
  }
  return loadError.value?.messages?.[0] || __('An Error Occurred')
})

usePageMeta(() => ({
  title: document.doc ? title.value : __(props.page.label),
  icon: brand.favicon,
}))

const sections = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_sidepanel_sections',
  cache: ['sidePanelSections', props.page.doctype],
  params: { doctype: props.page.doctype },
})

const tabs = shallowRef([])
const activeTab = ref('')
const activeLinkedTab = computed(() => tabs.value.find((tab) => tab.value === activeTab.value))

watch(
  () => document.doc?.name,
  (name) => {
    if (!name) return
    sections.fetch()
    tabs.value = linkedTabs(props.page.doctype, name)
    activeTab.value = tabs.value[0]?.value || ''
  },
  { immediate: true },
)

async function saveFieldChange() {
  try {
    await document.save.submit()
  } catch {
    // SidePanelLayout updates the shared document before saving. Restore the
    // server value after a rejected edit so the field matches the saved record.
    await document.reload().catch(() => {})
  }
}

const parentBreadcrumbs = shallowRef([])
const breadcrumbs = computed(() => [
  ...(props.page.sidebar ? [{ label: __(props.page.label), route: { name: props.page.label } }] : []),
  ...parentBreadcrumbs.value,
  { label: title.value },
])

watch(
  [() => document.doc, doctypeMeta],
  async ([doc, meta], _previous, onCleanup) => {
    let current = true
    onCleanup(() => (current = false))
    if (!doc || !meta) {
      parentBreadcrumbs.value = []
      return
    }

    const parents = await getParentBreadcrumbs(doc, props.page, new Set(), meta)
    if (current) parentBreadcrumbs.value = parents
  },
  { immediate: true },
)

async function getParentBreadcrumbs(doc, page, seen, meta) {
  const items = []
  for (const parent of page.parents || []) {
    const fieldname = typeof parent === 'string' ? parent : parent.field
    const doctype = parent.doctype || meta?.fields.find((field) => field.fieldname === fieldname)?.options
    const name = doc[fieldname]
    const parentPage = getParentPage(doctype)
    const key = JSON.stringify([doctype, name])
    if (!name || !parentPage || seen.has(key)) continue
    seen.add(key)

    // The same permission-checked read used to open the parent page.
    const record = await call('frappe.client.get', { doctype, name }).catch(() => null)
    if (!record) continue

    let parentMeta
    if (parentPage.parents?.some((link) => typeof link === 'string')) {
      const { meta: resource, doctypeMeta } = getMeta(doctype)
      await resource.promise?.catch(() => {})
      parentMeta = doctypeMeta.value
    }
    items.push(...(await getParentBreadcrumbs(record, parentPage, seen, parentMeta)))
    items.push({
      label: record[parentPage.title_field] || name,
      route: getRecordRoute(doctype, name),
    })
  }
  return items
}
</script>
