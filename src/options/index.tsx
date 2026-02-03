import { render } from 'preact'
import App from './App'

const patchInsertBefore = () => {
  if (typeof window === 'undefined') return
  const mark = '__glarityInsertBeforePatched__'
  if ((window as any)[mark]) return
  ;(window as any)[mark] = true
  const original = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode: Node, referenceNode: Node | null) {
    try {
      return original.call(this, newNode, referenceNode)
    } catch (error) {
      const isHierarchyError =
        error instanceof DOMException && error.name === 'HierarchyRequestError'
      if (!isHierarchyError) throw error

      const parent =
        this.nodeType === Node.DOCUMENT_NODE
          ? (this as Document).body ||
            (this as Document).head ||
            (this as Document).documentElement
          : this.parentNode

      if (parent && parent !== this) {
        try {
          return original.call(
            parent,
            newNode,
            referenceNode && referenceNode.parentNode === parent ? referenceNode : null,
          )
        } catch {
          // fall through to document-level fallback
        }
      }

      const owner =
        this.nodeType === Node.DOCUMENT_NODE ? (this as Document) : this.ownerDocument
      const fallback =
        owner?.body || owner?.head || owner?.documentElement || this.parentNode
      if (fallback && fallback !== this) {
        try {
          return original.call(fallback, newNode, null)
        } catch {
          // ignore and rethrow original error below
        }
      }

      throw error
    }
  }
}

patchInsertBefore()
render(<App />, document.getElementById('app')!)
