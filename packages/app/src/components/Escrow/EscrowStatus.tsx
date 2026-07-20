"use client";

import { Clock, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";

export interface Escrow {
  id: string;
  amount: string;
  token: string;
  counterparty: string;
  terms: string;
  status: "pending" | "funded" | "released" | "disputed" | "cancelled";
  createdAt: string;
  expiresAt?: string | null;
  txHash?: string | null;
}

interface EscrowStatusProps {
  escrow: Escrow;
  onRelease: () => void;
  onDispute: () => void;
  isLoading?: boolean;
}

const STATUS_STEPS = ["pending", "funded", "released"] as const;

const STATUS_META: Record<Escrow["status"], { label: string; color: string; Icon: React.ElementType }> = {
  pending:   { label: "Pending",   color: "text-yellow-500", Icon: Clock },
  funded:    { label: "Funded",    color: "text-blue-500",   Icon: CheckCircle2 },
  released:  { label: "Released",  color: "text-green-600",  Icon: CheckCircle2 },
  disputed:  { label: "Disputed",  color: "text-orange-500", Icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-gray-400",   Icon: XCircle },
};

export default function EscrowStatus({ escrow, onRelease, onDispute, isLoading }: EscrowStatusProps) {
  const { label, color, Icon } = STATUS_META[escrow.status];

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono text-gray-500 truncate max-w-[160px]">{escrow.id}</span>
        <span className={`flex items-center gap-1 text-sm font-medium ${color}`}>
          <Icon size={14} />
          {label}
        </span>
      </div>

      <div className="text-lg font-semibold">{escrow.amount} {escrow.token}</div>

      <div className="text-sm text-gray-600">
        <span className="font-medium">To: </span>
        <span className="font-mono break-all">{escrow.counterparty}</span>
      </div>

      <p className="text-sm text-gray-600 line-clamp-2">{escrow.terms}</p>

      {/* Timeline */}
      {!["disputed", "cancelled"].includes(escrow.status) && (
        <ol className="flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const { Icon: StepIcon, color: stepColor } = STATUS_META[step];
            const active = STATUS_STEPS.indexOf(escrow.status as typeof STATUS_STEPS[number]) >= i;
            return (
              <li key={step} className="flex items-center">
                <StepIcon size={16} className={active ? stepColor : "text-gray-300"} />
                <span className={`text-xs mx-1 ${active ? "text-gray-700" : "text-gray-300"}`}>{STATUS_META[step].label}</span>
                {i < STATUS_STEPS.length - 1 && <span className="w-6 h-px bg-gray-200 mx-1" />}
              </li>
            );
          })}
        </ol>
      )}

      {/* Expiry */}
      {escrow.expiresAt && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={12} />
          Expires {new Date(escrow.expiresAt).toLocaleString()}
        </p>
      )}

      {/* Explorer link */}
      {escrow.txHash && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${escrow.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          View on Explorer ↗
        </a>
      )}

      {/* Actions */}
      {escrow.status === "funded" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={onRelease}
            disabled={isLoading}
            className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Release
          </button>
          <button
            onClick={onDispute}
            disabled={isLoading}
            className="flex-1 rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Dispute
          </button>
        </div>
      )}
    </div>
  );
}
