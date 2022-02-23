import { Button, Flex, Input, Text, Textarea } from "@chakra-ui/react";
import { observer } from "mobx-react";
import React, { useCallback, useMemo } from "react";
import { useStore } from "store/RootStore";
import { useMutation } from "react-query";
import { toJS } from "mobx";

type Props = {};

export const SyncStatus = observer((props: Props) => {
  const { directoryStore } = useStore();
  const syncSetting = directoryStore?.directory?.syncSetting;

  const shareString = useMemo(() => {
    return btoa(JSON.stringify(toJS(syncSetting)));
  }, [syncSetting]);

  const { mutateAsync, isLoading } = useMutation(
    async () => {
      return directoryStore.sync(directoryStore.directory);
    },
    {
      mutationKey: `Sync-${directoryStore.selectedDirectoryId}`,
    }
  );

  const handleClickSync = useCallback(() => {
    mutateAsync();
  }, [mutateAsync]);

  return (
    <Flex flexDir={"column"} padding="20px">
      <Text mb="8px">Sync Uuid</Text>
      <Input mb="5px" value={syncSetting!.uuid} disabled size="sm" />
      <Text mb="8px" fontSize={"xx-small"}>
        This is the uuid for sync
      </Text>

      <Text mb="8px">Sync Encrypt Secret</Text>
      <Input mb="5px" value={syncSetting!.dataEncryptKey} disabled size="sm" />
      <Text fontSize={"xx-small"}>
        This key is used to encrypt your data saved in cloud
      </Text>

      <Button onClick={handleClickSync} disabled={isLoading} mt="20px">
        Sync
      </Button>

      <Text my="8px">Share String</Text>
      <Textarea resize={"none"} value={shareString} readOnly size="sm" />
      <Text fontSize={"xx-small"}>
        Share this string with your friend to get synced on spaces
      </Text>
    </Flex>
  );
});
