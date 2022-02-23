import {
  Box,
  Center,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { observer } from "mobx-react-lite";
import React, { useCallback } from "react";
import { BsCloudFill } from "react-icons/bs";
import { useStore } from "store/RootStore";
import { Supabase } from "./Supabase";
import { SyncStatus } from "./SyncStatus";
import { IoReload } from "react-icons/io5";

type Props = {};

export const Sync = observer((props: Props) => {
  const { directoryStore } = useStore();
  const { isOpen: isSyncModalOpen, onToggle } = useDisclosure();

  const syncSetting = directoryStore?.directory?.syncSetting;
  const isSyncing =
    !!directoryStore.directoriesLoading[directoryStore.selectedDirectoryId];

  const handleUpdateSyncSetting = useCallback(
    (syncSetting) => {
      directoryStore.updateDirectory({
        syncSetting,
      });
    },
    [directoryStore]
  );

  return (
    <>
      <Center
        cursor={"pointer"}
        borderRadius={"10px"}
        w="40px"
        h="30px"
        mx="20px"
        onClick={onToggle}
        position="relative"
        background={"green.300"}
      >
        <Box>
          <BsCloudFill />
        </Box>

        {isSyncing && (
          <Box position={"absolute"} bottom="0px" right="0px">
            <IoReload className="icon-spin" fontSize={"12px"} />
          </Box>
        )}
      </Center>

      <Modal isOpen={isSyncModalOpen} onClose={onToggle}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cloud Sync</ModalHeader>
          <ModalCloseButton />

          {!syncSetting && (
            <>
              <Center padding="30px">
                <Text>
                  You don't have sync setup yet for this space, start by using
                  one of the method below
                </Text>
              </Center>

              <Tabs isLazy>
                <TabList>
                  <Tab>Supabase</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Supabase onUpdate={handleUpdateSyncSetting} />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </>
          )}

          {!!syncSetting && <SyncStatus />}
        </ModalContent>
      </Modal>
    </>
  );
});
