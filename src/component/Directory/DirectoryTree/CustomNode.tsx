import React, { useMemo } from "react";
import { NodeModel } from "@minoru/react-dnd-treeview";
import { CustomData } from "./type";
import { useStore } from "store/RootStore";
import { RequestNode } from "./RequestNode";
import { Box } from "@chakra-ui/react";
import { observer } from "mobx-react";
import { FolderNode } from "./FolderNode";

type Props = {
  node: NodeModel<CustomData>;
  depth: number;
  isOpen: boolean;
  onToggle: (id: NodeModel["id"]) => void;
};

export const CustomNode: React.FC<Props> = observer((props) => {
  const indent = props.depth * 24;
  const { requestStore } = useStore();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onToggle(props.node.id);
  };

  const handleClick = () => {
    if (props.node.data?.type === "request") {
      requestStore.selectRequest(props.node.data?.requestId);
    }
  };

  const selected = useMemo(() => {
    if (props.node.data?.type === "request") {
      return requestStore.selectedRequestId === props.node.data?.requestId;
    } else {
      return false;
    }
  }, [props.node, requestStore.selectedRequestId]);

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
        <RequestNode id={props.node.data.requestId!} />
      ) : (
        <div>{`${props.node.text}`}</div>
      )}
    </Box>
  );
});
