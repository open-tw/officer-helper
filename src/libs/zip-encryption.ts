export type ZipEncryption = {
  method: 'zipcrypto' | 'aes256'
  enabled: boolean
  showPassword: boolean
  password: string
  confirmation: string
}

export function encryptionError(settings: ZipEncryption): string | null {
  if (!settings.enabled) return null
  if (!settings.password) return '請輸入加密密碼。'
  if (!settings.showPassword) {
    if (!settings.confirmation) return '請再次輸入密碼。'
    if (settings.password !== settings.confirmation)
      return '兩次輸入的密碼不一致。'
  }
  return null
}

export function encryptionOptions(settings: ZipEncryption) {
  const error = encryptionError(settings)
  if (error) throw new Error(error)
  if (!settings.enabled) return {}
  return settings.method === 'zipcrypto'
    ? { password: settings.password, zipCrypto: true }
    : {
        password: settings.password,
        zipCrypto: false,
        encryptionStrength: 3 as const,
      }
}
