/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

// What a template is handed: JSON off the queue, or a preview fixture.
export type TemplateData = Record<string, unknown>

export interface TemplateEntry {
  // Templates are looked up by string, so no entry's prop type is knowable
  // here; each keeps its own where it is defined. `never` is what "props this
  // side cannot name" means, and every concrete component satisfies it.
  component: React.ComponentType<never>
  subject: string | ((data: TemplateData) => string)
  to?: string
  displayName?: string
  previewData?: TemplateData
}

// The one crossing back from the string-keyed registry to a typed component.
// Callers render through here so the assertion lives once, next to its reason,
// instead of once per call site.
export function renderTemplate(entry: TemplateEntry, data: TemplateData): React.ReactElement {
  return React.createElement(entry.component as React.ComponentType<TemplateData>, data)
}

import { template as contactQuestionForFounder } from './contact-question-for-founder.tsx'
import { template as contactQuestionConfirmation } from './contact-question-confirmation.tsx'
import { template as investorWaitlistForFounder } from './investor-waitlist-for-founder.tsx'
import { template as investorWaitlistConfirmation } from './investor-waitlist-confirmation.tsx'
import { template as investorWaitlistConfirmationPt } from './investor-waitlist-confirmation-pt.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-question-for-founder': contactQuestionForFounder,
  'contact-question-confirmation': contactQuestionConfirmation,
  'investor-waitlist-for-founder': investorWaitlistForFounder,
  'investor-waitlist-confirmation': investorWaitlistConfirmation,
  'investor-waitlist-confirmation-pt': investorWaitlistConfirmationPt,
}
