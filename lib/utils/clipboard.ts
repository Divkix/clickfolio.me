/**
 * Clipboard utility for copying text to clipboard
 * Provides fallback for browsers without Clipboard API support
 */

/**
 * Copies text to clipboard with fallback support
 * @param text The text to copy to clipboard
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern clipboard API (preferred)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // Fallback for browsers without Clipboard API
    // Create a temporary textarea element
    const textArea = document.createElement('textarea')
    textArea.value = text

    // Make it invisible but still selectable
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '-9999px'
    textArea.style.opacity = '0'

    document.body.appendChild(textArea)

    try {
      // Select and copy the text
      textArea.focus()
      textArea.select()

      // Try to copy using the older execCommand API
      const successful = document.execCommand('copy')

      return successful
    } finally {
      // Clean up the temporary element
      document.body.removeChild(textArea)
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}