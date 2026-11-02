"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge, Button, cn, useToast } from "@open-mtlms/core";
import type { SidebarNavItem } from "@open-mtlms/shared";
import {
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
  Home,
  Users,
  Briefcase,
  GraduationCap,
  Video,
  BookOpen,
  Radio,
  Layers,
  Sparkles,
  Map,
  Crown,
  MessageCircle,
  Code,
  FileText,
  Search,
  Bot,
  Trophy,
  Zap,
  Package,
  Folder,
  Globe,
  Heart,
  Star,
  Bell,
  Calendar,
  Settings,
  Link,
  Image,
  Music,
  Shield,
  Bookmark,
  LayoutDashboard,
  BookText,
  FolderTree,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useAvailableRoutesQuery, useSidebarConfig, useUpdateNavItem, useAddCustomLink, useDeleteCustomLink, useReorderNavItems } from "@/lib/hooks";
import { useTenantStore } from "@/lib/stores/tenant-store";

import { AddCustomLinkDialog } from "./AddCustomLinkDialog";
import { SidebarItemEditor } from "./SidebarItemEditor";

/* ------------------------------------------------------------------ */
/*  Icon lookup                                                        */
/* ------------------------------------------------------------------ */

const iconComponents: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  community: Users,
  briefcase: Briefcase,
  "graduation-cap": GraduationCap,
  video: Video,
  "book-open": BookOpen,
  radio: Radio,
  layers: Layers,
  sparkles: Sparkles,
  map: Map,
  crown: Crown,
  "message-circle": MessageCircle,
  code: Code,
  "file-text": FileText,
  search: Search,
  bot: Bot,
  trophy: Trophy,
  zap: Zap,
  package: Package,
  folder: Folder,
  globe: Globe,
  heart: Heart,
  star: Star,
  bell: Bell,
  calendar: Calendar,
  settings: Settings,
  link: Link,
  image: Image,
  music: Music,
  shield: Shield,
  bookmark: Bookmark,
  "layout-dashboard": LayoutDashboard,
  "book-text": BookText,
  "folder-tree": FolderTree,
};

/* ------------------------------------------------------------------ */
/*  Type badge styles                                                  */
/* ------------------------------------------------------------------ */

