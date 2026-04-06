"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PencilEdit01Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { AnnotationPopover } from "@/components/annotations/AnnotationPopover";
import type { SerializedCfmAccount } from "./CfmLanding";

interface AccountCardProps {
  account: SerializedCfmAccount;
  totalSavings: number;
  onReanalyze: (accountId: string) => void;
  onEdit: (accountId: string) => void;
  onDelete: (accountId: string) => void;
}

function maskAccountId(awsAccountId: string): string {
  return `****${awsAccountId.slice(-4)}`;
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "Never";
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSavings(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AccountCard({ account, totalSavings, onReanalyze, onEdit, onDelete }: AccountCardProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    setDeleting(true);
    onDelete(account.id);
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{account.accountName}</CardTitle>
        <CardDescription className="font-mono text-xs">
          {maskAccountId(account.awsAccountId)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Last scan</span>
          <span>{formatDate(account.lastScanAt)}</span>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Savings found</span>
          <Badge variant={totalSavings > 0 ? "default" : "secondary"} className="w-fit">
            {formatSavings(totalSavings)}
          </Badge>
        </div>
      </CardContent>
      <CardFooter className="gap-1">
        <Button variant="ghost" size="xs" onClick={() => onReanalyze(account.id)} aria-label="Re-analyze account">
          <HugeiconsIcon icon={RepeatIcon} data-icon="inline-start" strokeWidth={2} />
          Re-analyze
        </Button>
        <Button variant="ghost" size="xs" onClick={() => onEdit(account.id)} aria-label="Edit account">
          <HugeiconsIcon icon={PencilEdit01Icon} data-icon="inline-start" strokeWidth={2} />
          Edit
        </Button>
        <AnnotationPopover targetType="cfm_scan" targetId={account.id} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="xs" aria-label="Delete account" disabled={deleting}>
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" strokeWidth={2} />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{account.accountName}&quot; and all associated scans and recommendations. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
