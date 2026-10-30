import { useState } from "react";
import { Input } from "@/components/ui/input";

interface CommaArrayInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "onBlur"
> {
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  onBlur?: () => void;
}

export function CommaArrayInput({ value, onChange, onBlur, ...props }: CommaArrayInputProps) {
  const [text, setText] = useState(() => value?.join(", ") || "");
  const [focused, setFocused] = useState(false);

  const externalText = value?.join(", ") || "";
  const [prevExternal, setPrevExternal] = useState(externalText);

  if (externalText !== prevExternal && !focused) {
    setPrevExternal(externalText);
    setText(externalText);
  }

  return (
    <Input
      {...props}
      value={text}
      onFocus={() => {
        setFocused(true);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);

        const items = text
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== "");

        onChange(items);
        const normalized = items.join(", ");
        setText(normalized);
        setPrevExternal(normalized);
        onBlur?.();
      }}
    />
  );
}
