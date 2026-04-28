import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateFee,
  getFeeBps,
  updateFeeBps,
  tip,
  createEscrow,
} from '../services/payment.service.js'

// Reset fee between tests by using a fresh module state
// (payment.service uses module-level state)

describe('calculateFee', () => {
  it('returns 0 when fee_bps is 0', () => {
    expect(calculateFee(1_000_000, 0)).toBe(0)
  })

  it('calculates 2.5% fee correctly', () => {
    expect(calculateFee(10_000_000, 250)).toBe(250_000)
  })

  it('calculates 5% fee correctly', () => {
    expect(calculateFee(10_000_000, 500)).toBe(500_000)
  })

  it('floors fractional stroops', () => {
    expect(calculateFee(1, 250)).toBe(0) // 0.025 → floor → 0
  })

  it('throws for negative fee_bps', () => {
    expect(() => calculateFee(1_000, -1)).toThrow('fee_bps must be between 0 and 10000')
  })

  it('throws for fee_bps > 10000', () => {
    expect(() => calculateFee(1_000, 10_001)).toThrow('fee_bps must be between 0 and 10000')
  })

  it('allows fee_bps = 10000 (100%)', () => {
    expect(calculateFee(1_000, 10_000)).toBe(1_000)
  })
})

describe('getFeeBps / updateFeeBps', () => {
  it('returns default fee of 250 bps', () => {
    // Reset to default first
    updateFeeBps('admin', 250)
    expect(getFeeBps()).toBe(250)
  })

  it('admin can update fee', () => {
    updateFeeBps('admin', 100)
    expect(getFeeBps()).toBe(100)
    updateFeeBps('admin', 250) // restore
  })

  it('throws when non-admin tries to update fee', () => {
    expect(() => updateFeeBps('user', 100)).toThrow('Only admins can update the fee')
    expect(() => updateFeeBps('curator', 100)).toThrow('Only admins can update the fee')
  })

  it('throws for invalid fee_bps in update', () => {
    expect(() => updateFeeBps('admin', -1)).toThrow('fee_bps must be between 0 and 10000')
    expect(() => updateFeeBps('admin', 10_001)).toThrow('fee_bps must be between 0 and 10000')
  })

  it('allows fee_bps = 0 (no fee)', () => {
    updateFeeBps('admin', 0)
    expect(getFeeBps()).toBe(0)
    updateFeeBps('admin', 250) // restore
  })
})

describe('tip', () => {
  beforeEach(() => {
    updateFeeBps('admin', 250) // ensure consistent fee
  })

  it('calculates tip with fee correctly', () => {
    const result = tip({ from: 'ALICE', to: 'BOB', amount: 10_000_000 })
    expect(result.from).toBe('ALICE')
    expect(result.to).toBe('BOB')
    expect(result.grossAmount).toBe(10_000_000)
    expect(result.fee).toBe(250_000)
    expect(result.netAmount).toBe(9_750_000)
  })

  it('throws for zero amount', () => {
    expect(() => tip({ from: 'A', to: 'B', amount: 0 })).toThrow('Tip amount must be greater than 0')
  })

  it('throws for negative amount', () => {
    expect(() => tip({ from: 'A', to: 'B', amount: -1 })).toThrow('Tip amount must be greater than 0')
  })

  it('throws when sender equals recipient', () => {
    expect(() => tip({ from: 'ALICE', to: 'ALICE', amount: 100 })).toThrow(
      'Sender and recipient must be different'
    )
  })

  it('netAmount = grossAmount when fee is 0', () => {
    updateFeeBps('admin', 0)
    const result = tip({ from: 'A', to: 'B', amount: 5_000_000 })
    expect(result.fee).toBe(0)
    expect(result.netAmount).toBe(5_000_000)
  })

  it('returns correct structure', () => {
    const result = tip({ from: 'A', to: 'B', amount: 1_000 })
    expect(result).toHaveProperty('from')
    expect(result).toHaveProperty('to')
    expect(result).toHaveProperty('grossAmount')
    expect(result).toHaveProperty('fee')
    expect(result).toHaveProperty('netAmount')
  })
})

describe('createEscrow', () => {
  const futureDate = new Date(Date.now() + 86_400_000) // +1 day

  it('creates escrow with pending status', () => {
    const result = createEscrow({ from: 'A', to: 'B', amount: 1_000, expiryDate: futureDate })
    expect(result.status).toBe('pending')
    expect(result.from).toBe('A')
    expect(result.to).toBe('B')
    expect(result.amount).toBe(1_000)
    expect(result.expiryDate).toBe(futureDate)
  })

  it('throws for past expiry date', () => {
    const past = new Date(Date.now() - 1_000)
    expect(() => createEscrow({ from: 'A', to: 'B', amount: 100, expiryDate: past })).toThrow(
      'Escrow expiry must be in the future'
    )
  })

  it('throws for zero amount', () => {
    expect(() => createEscrow({ from: 'A', to: 'B', amount: 0, expiryDate: futureDate })).toThrow(
      'Escrow amount must be greater than 0'
    )
  })

  it('throws for negative amount', () => {
    expect(() => createEscrow({ from: 'A', to: 'B', amount: -1, expiryDate: futureDate })).toThrow(
      'Escrow amount must be greater than 0'
    )
  })
})
