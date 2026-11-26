// Tabs of linked records.
//
// An installed app registers a tab in its hooks.py:
//
//   crm_linked_tabs = [{
//       "parent_doctype": "CRM Deal",   # the page that gets the tab
//       "doctype": "FUND Case",         # the records listed
//       "link_field": "deal",           # their field that names the page's record
//       "label": "Funding Cases",       # tab name
//       "add_label": "Add Funding Case",  # optional, text of the button
//       "columns": ["title", "status"],
//   }]
//
// `get_boot` (crm/www/crm.py) passes the hook to the page as `window.linked_tabs`.
import FileTextIcon from '@/components/Icons/FileTextIcon.vue'
import { createDocument } from '@/composables/document'
import { createListResource } from 'frappe-ui'
import { computed } from 'vue'

const slug = (doctype) => doctype.toLowerCase().replace(/ /g, '-')

export function linkedTabs(parentDoctype, docname) {
  return (window.linked_tabs || [])
    .filter((t) => t.parent_doctype === parentDoctype)
    .map((t) => {
      const list = createListResource({
        type: 'list',
        doctype: t.doctype,
        cache: ['linkedTab', t.doctype, docname],
        fields: ['name', ...t.columns],
        filters: { [t.link_field]: docname },
        orderBy: 'creation desc',
        // the count on the tab is the number of rows fetched
        pageLength: 100,
        auto: true,
      })
      return {
        name: t.label,
        // the value is the address hash and the remembered last tab: no space or slash
        value: slug(t.doctype),
        label: __(t.label),
        iconLeft: FileTextIcon,
        count: computed(() => list.data?.length ?? 0),
        linked: {
          ...t,
          list,
          deskRoute: `/desk/${slug(t.doctype)}`,
          // opens the CRM's creation dialog with the page's record filled in
          add: () =>
            createDocument(t.doctype, { [t.link_field]: docname }, null, () =>
              list.reload(),
            ),
        },
      }
    })
}
