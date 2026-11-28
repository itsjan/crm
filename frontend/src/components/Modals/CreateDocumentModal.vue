<template>
  <Dialog v-model:open="show" :size="dialogOptions.size" bare>
    <template #default>
      <div class="bg-surface-elevation-2 px-4 pb-6 pt-5 sm:px-6">
        <div class="mb-5 flex items-center justify-between">
          <div>
            <h3 class="text-3xl-semibold leading-6 text-ink-gray-9">
              {{ __(dialogOptions.title) || __('Untitled') }}
            </h3>
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="isManager() && !isMobileView"
              variant="ghost"
              class="w-7"
              :tooltip="__('Edit Fields Layout')"
              :icon="EditIcon"
              @click="openQuickEntryModal"
            />
            <Button
              variant="ghost"
              class="w-7"
              icon="lucide-x"
              @click="show = false"
            />
          </div>
        </div>
        <div v-if="tabs.data">
          <FieldLayout :tabs="tabs.data" :data="_data.doc" :doctype="doctype" />
          <ErrorMessage class="mt-2" :message="error" />
        </div>
      </div>
      <div class="px-4 pb-7 pt-4 sm:px-6">
        <div class="space-y-2">
          <Button
            v-for="action in dialogOptions.actions"
            :key="action.label"
            class="w-full"
            v-bind="action"
            :label="__(action.label)"
            :loading="loading"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import FieldLayout from '@/components/FieldLayout/FieldLayout.vue'
import EditIcon from '@/components/Icons/EditIcon.vue'
import { usersStore } from '@/stores/users'
import { getMeta } from '@/stores/meta'
import { saveRecord } from '@/extensions/saveRecord'
import { useRouter } from 'vue-router'
import { getRecordRoute, getRegisteredPage } from '@/extensions/pages'
import { useDocument } from '@/data/document'
import { isMobileView } from '@/composables/settings'
import { showQuickEntryModal, quickEntryProps } from '@/composables/modals'
import { call, createResource, ErrorMessage } from 'frappe-ui'
import { ref, nextTick, watch, computed } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  data: { type: Object, default: () => ({}) },
})

const router = useRouter()
const emit = defineEmits(['callback'])

const { isManager } = usersStore()

const show = defineModel({ type: Boolean })

const loading = ref(false)
const error = ref(null)

const { document: _data, triggerOnBeforeCreate } = useDocument(props.doctype)
const { doctypeMeta } = getMeta(props.doctype)

const page = getRegisteredPage(props.doctype)
const titleDefault = page?.create_title
if (titleDefault) {
  // The document store also holds the previous, possibly cancelled, draft.
  _data.doc = { __newDocument: true, doctype: props.doctype }
  let suggested = ''
  watch(
    () => _data.doc[titleDefault.source],
    async (source, previous, onCleanup) => {
      let current = true
      onCleanup(() => { current = false })
      const title = page.title_field
      if (_data.doc[title] && _data.doc[title] !== suggested) return
      _data.doc[title] = ''
      suggested = ''
      if (!source) return
      try {
        const value = await call(titleDefault.method, { [titleDefault.source]: source })
        if (current && !_data.doc[title]) {
          suggested = value
          _data.doc[title] = value
        }
      } catch (err) {
        // The server also supplies the default when saving without a title.
        console.warn('Could not load the default record title', err)
      }
    },
    { immediate: true },
  )
}

const dialogOptions = computed(() => {
  let doctype = props.doctype

  if (doctype.startsWith('CRM ') || doctype.startsWith('FCRM ')) {
    doctype = doctype.replace(/^(CRM |FCRM )/, '')
  }

  const page = getRegisteredPage(props.doctype)
  const title = page?.create_label || __('New {0}', [doctype])
  let size = 'xl'
  let actions = [
    {
      label: __('Create'),
      variant: 'solid',
      onClick: () => create(),
    },
  ]

  return { title, size, actions }
})

const tabs = createResource({
  url: 'crm.fcrm.doctype.crm_fields_layout.crm_fields_layout.get_fields_layout',
  cache: ['QuickEntry', props.doctype],
  params: { doctype: props.doctype, type: 'Quick Entry' },
  auto: true,
})

watch(
  [tabs, doctypeMeta],
  () => {
    if (!tabs.data || !doctypeMeta.value) return

    if (doctypeMeta.value?.autoname?.toLowerCase() === 'prompt') {
      let hasNewNameField = tabs.data.some((tab) =>
        tab.sections.some((section) =>
          section.columns.some((column) =>
            column.fields.some((field) => field.fieldname === '__newname'),
          ),
        ),
      )

      if (!hasNewNameField) {
        tabs.data[0].sections[0].columns[0].fields.unshift({
          fieldname: '__newname',
          label: __('Name'),
          fieldtype: 'Data',
          reqd: 1,
        })
      }
    }
  },
  { immediate: true, deep: true },
)

async function create() {
  loading.value = true
  error.value = null

  try {
    await triggerOnBeforeCreate?.()
    const doc = await saveRecord(
      page,
      { doctype: props.doctype, ..._data.doc },
      'frappe.client.insert',
    )
    if (!doc) return
    show.value = false
    emit('callback', doc)
    _data.doc = {}
    if (page?.open_after_create) {
      await router.push(getRecordRoute(props.doctype, doc.name))
    }
  } catch (err) {
    error.value = err.messages?.[0] || err.message
  } finally {
    loading.value = false
  }
}

watch(
  doctypeMeta,
  (meta) => {
    if (!meta) return

    let doc = {}

    if (typeof props.data === 'object') {
      Object.assign(doc, props.data)
    } else if (meta.autoname && meta.autoname.indexOf('field:') !== -1) {
      doc[meta.autoname.substr(6)] = props.data
    } else if (meta.autoname && meta.autoname === 'prompt') {
      doc.__newname = props.data
    } else if (meta.title_field) {
      doc[meta.title_field] = props.data
    }

    nextTick(() => Object.assign(_data.doc, doc))
  },
  { immediate: true, deep: true },
)

function openQuickEntryModal() {
  showQuickEntryModal.value = true
  quickEntryProps.value = { doctype: props.doctype }
  nextTick(() => (show.value = false))
}
</script>
