export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPE = 'application/pdf'

export function validatePDF(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size must be less than 10MB' }
  }
  if (file.type !== ALLOWED_FILE_TYPE) {
    return { valid: false, error: 'Only PDF files are allowed' }
  }
  return { valid: true }
}

export function generateTempKey(filename: string): string {
  const uuid = crypto.randomUUID()
  return `temp/${uuid}/${filename}`
}
