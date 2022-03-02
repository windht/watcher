import { Box, Flex, Text } from "@chakra-ui/react";
import React from "react";

const SNIPPETS = [
  {
    title: "Set an environment variable",
    snippet: `watcher.environment.set("variable_key", "variable_value");`,
  },
  {
    title: "Get an environment variable",
    snippet: `watcher.environment.get("variable_key");`,
  },
];

type Props = {
  onClick: any;
};

export const Snippets = ({ onClick }: Props) => {
  return (
    <Flex padding="20px" flexDir={"column"} width={"100%"} h="100%">
      <Text fontSize={"xs"} mb="20px">
        Request Scripts are javascript executes before/after request.
      </Text>
      <Text mb="10px" fontSize={"13px"} color="gray.500">
        SNIPPETS
      </Text>
      {SNIPPETS.map((snippet, index) => (
        <Box
          key={index}
          color="blue.300"
          onClick={() => {
            onClick(snippet.snippet);
          }}
        >
          <Text fontSize={"12px"}>{snippet.title}</Text>
        </Box>
      ))}
    </Flex>
  );
};
