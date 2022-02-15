import { Box, Flex } from "@chakra-ui/react";
import { NodeModel } from "@minoru/react-dnd-treeview";
import React from "react";
import { FaChevronDown, FaChevronRight, FaFolder } from "react-icons/fa";
import { CustomData } from "./type";

export const FolderNode: React.FC<{
  node: NodeModel<CustomData>;
  handleToggle: any;
  isOpen: boolean;
}> = ({ node, handleToggle, isOpen }) => {

  const handleClickFolder = (event: React.MouseEvent) => {
    event.stopPropagation();
  }

  return (
    <Flex alignItems={"center"} onClick={handleToggle} p="5px" flexDir={"row"}>
      <Box mr="5px" >{isOpen ? <FaChevronDown /> : <FaChevronRight />}</Box>
      <Flex onClick={handleClickFolder} flexDir={"row"} alignItems={"center"}>
        <Box mr="5px">
          <FaFolder />
        </Box>
        <Box>{node.text}</Box>
      </Flex>
    </Flex>
  );
};
