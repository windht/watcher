import {
  Box,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
} from "@chakra-ui/react";
import { NodeModel } from "@minoru/react-dnd-treeview";
import { useDirectoryUtil } from "hooks/directory";
import React from "react";
import { FaChevronDown, FaChevronRight, FaFolder } from "react-icons/fa";
import { FiMoreHorizontal } from "react-icons/fi";
import { CustomData } from "./type";

export const FolderNode: React.FC<{
  node: NodeModel<CustomData>;
  handleToggle: any;
  isOpen: boolean;
}> = ({ node, handleToggle, isOpen }) => {
  const { removeItem } = useDirectoryUtil();

  const handleClickFolder = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <Flex
      role="group"
      alignItems={"center"}
      onClick={handleToggle}
      p="5px"
      flexDir={"row"}
    >
      <Box mr="5px">{isOpen ? <FaChevronDown /> : <FaChevronRight />}</Box>
      <Flex onClick={handleClickFolder} flexDir={"row"} alignItems={"center"}>
        <Box mr="5px">
          <FaFolder />
        </Box>
        <Box>{node.text}</Box>
      </Flex>
      <Flex flex={1}></Flex>
      <Menu>
        <MenuButton
          opacity={0}
          _groupHover={{ opacity: 1 }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <FiMoreHorizontal color="white" />
        </MenuButton>
        <MenuList>
          <MenuItem
            color="red.400"
            onClick={() => {
              removeItem(node as any);
            }}
          >
            Delete
          </MenuItem>
        </MenuList>
      </Menu>
    </Flex>
  );
};
