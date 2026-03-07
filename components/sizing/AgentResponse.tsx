"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AgentResponseProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Renders agent response as formatted text.
 * Handles streaming (incremental text) and complete responses.
 */
export function AgentResponse({ content, isStreaming }: AgentResponseProps) {
  if (!content && !isStreaming) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Agent Response
          {isStreaming && (
            <span className="text-muted-foreground ml-2 animate-pulse">
              streaming...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
          {content || (
            <span className="text-muted-foreground">Waiting for response...</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
