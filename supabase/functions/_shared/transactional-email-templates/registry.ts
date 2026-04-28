/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as contactQuestionForFounder } from './contact-question-for-founder.tsx'
import { template as contactQuestionConfirmation } from './contact-question-confirmation.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-question-for-founder': contactQuestionForFounder,
  'contact-question-confirmation': contactQuestionConfirmation,
}
