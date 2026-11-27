import { call } from 'frappe-ui'
import { createDialog } from '@/utils/dialogs'

export async function saveRecord(page, doc, fallback) {
  if (!page?.save_method) return call(fallback, { doc })

  const params = { doc: JSON.parse(JSON.stringify(doc)) }
  let result = await call(page.save_method, params)
  while (result.confirmation) {
    const { title, message, action, token } = result.confirmation
    const accepted = await new Promise((resolve) => {
      createDialog({
        title,
        message,
        onClose: () => resolve(false),
        actions: [
          { label: __('Cancel'), onClick: (close) => close() },
          {
            label: action,
            variant: 'solid',
            onClick: (close) => {
              resolve(true)
              close()
            },
          },
        ],
      })
    })
    if (!accepted) return null
    result = await call(page.save_method, { ...params, confirmed: token })
  }
  return result.document
}
