/**
 * Memory Distillation Service
 *
 * Reviews recent daily artifacts and distills key facts, preferences,
 * and patterns into the user's soul artifact (__user_profile__).
 * Runs as a scheduled system feature.
 */

import { artifactService } from '@/lib/artifacts';
import OpenAI from 'openai';
import { getMinimaxClient } from '../minimax-model';

const PROFILE_TITLE = '__user_profile__';
const DAILY_PREFIX = 'Daily — ';

/**
 * Run distillation for a specific user.
 */
export async function distillMemory(userId: string, daysBack = 3): Promise<{
  success: boolean;
  dailiesReviewed: number;
  insightsAdded: number;
  error?: string;
}> {
  try {
    const allArtifacts = await artifactService.getByUserId(userId);

    const soulArtifact = allArtifacts.find((a) => a.title === PROFILE_TITLE);
    if (!soulArtifact) {
      return { success: true, dailiesReviewed: 0, insightsAdded: 0 };
    }

    const now = new Date();
    const dailyArtifacts = [];
    for (let i = 0; i < daysBack; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const daily = allArtifacts.find((a) => a.title === `${DAILY_PREFIX}${dateStr}`);
      if (daily) {
        dailyArtifacts.push(daily);
      }
    }

    if (dailyArtifacts.length === 0) {
      return { success: true, dailiesReviewed: 0, insightsAdded: 0 };
    }

    const dailyEntries: string[] = [];
    for (const daily of dailyArtifacts) {
      const withEntries = await artifactService.getWithEntries(daily.id);
      if (withEntries) {
        for (const entry of withEntries.entries) {
          dailyEntries.push(`[${daily.title}] ${entry.content}`);
        }
      }
    }

    if (dailyEntries.length === 0) {
      return { success: true, dailiesReviewed: dailyArtifacts.length, insightsAdded: 0 };
    }

    const soulWithEntries = await artifactService.getWithEntries(soulArtifact.id);
    const existingSoulContent = soulWithEntries
      ? soulWithEntries.entries
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
          .map((e) => e.content)
          .join('\n')
      : '';

    const openai = getMinimaxClient();

    const response = await openai.chat.completions.create({
      model: process.env.MINIMAX_MODEL || 'MiniMax-M2.5',
      messages: [
        {
          role: 'system',
          content: `You are a memory distillation agent. Your job is to review daily logs and extract key facts worth remembering long-term about the user.

Extract ONLY:
- Stable facts (name, school, job, location, important people)
- Preferences and patterns (communication style, tools, habits)
- Important decisions or plans (travel, projects, deadlines)
- Recurring needs or interests

Do NOT extract:
- Trivial tasks or one-off questions
- Things already in the existing profile
- Temporary context that won't matter in a week

Format: Return a JSON array of strings, each being a concise fact/insight. Return an empty array [] if nothing new is worth remembering.

Example output: ["User is traveling to SFO Feb 20-24 for a conference", "Prefers Slack notifications over email for urgent items"]`,
        },
        {
          role: 'user',
          content: `EXISTING PROFILE:\n${existingSoulContent || '(empty)'}\n\nRECENT DAILY LOGS:\n${dailyEntries.join('\n')}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: true, dailiesReviewed: dailyArtifacts.length, insightsAdded: 0 };
    }

    let insights: string[] = [];
    try {
      const parsed = JSON.parse(content);
      insights = Array.isArray(parsed) ? parsed : (parsed.insights || parsed.facts || []);
    } catch {
      return { success: true, dailiesReviewed: dailyArtifacts.length, insightsAdded: 0 };
    }

    let added = 0;
    for (const insight of insights) {
      if (typeof insight === 'string' && insight.trim()) {
        await artifactService.addEntry(soulArtifact.id, {
          content: insight.trim(),
          source: 'manual',
        });
        added++;
      }
    }

    return { success: true, dailiesReviewed: dailyArtifacts.length, insightsAdded: added };
  } catch (error) {
    console.error('[DistillationService] Error:', error);
    return {
      success: false,
      dailiesReviewed: 0,
      insightsAdded: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run distillation for all users who have daily artifacts.
 * Note: Without pg, we can't easily query all unique userIds.
 * This would need a Convex query or be called per-user.
 */
export async function distillAllUsers(): Promise<{
  usersProcessed: number;
  totalInsights: number;
  errors: string[];
}> {
  console.warn('distillAllUsers: requires a Convex query to list all user IDs with daily artifacts. Not yet implemented.');
  return { usersProcessed: 0, totalInsights: 0, errors: [] };
}
