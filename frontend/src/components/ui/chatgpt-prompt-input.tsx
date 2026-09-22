import * as React from "react";

export const PromptBox = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, onChange, placeholder, ...props }, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = React.useState("");

  React.useImperativeHandle(ref, () => internalRef.current!);

  React.useLayoutEffect(() => {
    const ta = internalRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onChange?.(e);
  };

  const hasValue = value.trim().length > 0;

  return (
    <div className="prompt-box">
      <textarea
        ref={internalRef}
        rows={1}
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? "Ask about doctors, appointments or channelling policy…"}
        className="prompt-textarea"
        {...props}
      />
      <div className="prompt-actions">
        <button
          type="submit"
          disabled={!hasValue}
          aria-label="Send message"
          className={`send-btn${hasValue ? " active" : ""}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

PromptBox.displayName = "PromptBox";
