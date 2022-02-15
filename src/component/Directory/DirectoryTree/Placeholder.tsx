import React from "react";
import { NodeModel } from "@minoru/react-dnd-treeview";
import { Box } from "@chakra-ui/react";

type Props = {
  node: NodeModel;
  depth: number;
};

export const Placeholder: React.FC<Props> = (props) => {
  return (
    <Box style={{ paddingLeft: props.depth * 24 }}>
      <Box w={"100%"} h="2px" backgroundColor={"red.300"}></Box>
    </Box>
  );
};
