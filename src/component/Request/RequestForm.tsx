import React from "react";
import { Flex } from "@chakra-ui/react";
import { RequestName } from "./RequestName";
import { RequestMethod } from "./RequestMethod";
import { RequestUrl } from "./RequestUrl";
import { RequestActionButtons } from "./RequestActionButtons";
import { RequestTabs } from "./RequestTabs";

interface Props {
  makeRequest: any;
}

export const RequestForm = ({ makeRequest }: Props) => {
  return (
    <Flex py="20px" h="100%" gap="10px" flexDir="column">
      <Flex px="20px" flexDir="row">
        <RequestName />
      </Flex>
      <Flex px="20px" gap="10px" flexDir="row">
        <RequestMethod />
        <RequestUrl />
        <RequestActionButtons makeRequest={makeRequest} />
      </Flex>
      <Flex flex={1} minH="0">
        <RequestTabs />
      </Flex>
    </Flex>
  );
};

export default RequestForm;
