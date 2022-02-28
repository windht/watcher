import React from "react";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import { RequestHeader } from "./RequestHeader";
import { RequestBody } from "./RequestBody";
import { RequestQuery } from "./RequestQuery";
import { RequestPreScript } from "./RequestPreScript";
import { RequestAfterScript } from "./RequestAfterScript";

type Props = {};

const TABS = [
  {
    label: "Params",
    component: <RequestQuery />,
  },
  {
    label: "Header",
    component: <RequestHeader />,
  },
  {
    label: "Body",
    component: <RequestBody />,
  },
  {
    label: "Pre-Request Script",
    component: <RequestPreScript />,
  },
  {
    label: "Post-Request Script",
    component: <RequestAfterScript />,
  },
];

export const RequestTabs = (props: Props) => {
  return (
    <Tabs display={"flex"} flexDir={"column"} flex={1} w="100%" isLazy>
      <TabList>
        {TABS.map((tab, index) => (
          <Tab key={index}>{tab.label}</Tab>
        ))}
      </TabList>
      <TabPanels flex={1} minH="0">
        {TABS.map((tab, index: number) => (
          <TabPanel overflowY={"scroll"} px="0" key={index} h="100%">
            {tab.component}
          </TabPanel>
        ))}
      </TabPanels>
    </Tabs>
  );
};
