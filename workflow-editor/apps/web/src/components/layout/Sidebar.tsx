"use client";

import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  Archive,
  Zap,
  Plus,
  ExternalLink,
  PanelLeft,
} from "lucide-react";
import { clsx } from "clsx";
import { DEV_USER } from "@/lib/dev-user";
import { SidebarConversations } from "./SidebarConversations";
import { useConversationStore } from "@/lib/ai-assistant/conversation-store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/automations",
    label: "Automations",
    icon: Zap,
  },
  {
    href: "/chat",
    label: "Chats",
    icon: MessageSquare,
  },
  {
    href: "/artifacts",
    label: "Artifacts",
    icon: Archive,
  },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const clearActiveConversation = useConversationStore(
    (state) => state.clearActiveConversation
  );

  // Tutorial refs for nav items
  const automationsNavRef = useRef<HTMLDivElement>(null);
  const artifactsNavRef = useRef<HTMLDivElement>(null);

  // Tutorial context - safely handle when not in TutorialProvider
  const [tutorialContext, setTutorialContext] = useState<{
    isActive: boolean;
    currentStep: number;
    nextStep: () => void;
  } | null>(null);

  // Try to get tutorial context on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("haist-tutorial-state");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isActive) {
          setTutorialContext({
            isActive: parsed.isActive,
            currentStep: parsed.currentStep,
            nextStep: () => {
              const updated = { ...parsed, currentStep: parsed.currentStep + 1 };
              localStorage.setItem("haist-tutorial-state", JSON.stringify(updated));
              setTutorialContext(prev => prev ? { ...prev, currentStep: updated.currentStep } : null);
            },
          });
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }, []);

  // Listen for storage changes
  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem("haist-tutorial-state");
        if (stored) {
          const parsed = JSON.parse(stored);
          setTutorialContext(prev => {
            if (!parsed.isActive) return null;
            return {
              isActive: parsed.isActive,
              currentStep: parsed.currentStep,
              nextStep: () => {
                const updated = { ...parsed, currentStep: parsed.currentStep + 1 };
                localStorage.setItem("haist-tutorial-state", JSON.stringify(updated));
                setTutorialContext(p => p ? { ...p, currentStep: updated.currentStep } : null);
              },
            };
          });
        }
      } catch (e) {
        // Ignore errors
      }
    };

    window.addEventListener("storage", handleStorage);
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Handle nav click for tutorial advancement
  const handleNavClick = (href: string) => {
    if (tutorialContext?.isActive) {
      if (tutorialContext.currentStep === 4 && href === "/automations") {
        tutorialContext.nextStep();
      }
      if (tutorialContext.currentStep === 6 && href === "/artifacts") {
        tutorialContext.nextStep();
      }
    }
  };

  return (
    <aside
      className={clsx(
        "h-screen bg-card/70 backdrop-blur-xl border-r border-border/50 flex flex-col shrink-0 transition-[width] duration-200 ease-out relative",
        isCollapsed ? "w-[3.25rem]" : "w-60"
      )}
    >
      {/* Subtle inner glow at top */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />

      {/* Header with Logo */}
      <div className="relative flex w-full items-center p-2 pt-3">
        <div
          className={clsx(
            "flex items-center gap-2 pl-2 h-8 overflow-hidden transition-opacity duration-200",
            isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <Link
            href="/automations"
            onClick={() => clearActiveConversation()}
            className="flex flex-row items-center gap-2.5 group"
            aria-label="Home"
          >
            <Image
              src="/haist-logo.png"
              alt="haist"
              width={24}
              height={24}
              className="h-6 w-6 flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-sm font-semibold text-foreground tracking-tight font-display">
              haist
            </span>
          </Link>
        </div>
        <div className={clsx("absolute top-3 flex items-center gap-1", isCollapsed ? "left-1/2 -translate-x-1/2" : "right-2")}>
          <button
            onClick={onToggleCollapse}
            className={clsx(
              "inline-flex items-center justify-center",
              "h-7 w-7 rounded-lg",
              "active:scale-90 transition-all duration-200 group",
              "hover:bg-foreground/[0.06]"
            )}
            type="button"
            aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
          >
            <PanelLeft className="w-4 h-4 transition text-muted-foreground group-hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="flex flex-col gap-px pt-3 relative z-[1]">
        <div className="px-2">
          <Link
            href="/chat"
            onClick={() => clearActiveConversation()}
            className={clsx(
              "sidebar-nav-item group",
              "h-8 w-full rounded-lg py-1.5",
              isCollapsed ? "px-0 justify-center" : "px-3",
              "active:bg-muted active:scale-[0.98]"
            )}
          >
            <div
              className={clsx(
                "w-full flex flex-row items-center gap-2.5",
                isCollapsed ? "justify-center" : "justify-start"
              )}
            >
              <div className="flex items-center justify-center text-foreground">
                <div className="flex items-center justify-center rounded-full transition-all duration-200 ease-out group-hover:rotate-90 group-active:scale-90">
                  <div className="flex items-center justify-center rounded-full size-5 bg-primary/15 group-hover:bg-primary/25">
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
              </div>
              <span
                className={clsx(
                  "truncate text-sm whitespace-nowrap flex-1 text-muted-foreground group-hover:text-foreground transition-all duration-200",
                  isCollapsed ? "opacity-0 hidden" : "opacity-100"
                )}
              >
                New chat
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-grow flex-col overflow-y-auto overflow-x-hidden relative transition-[border-color] border-t border-border/30 mt-3">
        <nav className="flex flex-col px-2 gap-0.5 pt-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const isChat = item.href === "/chat";
            const isAutomations = item.href === "/automations";
            const isArtifacts = item.href === "/artifacts";

            const isTutorialHighlight =
              tutorialContext?.isActive &&
              ((tutorialContext.currentStep === 4 && isAutomations) ||
                (tutorialContext.currentStep === 6 && isArtifacts));

            return (
              <div
                key={item.href}
                className="relative group"
                ref={isAutomations ? automationsNavRef : isArtifacts ? artifactsNavRef : undefined}
              >
                <Link
                  href={item.href}
                  onClick={() => {
                    if (isChat) clearActiveConversation();
                    handleNavClick(item.href);
                  }}
                  className={clsx(
                    "sidebar-nav-item",
                    "h-8 w-full rounded-lg py-1.5",
                    isCollapsed ? "px-0 justify-center" : "px-3",
                    "active:bg-muted active:scale-[0.98]",
                    isActive && "!bg-primary/[0.08] !text-foreground",
                    isTutorialHighlight && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                >
                  <div
                    className={clsx(
                      "w-full flex flex-row items-center gap-2.5",
                      isCollapsed ? "justify-center" : "justify-start"
                    )}
                  >
                    <div className="flex items-center justify-center">
                      <Icon
                        className={clsx(
                          "w-4 h-4 transition-colors duration-200",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                    </div>
                    <span
                      className={clsx(
                        "truncate text-sm whitespace-nowrap flex-1 transition-all duration-200",
                        isActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground group-hover:text-foreground",
                        isCollapsed ? "opacity-0 hidden" : "opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                    {item.external && !isCollapsed && (
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
                    )}
                  </div>
                </Link>

                {/* Active indicator line */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Conversations List */}
        {!isCollapsed && <SidebarConversations />}
      </div>

      {/* Footer - Dev User */}
      <div className="flex items-center gap-2.5 border-t border-border/30 px-3 py-3 relative z-[1]">
        <div className="flex shrink-0 items-center justify-center rounded-full font-medium select-none h-7 w-7 text-xs bg-primary/10 text-primary ring-1 ring-primary/20">
          {DEV_USER.name.charAt(0).toUpperCase()}
        </div>
        {!isCollapsed && (
          <span className="text-sm text-muted-foreground truncate">{DEV_USER.name}</span>
        )}
      </div>

      {/* Tutorial Step 4: Navigate to Automations */}
      {tutorialContext?.isActive && tutorialContext.currentStep === 4 && (
        <SidebarTutorialTooltip
          targetRef={automationsNavRef}
          title="Explore Automations"
          message="Click here to see how you can create automation rules for your connected services."
          currentStep={4}
          totalSteps={8}
        />
      )}

      {/* Tutorial Step 6: Navigate to Artifacts */}
      {tutorialContext?.isActive && tutorialContext.currentStep === 6 && (
        <SidebarTutorialTooltip
          targetRef={artifactsNavRef}
          title="View Your Artifacts"
          message="Click here to see your artifacts library where workflow outputs are stored."
          currentStep={6}
          totalSteps={8}
        />
      )}
    </aside>
  );
}

// Custom tutorial tooltip for sidebar
function SidebarTutorialTooltip({
  targetRef,
  title,
  message,
  currentStep,
  totalSteps,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  message: string;
  currentStep: number;
  totalSteps: number;
}) {
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (!targetRef.current) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      if (targetRef.current) {
        setRect(targetRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    const resizeObserver = new ResizeObserver(updateRect);
    if (targetRef.current) {
      resizeObserver.observe(targetRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
      resizeObserver.disconnect();
    };
  }, [targetRef]);

  if (!rect) return null;

  const tooltipGap = 12;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed left-0 right-0 top-0 bg-black/60 z-[50] animate-fade-in"
        style={{ height: Math.max(0, rect.top - 4) }}
      />
      <div
        className="fixed left-0 right-0 bottom-0 bg-black/60 z-[50] animate-fade-in"
        style={{ top: rect.bottom + 4 }}
      />
      <div
        className="fixed left-0 bg-black/60 z-[50] animate-fade-in"
        style={{
          top: rect.top - 4,
          width: Math.max(0, rect.left - 4),
          height: rect.height + 8,
        }}
      />
      <div
        className="fixed right-0 bg-black/60 z-[50] animate-fade-in"
        style={{
          top: rect.top - 4,
          left: rect.right + 4,
          height: rect.height + 8,
        }}
      />

      {/* Highlight border */}
      <div
        className="fixed border border-primary/50 animate-pulse-glow pointer-events-none z-[51]"
        style={{
          left: rect.left - 4,
          top: rect.top - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: 10,
          boxShadow: "0 0 20px hsl(var(--primary) / 0.2)",
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[60] w-72 animate-tutorial-tooltip-in"
        style={{
          top: rect.top + rect.height / 2,
          left: rect.right + tooltipGap,
          transform: "translateY(-50%)",
        }}
      >
        <div className="relative glass border border-border/60 rounded-xl shadow-2xl overflow-hidden">
          <div className="tutorial-arrow-left" />
          <div className="p-4">
            <h4 className="font-semibold text-foreground mb-1 text-sm">{title}</h4>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{message}</p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={clsx(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i + 1 === currentStep
                      ? "bg-primary"
                      : i + 1 < currentStep
                        ? "bg-primary/40"
                        : "bg-border"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
