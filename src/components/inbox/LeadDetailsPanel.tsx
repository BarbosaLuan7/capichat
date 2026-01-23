/**
 * LeadDetailsPanel
 *
 * This component has been refactored into smaller, focused components.
 * The implementation now lives in the lead-panel/ folder.
 *
 * Structure:
 * - lead-panel/index.tsx - Main orchestrator (~150 lines)
 * - lead-panel/LeadHeader.tsx - Avatar, name, phone, quick actions
 * - lead-panel/LeadInfoSection.tsx - Lead data: contact, qualification, stage
 * - lead-panel/LeadLabelsSection.tsx - Labels management
 * - lead-panel/LeadTimelineSection.tsx - Activity timeline
 * - lead-panel/LeadNotesSection.tsx - Internal notes
 * - lead-panel/LeadDocumentsSection.tsx - Document checklist
 * - lead-panel/LeadAISection.tsx - AI features (summary, classification)
 * - lead-panel/types.ts - Shared TypeScript interfaces
 *
 * This file re-exports everything to maintain backward compatibility.
 */

export { LeadDetailsPanel } from './lead-panel';
export type { LeadDetailsPanelProps, LeadWithRelations } from './lead-panel';
