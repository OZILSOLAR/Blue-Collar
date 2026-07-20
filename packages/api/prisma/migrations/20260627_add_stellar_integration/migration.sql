-- CreateTable: ContractEvent (Issue #751: On-Chain Event Indexer)
CREATE TABLE "ContractEvent" (
    "id"          TEXT NOT NULL,
    "contractId"  TEXT NOT NULL,
    "eventName"   TEXT NOT NULL,
    "ledger"      BIGINT NOT NULL,
    "txIndex"     INTEGER NOT NULL,
    "eventIndex"  INTEGER NOT NULL,
    "indexed"     JSONB NOT NULL,
    "data"        JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventIndexerCursor (tracks ingestion progress per contract)
CREATE TABLE "EventIndexerCursor" (
    "id"         TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "ledger"     BIGINT NOT NULL DEFAULT 0,
    "txIndex"    INTEGER NOT NULL DEFAULT 0,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventIndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable: StellarAccount (Issue #752: Wallet Integration)
CREATE TABLE "StellarAccount" (
    "id"           TEXT NOT NULL,
    "publicKey"    TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "balance"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sequences"    BIGINT NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StellarAccount_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "ContractEvent_contractId_ledger_txIndex_eventIndex_key"
    ON "ContractEvent"("contractId", "ledger", "txIndex", "eventIndex");

CREATE UNIQUE INDEX "EventIndexerCursor_contractId_key" 
    ON "EventIndexerCursor"("contractId");

CREATE UNIQUE INDEX "StellarAccount_publicKey_key" 
    ON "StellarAccount"("publicKey");

-- Regular indexes for querying
CREATE INDEX "ContractEvent_contractId_idx" ON "ContractEvent"("contractId");
CREATE INDEX "ContractEvent_ledger_idx" ON "ContractEvent"("ledger");
CREATE INDEX "ContractEvent_eventName_idx" ON "ContractEvent"("eventName");
CREATE INDEX "ContractEvent_createdAt_idx" ON "ContractEvent"("createdAt");

CREATE INDEX "StellarAccount_userId_idx" ON "StellarAccount"("userId");

-- FK constraints
ALTER TABLE "StellarAccount" ADD CONSTRAINT "StellarAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
