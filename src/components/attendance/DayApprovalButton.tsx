"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  dayId: string;
  isApproved: boolean;
}

export function DayApprovalButton({ dayId, isApproved: initialApproved }: Props) {
  const router = useRouter();
  const [isApproved, setIsApproved] = useState(initialApproved);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/attendance/days/${dayId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isApproved: !isApproved }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Hata oluştu");
        }

        setIsApproved((prev) => !prev);
        router.refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Hata");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
          isApproved
            ? "bg-yellow-900/30 text-yellow-300 border-yellow-800 hover:bg-yellow-900/50"
            : "bg-emerald-900/30 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50"
        }`}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isApproved ? (
          <><XCircle className="w-4 h-4" /> Onayı Geri Al</>
        ) : (
          <><CheckCircle className="w-4 h-4" /> Günü Onayla</>
        )}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
