"use client";

import { useEffect, useId, useRef, useState } from "react";

const DEFAULT_PREVIEW_LINES = 5;

export function ExpandableText({
  text,
  previewLines = DEFAULT_PREVIEW_LINES,
}: {
  text: string;
  previewLines?: number;
}) {
  const contentRef = useRef<HTMLParagraphElement | null>(null);
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const checkOverflow = () => {
      const computedStyle = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(computedStyle.fontSize) || 16;
      const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
      const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.5;
      const collapsedHeight = lineHeight * previewLines;
      setIsOverflowing(element.scrollHeight > collapsedHeight + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", checkOverflow);
      return () => window.removeEventListener("resize", checkOverflow);
    }

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewLines, text]);

  return (
    <div className="space-y-1">
      <p
        id={contentId}
        ref={contentRef}
        className="whitespace-pre-wrap break-words"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: previewLines,
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {isOverflowing ? (
        <button
          type="button"
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="text-xs font-semibold text-[var(--color-primary)] hover:text-blue-600 cursor-pointer"
        >
          {expanded ? "Show less" : "Show more..."}
        </button>
      ) : null}
    </div>
  );
}
