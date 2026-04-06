import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  createAnnotationSchema,
  updateAnnotationSchema,
} from "../validators";

// ─── Generators ──────────────────────────────────────────────────────────────

const uuidArb = fc.uuid().map((u) => u.toString());

const targetTypeArb = fc.constantFrom(
  "cfm_scan" as const,
  "csp_scan" as const,
  "cfm_recommendation" as const,
  "csp_finding" as const,
);

const contentArb = fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0);

// ─── In-memory store to mock Drizzle DB layer ───────────────────────────────

type AnnotationRecord = {
  id: string;
  userId: string;
  targetType: string;
  targetId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

function createInMemoryAnnotationStore() {
  let annotations: AnnotationRecord[] = [];

  return {
    reset() {
      annotations = [];
    },
    seed(records: AnnotationRecord[]) {
      annotations = [...records];
    },
    getAnnotations(
      userId: string,
      targetType: string,
      targetId: string,
    ): AnnotationRecord[] {
      return annotations
        .filter(
          (a) =>
            a.userId === userId &&
            a.targetType === targetType &&
            a.targetId === targetId,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    createAnnotation(
      userId: string,
      data: { targetType: string; targetId: string; content: string },
    ): AnnotationRecord {
      const now = new Date();
      const annotation: AnnotationRecord = {
        id: crypto.randomUUID(),
        userId,
        targetType: data.targetType,
        targetId: data.targetId,
        content: data.content,
        createdAt: now,
        updatedAt: now,
      };
      annotations.push(annotation);
      return annotation;
    },
    getAnnotationById(id: string): AnnotationRecord | null {
      return annotations.find((a) => a.id === id) ?? null;
    },
    updateAnnotation(
      id: string,
      userId: string,
      data: { content: string },
    ): AnnotationRecord | null {
      const idx = annotations.findIndex(
        (a) => a.id === id && a.userId === userId,
      );
      if (idx === -1) return null;
      annotations[idx] = {
        ...annotations[idx],
        content: data.content,
        updatedAt: new Date(),
      };
      return annotations[idx];
    },
    deleteAnnotation(id: string, userId: string): boolean {
      const idx = annotations.findIndex(
        (a) => a.id === id && a.userId === userId,
      );
      if (idx === -1) return false;
      annotations.splice(idx, 1);
      return true;
    },
  };
}

// ─── Annotation record generator ────────────────────────────────────────────

const annotationRecordArb = (userId: string) =>
  fc.record({
    id: uuidArb,
    userId: fc.constant(userId),
    targetType: targetTypeArb.map((t) => t as string),
    targetId: uuidArb,
    content: contentArb,
    createdAt: fc.date({
      min: new Date("2024-01-01"),
      max: new Date("2025-12-31"),
    }),
    updatedAt: fc.date({
      min: new Date("2024-01-01"),
      max: new Date("2025-12-31"),
    }),
  });

// ─── Property Tests ─────────────────────────────────────────────────────────

describe("Feature: phase5-dashboard-ux — Annotations Properties", () => {
  const store = createInMemoryAnnotationStore();

  beforeEach(() => {
    store.reset();
  });

  // ── Property 6: Annotations are user-and-target-scoped ────────────────────
  // **Validates: Requirement 8.1**
  describe("Property 6: Annotations are user-and-target-scoped", () => {
    it("GET returns only annotations matching the queried userId + targetType + targetId", () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          targetTypeArb,
          targetTypeArb,
          uuidArb,
          uuidArb,
          fc.array(annotationRecordArb("placeholder"), {
            minLength: 1,
            maxLength: 8,
          }),
          fc.array(annotationRecordArb("placeholder"), {
            minLength: 1,
            maxLength: 8,
          }),
          (
            userA,
            userB,
            targetTypeA,
            targetTypeB,
            targetIdA,
            targetIdB,
            annsA,
            annsB,
          ) => {
            // Ensure distinct users and at least one distinct target dimension
            fc.pre(userA !== userB);

            store.reset();

            // Assign ownership and targets
            const ownedByA = annsA.map((a) => ({
              ...a,
              userId: userA,
              targetType: targetTypeA,
              targetId: targetIdA,
            }));
            const ownedByB = annsB.map((a) => ({
              ...a,
              userId: userB,
              targetType: targetTypeB,
              targetId: targetIdB,
            }));
            store.seed([...ownedByA, ...ownedByB]);

            // Query for user A's annotations on targetA
            const resultA = store.getAnnotations(
              userA,
              targetTypeA,
              targetIdA,
            );
            expect(resultA.every((a) => a.userId === userA)).toBe(true);
            expect(
              resultA.every((a) => a.targetType === targetTypeA),
            ).toBe(true);
            expect(resultA.every((a) => a.targetId === targetIdA)).toBe(
              true,
            );
            expect(resultA.length).toBe(ownedByA.length);

            // No cross-contamination: user B's annotations should not appear
            const allAIds = new Set(ownedByA.map((a) => a.id));
            const resultB = store.getAnnotations(
              userB,
              targetTypeB,
              targetIdB,
            );
            expect(resultB.some((a) => allAIds.has(a.id))).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 7: Annotation creation round-trip ────────────────────────────
  // **Validates: Requirement 8.2**
  describe("Property 7: Annotation creation round-trip", () => {
    it("creating an annotation and retrieving it preserves all fields", () => {
      fc.assert(
        fc.property(
          uuidArb,
          targetTypeArb,
          uuidArb,
          contentArb,
          (userId, targetType, targetId, content) => {
            store.reset();

            const created = store.createAnnotation(userId, {
              targetType,
              targetId,
              content,
            });

            const retrieved = store.getAnnotations(
              userId,
              targetType,
              targetId,
            );
            expect(retrieved.length).toBe(1);

            const annotation = retrieved[0];
            expect(annotation.id).toBe(created.id);
            expect(annotation.userId).toBe(userId);
            expect(annotation.targetType).toBe(targetType);
            expect(annotation.targetId).toBe(targetId);
            expect(annotation.content).toBe(content);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 8: Annotation content length validation ──────────────────────
  // **Validates: Requirement 8.3**
  describe("Property 8: Annotation content length validation", () => {
    it("Zod createAnnotationSchema rejects content > 500 characters", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 501, maxLength: 2000 }),
          uuidArb,
          targetTypeArb,
          (longContent, targetId, targetType) => {
            const result = createAnnotationSchema.safeParse({
              targetType,
              targetId,
              content: longContent,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Zod updateAnnotationSchema rejects content > 500 characters", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 501, maxLength: 2000 }),
          (longContent) => {
            const result = updateAnnotationSchema.safeParse({
              content: longContent,
            });
            expect(result.success).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 9: Annotations ownership enforcement ─────────────────────────
  // **Validates: Requirements 8.4, 8.5**
  describe("Property 9: Annotations ownership enforcement", () => {
    it("updateAnnotation by non-owner returns null, deleteAnnotation by non-owner returns false", () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          targetTypeArb,
          uuidArb,
          contentArb,
          (ownerUserId, otherUserId, targetType, targetId, content) => {
            fc.pre(ownerUserId !== otherUserId);

            store.reset();

            // Create an annotation owned by ownerUserId
            const created = store.createAnnotation(ownerUserId, {
              targetType,
              targetId,
              content,
            });

            // Non-owner tries to update
            const updateResult = store.updateAnnotation(
              created.id,
              otherUserId,
              { content: "hacked" },
            );
            expect(updateResult).toBeNull();

            // Annotation should be unchanged
            const unchanged = store.getAnnotationById(created.id);
            expect(unchanged).not.toBeNull();
            expect(unchanged!.content).toBe(content);

            // Non-owner tries to delete
            const deleteResult = store.deleteAnnotation(
              created.id,
              otherUserId,
            );
            expect(deleteResult).toBe(false);

            // Annotation should still exist
            const stillExists = store.getAnnotationById(created.id);
            expect(stillExists).not.toBeNull();
            expect(stillExists!.id).toBe(created.id);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
