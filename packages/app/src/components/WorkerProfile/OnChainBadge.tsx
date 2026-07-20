"use client";

import { ExternalLink } from "lucide-react";

interface OnChainBadgeProps {
  contractId: string | null | undefined;
  workerId: string;
}

export default function OnChainBadge({ contractId }: OnChainBadgeProps) {
  if (!contractId) return null;

  return (
    <a
      href={`https://stellar.expert/explorer/testnet/contract/${contractId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 hover:bg-green-200 transition-colors"
    >
      <ExternalLink size={11} aria-hidden="true" />
      On-chain
    </a>
  );
}
