<template>
  <div class="flex h-full flex-col overflow-y-auto">
    <!-- the Deal page has the name and the button in the tab; on the Organization
         page the button is in the page header -->
    <div
      v-if="header"
      class="mx-3 my-3 flex items-center justify-between text-lg-medium sm:mx-10 sm:mb-4 sm:mt-8"
    >
      <div class="flex h-8 items-center text-2xl-semibold text-ink-gray-8">
        {{ tab.label }}
      </div>
      <Button
        variant="solid"
        :label="__(linked.add_label || 'Add')"
        iconLeft="lucide-plus"
        @click="linked.add"
      />
    </div>
    <div
      v-if="linked.list.loading && !linked.list.data"
      role="status"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-2xl-medium text-ink-gray-4"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
    </div>
    <ErrorPage
      v-else-if="linked.list.error && !linked.list.data"
      :errorTitle="__(linked.list.error.exc_type === 'PermissionError' ? 'Not Permitted' : 'Error Occurred')"
      :errorMessage="linked.list.error.messages?.[0] || __('An Error Occurred')"
    />
    <ListView
      v-else-if="rows.length"
      :class="header ? 'mx-3 sm:mx-10' : 'mx-3 mt-4 sm:mx-5'"
      :columns="columns"
      :rows="rows"
      row-key="name"
      :options="listOptions"
    />
    <EmptyState
      v-else
      :name="tab.name"
      :icon="tab.iconLeft"
      :title="linked.empty_title ? __(linked.empty_title) : ''"
      :description="linked.empty_description ? __(linked.empty_description) : ''"
      top="30%"
    />
  </div>
</template>

<script setup>
import ErrorPage from '@/components/ErrorPage.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import { getMeta } from '@/stores/meta'
import { getRecordRoute, getRegisteredPage } from './pages'
import { usersStore } from '@/stores/users'
import { formatDate } from '@/utils'
import { ListView } from 'frappe-ui/experimental'
import { computed } from 'vue'

const props = defineProps({
  tab: { type: Object, required: true },
  header: { type: Boolean, default: true },
})

const linked = props.tab.linked
const { doctypeMeta } = getMeta(linked.doctype)
const { getUser } = usersStore()

const fields = computed(() =>
  linked.columns.map(
    (fieldname) =>
      doctypeMeta.value?.fields.find((f) => f.fieldname === fieldname) || {
        fieldname,
        label: fieldname,
      },
  ),
)

const columns = computed(() =>
  fields.value.map((df, i) => ({
    key: df.fieldname,
    label: __(df.label),
    width: i === 0 ? '16rem' : '10rem',
  })),
)

function display(df, value) {
  if (!value) return ''
  if (df.fieldtype === 'Link' && df.options === 'User')
    return getUser(value).full_name
  if (df.fieldtype === 'Date') return formatDate(value, '', true)
  if (df.fieldtype === 'Select') return __(value)
  return value
}

const rows = computed(() =>
  (linked.list.data || []).map((doc) => ({
    name: doc.name,
    ...Object.fromEntries(
      fields.value.map((df) => [df.fieldname, display(df, doc[df.fieldname])]),
    ),
  })),
)

const listOptions = {
  selectable: false,
  showTooltip: false,
  ...(getRegisteredPage(linked.doctype)
    ? { getRowRoute: (row) => getRecordRoute(linked.doctype, row.name) }
    : { onRowClick: openDesk }),
}

function openDesk(row) {
  window.open(`${linked.deskRoute}/${encodeURIComponent(row.name)}`, '_blank', 'noopener')
}
</script>
