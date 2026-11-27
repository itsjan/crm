import FileTextIcon from '@/components/Icons/FileTextIcon.vue'

const nativePages = {
  'CRM Organization': {
    name: 'Organization',
    param: 'organizationId',
    title_field: 'organization_name',
  },
  'CRM Deal': {
    name: 'Deal',
    param: 'dealId',
    title_field: 'title',
    parents: [{ field: 'organization', doctype: 'CRM Organization' }],
  },
}

export function getRegisteredPage(doctype) {
  return (window.pages || []).find((page) => page.doctype === doctype)
}

export function getRecordRoute(doctype, docname) {
  if (getRegisteredPage(doctype)) return { name: doctype, params: { docname } }
  const page = nativePages[doctype]
  if (page) return { name: page.name, params: { [page.param]: docname } }
}

export function getParentPage(doctype) {
  return getRegisteredPage(doctype) || nativePages[doctype]
}

export function registerRecordPages(router) {
  for (const page of window.pages || []) {
    router.addRoute({
      path: '/' + page.route + '/view/:viewType(list)?',
      name: page.label,
      component: () => import('./RecordList.vue'),
      props: { page },
    })
    router.addRoute({
      path: '/' + page.route + '/:docname',
      name: page.doctype,
      component: () => import('./RecordPage.vue'),
      props: (route) => ({ page, docname: route.params.docname }),
    })
  }
}

export function getRegisteredNavigationItems() {
  return (window.pages || [])
    .filter((page) => page.sidebar)
    .map((page) => ({
      label: page.label,
      icon: page.icon || FileTextIcon,
      route: page.label,
      desktopOnly: true,
    }))
}
