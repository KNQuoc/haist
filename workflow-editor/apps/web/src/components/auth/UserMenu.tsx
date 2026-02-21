'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { LogOut, User, GraduationCap, ChevronsUpDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

interface UserMenuProps {
  isCollapsed?: boolean;
}

export function UserMenu({ isCollapsed = false }: UserMenuProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  // Only render portal after mounting (client-side)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Calculate menu position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 160; // Approximate menu height
      const menuWidth = 224; // w-56 = 14rem = 224px

      // Position above the button, aligned to left edge
      let top = rect.top - menuHeight - 8;
      let left = rect.left;

      // If menu would go off the top, show below instead
      if (top < 8) {
        top = rect.bottom + 8;
      }

      // Ensure menu doesn't go off the right edge
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }

      // Ensure menu doesn't go off the left edge
      if (left < 8) {
        left = 8;
      }

      setMenuPosition({ top, left });
    }
  }, [isOpen]);

  if (!session) return null;

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/login';
        },
      },
    });
  };

  const handleRestartTutorial = () => {
    setIsOpen(false);
    try {
      localStorage.removeItem('blockd-tutorial-state');
    } catch (e) {
      console.warn('Failed to clear tutorial state:', e);
    }
    // Navigate to chat page and reload to trigger tutorial
    window.location.href = '/chat';
  };

  // Get initials from name
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed w-56 bg-card border border-border rounded-lg shadow-lg py-1 z-[9999] animate-scale-in"
      style={{
        top: menuPosition.top,
        left: menuPosition.left,
      }}
    >
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-medium text-foreground">{session.user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
      </div>
      <button
        onClick={handleRestartTutorial}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
      >
        <GraduationCap className="w-4 h-4" />
        Restart Tutorial
      </button>
      <button
        onClick={handleSignOut}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex-1 min-w-0',
          'inline-flex items-center relative shrink-0',
          'h-9 py-2 rounded-none',
          'whitespace-nowrap !scale-100',
          'flex-row !min-w-0 w-full',
          'group !-outline-offset-2',
          'transition-[gap] duration-150 ease-out',
          '!py-8 my-0',
          'hover:bg-muted/50 transition-colors',
          isCollapsed ? 'justify-center px-0' : 'justify-start px-2 gap-3'
        )}
        type="button"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="flex items-center justify-center rounded-full text-foreground border-[0.5px] border-transparent group-hover:border-border/50 transition group-hover:opacity-90">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-9 w-9 rounded-full shrink-0"
              />
            ) : (
              <div className="flex shrink-0 items-center justify-center rounded-full font-bold select-none h-9 w-9 text-[16px] bg-muted-foreground/20 text-foreground">
                {getInitials(session.user.name)}
              </div>
            )}
          </div>
        </div>

        {/* Name and Plan - Hidden when collapsed */}
        <div
          className={clsx(
            'flex flex-1 text-sm justify-between items-center font-medium min-w-0 overflow-hidden transition-opacity duration-150',
            isCollapsed ? 'opacity-0 hidden' : 'opacity-100'
          )}
        >
          <div className="flex flex-col items-start min-w-0 flex-1 pr-1">
            <span className="w-full text-start block truncate text-foreground">
              {session.user.name || session.user.email}
            </span>
            <span className="w-full truncate text-xs text-muted-foreground font-normal text-start">
              Free plan
            </span>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        </div>
      </button>

      {/* Render dropdown in portal to escape sidebar stacking context */}
      {isOpen && mounted && createPortal(menuContent, document.body)}
    </>
  );
}
