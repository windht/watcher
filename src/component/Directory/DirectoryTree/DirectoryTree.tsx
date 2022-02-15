import React, { useEffect, useRef } from "react";
import { Tree, NodeModel } from "@minoru/react-dnd-treeview";
import { CustomData } from "./type";
import { CustomNode } from "./CustomNode";
import { Placeholder } from "./Placeholder";
import { CustomDragPreview } from "./CustomDragPreview";
import { ROOT_ID } from "store/DirectoryStore";
import styles from "./styles.module.css";

type Props = {
  treeData: NodeModel<CustomData>[];
  setTreeData: (data: any) => void;
  expandAll: boolean;
};

export const DirectoryTree = ({ treeData, setTreeData, expandAll }: Props) => {
  const handleDrop = (newTree: NodeModel<CustomData>[]) => {
    setTreeData(newTree);
  };
  const ref = useRef<any>(null);
  useEffect(() => {
    if (expandAll) {
      ref.current.openAll();
    } else {
      ref.current.closeAll();
    }
  }, [expandAll]);

  return (
    <Tree
      classes={{
        root: styles.ul,
        container: styles.ul,
      }}
      ref={ref}
      tree={treeData}
      rootId={ROOT_ID}
      render={(node, { depth, isOpen, onToggle }) => (
        <CustomNode
          node={node}
          depth={depth}
          isOpen={isOpen}
          onToggle={onToggle}
        />
      )}
      dragPreviewRender={(monitorProps) => (
        <CustomDragPreview monitorProps={monitorProps} />
      )}
      onDrop={handleDrop}
      sort={false}
      insertDroppableFirst={false}
      canDrop={(tree, { dragSource, dropTargetId, dropTarget }) => {
        if (dragSource?.parent === dropTargetId) {
          return true;
        }
      }}
      dropTargetOffset={10}
      placeholderRender={(node, { depth }) => (
        <Placeholder node={node} depth={depth} />
      )}
    />
  );
};
