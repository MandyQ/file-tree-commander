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

  // Handle drop operations on target tree (for internal tree reordering)
  const handleDrop = useCallback((items: unknown[], target: any) => {
    console.log('=== handleDrop START ===');
    console.log('items:', items);
    console.log('target:', target);
    console.log('target type:', typeof target);

    setTargetData(prevData => {
      console.log('Inside setTargetData callback');
      let newData = { ...prevData };
      const currentTargetItems = flattenTree(prevData);

      // Extract target information from the tree library's drop event
      // The target object structure: { targetType, targetItem, parentItem, depth, index, ... }
      let targetParentId: string;
      let targetIndex: number | undefined;

      if (target.targetItem && typeof target.targetItem === 'object' && typeof target.targetItem.getId === 'function') {
        // target.targetItem is an ItemInstance
        const targetItem = target.targetItem;
        const targetItemData = targetItem.getItemData?.() || targetItems[targetItem.getId()];

        if (target.targetType === 'item' && targetItemData?.isFolder) {
          // Dropping onto a folder - add as child
          targetParentId = targetItem.getId();
          targetIndex = undefined; // Add to end
          console.log('Drop type: INTO folder', targetParentId);
        } else if (target.parentItem) {
          // Dropping between items - add to parent
          targetParentId = target.parentItem;
          targetIndex = target.index;
          console.log('Drop type: BETWEEN items, parent:', targetParentId, 'index:', targetIndex);
        } else {
          // Fallback to root
          targetParentId = 'target-root';
          targetIndex = target.index;
          console.log('Drop type: TO ROOT, index:', targetIndex);
        }
      } else {
        // Simple structure - use as is
        targetParentId = target.parentItem || 'target-root';
        targetIndex = target.index;
        console.log('Drop type: SIMPLE, parent:', targetParentId, 'index:', targetIndex);
      }

      // For each dragged item
      for (const item of items) {
        const itemId = (item as { getId?: () => string }).getId ? (item as { getId: () => string }).getId() : (item as string);
        console.log('Processing item:', itemId);

        // Single instance rule: Remove existing instance from target if it exists
        if (currentTargetItems[itemId]) {
          console.log('Removing existing instance of:', itemId);
          newData = removeNodeById(newData, itemId);
        }

        // Get the source node (either from source or target tree)
        const sourceNode = sourceItems[itemId] || currentTargetItems[itemId];
        console.log('Source node:', sourceNode);
        if (!sourceNode) {
          console.log('No source node found for:', itemId);
          continue;
        }

        // Clone the node to avoid mutations
        const nodeCopy = cloneNode(sourceNode);

        console.log('Inserting into parent:', targetParentId, 'at index:', targetIndex);

        // Insert into target tree
        newData = insertNode(newData, targetParentId, nodeCopy, targetIndex);
      }

      console.log('handleDrop result:', newData);
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
  }, []);



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
              <div>
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
      />
    </div>
  );
};