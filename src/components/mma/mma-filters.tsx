"use client";

import { cn } from "@/lib/utils";

const WEIGHT_CLASSES = [
  { value: "", label: "All" },
  { value: "Heavyweight", label: "Heavyweight" },
  { value: "Light Heavyweight", label: "Light Heavyweight" },
  { value: "Middleweight", label: "Middleweight" },
  { value: "Welterweight", label: "Welterweight" },
  { value: "Lightweight", label: "Lightweight" },
  { value: "Featherweight", label: "Featherweight" },
  { value: "Bantamweight", label: "Bantamweight" },
  { value: "Flyweight", label: "Flyweight" },
] as const;

type Props = {
  weightClass: string;
  onWeightClassChange: (v: string) => void;
};

export function MmaFilters({ weightClass, onWeightClassChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {WEIGHT_CLASSES.map((wc) => {
        const isActive = weightClass === wc.value;
        return (
          <button
            key={wc.value}
            type="button"
            onClick={() => onWeightClassChange(wc.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200",
              isActive
                ? "bg-[#7B3FA0] text-white shadow-md"
                : "bg-[#EDE8F5] text-[#6B5B8D] hover:bg-[#E0D8F0] hover:text-[#1A1145]"
            )}
          >
            {wc.label}
          </button>
        );
      })}
    </div>
  );
}
