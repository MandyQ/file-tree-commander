// src/components/TargetTree.tsx
import { useCallback } from 'react';
import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  dragAndDropFeature,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import type { FileNode } from '../data/mockFileTree';
import { FileTreeItem } from './FileTreeItem';

interface TargetTreeProps {
  targetData: FileNode;
  targetItems: Record<string, FileNode>;
  sourceItems: Record<string, FileNode>;
  draggedItem: string | null;
  setDraggedItem: (item: string | null) => void;
  setTargetData: React.Dispatch<React.SetStateAction<FileNode>>;
  cloneNode: (node: FileNode) => FileNode;
  removeNodeById: (tree: FileNode, nodeId: string) => FileNode;
  insertNode: (tree: FileNode, targetParentId: string, node: FileNode, index?: number) => FileNode;
  handleDrop: (items: unknown[], target: { parentItem?: string; index?: number }) => void;
  onDelete: (itemId: string) => void;
  onName: (itemId: string, newName: string) => void;
  onSelect: (itemId: string) => void;
  selectedItemId: string | null;
  lastClickedTree: 'source' | 'target' | null;
  expandedItems: string[];
  setExpandedItems: React.Dispatch<React.SetStateAction<string[]>>;
}

export const TargetTree = ({
  targetData,
  targetItems,
  sourceItems,
  draggedItem,
  setDraggedItem,
  setTargetData,
  cloneNode,
  removeNodeById,
  insertNode,
  handleDrop,
  onDelete,
  onName,
  onSelect,
  selectedItemId,
  lastClickedTree,
  expandedItems,
  setExpandedItems,
}: TargetTreeProps) => {
  console.log('TargetTree component rendered with targetData:', targetData);

  // Handler for dropping source items onto target items/folders
  const handleItemDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Always prevent default to allow drops
    e.preventDefault();

    if (draggedItem) {
      // Dragging from source tree
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    } else {
      // Internal drag within target tree
      e.dataTransfer.dropEffect = 'move';
    }
  }, [draggedItem]);

  const handleItemDrop = useCallback((e: React.DragEvent<HTMLDivElement>, targetItem: any) => {
    // Only intercept if dragging from source tree (draggedItem is set)
    if (!draggedItem) {
      // Let tree's internal drag-drop handle it - don't prevent default
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const itemId = e.dataTransfer.getData('text/plain');

    console.log('Dropping source item:', itemId, 'onto target item:', targetItem.getId());

    if (itemId && draggedItem) {
      // Get the source node
      const sourceNode = sourceItems[itemId];
      if (!sourceNode) return;

      // Get the drop target item data
      const targetItemData = targetItem.getItemData();
      const targetId = targetItem.getId();

      setTargetData(prevData => {
        // Remove if already exists (single instance rule)
        let newData = removeNodeById(prevData, itemId);

        // Clone the source node
        const nodeCopy = cloneNode(sourceNode);

        // If dropping on a folder, add as child; otherwise add as sibling
        if (targetItemData.isFolder) {
          console.log('Adding to folder:', targetId);
          newData = insertNode(newData, targetId, nodeCopy);
        } else {
          // Find parent and add as sibling
          const findParent = (tree: FileNode, childId: string): string | null => {
            if (tree.children) {
              for (const child of tree.children) {
                if (child.id === childId) return tree.id;
                const result = findParent(child, childId);
                if (result) return result;
              }
            }
            return null;
          };

          const parentId = findParent(newData, targetId);
          if (parentId) {
            console.log('Adding as sibling in parent:', parentId);
            newData = insertNode(newData, parentId, nodeCopy);
          }
        }

        return newData;
      });

      setDraggedItem(null);
    }
  }, [draggedItem, sourceItems, setTargetData, removeNodeById, cloneNode, insertNode, setDraggedItem]);

  // Target Tree (Editable)
  const targetTree = useTree<FileNode>({
    rootItemId: 'target-root',
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().isFolder,
    dataLoader: {
      getItem: (itemId) => {
        console.log('getItem called for:', itemId, 'result:', targetItems[itemId]);
        return targetItems[itemId];
      },
      getChildren: (itemId) => {
        const item = targetItems[itemId];
        const children = item?.children?.map(child => child.id) || [];
        console.log('getChildren called for:', itemId, 'children:', children);
        return children;
      },
    },
    indent: 20,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature
    ],
    // Use controlled expanded state to preserve folder open/close state
    state: {
      expandedItems,
    },
    setExpandedItems,
    // Enable reordering for internal drag and drop
    canReorder: true,
    // Increase the drop zone size at top/bottom of items (25% of item height each)
    // This makes it easier to drop items above or below folders instead of into them
    reorderAreaPercentage: 0.25,
    // Handle drops on target tree
    onDrop: (items, target) => {
      // Convert the newer API format to our expected format
      const convertedTarget: any = {
        parentItem: undefined,
        index: undefined,
        targetItem: undefined,
        targetType: undefined,
      };

      // The new API provides: item, childIndex, insertionIndex, dragLineIndex, dragLineLevel
      if ('item' in target) {
        const dropTarget = target as any;
        convertedTarget.targetItem = dropTarget.item;
        convertedTarget.index = dropTarget.insertionIndex;
        convertedTarget.childIndex = dropTarget.childIndex;

        // Determine if dropping into a folder or between items
        const targetItemData = dropTarget.item?.getItemData?.();
        const itemId = dropTarget.item?.getId();

        console.log('🎯 Drop target analysis:');
        console.log('  itemId:', itemId);
        console.log('  itemData:', targetItemData);
        console.log('  isFolder:', targetItemData?.isFolder);
        console.log('  childIndex:', dropTarget.childIndex);
        console.log('  insertionIndex:', dropTarget.insertionIndex);

        // If dropping on a folder item, drop INTO it
        if (targetItemData?.isFolder) {
          convertedTarget.targetType = 'item'; // Dropping into folder
          convertedTarget.parentItem = itemId;
          convertedTarget.index = dropTarget.childIndex; // Position within folder's children
          console.log('  ✅ Detected: Drop INTO folder');
        } else {
          // Dropping between items
          convertedTarget.targetType = 'between-items';
          // Find the parent of the target item
          if (itemId) {
            const findParent = (tree: FileNode, childId: string): string | null => {
              if (tree.children) {
                for (const child of tree.children) {
                  if (child.id === childId) return tree.id;
                  const result = findParent(child, childId);
                  if (result) return result;
                }
              }
              return null;
            };
            convertedTarget.parentItem = findParent(targetData, itemId) || 'target-root';
          }
          convertedTarget.index = dropTarget.insertionIndex;
          console.log('  ✅ Detected: Drop BETWEEN items');
        }
      }

      console.log('🔍 onDrop - converted target:', convertedTarget);
      handleDrop(items, convertedTarget);
    },
    // Allow all drops - into folders, between items, etc.
    canDrop: () => {
      return true;
    },
    canDrag: () => {
      return true;
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-t-xl border border-emerald-200 px-6 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500 shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div style={{'paddingLeft': 12}}>
              <h2 className="font-bold text-lg text-gray-800 mb-1">Target Structure</h2>
              <p className="text-xs text-gray-600">Drag files here to organize</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-b-xl border-x border-b border-gray-200 shadow-lg overflow-auto">
        {(() => {
          const containerProps = targetTree.getContainerProps();
          const originalOnDragOver = containerProps.onDragOver;
          const originalOnDrop = containerProps.onDrop;

          return (
            <div
              {...containerProps}
              className="tree p-4 space-y-1 min-h-[200px]"
              onDragOver={(e) => {
                // For internal drags, call tree's original handler
                if (!draggedItem && originalOnDragOver) {
                  originalOnDragOver(e);
                }

                // For cross-tree drags from source, allow the drop
                if (draggedItem) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDrop={(e) => {
                // For internal drags, let tree handle it
                if (!draggedItem && originalOnDrop) {
                  originalOnDrop(e);
                  return;
                }

                // Only intercept if dragging from source tree to empty space
                if (draggedItem) {
                  console.log('Container drop from source tree');
                  e.preventDefault();
                  e.stopPropagation();
                  const itemId = e.dataTransfer.getData('text/plain');

                  if (itemId) {
                    const sourceNode = sourceItems[itemId];
                    if (!sourceNode) return;

                    setTargetData(prevData => {
                      const newData = removeNodeById(prevData, itemId);
                      const nodeCopy = cloneNode(sourceNode);
                      return {
                        ...newData,
                        children: [...(newData.children || []), nodeCopy],
                      };
                    });

                    setDraggedItem(null);
                  }
                }
              }}
            >
          {(() => {
            const items = targetTree.getItems();
            // console.log('targetTree.getItems():', items);
            // console.log('items.length:', items.length);
            // console.log('targetData:', targetData);
            // console.log('targetData.children:', targetData.children);
            const hasItems = targetData.children && targetData.children.length > 0;
            // console.log('hasItems:', hasItems);

            // Force tree to use the latest data
            if (hasItems && items.length === 0) {
              console.warn('Tree has no items but data exists - forcing re-render');
            }

            return hasItems && items.length > 0 ? (
              items.map((item) => (
                <FileTreeItem
                  key={item.getId()}
                  item={item}
                  onDelete={onDelete}
                  showDelete={true}
                  onRename={onName}
                  onSelect={onSelect}
                  selectedItemId={selectedItemId}
                  treeType="target"
                  lastClickedTree={lastClickedTree}
                  onDragOver={draggedItem ? handleItemDragOver : undefined}
                  onDrop={draggedItem ? handleItemDrop : undefined}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center pointer-events-none">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">Drag files from the source tree to get started</p>
              </div>
            );
          })()}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
