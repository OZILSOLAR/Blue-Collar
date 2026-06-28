"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageSquare } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  currentUserId: string;
}

export function MessagesPreview({ conversations, currentUserId }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="py-10 text-center">
        <MessageSquare size={32} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-400">No messages yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {conversations.slice(0, 5).map((conv) => {
        const other = conv.participants.find((p) => p.userId !== currentUserId);
        const lastMsg = conv.messages?.[conv.messages.length - 1];
        const isUnread = (conv.unreadCount ?? 0) > 0;

        return (
          <li key={conv.id}>
            <Link
              href={`/messages?id=${conv.id}`}
              className="flex items-center gap-3 px-1 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              {other?.user.avatar ? (
                <Image
                  src={other.user.avatar}
                  alt={`${other.user.firstName} ${other.user.lastName}`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-sm font-bold">
                  {other?.user.firstName?.[0] ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm truncate", isUnread ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300")}>
                  {other ? `${other.user.firstName} ${other.user.lastName}` : conv.subject ?? "Conversation"}
                </p>
                {lastMsg && (
                  <p className="truncate text-xs text-gray-400">{lastMsg.body}</p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {lastMsg && (
                  <time className="text-[10px] text-gray-400">{formatDate(lastMsg.createdAt)}</time>
                )}
                {isUnread && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
