import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildWifiPayload } from '../src/libs/qr-wifi.ts'

const network = {
  ssid: 'Office',
  password: 'secret123',
  security: 'WPA' as const,
  hidden: false,
}

test('encodes personal and hidden WEP networks', () => {
  assert.equal(buildWifiPayload(network), 'WIFI:T:WPA;S:Office;P:secret123;;')
  assert.equal(
    buildWifiPayload({ ...network, security: 'WEP', hidden: true }),
    'WIFI:T:WEP;S:Office;P:secret123;H:true;;',
  )
})

test('escapes delimiters and preserves whitespace and Unicode', () => {
  assert.equal(
    buildWifiPayload({
      ...network,
      ssid: ' 辦公室;,:"\\ ',
      password: ' pass;word ',
    }),
    'WIFI:T:WPA;S: 辦公室\\;\\,\\:\\"\\\\ ;P: pass\\;word ;;',
  )
})

test('open networks omit previously entered passwords', () => {
  assert.equal(
    buildWifiPayload({ ...network, security: 'nopass' }),
    'WIFI:T:nopass;S:Office;;',
  )
})

test('requires credentials and checks SSID byte length without truncation', () => {
  assert.equal(buildWifiPayload({ ...network, ssid: '' }), '')
  assert.equal(buildWifiPayload({ ...network, password: '' }), '')
  assert.equal(buildWifiPayload({ ...network, ssid: '中'.repeat(11) }), '')
  assert.ok(buildWifiPayload({ ...network, ssid: 'a'.repeat(32) }))
  assert.equal(buildWifiPayload({ ...network, ssid: 'a'.repeat(33) }), '')
})
