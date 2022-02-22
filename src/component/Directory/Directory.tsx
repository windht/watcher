import { Box, Center, Flex, Input } from "@chakra-ui/react";
import { useDirectory } from "hooks/directory";
import { observer } from "mobx-react";
import React, { useMemo, useState } from "react";
import { DirectoryTree } from "./DirectoryTree";
import { toJS } from "mobx";
import { ImportButton } from "component/ImportButton";
import { useStore } from "store/RootStore";
import { NewButton } from "component/NewButton";

type Props = {};

export const Directory = observer((props: Props) => {
  const { requestStore } = useStore();
  const { directory, setDirectoryCollections } = useDirectory();

  const [search, setSearch] = useState("");

  const treeData = useMemo(() => {
    return toJS(
      (directory.collections || []).filter((item) => {
        if (item.data.type === "request") {
          const request =
            requestStore.requestsById[item.data.requestId as string];
          return request?.name?.toLowerCase().includes(search.toLowerCase());
        }
        return true;
      })
    );
  }, [search, directory.collections, requestStore.requestsById]);

  const noRequestFound = useMemo(() => {
    return (
      !!search &&
      treeData.filter((item) => item.data.type === "request").length === 0
    );
  }, [treeData, search]);

  return (
    <Flex
      p="10px"
      h="full"
      w="full"
      flexDir={"column"}
      borderRight={"1px solid"}
      borderRightColor={"whiteAlpha.400"}
    >
      <Flex>
        <Box flex={1}></Box>
        <NewButton />
        <ImportButton />
      </Flex>
      <Flex my="5px">
        <Input
          placeholder="Search here"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Flex>
      <Flex flex={1} minH="0" overflowY={"auto"}>
        {noRequestFound ? (
          <Center h="100%" w="100%">
            No Request Found
          </Center>
        ) : (
          <DirectoryTree
            expandAll={!!search}
            treeData={treeData}
            setTreeData={setDirectoryCollections}
          />
        )}
      </Flex>
    </Flex>
  );
});
