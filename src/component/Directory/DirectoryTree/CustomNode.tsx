import React, { useMemo } from "react";
import { NodeModel } from "@minoru/react-dnd-treeview";
import { CustomData } from "./type";
import { useStore } from "store/RootStore";
import { RequestNode } from "./RequestNode";
import { Box } from "@chakra-ui/react";
import { observer } from "mobx-react";
import { FolderNode } from "./FolderNode";
import { useTabUtil } from "hooks/tab";

type Props = {
  node: NodeModel<CustomData>;
  depth: number;
  isOpen: boolean;
  onToggle: (id: NodeModel["id"]) => void;
};

export const CustomNode: React.FC<Props> = observer((props) => {
  const indent = props.depth * 24;
  const { directoryStore } = useStore();
  const { addAndSelectRequest } = useTabUtil();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onToggle(props.node.id);
  };

  const handleClick = () => {
    if (props.node.data?.type === "request") {
      directoryStore.selectRequest(props.node.data?.requestId);
      if (props.node.data?.requestId) {
        addAndSelectRequest(
          directoryStore.directory.requestsById[props.node.data?.requestId]
        );
      }
    }
  };

  const selected = useMemo(() => {
    if (props.node.data?.type === "request") {
      return directoryStore.selectedRequestId === props.node.data?.requestId;
    } else {
      return false;
    }
  }, [props.node, directoryStore.selectedRequestId]);

  return (
    <Box
      cursor={"pointer"}
      onClick={handleClick}
      style={{ paddingInlineStart: indent }}
      backgroundColor={selected ? "whiteAlpha.600" : "transparent"}
    >
      {props.node.droppable ? (
        <FolderNode
          isOpen={props.isOpen}
          node={props.node}
          handleToggle={handleToggle}
        />
      ) : props.node.data?.type === "request" ? (
        <RequestNode node={props.node} id={props.node.data.requestId!} />
      ) : (
        <div>{`${props.node.text}`}</div>
      )}
    </Box>
  );
});
