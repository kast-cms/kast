'use client';

import { useTheme, type Theme } from '@/components/theme/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType, JSX } from 'react';

const OPTIONS: { value: Theme; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle(): JSX.Element {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme">
          {/*
            Both icons render; only one is visible per theme. Cross-fading with
            CSS avoids the hydration mismatch you get from branching on the
            resolved theme during the first client render. The per-theme
            transforms live in globals.css (`.theme-icon-*`).
          */}
          <Sun className="theme-icon theme-icon-sun" />
          <Moon className="theme-icon theme-icon-moon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        {OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon />
            {label}
            {theme === value && <Check className="ms-auto size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
