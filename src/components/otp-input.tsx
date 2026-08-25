"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  length?: number;
};

export function OtpInput({
  value,
  onChange,
  disabled = false,
  error = false,
  length = 6,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  const focusAt = useCallback((index: number) => {
    const el = inputsRef.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  useEffect(() => {
    if (!disabled && value.length === 0) focusAt(0);
  }, [disabled, focusAt, value.length]);

  const setDigit = (index: number, char: string) => {
    const next = digits.map((d, i) => (i === index ? char : d === " " ? "" : d));
    const joined = next.join("").replace(/\s/g, "").slice(0, length);
    onChange(joined.replace(/\D/g, ""));
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index] && digits[index] !== " ") {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        focusAt(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusAt(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="flex gap-2" role="group" aria-label="One-time passcode">
      {Array.from({ length }).map((_, index) => {
        const char = digits[index] === " " ? "" : digits[index];
        return (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={error || undefined}
            value={char}
            onPaste={onPaste}
            onKeyDown={(e) => onKeyDown(index, e)}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              if (!raw) {
                setDigit(index, "");
                return;
              }
              const digit = raw.slice(-1);
              setDigit(index, digit);
              if (index < length - 1) focusAt(index + 1);
            }}
            className={`h-12 w-10 rounded-xl border bg-white text-center text-lg font-semibold text-slate-800 outline-none transition focus:ring-2 disabled:opacity-50 sm:w-11 ${
              error
                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-400/20"
                : "border-slate-200 focus:border-brand-400 focus:ring-brand-400/20"
            }`}
          />
        );
      })}
    </div>
  );
}
