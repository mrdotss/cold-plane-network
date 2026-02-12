"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESOURCE_TYPES } from "@/lib/spec/schema";
import { parseSpec } from "@/lib/spec/parser";
import yaml from "js-yaml";

interface SpecFormProps {
  specText: string;
  onSpecChange: (text: string) => void;
}

interface FormResource {
  name: string;
  type: string;
  properties: string; // key=value pairs, one per line
  dependsOn: string;  // comma-separated
  connectTo: string;  // comma-separated
}

const EMPTY_RESOURCE: FormResource = {
  name: "",
  type: "vpc",
  properties: "",
  dependsOn: "",
  connectTo: "",
};

export function SpecForm({ specText, onSpecChange }: SpecFormProps) {
  const [newResource, setNewResource] = useState<FormResource>({ ...EMPTY_RESOURCE });

  // Parse current spec to show existing resources
  const parsed = parseSpec(specText);

  const handleAddResource = useCallback(() => {
    if (!newResource.name.trim() || !newResource.type.trim()) return;

    // Parse properties from key=value lines
    const props: Record<string, string> = {};
    for (const line of newResource.properties.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        props[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }

    const depsList = newResource.dependsOn
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const connList = newResource.connectTo
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Build the resource object for YAML
    const resource: Record<string, unknown> = {
      name: newResource.name.trim(),
      type: newResource.type.trim(),
    };
    if (Object.keys(props).length > 0) resource.properties = props;
    if (depsList.length > 0) resource.dependsOn = depsList;
    if (connList.length > 0) resource.connectTo = connList;

    // Parse existing spec and append
    const existing = parseSpec(specText);
    const allResources = [
      ...existing.resources.map((r) => {
        const obj: Record<string, unknown> = { name: r.name, type: r.type };
        if (Object.keys(r.properties).length > 0) obj.properties = r.properties;
        if (r.dependsOn?.length) obj.dependsOn = r.dependsOn;
        if (r.connectTo?.length) obj.connectTo = r.connectTo;
        return obj;
      }),
      resource,
    ];

    const newYaml = yaml.dump({ resources: allResources }, { lineWidth: -1 });
    onSpecChange(newYaml);
    setNewResource({ ...EMPTY_RESOURCE });
  }, [newResource, specText, onSpecChange]);

  const handleRemoveResource = useCallback(
    (index: number) => {
      const existing = parseSpec(specText);
      const filtered = existing.resources.filter((_, i) => i !== index);
      if (filtered.length === 0) {
        onSpecChange("");
        return;
      }
      const rebuilt = filtered.map((r) => {
        const obj: Record<string, unknown> = { name: r.name, type: r.type };
        if (Object.keys(r.properties).length > 0) obj.properties = r.properties;
        if (r.dependsOn?.length) obj.dependsOn = r.dependsOn;
        if (r.connectTo?.length) obj.connectTo = r.connectTo;
        return obj;
      });
      onSpecChange(yaml.dump({ resources: rebuilt }, { lineWidth: -1 }));
    },
    [specText, onSpecChange]
  );

  return (
    <div className="p-2 space-y-3 text-sm">
      {/* Existing resources */}
      {parsed.resources.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Resources ({parsed.resources.length})
          </p>
          {parsed.resources.map((r, i) => (
            <div
              key={`${r.type}:${r.name}`}
              className="flex items-center justify-between rounded border px-2 py-1.5"
            >
              <div className="min-w-0">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground ml-1.5 text-xs">{r.type}</span>
                {r.parent && (
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    → {r.parent}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleRemoveResource(i)}
                aria-label={`Remove ${r.name}`}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new resource form */}
      <div className="space-y-2 border rounded p-2">
        <p className="text-xs font-medium text-muted-foreground">Add Resource</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="res-name" className="text-xs">Name</Label>
            <Input
              id="res-name"
              value={newResource.name}
              onChange={(e) => setNewResource((p) => ({ ...p, name: e.target.value }))}
              placeholder="my-vpc"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label htmlFor="res-type" className="text-xs">Type</Label>
            <select
              id="res-type"
              value={newResource.type}
              onChange={(e) => setNewResource((p) => ({ ...p, type: e.target.value }))}
              className="h-7 w-full rounded border bg-background px-2 text-xs"
              aria-label="Resource type"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="res-props" className="text-xs">Properties (key=value per line)</Label>
          <textarea
            id="res-props"
            value={newResource.properties}
            onChange={(e) => setNewResource((p) => ({ ...p, properties: e.target.value }))}
            placeholder={"cidr=10.0.0.0/16\nregion=us-east-1"}
            rows={2}
            className="w-full rounded border bg-background px-2 py-1 text-xs font-mono resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="res-deps" className="text-xs">Depends On</Label>
            <Input
              id="res-deps"
              value={newResource.dependsOn}
              onChange={(e) => setNewResource((p) => ({ ...p, dependsOn: e.target.value }))}
              placeholder="vpc-1, subnet-1"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label htmlFor="res-conn" className="text-xs">Connect To</Label>
            <Input
              id="res-conn"
              value={newResource.connectTo}
              onChange={(e) => setNewResource((p) => ({ ...p, connectTo: e.target.value }))}
              placeholder="firewall-1"
              className="h-7 text-xs"
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleAddResource}
          disabled={!newResource.name.trim()}
          className="w-full"
        >
          Add Resource
        </Button>
      </div>
    </div>
  );
}
