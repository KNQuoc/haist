'use client';

import React, { useState } from 'react';
import { CheckCircle2, Wrench, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ToolCallResult } from '@/lib/ai-assistant/types';

interface ToolCallCardProps {
  toolCall: ToolCallResult;
  /** true while the parent message is still streaming */
  isStreaming?: boolean;
}

/** "COMPOSIO_SEARCH_TOOLS" → "Search Tools", "GMAIL_SEND_EMAIL" → "Send Email" */
function formatAction(name: string): string {
  const parts = name.split('_');
  // Drop first token if it looks like a toolkit prefix (all-caps single word)
  const meaningful = parts.length > 1 && parts[0] === parts[0].toUpperCase()
    ? parts.slice(1)
    : parts;
  return meaningful
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

const SERVICE_NAMES: Record<string, string> = {
  GMAIL: 'Gmail',
  SLACK: 'Slack',
  GITHUB: 'GitHub',
  NOTION: 'Notion',
  GOOGLECALENDAR: 'Google Calendar',
  GOOGLEDRIVE: 'Google Drive',
  GOOGLESHEETS: 'Google Sheets',
  GOOGLEDOCS: 'Google Docs',
  GOOGLETASKS: 'Google Tasks',
  GOOGLEMEET: 'Google Meet',
  GOOGLE_MAPS: 'Google Maps',
  LINEAR: 'Linear',
  DISCORD: 'Discord',
  TWITTER: 'X',
  LINKEDIN: 'LinkedIn',
  REDDIT: 'Reddit',
  OUTLOOK: 'Outlook',
  ONE_DRIVE: 'OneDrive',
  MICROSOFT_TEAMS: 'Teams',
  JIRA: 'Jira',
  ASANA: 'Asana',
  FIGMA: 'Figma',
  YOUTUBE: 'YouTube',
  SALESFORCE: 'Salesforce',
  CALENDLY: 'Calendly',
  FIRECRAWL: 'Firecrawl',
  EXA: 'Exa',
  CANVA: 'Canva',
};

/** Returns a human-friendly service name, or null if it's internal/generic */
function getServiceLabel(toolkit: string): string | null {
  const upper = toolkit.toUpperCase();
  // Hide internal / generic names — they're not useful to the user
  if (upper === 'COMPOSIO' || upper === 'DEFAULT' || upper === 'INTERNAL') return null;
  return SERVICE_NAMES[upper] || toolkit.charAt(0).toUpperCase() + toolkit.slice(1).toLowerCase();
}

export function ToolCallCard({ toolCall, isStreaming }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails = toolCall.result !== undefined || toolCall.error !== undefined;

  const formatResult = (result: unknown): string => {
    if (typeof result === 'string') return result;
    return JSON.stringify(result, null, 2);
  };

  const action = formatAction(toolCall.toolName);
  const serviceLabel = getServiceLabel(toolCall.toolkit);

  // If the card is rendered and we're not actively streaming, it's done
  const isDone = !isStreaming || toolCall.result !== undefined || toolCall.error !== undefined || toolCall.success;

  return (
    <div className="mt-2 p-3 rounded-lg border bg-muted/30 border-border/60">
      <div
        className={clsx(
          'flex items-center gap-2',
          hasDetails && 'cursor-pointer'
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {isDone ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
        )}
        <span className="text-sm font-medium truncate">{action}</span>
        {serviceLabel && (
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {serviceLabel}
          </span>
        )}
        {hasDetails && (
          <span className="ml-auto">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
        )}
      </div>

      {expanded && toolCall.result !== undefined && (
        <div className="mt-2">
          <pre className="p-2 bg-background/80 rounded-md text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words border border-border/50">
            {formatResult(toolCall.result)}
          </pre>
        </div>
      )}

      {expanded && toolCall.error && (
        <p className="mt-2 text-xs text-muted-foreground">{toolCall.error}</p>
      )}
    </div>
  );
}
