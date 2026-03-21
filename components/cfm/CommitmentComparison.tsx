"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CfmRecommendation } from "@/lib/cfm/types";

interface CommitmentComparisonProps {
  service: string;
  recommendations: CfmRecommendation[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface CommitmentOption {
  title: string;
  savingsAmount: number;
  savingsPercent: number;
  tradeoffs: string[];
}

function computeCommitmentOptions(
  service: string,
  recommendations: CfmRecommendation[],
): { savingsPlan: CommitmentOption; reservedInstance: CommitmentOption } | null {
  const totalCurrentCost = recommendations.reduce((s, r) => s + r.currentCost, 0);
  if (totalCurrentCost === 0) return null;

  const totalSavings = recommendations.reduce((s, r) => s + r.estimatedSavings, 0);

  const isEC2 = service.toUpperCase() === "EC2";

  // Savings Plans: typically ~30% savings, flexible across instance families
  const spSavings = Math.round(totalSavings * 0.65);
  const spPercent = totalCurrentCost > 0 ? Math.round((spSavings / totalCurrentCost) * 100) : 0;

  // Reserved Instances: typically ~40% savings, locked to specific instance type
  const riSavings = Math.round(totalSavings * 0.85);
  const riPercent = totalCurrentCost > 0 ? Math.round((riSavings / totalCurrentCost) * 100) : 0;

  return {
    savingsPlan: {
      title: isEC2 ? "Compute Savings Plans" : "RDS Savings Plans",
      savingsAmount: spSavings,
      savingsPercent: spPercent,
      tradeoffs: isEC2
        ? [
            "Flexible across instance families and regions",
            "1 or 3-year commitment",
            "Applies to EC2, Fargate, and Lambda",
          ]
        : [
            "Flexible across RDS DB engines",
            "1 or 3-year commitment",
            "Applies to any RDS instance type",
          ],
    },
    reservedInstance: {
      title: isEC2 ? "EC2 Reserved Instances" : "RDS Reserved Instances",
      savingsAmount: riSavings,
      savingsPercent: riPercent,
      tradeoffs: isEC2
        ? [
            "Higher savings but locked to instance type",
            "1 or 3-year commitment",
            "Standard or Convertible options",
          ]
        : [
            "Higher savings but locked to DB engine and instance class",
            "1 or 3-year commitment",
            "Multi-AZ option available",
          ],
    },
  };
}

export function CommitmentComparison({ service, recommendations }: CommitmentComparisonProps) {
  const options = useMemo(
    () => computeCommitmentOptions(service, recommendations),
    [service, recommendations],
  );

  if (!options) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Commitment Opportunities</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CommitmentCard option={options.savingsPlan} />
        <CommitmentCard option={options.reservedInstance} />
      </div>
    </div>
  );
}

function CommitmentCard({ option }: { option: CommitmentOption }) {
  return (
    <Card size="sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm">{option.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">
            {formatCurrency(option.savingsAmount)}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {option.savingsPercent}% savings
          </Badge>
        </div>
        <ul className="flex flex-col gap-1">
          {option.tradeoffs.map((note) => (
            <li key={note} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="mt-1 size-1 rounded-full bg-muted-foreground shrink-0" />
              {note}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
