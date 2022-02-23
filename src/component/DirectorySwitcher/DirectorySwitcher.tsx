import {
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Input,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
} from "@chakra-ui/react";
import { observer } from "mobx-react";
import React, { useCallback, useState } from "react";
import { FaCheck, FaChevronDown } from "react-icons/fa";
import { useStore } from "store/RootStore";

type Props = {};

export const DirectorySwitcher = observer((props: Props) => {
  const { directoryStore } = useStore();
  const [isCreatingDirectory, setIsCreatingDirectory] = useState(false);
  const [directoryName, setDirectoryName] = useState("");
  const [syncString, setSyncString] = useState("");

  const handleCreate = useCallback(() => {
    const directoryId = directoryStore.createDirectory(directoryName);
    directoryStore.selectDirectory(directoryId);
    setDirectoryName("");
    setIsCreatingDirectory(false);
  }, [directoryName, directoryStore]);

  const handleSync = useCallback(async () => {
    const directoryId = await directoryStore.createFromSync(syncString);
    directoryStore.selectDirectory(directoryId);
    setSyncString("");
    setIsCreatingDirectory(false);
  }, [syncString, directoryStore]);

  return (
    <Box mx="30px">
      <Menu isLazy>
        <MenuButton>
          <Flex flexDir={"row"} alignItems="center">
            <Text mr="10px">
              {" "}
              {`WorkSpaces - ${directoryStore?.directory?.name}`}
            </Text>
            <FaChevronDown />
          </Flex>
        </MenuButton>
        <MenuList>
          {directoryStore.directories.map((directory) => (
            <MenuItem
              key={directory.id}
              onClick={() => {
                directoryStore.selectDirectory(directory.id);
              }}
            >
              <Flex
                w="100%"
                alignItems={"center"}
                flexDir="row"
                justifyContent={"space-between"}
              >
                <Text>{directory.name || directory.id}</Text>
                {directoryStore.selectedDirectoryId === directory.id && (
                  <FaCheck />
                )}
              </Flex>
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuItem
            onClick={() => {
              setIsCreatingDirectory(true);
            }}
          >
            Create New Workspace
          </MenuItem>
        </MenuList>
      </Menu>

      <Modal
        isOpen={isCreatingDirectory}
        onClose={() => {
          setIsCreatingDirectory(false);
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Directory</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Enter Directory Name"
              onChange={(event) => {
                setDirectoryName(event.target.value);
              }}
              value={directoryName}
            />

            <Flex flexDirection={"row"} mt="10px">
              <Box flex={1}></Box>
              <Button
                colorScheme="blue"
                disabled={!directoryName}
                onClick={handleCreate}
              >
                Create
              </Button>
            </Flex>

            <Center my="10px">
              <Divider></Divider>
              <Text mx="10px">OR</Text>
              <Divider></Divider>
            </Center>

            <Input
              placeholder="Enter Sync String"
              onChange={(event) => {
                setSyncString(event.target.value);
              }}
              value={syncString}
            />

            <Flex flexDirection={"row"} mt="10px">
              <Box flex={1}></Box>
              <Button
                colorScheme="blue"
                disabled={!syncString}
                onClick={handleSync}
              >
                Sync
              </Button>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
});
