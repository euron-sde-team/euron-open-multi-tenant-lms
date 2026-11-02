"use client";

import { useState } from "react";

type Scope = "category" | "marketing" | "all";

interface Props {
  token: string;
  category: "NOTIFICATION" | "MARKETING";
  tenantName: string;
}

const CHOICES: Array<{
  value: Scope;
  title: string;
  description: string;
}> = [
  {
    value: "category",
    title: "Just emails like this one",
    description:
      "Stop receiving the same kind of email you just got. You'll still get other categories of emails from us.",
  },
  {
    value: "marketing",
    title: "All marketing emails",
    description:
      "Stop campaigns and promotional emails. You'll still get account notifications.",
  },
  {
    value: "all",
    title: "Everything except essential",
    description:
      "Stop campaigns and notifications. Only critical messages (login codes, payment receipts) will arrive.",
  },
];

export default function UnsubscribeForm({ token, category, tenantName }: Props) {
  const defaultScope: Scope = category === "NOTIFICATION" ? "category" : "marketing";
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/email/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, scope }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          marginTop: 24,
          padding: "16px 18px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          color: "#166534",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Done.</p>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
          You won&apos;t receive any further emails of the selected type from{" "}
          {tenantName}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      {CHOICES.map((choice) => {
        const checked = scope === choice.value;
        return (
          <label
            key={choice.value}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 14px",
              marginBottom: 10,
              borderRadius: 8,
              border: `1px solid ${checked ? "#18181b" : "#e4e4e7"}`,
              background: checked ? "#fafafa" : "#ffffff",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="scope"
              value={choice.value}
              checked={checked}
              onChange={() => setScope(choice.value)}
              style={{ marginTop: 4 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#18181b" }}>
                {choice.title}
              </div>
              <div style={{ fontSize: 13, color: "#52525b", marginTop: 4 }}>
                {choice.description}
              </div>
            </div>
          </label>
        );
      })}
      {error && (
        <p
          style={{
            margin: "8px 0",
            padding: "10px 12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            fontSize: 13,
            color: "#991b1b",
          }}
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: 8,
          padding: "10px 20px",
          background: submitting ? "#71717a" : "#18181b",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          cursor: submitting ? "wait" : "pointer",
        }}
      >
        {submitting ? "Unsubscribing..." : "Confirm unsubscribe"}
      </button>
    </form>
  );
}
