<template>
  <LayoutHeader>
    <template #left-header>
      <ViewBreadcrumbs v-model="viewControls" :routeName="page.label" />
    </template>
    <template #right-header>
      <CustomActions
        v-if="recordListView?.customListActions"
        :actions="recordListView.customListActions"
      />
      <Button
        v-if="!list.error"
        variant="solid"
        :label="__('Create')"
        iconLeft="lucide-plus"
        @click="openCreate"
      />
    </template>
  </LayoutHeader>
  <ViewControls
    v-show="!list.error"
    ref="viewControls"
    v-model="list"
    v-model:loadMore="loadMore"
    v-model:resizeColumn="triggerResize"
    v-model:updatedPageCount="updatedPageCount"
    :doctype="page.doctype"
  />
  <ErrorPage
    v-if="list.error"
    :errorTitle="__(list.error.exc_type === 'PermissionError' ? 'Not Permitted' : 'Error Occurred')"
    :errorMessage="list.error.messages?.[0] || __('An Error Occurred')"
  />
  <RecordListView
    v-else-if="list.data && rows.length"
    ref="recordListView"
    v-model="list.data.page_length_count"
    v-model:list="list"
    :doctype="page.doctype"
    :rows="rows"
    :columns="list.data.columns"
    :options="{
      selectable: true,
      showTooltip: false,
      resizeColumn: true,
      rowCount: list.data.row_count,
      totalCount: list.data.total_count,
    }"
    @loadMore="loadMore++"
    @columnWidthUpdated="triggerResize++"
    @updatePageCount="(count) => (updatedPageCount = count)"
    @applyFilter="(data) => viewControls.applyFilter(data)"
    @applyLikeFilter="(data) => viewControls.applyLikeFilter(data)"
    @likeDoc="(data) => viewControls.likeDoc(data)"
    @selectionsChanged="(selections) => viewControls.updateSelections(selections)"
  />
  <EmptyState
    v-else-if="list.data"
    :name="page.label"
    :title="__('No records found')"
    :description="
      Object.keys(list.params?.filters || {}).length
        ? __('Clear the filters to see all records.')
        : __('Use Create to add a record.')
    "
    @create="openCreate"
  />
  <div v-else class="flex flex-1 items-center justify-center gap-3" role="status">
    <LoadingIndicator class="h-6 w-6" />
    {{ __('Loading...') }}
  </div>
</template>

<script setup>
import CustomActions from '@/components/CustomActions.vue'
import ErrorPage from '@/components/ErrorPage.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import LayoutHeader from '@/components/LayoutHeader.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import ViewBreadcrumbs from '@/components/ViewBreadcrumbs.vue'
import ViewControls from '@/components/ViewControls.vue'
import { createDocument } from '@/composables/document'
import { useDocument } from '@/data/document'
import { timestampCell } from '@/composables/useTimelinePreferences'
import { getMeta } from '@/stores/meta'
import { usersStore } from '@/stores/users'
import { formatDate } from '@/utils'
import { computed, ref } from 'vue'
import RecordListView from './RecordListView.vue'

const props = defineProps({ page: { type: Object, required: true } })
const { getFormattedPercent, getFormattedFloat, getFormattedCurrency } =
  getMeta(props.page.doctype)
const { getUser } = usersStore()

const recordListView = ref(null)
const viewControls = ref(null)
const list = ref({})
const loadMore = ref(1)
const triggerResize = ref(1)
const updatedPageCount = ref(20)

const rows = computed(() => {
  const data = list.value.data
  if (!data) return []

  return data.data.map((doc) => {
    const row = { ...doc }
    for (const column of data.columns) {
      row[column.key] = formatCell(doc, column)
    }
    return row
  })
})

function formatCell(doc, { key, type, options }) {
  const value = doc[key]
  if (value == null || value === '') return value
  if (key === 'modified' || key === 'creation') return timestampCell(value)
  if (type === 'Date' || type === 'Datetime') {
    return formatDate(value, '', true, type === 'Datetime')
  }
  if (type === 'Link' && options === 'User') return getUser(value).full_name
  if (type === 'Currency') return getFormattedCurrency(key, doc)
  if (type === 'Float') return getFormattedFloat(key, doc)
  if (type === 'Percent') return getFormattedPercent(key, doc)
  return value
}

function openCreate() {
  const doctype = props.page.doctype
  useDocument(doctype).document.fieldPropertyOverrides = {}
  createDocument(doctype, {}, null, () => list.value.reload())
}
</script>
