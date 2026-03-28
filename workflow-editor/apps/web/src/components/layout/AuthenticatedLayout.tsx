'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from '@/components/notifications';
import { NotificationSidebar } from '@/components/notifications';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AuthenticatedLayout({ children, title }: AuthenticatedLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-[40%] -left-[20%] w-[60%] h-[60%] rounded-full opacity-[0.03] blur-[120px]"
          style={{ background: 'hsl(var(--primary))' }}
        />
        <div
          className="absolute -bottom-[30%] -right-[15%] w-[50%] h-[50%] rounded-full opacity-[0.02] blur-[100px]"
          style={{ background: 'hsl(var(--primary))' }}
        />
      </div>

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col min-w-0 relative z-[1]">
        {/* Top Bar */}
        <header className="h-12 border-b border-border/60 bg-card/60 backdrop-blur-xl flex items-center px-6 shrink-0 gap-3">
          {title && (
            <h1 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
              {title}
            </h1>
          )}
          <div className="ml-auto">
            <NotificationBell
              isOpen={isNotificationsOpen}
              onToggle={() => setIsNotificationsOpen(!isNotificationsOpen)}
            />
          </div>
        </header>
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <NotificationSidebar
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
}
