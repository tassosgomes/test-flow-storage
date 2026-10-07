"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label = "Copiar",
  copiedLabel = "Copiado",
  className = "btn btn-secondary",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
