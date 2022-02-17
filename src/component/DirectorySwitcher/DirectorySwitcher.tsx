import {
  Box,
  Button,
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
  ModalFooter,
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

  const handleCreate = useCallback(() => {
    const directoryId = directoryStore.createDirectory(directoryName);
    directoryStore.selectDirectory(directoryId);
    setDirectoryName("");
    setIsCreatingDirectory(false);
  }, [directoryName, directoryStore]);

  return (
    <Box mx="30px">
      <Menu isLazy>
        <MenuButton>
          <Flex flexDir={"row"} alignItems="center">
            <Text mr="10px">
              {" "}
              {`WorkSpaces - ${directoryStore.directory.name}`}
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
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={() => {
                setIsCreatingDirectory(false);
              }}
            >
              Close
            </Button>
            <Button
              disabled={!directoryName}
              variant="ghost"
              onClick={handleCreate}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
});
