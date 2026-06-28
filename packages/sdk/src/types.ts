/** Shared types used across SDK clients */

export interface AccountInfo {
  publicKey: string
  balance: number
  sequence: bigint
}

export interface UnsignedTxParams {
  sourcePublicKey: string
  destinationPublicKey: string
  amount: string
  memo: string
  sequence: string
}

export interface BroadcastResult {
  txHash: string
  txId: string
}

export interface TxStatus {
  status: 'pending' | 'confirmed' | 'failed'
  resultCode?: string
}

export interface WorkerRegistration {
  workerId: string
  contractId: string
}

export interface ReputationSync {
  workerId: string
  avgRating: number
  reviewCount: number
  reputation: number
}

export interface SdkConfig {
  horizonUrl: string
  registryContractId?: string
  marketContractId?: string
  network: 'testnet' | 'mainnet'
}
