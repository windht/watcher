import { Box, Flex } from "@chakra-ui/react";
import { Directory } from "component/Directory";
import { Request } from "component/Request";
import React from "react";

type Props = {};

export const ApiList = (props: Props) => {
  return (
    <Box w="100%" h="100%">
      <Flex h="100%" flexDir={"row"}>
        <Flex w="400px" h="100%">
          <Directory />
        </Flex>
        <Flex flex={1} minW="0">
          <Request />
        </Flex>
      </Flex>
    </Box>
  );
};
