import { useState, useCallback, useMemo } from 'react';
import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  dragAndDropFeature,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { mockSourceTree, mockTargetTree } from '../data/mockFileTree';
import type { FileNode } from '../data/mockFileTree';
import { FileTreeItem } from './FileTreeItem';
import { TargetTree } from './TargetTree';

export const FileTreeCommander = () => {
  const [sourceData] = useState(mockSourceTree);
  const [targetData, setTargetDataInternal] = useState(mockTargetTree);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [lastClickedTree, setLastClickedTree] = useState<'source' | 'target' | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [sourceExpandedItems, setSourceExpandedItems] = useState<string[]>([]);

  // Wrapper to increment version when target data changes
  const setTargetData = useCallback((update: React.SetStateAction<FileNode>) => {
    setTargetDataInternal(update);
    setDataVersion(v => v + 1);
  }, []);

  const flattenTree = useCallback((node: FileNode): Record<string, FileNode> => {
    const items: Record<string, FileNode> = {};

    const traverse = (n: FileNode) => {
      items[n.id] = n;
      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    traverse(node);
    return items;
  }, []);

  // Helper: Find all parent folder IDs for a given item
  const findParentFolders = useCallback((tree: FileNode, targetId: string): string[] => {
    const parents: string[] = [];

    const findPath = (node: FileNode, path: string[]): boolean => {
      if (node.id === targetId) {
        parents.push(...path);
        return true;
      }

      if (node.children) {
        const newPath = node.isFolder ? [...path, node.id] : path;
        for (const child of node.children) {
          if (findPath(child, newPath)) {
            return true;
          }
        }
      }

      return false;
    };

    findPath(tree, []);
    return parents;
  }, []);

  const sourceItems = useMemo(() => flattenTree(sourceData), [sourceData, flattenTree]);
  const targetItems = useMemo(() => {
    const items = flattenTree(targetData);
    console.log('targetItems recalculated:', items);
    return items;
  }, [targetData, flattenTree]);

  // Helper: Deep clone a file node
  const cloneNode = (node: FileNode): FileNode => {
    return {
      ...node,
      children: node.children ? node.children.map(cloneNode) : undefined,
    };
  };

  // Helper: Find and remove a node by ID from tree
  const removeNodeById = (tree: FileNode, nodeId: string): FileNode => {
    if (tree.children) {
      return {
        ...tree,
        children: tree.children
          .filter(child => child.id !== nodeId)
          .map(child => removeNodeById(child, nodeId)),
      };
    }
    return tree;
  };

  // Delete handler for target tree items
  const handleDelete = useCallback((itemId: string) => {
    setTargetData(prevData => removeNodeById(prevData, itemId));
  }, [setTargetData]);

  // Helper: Insert node at a specific position
  const insertNode = (
    tree: FileNode,
    targetParentId: string,
    node: FileNode,
    index?: number
  ): FileNode => {
    if (tree.id === targetParentId) {
      const newChildren = [...(tree.children || [])];
      if (index !== undefined) {
        newChildren.splice(index, 0, node);
      } else {
        newChildren.push(node);
      }
      return { ...tree, children: newChildren };
    }

    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => insertNode(child, targetParentId, node, index)),
      };
    }

    return tree;
  };

  // Handle drop operations on target tree (for both internal reordering and external drops)
  const handleDrop = useCallback((items: unknown[], target: any) => {
    console.log('=== handleDrop START ===');
    console.log('Full target object:', JSON.stringify(target, null, 2));
    console.log('items:', items);

    setTargetData(prevData => {
      let newData = { ...prevData };
      const currentTargetItems = flattenTree(prevData);

      // Extract target information from the tree library's drop event
      let targetParentId: string;
      let targetIndex: number | undefined;

      if (target.targetItem && typeof target.targetItem === 'object' && typeof target.targetItem.getId === 'function') {
        // target.targetItem is an ItemInstance
        const targetItem = target.targetItem;
        const targetItemId = targetItem.getId();
        const targetItemData = targetItem.getItemData?.() || targetItems[targetItemId] || currentTargetItems[targetItemId];

        // console.log('Target item ID:', targetItemId);
        // console.log('Target item data:', targetItemData);
        // console.log('Target type:', target.targetType);
        // console.log('Is folder:', targetItemData?.isFolder);
        // console.log('Parent item:', target.parentItem);
        // console.log('Depth:', target.depth);

        // Check if dropping onto a folder
        // Strategy: If the target item is a folder, always treat it as dropping INTO the folder
        // unless we have explicit evidence it's a between-items drop
        const isExplicitlyBetweenItems = target.targetType === 'between-items';
        const isDropIntoFolder = targetItemData?.isFolder && !isExplicitlyBetweenItems;

        if (isDropIntoFolder) {
          // Dropping INTO a folder - add as child at the end
          targetParentId = targetItemId;
          targetIndex = undefined;
          console.log('Drop INTO folder:', targetParentId);
        } else if (target.parentItem) {
          // Dropping between items - use parent and index
          targetParentId = target.parentItem;
          targetIndex = target.index;
          // console.log('Drop BETWEEN items, parent:', targetParentId, 'index:', targetIndex);
        } else {
          // Fallback to root
          targetParentId = 'target-root';
          targetIndex = target.index;
          // console.log('Drop at ROOT, index:', targetIndex);
        }
      } else {
        // Simple structure
        targetParentId = target.parentItem || 'target-root';
        targetIndex = target.index;
        // console.log('Drop SIMPLE, parent:', targetParentId, 'index:', targetIndex);
      }

      // Process each dragged item
      for (const item of items) {
        const itemId = (item as { getId?: () => string }).getId ? (item as { getId: () => string }).getId() : (item as string);
        const isFromTarget = !!currentTargetItems[itemId];
        console.log(`Processing ${isFromTarget ? 'internal' : 'external'} item:`, itemId);

        // Get the source node BEFORE removing it
        // Priority: Use target tree version if it exists (preserves renames), otherwise use source tree
        const sourceNode = currentTargetItems[itemId] || sourceItems[itemId];
        if (!sourceNode) {
          console.log('No source node found for:', itemId);
          continue;
        }

        // Clone the node to avoid mutations (this preserves any renames or modifications)
        const nodeCopy = cloneNode(sourceNode);

        // Remove existing instance from target if it exists (for both internal moves and duplicate prevention)
        if (currentTargetItems[itemId]) {
          newData = removeNodeById(newData, itemId);
        }

        // Insert into target tree at the specified location
        newData = insertNode(newData, targetParentId, nodeCopy, targetIndex);
        console.log('Inserted into parent:', targetParentId, 'at index:', targetIndex);
      }

      console.log('=== handleDrop END ===');
      return newData;
    });
  }, [sourceItems, targetItems, flattenTree, setTargetData, removeNodeById, cloneNode, insertNode]);

  // Source Tree (Read-only)
  const sourceTree = useTree<FileNode>({
    rootItemId: 'root',
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().isFolder,
    dataLoader: {
      getItem: (itemId) => sourceItems[itemId],
      getChildren: (itemId) => {
        const item = sourceItems[itemId];
        return item?.children?.map(child => child.id) || [];
      },
    },
    indent: 20,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      dragAndDropFeature
    ],
    // Use controlled expanded state to programmatically expand folders
    state: {
      expandedItems: sourceExpandedItems,
    },
    setExpandedItems: setSourceExpandedItems,
    // Allow dragging from source (to copy to target)
    canDrag: () => true,
    // Prevent dropping on source (read-only)
    canDrop: () => false,
  });

  // Helper: Update a node's name by ID
  const renameNodeById = (tree: FileNode, nodeId: string, newName: string): FileNode => {
    if (tree.id === nodeId) {
      return { ...tree, name: newName };
    }
    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => renameNodeById(child, nodeId, newName)),
      };
    }
    return tree;
  };

  const handleRename = useCallback((itemId: string, newName: string) => {
    setTargetData(prevData => renameNodeById(prevData, itemId, newName));
  }, [setTargetData]);

  // Selection sync handler - when source item is selected
  const handleSourceSelection = useCallback((itemId: string) => {
    console.log('Source item selected:', itemId);
    setSelectedItemId(itemId);
    setLastClickedTree('source');
  }, []);

  // Selection sync handler - when target item is selected
  const handleTargetSelection = useCallback((itemId: string) => {
    console.log('Target item selected:', itemId);
    setSelectedItemId(itemId);
    setLastClickedTree('target');

    // If this item exists in source tree, expand all its parent folders in source
    if (sourceItems[itemId]) {
      const parentFolders = findParentFolders(sourceData, itemId);
      console.log('Expanding parent folders in source:', parentFolders);

      // Add parent folders to source expanded items (keep existing expanded items too)
      setSourceExpandedItems(prev => {
        const newExpanded = new Set([...prev, ...parentFolders]);
        return Array.from(newExpanded);
      });
    }
  }, [sourceItems, sourceData, findParentFolders]);



  return (
    <div className="grid grid-cols-2 gap-8 h-full">
      {/* Source Tree (Read-only) */}
      <div className="flex flex-col h-full">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-t-xl border border-blue-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div style={{'paddingLeft': 12}}>
                <h2 className="font-bold text-lg text-gray-800">Source Files</h2>
                <p className="text-xs text-gray-600">Read-only repository</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-b-xl border-x border-b border-gray-200 shadow-lg overflow-auto">
          <div {...sourceTree.getContainerProps()} className="tree p-4 space-y-1">
            {sourceTree.getItems().map((item) => (
              <div
                key={item.getId()}
                draggable
                className={`cursor-grab active:cursor-grabbing ${
                  draggedItem === item.getId() ? 'opacity-50' : ''
                }`}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('text/plain', item.getId());
                  setDraggedItem(item.getId());
                }}
                onDragEnd={() => setDraggedItem(null)}
              >
                <FileTreeItem
                  item={item}
                  onSelect={handleSourceSelection}
                  selectedItemId={selectedItemId}
                  treeType="source"
                  lastClickedTree={lastClickedTree}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <TargetTree
        key={`target-tree-${dataVersion}`}
        targetData={targetData}
        targetItems={targetItems}
        sourceItems={sourceItems}
        draggedItem={draggedItem}
        setDraggedItem={setDraggedItem}
        setTargetData={setTargetData}
        cloneNode={cloneNode}
        removeNodeById={removeNodeById}
        insertNode={insertNode}
        handleDrop={handleDrop}
        onDelete={handleDelete}
        onName={handleRename}
        onSelect={handleTargetSelection}
        selectedItemId={selectedItemId}
        lastClickedTree={lastClickedTree}
        expandedItems={expandedItems}
        setExpandedItems={setExpandedItems}
      />
    </div>
  );
};