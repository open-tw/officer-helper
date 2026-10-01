export type WifiSecurity = 'WPA' | 'WEP' | 'nopass'

// ZXing Wi-Fi format: escape delimiters without changing literal whitespace.
function escapeWifi(value: string) {
  return value.replace(/[\\;,:"]/g, '\\$&')
}

export function buildWifiPayload({
  ssid,
  password,
  security,
  hidden,
}: {
  ssid: string
  password: string
  security: WifiSecurity
  hidden: boolean
}) {
  if (!ssid || new TextEncoder().encode(ssid).length > 32) return ''
  if (security !== 'nopass' && !password) return ''
  return `WIFI:T:${security};S:${escapeWifi(ssid)};${security === 'nopass' ? '' : `P:${escapeWifi(password)};`}${hidden ? 'H:true;' : ''};`
}
