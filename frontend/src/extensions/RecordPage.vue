<template>
  <ErrorPage
    v-if="loadError"
    :errorTitle="errorTitle"
    :errorMessage="errorMessage"
  />
  <template v-else-if="document.doc">
    <LayoutHeader>
      <header class="flex h-10.5 min-w-0 items-center justify-between gap-2 py-[7px] pl-2 sm:pl-5">
        <div class="min-w-0 overflow-x-auto">
          <Breadcrumbs :items="breadcrumbs" />
        </div>
        <Button
          v-if="page.show_delete && permissions.data?.permissions?.delete"
          theme="red"
          icon-left="lucide-trash-2"
          :label="__('Delete')"
          @click="showDelete = true"
        />
        <Button
          v-if="activeLinkedTab"
          class="shrink-0"
          :label="__(activeLinkedTab.linked.add_label || 'Add')"
          iconLeft="lucide-plus"
          @click="activeLinkedTab.linked.add()"
        />
      </header>
    </LayoutHeader>
    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <component
        :is="narrow ? 'div' : Resizer"
        class="flex shrink-0 flex-col border-b md:h-full md:overflow-hidden md:border-b-0 md:border-r"
      >
        <h1 class="truncate border-b px-5 py-4 text-xl-semibold" :title="title">
          {{ title }}
        </h1>
        <SidePanelLayout
          v-if="sections.data"
          :sections="sideSections"
          :recordLinks="recordLinks"
          :doctype="page.doctype"
          :docname="docname"
          @reload="sections.reload"
          @beforeFieldChange="onSideFieldChange"
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
      </component>
      <Tabs
        v-if="tabs.length"
        v-model="activeTab"
        as="div"
        :tabs="tabs"
        class="flex min-h-52 min-w-0 flex-1 flex-col overflow-hidden [&_[role='tablist']]:min-h-[45px] [&_[role='tablist']]:px-5 [&>[data-slot=tab-panel]]:min-h-0 [&>[data-slot=tab-panel]]:grow [&>[data-slot=tab-panel]]:overflow-auto"
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
      <section
        v-else-if="page.form_fields?.length"
        class="min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-8"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-xl-semibold">{{ __(page.label_singular || page.label) }}</h2>
          <Button
            variant="solid"
            :label="__('Save')"
            :loading="formSave.loading"
            :disabled="!document.isDirty"
            @click="formSave.submit()"
          />
        </div>
        <p v-if="formSave.error" role="alert" class="mb-3 text-ink-red-3">{{ formSave.error.messages?.[0] || formSave.error.message }}</p>
        <FieldLayout
          v-if="formTabs.length"
          :tabs="formTabs"
          :data="document.doc"
          :doctype="page.doctype"
          :docname="docname"
        />
      </section>
      <EmptyState
        v-else-if="!narrow"
        :name="page.label"
        :title="__('No tabs yet')"
        :description="__('The record details are in the side panel.')"
      />
    </div>
    <Dialog v-model:open="showDelete" :title="__('Delete')">
      <p>{{ __('Are you sure you want to delete {0}?', [title]) }}</p>
      <p v-if="deleteError" role="alert" class="mt-2 text-ink-red-3">{{ deleteError }}</p>
      <template #actions>
        <Button :label="__('Cancel')" :disabled="deleting" @click="showDelete = false" />
        <Button theme="red" variant="solid" :label="__('Delete')" :loading="deleting" @click="deleteRecord" />
      </template>
    </Dialog>
  </template>
  <div v-else class="flex flex-1 items-center justify-center gap-3" role="status">
    <LoadingIndicator class="h-6 w-6" />
    {{ __('Loading...') }}
  </div>
</template>

<script setup>
import { useMediaQuery } from '@vueuse/core'
import ErrorPage from '@/components/ErrorPage.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import Resizer from '@/components/Resizer.vue'
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import SidePanelLayout from '@/components/SidePanelLayout.vue'
import { useRouter } from 'vue-router'
import { useDocument, markDocumentAsDeleted, unmarkDocumentAsDeleted, expireDeletionMarker } from '@/data/document'
import { getMeta } from '@/stores/meta'
import { getSettings } from '@/stores/settings'
import { call, createResource, Dialog, Breadcrumbs, Tabs, usePageMeta } from 'frappe-ui'
import { computed, ref, shallowRef, unref, watch } from 'vue'
import { saveRecord } from './saveRecord'
import LinkedTab from './LinkedTab.vue'
import { linkedTabs } from './linkedTabs'
import { getParentPage, getRecordRoute } from './pages'

const props = defineProps({
  page: { type: Object, required: true },
  docname: { type: String, required: true },
})

const narrow = useMediaQuery('(max-width: 767px)')
const { brand } = getSettings()
const { document, permissions } = useDocument(props.page.doctype, props.docname)
const { doctypeMeta } = getMeta(props.page.doctype)
const title = computed(() => document.doc?.[props.page.title_field] || props.docname)

const router = useRouter()
const showDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')
watch(showDelete, () => { deleteError.value = '' })

async function deleteRecord() {
  if (deleting.value) return
  const { doctype, label } = props.page
  const name = props.docname
  const destination = parentBreadcrumbs.value.at(-1)?.route || { name: label }
  deleting.value = true
  markDocumentAsDeleted(doctype, name)
  try {
    await call('frappe.client.delete', { doctype, name })
  } catch (err) {
    unmarkDocumentAsDeleted(doctype, name)
    deleteError.value = err.messages?.[0] || err.message
    return
  } finally {
    deleting.value = false
  }
  expireDeletionMarker(doctype, name)
  showDelete.value = false
  await router.replace(destination)
}

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

const formSave = createResource({
  url: 'frappe.client.save',
  resourceFetcher: ({ url }) => saveRecord(props.page, document.doc, url),
  onSuccess: (saved) => saved && document.reload(),
})

const formTabs = computed(() => {
  if (!doctypeMeta.value || !props.page.form_fields?.length) return []
  const fields = props.page.form_fields
    .map((name) => doctypeMeta.value.fields.find((field) => field.fieldname === name))
    .filter(Boolean)
  return [{ name: 'record', sections: [{ name: 'details', columns: [{ fields }] }] }]
})

const sideSections = computed(() => {
  if (!props.page.form_fields?.length) return sections.data
  return sections.data?.map((section) => ({
    ...section,
    columns: section.columns.map((column) => ({
      ...column,
      fields: column.fields.filter((field) => field.fieldname !== props.page.form_button),
    })),
  }))
})

function onSideFieldChange() {
  if (!props.page.form_fields?.length) return saveFieldChange()
}

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
const recordLinks = computed(() => {
  const links = {}
  for (const fieldname of props.page.read_only_links || []) {
    const field = doctypeMeta.value?.fields.find((field) => field.fieldname === fieldname)
    const name = document.doc?.[fieldname]
    if (field?.fieldtype !== 'Link' || !name) continue
    const route = getRecordRoute(field.options, name)
    const parent = parentBreadcrumbs.value.find(
      (item) => route && item.route.name === route.name &&
        Object.values(item.route.params).includes(name),
    )
    links[fieldname] = route
      ? { target: { to: route }, label: parent?.label || name, description: parent?.description }
      : { target: { href: '/desk/' + field.options.toLowerCase().replace(/ /g, '-') + '/' + encodeURIComponent(name) }, label: name }
  }
  return links
})
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
      description: parentPage.description_field && record[parentPage.description_field]?.trim(),
      route: getRecordRoute(doctype, name),
    })
  }
  return items
}
</script>
