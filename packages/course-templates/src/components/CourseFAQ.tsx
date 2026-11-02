"use client";

import { useState } from "react";
import { HelpCircle, Minus, Plus } from "lucide-react";
import type { CourseFAQData } from "@open-mtlms/shared";
import { cn } from "../lib/utils";

interface CourseFAQProps {
  faqs: CourseFAQData[];
  className?: string;
  variant?: "card" | "accordion";
  title?: string;
}

export function CourseFAQ({
  faqs,
  className,
  variant = "card",
  title = "Frequently Asked Questions",
}: CourseFAQProps) {
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  const toggleFAQ = (id: string) => {
    setExpandedFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (faqs.length === 0) {
    return null;
  }

  if (variant === "accordion") {
    return (
      <div className={cn("space-y-3", className)}>
        {faqs.map((faq) => (
          <div
            key={faq.id}
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "hsl(var(--card))" }}
          >
            <button
              className="w-full flex items-center justify-between p-5 text-left"
              onClick={() => toggleFAQ(faq.id)}
            >
              <span className="font-medium pr-4" style={{ color: "hsl(var(--card-foreground))" }}>
                {faq.question}
              </span>
              {expandedFAQs.has(faq.id) ? (
                <Minus className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
              ) : (
                <Plus className="h-5 w-5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
              )}
            </button>
            {expandedFAQs.has(faq.id) && (
              <div className="px-5 pb-5">
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Default card variant
  return (
    <section
      className={cn("rounded-xl border p-6", className)}
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <h2
        className="text-xl font-bold mb-6 flex items-center gap-2"
        style={{ color: "hsl(var(--card-foreground))" }}
      >
        <HelpCircle className="h-5 w-5" style={{ color: "hsl(var(--primary))" }} />
        {title}
      </h2>
      <div className="space-y-4">
        {faqs.map((faq) => (
          <div
            key={faq.id}
            className="border-b pb-4 last:border-b-0 last:pb-0"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <h4 className="font-medium mb-2" style={{ color: "hsl(var(--card-foreground))" }}>
              {faq.question}
            </h4>
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {faq.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
