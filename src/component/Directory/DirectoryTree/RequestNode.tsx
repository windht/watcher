import {
  Box,
  Flex,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
} from "@chakra-ui/react";
import { useDirectoryUtil } from "hooks/directory";
import { observer } from "mobx-react-lite";
import React from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import { useStore } from "store/RootStore";

const COLOR_MAP: any = {
  GET: "lightgreen",
  POST: "orange",
  DELETE: "red",
  PUT: "blue",
  PATCH: "yellow",
};

export const RequestNode: React.FC<{
  node: any;
  id: string;
}> = observer(({ id, node }) => {
  const { requestStore } = useStore();
  const request = requestStore.requestsById[id];
  const { removeItem } = useDirectoryUtil();

  if (!request) {
    return null;
  }

  return (
    <Flex role="group" p="5px" flexDir={"row"}>
      <Box color={COLOR_MAP[request.method] || "black"} mr="10px">
        {request.method}
      </Box>
      <Box>{request.name}</Box>
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
});
