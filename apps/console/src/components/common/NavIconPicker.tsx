'use client';

import {
  type LucideIcon,
  Bell,
  Bookmark,
  BookOpen,
  BookText,
  Bot,
  Briefcase,
  Calendar,
  Code,
  Crown,
  FileText,
  Folder,
  FolderTree,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Image,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link as LinkIcon,
  Map,
  MessageCircle,
  Music,
  Package,
  Radio,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Icon registry                                                      */
/* ------------------------------------------------------------------ */

const ICON_MAP: Record<string, { label: string; Icon: LucideIcon }> = {
  home: { label: 'Home', Icon: Home },
  'book-open': { label: 'Book Open', Icon: BookOpen },
  radio: { label: 'Radio', Icon: Radio },
  layers: { label: 'Layers', Icon: Layers },
  zap: { label: 'Zap', Icon: Zap },
  'book-text': { label: 'Book Text', Icon: BookText },
  map: { label: 'Map', Icon: Map },
  package: { label: 'Package', Icon: Package },
  'folder-tree': { label: 'Folder Tree', Icon: FolderTree },
  bot: { label: 'Bot', Icon: Bot },
  sparkles: { label: 'Sparkles', Icon: Sparkles },
  'file-text': { label: 'File Text', Icon: FileText },
  briefcase: { label: 'Briefcase', Icon: Briefcase },
  'layout-grid': { label: 'Layout Grid', Icon: LayoutGrid },
  users: { label: 'Users', Icon: Users },
  video: { label: 'Video', Icon: Video },
  'graduation-cap': { label: 'Graduation Cap', Icon: GraduationCap },
  trophy: { label: 'Trophy', Icon: Trophy },
  heart: { label: 'Heart', Icon: Heart },
  star: { label: 'Star', Icon: Star },
  bell: { label: 'Bell', Icon: Bell },
  settings: { label: 'Settings', Icon: Settings },
  globe: { label: 'Globe', Icon: Globe },
  shield: { label: 'Shield', Icon: Shield },
  calendar: { label: 'Calendar', Icon: Calendar },
  code: { label: 'Code', Icon: Code },
  search: { label: 'Search', Icon: Search },
  image: { label: 'Image', Icon: Image },
  music: { label: 'Music', Icon: Music },
  link: { label: 'Link', Icon: LinkIcon },
  bookmark: { label: 'Bookmark', Icon: Bookmark },
  'layout-dashboard': { label: 'Layout Dashboard', Icon: LayoutDashboard },
  'message-circle': { label: 'Message Circle', Icon: MessageCircle },
  crown: { label: 'Crown', Icon: Crown },
  folder: { label: 'Folder', Icon: Folder },
};

const ICON_ENTRIES = Object.entries(ICON_MAP);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface NavIconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function NavIconPicker({ value, onChange }: NavIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = search.trim()
    ? ICON_ENTRIES.filter(([key, { label }]) => {
        const q = search.toLowerCase();
        return key.includes(q) || label.toLowerCase().includes(q);
      })
    : ICON_ENTRIES;

  const selectedEntry = value ? ICON_MAP[value] : null;

  return (
    <div ref={containerRef} className='relative'>
      {/* Trigger button */}
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='flex h-11 w-full items-center rounded-lg border border-border bg-surface px-4 text-sm text-textPrimary hover:bg-bgGray focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
      >
        {selectedEntry ? (
          <>
            <selectedEntry.Icon className='mr-2.5 h-4 w-4 text-textSecondary' />
            <span>{selectedEntry.label}</span>
          </>
        ) : (
          <span className='text-textSecondary'>Select an icon</span>
        )}
        {value && (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setOpen(false);
            }}
            className='ml-auto rounded p-0.5 text-textSecondary hover:text-error'
          >
            <X className='h-3.5 w-3.5' />
          </button>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className='absolute left-0 top-full z-50 mt-1 w-full min-w-[320px] rounded-lg border border-border bg-surface shadow-lg'>
          {/* Search */}
          <div className='border-b border-border p-2'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-textSecondary' />
              <input
                ref={searchInputRef}
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search icons...'
                className='h-9 w-full rounded-md border border-border bg-bgGray pl-9 pr-3 text-sm text-textPrimary placeholder-textSecondary focus:border-primarySolid focus:outline-none focus:ring-1 focus:ring-primarySolid'
              />
            </div>
          </div>

          {/* Icon grid */}
          <div className='max-h-[240px] overflow-y-auto p-2'>
            {filtered.length === 0 ? (
              <p className='px-2 py-4 text-center text-sm text-textSecondary'>
                No icons found
              </p>
            ) : (
              <div className='grid grid-cols-6 gap-1'>
                {filtered.map(([key, { label, Icon }]) => (
                  <button
                    key={key}
                    type='button'
                    title={label}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`flex h-10 w-full items-center justify-center rounded-md transition-colors ${
                      value === key
                        ? 'bg-primarySolid text-white'
                        : 'text-textPrimary hover:bg-bgGray'
                    }`}
                  >
                    <Icon className='h-4.5 w-4.5' />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
