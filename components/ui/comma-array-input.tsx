"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface CommaArrayInputProps {
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  placeholder?: string;
}

export function CommaArrayInput({ value, onChange, onBlur, placeholder }: CommaArrayInputProps) {
  const [text, setText] = useState(value?.join(", ") || "");
  const focusedRef = useRef(false);

  // Sync from external value changes (form reset, initial load)
  // only when not actively editing
  const externalText = value?.join(", ") || "";
  const prevExternalRef = useRef(externalText);
  if (externalText !== prevExternalRef.current && !focusedRef.current) {
    setText(externalText);
    prevExternalRef.current = externalText;
  }

  return (
    <Input
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focusedRef.current = false;
        const items = text
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== "");
        onChange(items);
        const normalized = items.join(", ");
        setText(normalized);
        prevExternalRef.current = normalized;
        onBlur?.();
      }}
    />
  );
}
