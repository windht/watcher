import { Flex, Text } from "@chakra-ui/react";
import { DirectorySwitcher } from "component/DirectorySwitcher";
import { Sync } from "component/Sync";
import React from "react";
import { Sidebar } from "./Sidebar";

type Props = {};

export const Layout: React.FunctionComponent<Props> = ({ children }) => {
  return (
    <Flex w="100vw" h="100vh" flexDir={"column"}>
      <Flex
        h="60px"
        borderBottom="1px solid"
        borderBottomColor={"whiteAlpha.400"}
        alignItems="center"
      >
        <DirectorySwitcher />
        <Flex flexGrow={1}></Flex>
        <Sync />
      </Flex>
      <Flex w="100%" flex={1} minH="0" flexDir={"row"}>
        <Flex
          w="100px"
          flexDir={"column"}
          borderRight="1px solid"
          borderRightColor={"whiteAlpha.400"}
        >
          <Sidebar />
        </Flex>
        <Flex flex={1} minW="0">
          {children}
        </Flex>
      </Flex>
      <Flex
        borderTop="1px solid"
        borderTopColor={"whiteAlpha.400"}
        flexDir={"row"}
        h="60px"
        px="20px"
        alignItems={"center"}
      >
        <Text>Watcher V0.6.0</Text>
      </Flex>
    </Flex>
  );
};
