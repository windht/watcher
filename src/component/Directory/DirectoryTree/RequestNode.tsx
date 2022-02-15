import { Box, Flex } from "@chakra-ui/react";
import { observer } from "mobx-react-lite";
import React from "react";
import { useStore } from "store/RootStore";

const COLOR_MAP: any = {
  GET: "lightgreen",
  POST: "orange",
  DELETE: "red",
  PUT: "blue",
  PATCH: "yellow",
};

export const RequestNode: React.FC<{
  id: string;
}> = observer(({ id }) => {
  const { requestStore } = useStore();
  const request = requestStore.requestsById[id];

  if (!request) {
    return null;
  }

  return (
    <Flex p="5px" flexDir={"row"}>
      <Box color={COLOR_MAP[request.method] || "black"} mr="10px">
        {request.method}
      </Box>
      <Box>{request.name}</Box>
    </Flex>
  );
});