const TYPE_BADGE_STYLES: Record<string, string> = {
  system: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  entitlement: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  custom: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const TYPE_DISPLAY_LABELS: Record<string, string> = {
  system: "System",
  entitlement: "Feature",
  custom: "Custom",
};

/* ------------------------------------------------------------------ */
/*  Sortable item component                                            */
/* ------------------------------------------------------------------ */

interface SortableNavItemProps {
  item: SidebarNavItem & { featureAvailable?: boolean };
  onEdit: (item: SidebarNavItem) => void;
  onToggleVisibility: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableNavItem({ item, onEdit, onToggleVisibility, onDelete }: SortableNavItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = item.icon ? iconComponents[item.icon] : null;
  const isVisible = item.visible !== false;
  const isUnavailable = item.itemType === "entitlement" && item.featureAvailable === false;
  const isCustom = item.itemType === "custom";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow",
        isDragging && "shadow-lg z-50",
        isUnavailable && "opacity-60",
        !isVisible && "opacity-50"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="text-muted-foreground cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Icon */}
      {Icon && <Icon className="text-muted-foreground h-4 w-4 shrink-0" />}

      {/* Label and link */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.label}</span>
          {item.itemType && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                TYPE_BADGE_STYLES[item.itemType] ?? "bg-muted"
              )}
            >
              {TYPE_DISPLAY_LABELS[item.itemType] ?? "System"}
            </span>
          )}
          {isUnavailable && (
            <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Not in plan
            </span>
          )}
          {item.badge && (
            <Badge variant="secondary" className="text-[10px]">
              {item.badge.text}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground truncate text-xs">{item.href}</p>
      </div>

      {/* Status + Actions */}
      <div className="flex items-center gap-2">
        {/* Active/Hidden status badge */}
        <button
          type="button"
          onClick={() => onToggleVisibility(item.id)}
          title={isVisible ? "Click to hide from sidebar" : "Click to show in sidebar"}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
            isVisible
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          )}
        >
          {isVisible ? (
            <><Eye className="h-3 w-3" /> Active</>
          ) : (
            <><EyeOff className="h-3 w-3" /> Hidden</>
          )}
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(item)}
          title="Edit item"
        >
          <Pencil className="h-4 w-4" />
        </Button>

        {isCustom && (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive h-8 w-8"
            onClick={() => onDelete(item.id)}
            title="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main manager component                                             */
/* ------------------------------------------------------------------ */

export function SidebarNavManager() {
  const tenantId = useTenantStore((s) => s.selectedTenantId);
  const { data, isLoading } = useSidebarConfig(tenantId ?? undefined);
  const { data: availableRoutes } = useAvailableRoutesQuery(tenantId ?? undefined);
  const updateNavItemMutation = useUpdateNavItem(tenantId ?? undefined);
  const addCustomLinkMutation = useAddCustomLink(tenantId ?? undefined);
  const deleteCustomLinkMutation = useDeleteCustomLink(tenantId ?? undefined);
  const reorderMutation = useReorderNavItems(tenantId ?? undefined);
  const { toast } = useToast();

  const [items, setItems] = useState<(SidebarNavItem & { featureAvailable?: boolean })[]>([]);
  const [editingItem, setEditingItem] = useState<SidebarNavItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Sync from server data
  useEffect(() => {
    if (data?.items) {
      setItems(data.items);
    }
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const newItems = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate(newItems.map((i) => i.id), {
        onError: (error: Error) => {
          toast({ title: "Update failed", description: error.message || "Please try again.", variant: "destructive" });
        },
      });
      return newItems;
    });
  }, [reorderMutation, toast]);

  const handleToggleVisibility = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;
      const newVisible = target.visible === false ? true : false;
      updateNavItemMutation.mutate({ id, data: { visible: newVisible } }, {
        onError: (error: Error) => {
          toast({ title: "Update failed", description: error.message || "Please try again.", variant: "destructive" });
        },
      });
      return prev.map((item) =>
        item.id === id ? { ...item, visible: newVisible } : item
      );
    });
  }, [updateNavItemMutation, toast]);

  const handleEdit = useCallback((item: SidebarNavItem) => {
    setEditingItem(item);
  }, []);

  const handleEditSave = useCallback((updated: SidebarNavItem) => {
    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    setEditingItem(null);
    const { label, icon, badge, isExternal } = updated;
    updateNavItemMutation.mutate({ id: updated.id, data: { label, icon, badge, isExternal } }, {
      onError: (error: Error) => {
        toast({ title: "Update failed", description: error.message || "Please try again.", variant: "destructive" });
      },
    });
  }, [updateNavItemMutation, toast]);

  const handleDelete = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    deleteCustomLinkMutation.mutate(id, {
      onError: (error: Error) => {
        toast({ title: "Update failed", description: error.message || "Please try again.", variant: "destructive" });
      },
    });
  }, [deleteCustomLinkMutation, toast]);

  const handleAddCustom = useCallback((data: { label: string; href: string; icon?: string; isExternal?: boolean }) => {
    addCustomLinkMutation.mutate(data, {
      onError: (error: Error) => {
        toast({ title: "Update failed", description: error.message || "Please try again.", variant: "destructive" });
      },
    });
  }, [addCustomLinkMutation, toast]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Link
        </Button>
      </div>

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {items.map((item) => (
              <SortableNavItem
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onToggleVisibility={handleToggleVisibility}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && !isLoading && (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          No navigation items configured. Items will be auto-populated based on
          your enabled features.
        </div>
      )}

      {/* Edit dialog */}
      {editingItem && (
        <SidebarItemEditor
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => { if (!open) setEditingItem(null); }}
          onSave={handleEditSave}
        />
      )}

      {/* Add custom link dialog */}
      <AddCustomLinkDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddCustom}
        availableRoutes={availableRoutes}
      />
    </div>
  );
}
