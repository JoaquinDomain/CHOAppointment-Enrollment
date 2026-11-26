/**
 * Shared DOM helpers for revealing the first invalid field in a form.
 *
 * The helpers deliberately work from the rendered DOM instead of a list of
 * refs: validation messages are rendered by React, so the next paint is the
 * earliest reliable moment to know which control is invalid. Controls opt in
 * with `aria-invalid="true"`, which also gives assistive technology the same
 * information.
 */

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]), select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'

export interface FieldRevealOptions {
  /** Sticky/fixed element that must not cover the field. Defaults to `<header>`. */
  headerSelector?: string
  /** Breathing room between the header and the field, in pixels. */
  margin?: number
  /** Use instant scrolling (used when the on-screen keyboard resizes the viewport). */
  instant?: boolean
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function isFocusableField(element: HTMLElement | null): boolean {
  if (!element) return false
  if (element.hasAttribute('disabled')) return false
  if (element.closest('[inert]')) return false
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false

  return typeof element.focus === 'function'
}

function resolveFocusTarget(element: HTMLElement): HTMLElement | null {
  // A radio group may be marked invalid on its fieldset/group container.
  if (
    element instanceof HTMLFieldSetElement ||
    element.getAttribute('role') === 'radiogroup'
  ) {
    const radios = Array.from(
      element.querySelectorAll<HTMLInputElement>('input[type="radio"]:not([disabled])')
    )
    return radios.find(radio => radio.checked) ?? radios[0] ?? null
  }

  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const form = element.form
    const group = form
      ? Array.from(
          form.querySelectorAll<HTMLInputElement>(
            `input[type="radio"][name="${element.name}"]:not([disabled])`
          )
        )
      : []
    return group.find(radio => radio.checked) ?? group[0] ?? null
  }

  if (isFocusableField(element)) return element

  const descendant = element.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
  return descendant && isFocusableField(descendant) ? descendant : null
}

/**
 * Returns the first invalid control in rendered order. Elements that cannot
 * receive focus (hidden, disabled, inert) are skipped so focus never lands on
 * something the patient cannot use.
 */
export function findFirstInvalidField(root: ParentNode): HTMLElement | null {
  const invalid = Array.from(root.querySelectorAll<HTMLElement>('[aria-invalid="true"]'))

  for (const element of invalid) {
    const target = resolveFocusTarget(element)
    if (target) return target
  }

  return null
}

function stickyHeaderOffset(headerSelector: string): number {
  const header = document.querySelector<HTMLElement>(headerSelector)
  if (!header) return 0

  const position = window.getComputedStyle(header).position
  if (position !== 'sticky' && position !== 'fixed') return 0

  return header.getBoundingClientRect().height
}

/**
 * Scrolls the field into the part of the viewport that is actually visible,
 * leaving room for a sticky header and for the on-screen keyboard. When the
 * field is already fully visible it does nothing, which prevents scroll jumps
 * while the patient is correcting fields.
 */
export function scrollFieldIntoView(
  field: HTMLElement,
  options: FieldRevealOptions = {}
): void {
  const { headerSelector = 'header', margin = 16 } = options

  const viewport = window.visualViewport
  const viewTop = viewport?.offsetTop ?? 0
  const viewHeight = viewport?.height ?? window.innerHeight
  const headerOffset = stickyHeaderOffset(headerSelector)

  const rect = field.getBoundingClientRect()
  const topBoundary = viewTop + headerOffset + margin
  const bottomBoundary = viewTop + viewHeight - margin

  if (rect.top >= topBoundary && rect.bottom <= bottomBoundary) return

  const usableHeight = Math.max(0, viewHeight - headerOffset - margin * 2)
  const centering = Math.max(0, (usableHeight - rect.height) / 2)
  const target =
    window.scrollY + rect.top - viewTop - headerOffset - margin - centering

  const behavior = options.instant || prefersReducedMotion() ? 'auto' : 'smooth'
  const top = Math.max(0, target)

  try {
    window.scrollTo({ top, behavior })
  } catch {
    // Very old browsers do not accept the options object.
    window.scrollTo(0, top)
  }
}

function keepVisibleWhileKeyboardChanges(
  field: HTMLElement,
  options: FieldRevealOptions
): void {
  const viewport = window.visualViewport
  if (!viewport) return

  const onResize = () => {
    if (document.activeElement === field) {
      scrollFieldIntoView(field, { ...options, instant: true })
    }
  }

  // The keyboard animates through several viewport sizes. Keep correcting
  // instantly until the field loses focus; instant scrolling avoids a queue of
  // competing smooth animations.
  viewport.addEventListener('resize', onResize)
  field.addEventListener('blur', () => viewport.removeEventListener('resize', onResize), {
    once: true,
  })
}

/**
 * Scrolls to and focuses the first invalid control. Returns the focused
 * element, or null when the form has no visible invalid control.
 */
export function focusFirstInvalidField(
  root: ParentNode,
  options: FieldRevealOptions = {}
): HTMLElement | null {
  const field = findFirstInvalidField(root)
  if (!field) return null

  scrollFieldIntoView(field, options)

  try {
    field.focus({ preventScroll: true })
  } catch {
    field.focus()
  }

  keepVisibleWhileKeyboardChanges(field, options)

  return field
}
