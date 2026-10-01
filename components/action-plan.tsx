"use client";

import { useOptimistic, useTransition } from "react";
import { Check, User, CalendarDays, FileCheck2 } from "lucide-react";
import { toggleActionStepAction } from "@/app/actions";
import type { ActionPlanStep } from "@/lib/types";
import { cn } from "@/lib/cn";

const PHASE_LABEL: Record<string, string> = {
  Assess: "1 · Assess scope",
  Remediate: "2 · Remediate controls",
  Verify: "3 · Verify & attest",
};

/**
 * Visual, trackable remediation stepper. Steps are generated
 * deterministically from the mapped controls + publication metadata;
 * checking a step persists it to the store via a server action.
 */
export function ActionPlan({
  publicationId,
  steps,
}: {
  publicationId: string;
  steps: ActionPlanStep[];
}) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(
    steps,
    (current: ActionPlanStep[], toggledId: string) =>
      current.map((s) =>
        s.id === toggledId ? { ...s, done: !s.done } : s,
      ),
  );

  const done = optimistic.filter((s) => s.done).length;
  const pct = optimistic.length === 0 ? 0 : Math.round((done / optimistic.length) * 100);

  const toggle = (stepId: string) => {
    startTransition(async () => {
      setOptimistic(stepId);
      await toggleActionStepAction(publicationId, stepId);
    });
  };

  let lastPhase = "";
  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-sm font-semibold text-ink">
            {done} of {optimistic.length} steps complete
          </p>
          <p className="font-mono text-sm text-ink-soft">{pct}%</p>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Action plan progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] text-ink-faint">
          Steps are generated from the mapped controls above; due dates are
          suggested response timelines based on severity.
        </p>
      </div>

      <ol className="relative ml-1 space-y-0">
        {optimistic.map((step) => {
          const showPhase = step.phase !== lastPhase;
          lastPhase = step.phase;
          return (
            <li key={step.id}>
              {showPhase && (
                <p className="mb-2 mt-5 first:mt-0 text-[13px] font-bold uppercase tracking-wide text-ink-faint">
                  {PHASE_LABEL[step.phase] ?? step.phase}
                </p>
              )}
              <div className="relative flex gap-4 pb-5">
                {/* Stepper rail */}
                <div className="flex flex-col items-center" aria-hidden>
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    disabled={isPending}
                    tabIndex={-1}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition",
                      step.done
                        ? "border-primary bg-primary text-white"
                        : "border-line-strong bg-paper text-transparent hover:border-primary",
                    )}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <span className="mt-1 w-0.5 flex-1 bg-line" />
                </div>

                {/* Step card */}
                <div
                  className={cn(
                    "flex-1 rounded border p-4 transition",
                    step.done
                      ? "border-line bg-canvas"
                      : "border-line bg-paper",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={step.done}
                        onChange={() => toggle(step.id)}
                        disabled={isPending}
                        className="mt-1 h-4 w-4 shrink-0 accent-[#005ea2]"
                        aria-label={`Mark step ${step.order} complete: ${step.title}`}
                      />
                      <span>
                        <span
                          className={cn(
                            "block text-[15px] font-semibold",
                            step.done ? "text-ink-faint line-through" : "text-ink",
                          )}
                        >
                          {step.order}. {step.title}
                        </span>
                        <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                          {step.detail}
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 font-medium text-primary-dark">
                      <User className="h-3.5 w-3.5" aria-hidden /> {step.owner}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 font-medium text-ink-soft ring-1 ring-line">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Due{" "}
                      {new Date(`${step.dueDate}T00:00:00Z`).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </span>
                  </div>
                  <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-faint">
                    <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Evidence to file: {step.evidence}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
