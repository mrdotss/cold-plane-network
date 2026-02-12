export interface MappingRow {
  name: string
  type: string
  location: string | null
  awsService: string
  awsCategory: string
  confidence: string
  rationale: string
  migrationNotes: string
  alternatives: string
}

export function filterByConfidence(
  items: MappingRow[],
  confidence: string | null
): MappingRow[] {
  if (!confidence) return items
  return items.filter((item) => item.confidence === confidence)
}

export function filterByCategory(
  items: MappingRow[],
  category: string | null
): MappingRow[] {
  if (!category) return items
  return items.filter((item) => item.awsCategory === category)
}

export function applyFilters(
  items: MappingRow[],
  filters: { confidence: string | null; category: string | null }
): MappingRow[] {
  let result = items
  result = filterByConfidence(result, filters.confidence)
  result = filterByCategory(result, filters.category)
  return result
}
