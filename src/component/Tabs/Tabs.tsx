import { Flex } from "@chakra-ui/react";
import { RequestView } from "component/Request";
import { useSelectedTab, useSingleTabUpdate, useTabs } from "hooks/tab";
import { toJS } from "mobx";
import { observer } from "mobx-react";
import React, { useCallback, useMemo } from "react";
import { TabStatusEnum } from "store/TabStore";
import { TabItem } from "./TabItem";

type Props = {};

export const Tabs = observer((props: Props) => {
  const tabs = useTabs();
  const selectedTab = useSelectedTab();
  const { update: updateTab } = useSingleTabUpdate();

  const currentData = useMemo(() => {
    if (selectedTab && selectedTab.type === "request") {
      return toJS(selectedTab.currentData);
    } else {
      return null;
    }
  }, [selectedTab]);

  const handleTabUpdate = useCallback(
    (values) => {
      updateTab({
        ...selectedTab,
        currentData: values,
        status: TabStatusEnum.DIRTY,
      });
    },
    [selectedTab, updateTab]
  );

  const handleTabSave = useCallback(() => {
    updateTab({
      ...selectedTab,
      status: TabStatusEnum.STATIC,
    });
  }, [selectedTab, updateTab]);

  return (
    <Flex flexDir={"column"} flex={1}>
      <Flex flexDir={"row"}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            selected={selectedTab?.id === tab.id}
          />
        ))}
      </Flex>
      <Flex flex={1} minH="0" key={selectedTab?.id}>
        {selectedTab?.type === "request" && currentData && (
          <RequestView
            handleSave={handleTabSave}
            handleChange={handleTabUpdate}
            request={currentData}
            isDirty={selectedTab.status === TabStatusEnum.DIRTY}
          />
        )}
      </Flex>
    </Flex>
  );
});
