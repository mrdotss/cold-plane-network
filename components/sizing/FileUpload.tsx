"use client";

import React, { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parsePricingJson } from "@/lib/sizing/parser";
import type { PricingData } from "@/lib/sizing/types";

interface FileUploadProps {
  onParsed: (data: PricingData, fileName: string) => void;
}

export function FileUpload({ onParsed }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      setSummary(null);

      if (!file.name.endsWith(".json")) {
        setError(["Only .json files are accepted."]);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = parsePricingJson(reader.result as string);
        if (result.success) {
          setSummary(
            `${result.data.serviceCount} services, ${result.data.regionCount} regions, $${result.data.totalMonthly.toFixed(2)}/mo`
          );
          onParsed(result.data, file.name);
        } else {
          setError(result.errors);
        }
      };
      reader.onerror = () => setError(["Failed to read file."]);
      reader.readAsText(file);
    },
    [onParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Card
      className={`border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : ""}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-muted-foreground text-sm">
          Drag & drop an AWS Pricing Calculator JSON file, or
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={onInputChange}
          aria-label="Upload pricing JSON file"
        />
        {summary && (
          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
            {summary}
          </p>
        )}
        {error && (
          <div className="text-sm text-destructive mt-1 space-y-0.5">
            {error.map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
