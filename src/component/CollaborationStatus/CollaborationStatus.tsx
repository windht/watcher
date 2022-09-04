import { Box, Flex } from "@chakra-ui/react";
import { observer } from "mobx-react";
import React, { useEffect } from "react";
import { FcCollaboration } from "react-icons/fc";
import { useStore } from "store/RootStore";
import { Tooltip } from '@chakra-ui/react'

type Props = {};

export const CollaborationStatus = observer((props: Props) => {
  const { directoryStore, collaborationStore } = useStore();
  const hasSyncSettings = !!directoryStore?.directory?.syncSetting;

  useEffect(() => {
    directoryStore?.directory?.syncSetting! &&
      collaborationStore.setupProvider(directoryStore?.directory?.syncSetting!);
    return () => {
      collaborationStore.cleanWebrtc();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryStore?.directory?.syncSetting]);

  if (!hasSyncSettings) {
    return null;
  }

  return (
    <Flex alignItems={'center'}>
      <Tooltip label="Collaborators">
        <Box
          filter={true ? "grayscale(0)" : "grayscale(1)"}
        >
          <FcCollaboration fontSize={24}/>
        </Box>
      </Tooltip>
    </Flex>
  );
});
