"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function DeleteShiftButton({ shiftId }: { shiftId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Bu vardiyayı silmek istediğinizden emin misiniz?")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/shifts/${shiftId}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error ?? "Vardiya silinemedi");
          return;
        }
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Vardiya silinemedi");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors inline-flex items-center gap-1"
    >
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sil"}
    </button>
  );
}
