"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ModelUsage } from "./profile-types";

export function ModelSplit({ models, latestModel }: {
  models: ReadonlyArray<ModelUsage>;
  latestModel?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const shownModel = latestModel ?? models[0]?.modelId;
  const total = models.reduce((sum, model) => sum + model.tokens, 0);

  function cancelClose() { clearTimeout(closeTimer.current); }
  function show() { cancelClose(); setOpen(true); }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => {
    if (!open || !trigger.current || !tooltip.current) return;
    const panel = tooltip.current;
    const button = trigger.current;
    // The native top layer escapes both tables' horizontal overflow clipping.
    panel.showPopover();
    const position = () => {
      const anchor = button.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      panel.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - bounds.width - 8))}px`;
      const below = anchor.bottom + 6;
      panel.style.top = `${Math.max(8, below + bounds.height <= window.innerHeight - 8 ? below : anchor.top - bounds.height - 6)}px`;
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) setOpen(false);
    };
    position();
    const dismiss = () => setOpen(false);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.contains(event.target) && !trigger.current?.contains(event.target)) dismiss();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      panel.hidePopover();
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open]);

  if (!shownModel) return <span className="text-white/35">No model used</span>;
  return <span className="block min-w-0" onMouseLeave={scheduleClose}>
    <button ref={trigger} type="button" onMouseEnter={show} onFocus={show} onBlur={() => setOpen(false)} onClick={show}
      aria-describedby={open ? id : undefined}
      aria-label={`${prettyModel(shownModel)}${models.length > 1 ? ` and ${models.length - 1} other models` : ""}, token split`}
      className="flex max-w-full cursor-help items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-left text-xs text-white/55 hover:text-white/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8eb7ff]">
      <span className="truncate">{prettyModel(shownModel)}</span>
      {models.length > 1 && <span className="shrink-0 text-[10px] text-white/40">+{models.length - 1}</span>}
    </button>
    <span ref={tooltip} id={id} role="tooltip" popover="manual" onMouseEnter={cancelClose}
      style={{ position: "fixed", inset: "auto", margin: 0, width: 288, maxWidth: "calc(100vw - 16px)", maxHeight: "min(320px, calc(100vh - 16px))", overflowY: "auto" }}
      className="rounded-xl border border-white/15 bg-[#191d1d] p-4 text-xs text-[#f2f1eb] shadow-xl">
      <span className="mb-3 block font-medium">Token split</span>
      {total === 0 && <span className="mb-3 block text-white/55">No token usage reported.</span>}
      {models.map((model) => <span key={model.modelId} className="mt-2 flex items-baseline justify-between gap-4">
        <span className="min-w-0 break-words text-white/75">{prettyModel(model.modelId)}{model.modelId === latestModel && <span className="ml-1.5 text-[10px] text-[#8eb7ff]"> latest</span>}</span>
        <span className="shrink-0 font-mono tabular-nums text-white/65">{total ? `${(model.tokens / total * 100).toFixed(1)}%` : "—"}</span>
      </span>)}
    </span>
  </span>;
}

export function prettyModel(value: string) {
  return value === "unknown" ? "Unknown model" : value.replace(/[-_]/g, " ").replace(/\b(?:gpt|glm|ai)\b/gi, (m) => m.toUpperCase()).replace(/\b\w/g, (m) => m.toUpperCase());
}
