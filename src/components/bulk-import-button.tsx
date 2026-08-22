"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { useAuth } from "@/lib/auth";

type Props = {
  resource: string;
  title: string;
  description: string;
  label?: string;
  onImported?: () => void | Promise<void>;
};

const canImportRole = (role?: string) =>
  role === "ADMIN" || role === "SUPER_ADMIN" || role === "RECEPTIONIST";

export function BulkImportButton({
  resource,
  title,
  description,
  label = "Import CSV",
  onImported,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!canImportRole(user?.role)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-brand-50 hover:text-brand-700"
      >
        <Upload className="h-4 w-4" />
        {label}
      </button>
      {open && (
        <BulkImportDialog
          resource={resource}
          title={title}
          description={description}
          onClose={() => setOpen(false)}
          onImported={async () => {
            await onImported?.();
          }}
        />
      )}
    </>
  );
}
