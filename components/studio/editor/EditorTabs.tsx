"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpecEditor } from "./SpecEditor";
import { SpecForm } from "./SpecForm";

interface EditorTabsProps {
  specText: string;
  onSpecChange: (text: string) => void;
}

export function EditorTabs({ specText, onSpecChange }: EditorTabsProps) {
  return (
    <Tabs defaultValue="editor" className="flex flex-col h-full">
      <div className="shrink-0 px-2 pt-1">
        <TabsList className="w-full">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="editor" className="flex-1 min-h-0">
        <SpecEditor value={specText} onChange={onSpecChange} />
      </TabsContent>
      <TabsContent value="form" className="flex-1 min-h-0 overflow-auto">
        <SpecForm specText={specText} onSpecChange={onSpecChange} />
      </TabsContent>
    </Tabs>
  );
}
