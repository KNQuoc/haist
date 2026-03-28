'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Maximize2,
  Minimize2,
  X,
  Zap,
  Mail,
  MessageSquare,
  Database,
  Globe,
  FileText,
  Github,
  Calendar,
  Search,
  Bot,
  Send,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { WorkflowDocument } from '@workflow-editor/core';
import type { ToolCallResult } from '@/lib/ai-assistant/types';

/* ────────────────────────────────────────
   Service color + icon mapping
   ──────────────────────────────────────── */

const SERVICE_THEME: Record<string, { bg: string; border: string; icon: string }> = {
  GMAIL:            { bg: 'bg-red-500/10',     border: 'border-red-400/30',    icon: '📧' },
  SLACK:            { bg: 'bg-purple-500/10',  border: 'border-purple-400/30', icon: '💬' },
  GITHUB:           { bg: 'bg-gray-500/10',    border: 'border-gray-400/30',   icon: '🐙' },
  NOTION:           { bg: 'bg-neutral-500/10', border: 'border-neutral-400/30',icon: '📝' },
  GOOGLECALENDAR:   { bg: 'bg-blue-500/10',    border: 'border-blue-400/30',   icon: '📅' },
  GOOGLEDRIVE:      { bg: 'bg-yellow-500/10',  border: 'border-yellow-400/30', icon: '📁' },
  GOOGLESHEETS:     { bg: 'bg-green-500/10',   border: 'border-green-400/30',  icon: '📊' },
  LINEAR:           { bg: 'bg-indigo-500/10',  border: 'border-indigo-400/30', icon: '🔷' },
  DISCORD:          { bg: 'bg-indigo-500/10',  border: 'border-indigo-400/30', icon: '🎮' },
  TWITTER:          { bg: 'bg-sky-500/10',     border: 'border-sky-400/30',    icon: '🐦' },
  LINKEDIN:         { bg: 'bg-blue-600/10',    border: 'border-blue-500/30',   icon: '💼' },
  REDDIT:           { bg: 'bg-orange-500/10',  border: 'border-orange-400/30', icon: '🔴' },
  FIRECRAWL:        { bg: 'bg-orange-500/10',  border: 'border-orange-400/30', icon: '🔥' },
  EXA:              { bg: 'bg-cyan-500/10',    border: 'border-cyan-400/30',   icon: '🔎' },
  OUTLOOK:          { bg: 'bg-blue-500/10',    border: 'border-blue-400/30',   icon: '📬' },
  JIRA:             { bg: 'bg-blue-600/10',    border: 'border-blue-500/30',   icon: '🎫' },
  ASANA:            { bg: 'bg-pink-500/10',    border: 'border-pink-400/30',   icon: '✅' },
  'ai-agent':       { bg: 'bg-violet-500/10',  border: 'border-violet-400/30', icon: '🤖' },
  'http':           { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30',icon: '🌐' },
  'postgresql':     { bg: 'bg-blue-500/10',    border: 'border-blue-400/30',   icon: '🗄️' },
  'resend':         { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-400/30',icon: '📨' },
  'web-search':     { bg: 'bg-teal-500/10',    border: 'border-teal-400/30',   icon: '🔍' },
  'web-scrape':     { bg: 'bg-teal-500/10',    border: 'border-teal-400/30',   icon: '🕷️' },
  'reddit-scrape':  { bg: 'bg-orange-500/10',  border: 'border-orange-400/30', icon: '🔴' },
};

const DEFAULT_THEME = { bg: 'bg-primary/10', border: 'border-primary/30', icon: '⚡' };

function getTheme(key: string) {
  const upper = key.toUpperCase();
  const lower = key.toLowerCase();
  return SERVICE_THEME[upper] || SERVICE_THEME[lower] || DEFAULT_THEME;
}

/* ────────────────────────────────────────
   Custom Nodes
   ──────────────────────────────────────── */

function TriggerStepNode({ data }: NodeProps<Node<StepNodeData>>) {
  return (
    <div className="af-node af-node--trigger">
      <div className="flex items-center gap-3">
        <div className="af-node-icon bg-amber-500/10">
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Trigger</div>
          <div className="text-xs text-muted-foreground truncate">{data.sublabel || 'User Request'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2 !border-0" />
    </div>
  );
}

function ServiceStepNode({ data }: NodeProps<Node<StepNodeData>>) {
  const theme = getTheme(data.toolkit || '');

  return (
    <div className={clsx('af-node', theme.border)}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-3">
        <div className={clsx('af-node-icon', theme.bg)}>
          <span className="text-base leading-none">{theme.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{data.label}</div>
          {data.sublabel && (
            <div className="text-xs text-muted-foreground truncate">{data.sublabel}</div>
          )}
        </div>
        {data.status && (
          <div className="flex-shrink-0">
            {data.status === 'success' && (
              <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
            )}
            {data.status === 'error' && (
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground ring-2 ring-muted-foreground/20" />
            )}
            {data.status === 'running' && (
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse ring-2 ring-primary/20" />
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2 !border-0" />
    </div>
  );
}

function OutputStepNode({ data }: NodeProps<Node<StepNodeData>>) {
  return (
    <div className="af-node af-node--output">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-3">
        <div className="af-node-icon bg-green-500/10">
          <Send className="w-4 h-4 text-green-500" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Output</div>
          <div className="text-xs text-muted-foreground truncate">{data.sublabel || 'Result'}</div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   Node data types
   ──────────────────────────────────────── */

interface StepNodeData {
  [key: string]: unknown;
  label: string;
  sublabel?: string;
  toolkit?: string;
  status?: 'success' | 'error' | 'running';
  icon?: string;
}

const nodeTypes = {
  triggerStep: TriggerStepNode,
  serviceStep: ServiceStepNode,
  outputStep: OutputStepNode,
};

/* ────────────────────────────────────────
   Data Converters
   ──────────────────────────────────────── */

function makeEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    animated: true,
    style: { stroke: 'hsl(245 58% 51% / 0.5)', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(245 58% 51% / 0.5)', width: 16, height: 16 },
  };
}

function toolCallsToGraph(toolCalls: ToolCallResult[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const centerX = 200;
  const spacing = 100;

  // Trigger
  nodes.push({
    id: 'trigger',
    type: 'triggerStep',
    position: { x: centerX, y: 0 },
    data: { label: 'Trigger', sublabel: 'User Request' },
  });

  // Tool call steps
  toolCalls.forEach((tc, i) => {
    const nodeId = `step-${i}`;
    nodes.push({
      id: nodeId,
      type: 'serviceStep',
      position: { x: centerX, y: (i + 1) * spacing },
      data: {
        label: formatToolName(tc.toolName),
        sublabel: formatServiceName(tc.toolkit),
        toolkit: tc.toolkit,
        status: tc.success ? 'success' : 'success',
      },
    });
    edges.push(makeEdge(`e-${i}`, i === 0 ? 'trigger' : `step-${i - 1}`, nodeId));
  });

  // Output
  const lastId = toolCalls.length > 0 ? `step-${toolCalls.length - 1}` : 'trigger';
  nodes.push({
    id: 'output',
    type: 'outputStep',
    position: { x: centerX, y: (toolCalls.length + 1) * spacing },
    data: { label: 'Output', sublabel: 'Complete' },
  });
  edges.push(makeEdge('e-output', lastId, 'output'));

  return { nodes, edges };
}

function workflowToGraph(workflow: WorkflowDocument): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const centerX = 200;
  const spacing = 100;

  // Trigger
  nodes.push({
    id: 'wf-trigger',
    type: 'triggerStep',
    position: { x: centerX, y: 0 },
    data: { label: 'Trigger', sublabel: workflow.trigger.type },
  });

  // Workflow nodes
  workflow.nodes.forEach((wfNode, i) => {
    const d = wfNode.data as Record<string, unknown>;
    const toolkit = (d.toolkit as string) || (d.bubbleName as string) || 'default';
    nodes.push({
      id: wfNode.id,
      type: 'serviceStep',
      position: wfNode.position?.x ? wfNode.position : { x: centerX, y: (i + 1) * spacing },
      data: {
        label: (d.label as string) || (d.bubbleName as string) || (d.toolName as string) || 'Step',
        sublabel: d.nodeType === 'composio' ? (d.toolkit as string) : (d.bubbleName as string),
        toolkit,
        status: 'success',
      },
    });
  });

  // Connect trigger to first node
  if (workflow.nodes.length > 0) {
    edges.push(makeEdge('wf-e-trigger', 'wf-trigger', workflow.nodes[0].id));
  }

  // Workflow edges
  workflow.edges.forEach((wfEdge) => {
    edges.push(makeEdge(wfEdge.id, wfEdge.source, wfEdge.target));
  });

  return { nodes, edges };
}

function formatToolName(name: string): string {
  const parts = name.split('_');
  const meaningful = parts.length > 1 ? parts.slice(1) : parts;
  return meaningful
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

function formatServiceName(toolkit: string): string | undefined {
  const map: Record<string, string> = {
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
    FIRECRAWL: 'Firecrawl',
    EXA: 'Exa',
  };
  const upper = toolkit.toUpperCase();
  // Hide internal/generic names
  if (upper === 'COMPOSIO' || upper === 'DEFAULT' || upper === 'INTERNAL') return undefined;
  return map[upper] || toolkit.charAt(0).toUpperCase() + toolkit.slice(1).toLowerCase();
}

/* ────────────────────────────────────────
   Main Component
   ──────────────────────────────────────── */

interface AutomationFlowVisualizerProps {
  workflow?: WorkflowDocument;
  toolCalls?: ToolCallResult[];
  className?: string;
  onClose?: () => void;
}

export function AutomationFlowVisualizer({
  workflow,
  toolCalls,
  className,
  onClose,
}: AutomationFlowVisualizerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { nodes, edges } = useMemo(() => {
    if (workflow) return workflowToGraph(workflow);
    if (toolCalls && toolCalls.length > 0) return toolCallsToGraph(toolCalls);
    return { nodes: [], edges: [] };
  }, [workflow, toolCalls]);

  if (nodes.length === 0) return null;

  const content = (
    <ReactFlowProvider>
      <div
        className={clsx(
          'af-container rounded-xl border border-border overflow-hidden bg-card/95 backdrop-blur-sm',
          isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'h-[360px]',
          className,
        )}
      >
        {/* Header */}
        <div className="af-header flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-card">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium text-foreground">Automation Flow</span>
            <span className="text-xs text-muted-foreground">
              {nodes.length - 1} step{nodes.length - 1 !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1" style={{ height: isFullscreen ? 'calc(100% - 44px)' : 'calc(100% - 44px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 1.2 }}
            nodesDraggable={isFullscreen}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} color="hsl(var(--border) / 0.5)" />
            {isFullscreen && <Controls showInteractive={false} />}
          </ReactFlow>
        </div>
      </div>
    </ReactFlowProvider>
  );

  if (isFullscreen) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        />
        {content}
      </>
    );
  }

  return content;
}
