import React, { useCallback, useMemo } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { IoClose } from "react-icons/io5";
import { ITab, TabStatusEnum } from "store/TabStore";
import { useStore } from "store/RootStore";
import { useTabUtil } from "hooks/tab";

type Props = {
  tab: ITab;
  selected: boolean;
};

export const TabItem = ({ tab, selected }: Props) => {
  const { directoryStore, tabStore } = useStore();
  const { closeTab } = useTabUtil();

  const tabTitle = useMemo(() => {
    if (tab.type === "request") {
      return directoryStore.directory.requestsById[tab.data.id].name;
    }
    return "Untitled";
  }, [tab, directoryStore]);

  const handleCloseTab = useCallback(
    (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    },
    [closeTab, tab]
  );

  return (
    <Flex
      alignItems={"center"}
      borderBottomWidth={1}
      borderBottomColor={selected ? "blue.300" : "transparent"}
      padding="10px"
      cursor={"pointer"}
      onClick={() => tabStore.setSelectedTabId(tab.id)}
      position="relative"
    >
      <Text>{tabTitle}</Text>
      {tab.status === TabStatusEnum.DIRTY && (
        <Box
          onClick={handleCloseTab}
          position={"absolute"}
          right="10px"
          w="16px"
          h="16px"
          borderRadius={"50%"}
          backgroundColor="white"
        ></Box>
      )}
      <Box
        _hover={{
          backgroundColor: "gray.600",
        }}
        onClick={handleCloseTab}
        borderRadius="50%"
        ml="3px"
      >
        <IoClose />
      </Box>
    </Flex>
  );
};
