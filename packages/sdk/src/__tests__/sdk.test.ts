import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HorizonClient, SdkError } from '../horizon.client.js'
import { createSdk } from '../index.js'

const TESTNET_URL = 'https://horizon-testnet.stellar.org'

describe('HorizonClient', () => {
  let client: HorizonClient

  beforeEach(() => {
    client = new HorizonClient({ horizonUrl: TESTNET_URL })
    vi.restoreAllMocks()
  })

  it('getAccountInfo parses balance and sequence', async () => {
    const mockData = {
      balances: [{ balance: '100.0000000', asset_type: 'native' }],
      sequence: '1234567',
    }
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const info = await client.getAccountInfo('GDUMMY')
    expect(info.balance).toBe(100)
    expect(info.sequence).toBe(BigInt(1234567))
  })

  it('getAccountInfo throws SdkError on 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 404 }))
    await expect(client.getAccountInfo('GDUMMY')).rejects.toThrow(SdkError)
  })

  it('broadcastTransaction returns txHash on success', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ hash: 'abc123', id: 'id456' }), { status: 200 }),
    )
    const result = await client.broadcastTransaction('SIGNED_XDR')
    expect(result.txHash).toBe('abc123')
  })

  it('getTransactionStatus returns pending on 404', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 404 }))
    const status = await client.getTransactionStatus('HASH')
    expect(status.status).toBe('pending')
  })

  it('getTransactionStatus returns confirmed for successful tx', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ successful: true, result_code: 'OK' }), { status: 200 }),
    )
    const status = await client.getTransactionStatus('HASH')
    expect(status.status).toBe('confirmed')
  })
})

describe('createSdk', () => {
  it('returns horizon client with correct URL on testnet', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.horizon).toBeInstanceOf(HorizonClient)
    expect(sdk.config.horizonUrl).toBe(TESTNET_URL)
  })

  it('registry is null when no contractId provided', () => {
    const sdk = createSdk({ network: 'testnet' })
    expect(sdk.registry).toBeNull()
  })

  it('registry is instantiated when contractId is provided', () => {
    const sdk = createSdk({ network: 'testnet', registryContractId: 'CONTRACT_ABC' })
    expect(sdk.registry).not.toBeNull()
  })
})
