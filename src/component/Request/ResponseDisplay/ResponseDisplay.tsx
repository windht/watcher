import {
  Box,
  Center,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
} from "@chakra-ui/react";
import React from "react";
import { ResponseBody } from "./ResponseBody";
import { ResponseHeader } from "./ResponseHeader";

type Props = {
  response: any;
};

const TABS = [
  {
    label: "Body",
    component: ResponseBody,
  },
  {
    label: "Headers",
    component: ResponseHeader,
  },
];

export const ResponseDisplay = ({ response }: Props) => {
  return (
    <Box
      borderTop={"1px solid"}
      borderTopColor={"whiteAlpha.400"}
      h="40%"
      w="100%"
      resize="vertical"
      maxH="50%"
    >
      {response ? (
        <Tabs flexDir={"column"} display={"flex"} h="100%" w="100%" isLazy>
          <TabList alignItems="center" flexDir={"row"}>
            {TABS.map((tab, index) => (
              <Tab key={index}>{tab.label}</Tab>
            ))}

            <Box flex={1}></Box>
            <Text>Status: {response.status}</Text>
            <Box w={"50px"}></Box>
          </TabList>
          <TabPanels w="100%" flex={1} minH="0">
            {TABS.map((tab, index) => (
              <TabPanel key={index} h="100%" w="100%" overflowY={"auto"}>
                {React.createElement(tab.component, {
                  response,
                })}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      ) : (
        <Center w="full" h="full">
          No Response Yet
        </Center>
      )}
    </Box>
  );
};
