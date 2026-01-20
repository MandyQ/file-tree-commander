import { useState } from 'react';
import type { ItemInstance } from '@headless-tree/core';
import { Folder, FolderOpen, File, ChevronRight, FileText, FileCode } from 'lucide-react';
import type { FileNode } from '../data/mockFileTree';
import { cn } from '../lib/utils';

interface FileTreeItemProps {
  item: ItemInstance<FileNode>;
  onDelete?: (itemId: string) => void;
  showDelete?: boolean;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, item: ItemInstance<FileNode>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, item: ItemInstance<FileNode>) => void;
  onRename?: (itemId: string, newName: string) => void;
  onSelect?: (itemId: string) => void;
  selectedItemId?: string | null;
  treeType?: 'source' | 'target';
  lastClickedTree?: 'source' | 'target' | null;
}

export const FileTreeItem = ({ item, onDelete, showDelete, onDragOver, onDrop, onRename, onSelect, selectedItemId, treeType, lastClickedTree }: FileTreeItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.getItemName());

  const isFolder = item.isFolder();
  const isExpanded = item.isExpanded();
  const isSelected = item.isSelected();
  const isFocused = item.isFocused();
  const level = item.getItemMeta().level;
  const itemName = item.getItemName();
  const isDragging = item.isDragging?.() || false;
  const isDragOver = item.isDragOver?.() || false;
  const canDrop = item.canDrop?.() || false;

  // Check if this item is selected across trees
  const isCrossTreeSelected = selectedItemId === item.getId();
  

  // Determine file icon based on extension
  const getFileIcon = () => {
    if (isFolder) {
      return isExpanded ? (
        <FolderOpen className="h-4 w-4 text-blue-500" />
      ) : (
        <Folder className="h-4 w-4 text-blue-400" />
      );
    }

    // Check file extensions for appropriate icons
    if (itemName.endsWith('.tsx') || itemName.endsWith('.ts') || itemName.endsWith('.js')) {
      return <FileCode className="h-4 w-4 text-amber-500" />;
    }
    if (itemName.endsWith('.md')) {
      return <FileText className="h-4 w-4 text-gray-500" />;
    }
    return <File className="h-4 w-4 text-gray-400" />;
  };

    const handleBlur = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== itemName && onRename) {
      onRename(item.getId(), editName.trim());
    } else {
      setEditName(itemName); // 恢复原名
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleBlur();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(itemName);
    }
  };


  const itemProps = item.getProps();
  const originalOnClick = itemProps.onClick;
  const originalOnDragOver = itemProps.onDragOver;
  const originalOnDrop = itemProps.onDrop;

  return (
    <div
      {...itemProps}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 rounded-md",
        "transition-all duration-150 ease-in-out",
        "hover:bg-accent/50 hover:shadow-sm",
        ((isSelected && lastClickedTree === treeType) || isCrossTreeSelected) && "bg-[#b6bec9] border border-[#b6bec9] shadow-sm",
        isFocused && "ring-2 ring-[#b6bec9]/50 ring-offset-1",
        !(isSelected && lastClickedTree === treeType) && !isFocused && !isCrossTreeSelected && "border border-transparent",
        isDragging && "opacity-40 cursor-grabbing",
        isDragOver && canDrop && "bg-blue-100 border-blue-400 border-2",
        isDragOver && !canDrop && "bg-red-50 border-red-400 border-2",
        // Cursor style based on tree type and drag state
        treeType === "target" ? (isDragging ? "cursor-grabbing" : "cursor-move") : "cursor-pointer"
      )}
      style={{ paddingLeft: `${level * 16 + 12}px` }}
      onDragOver={(e) => {
        // Try custom handler first
        if (onDragOver) {
          onDragOver(e, item);
        }
        // If event not handled, call tree's original handler
        if (!e.defaultPrevented && originalOnDragOver) {
          originalOnDragOver(e);
        }
      }}
      onDrop={(e) => {
        // Try custom handler first
        if (onDrop) {
          onDrop(e, item);
        }
        // If event not handled (preventDefault not called), call tree's original handler
        if (!e.defaultPrevented && originalOnDrop) {
          originalOnDrop(e);
        }
      }}
      onClick={(e) => {
        // Call the tree's original onClick handler first
        if (originalOnClick) {
          originalOnClick(e);
        }
        // Then call the select callback for cross-tree synchronization
        if (onSelect) {
          onSelect(item.getId());
        }
      }}
    >
      {/* Expand/Collapse Arrow */}
      {isFolder && (
        <button
          className={cn(
            "flex items-center justify-center p-0.5 rounded",
            "transition-transform duration-200",
            "hover:bg-accent/80",
            isExpanded && "rotate-90"
          )}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {/* File/Folder Icon */}
      <div className="flex items-center justify-center shrink-0">
        {getFileIcon()}
      </div>

      {/* Item Name */}
      {isEditing && onRename ? (
        <input
          value={editName}
          autoFocus
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm truncate border px-1 rounded focus:outline-none"
        />
      ) : (
        <span
          className={cn(
            "flex-1 text-sm truncate select-none",
            "transition-colors duration-150",
            ((isSelected && lastClickedTree === treeType) || isCrossTreeSelected)
              ? "font-semibold text-gray-800"
              : "text-foreground group-hover:text-foreground/90"
          )}
          onDoubleClick={() => onRename && setIsEditing(true)}
        >
          {itemName}
        </span>
      )}
     


      {/* Drag Indicator (shown on hover for source tree files) */}
      {!isFolder && !showDelete && (
        <div className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "text-xs text-muted-foreground"
        )}>
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </div>
      )}

      {/* Target tree controls: Drag handle + Delete button */}
      {showDelete && (
        <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Drag handle */}
          <div
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-move"
            title="Drag to reorder"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </div>

          {/* Delete button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.getId());
              }}
              className="p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700"
              aria-label="Delete"
              title="Delete"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};