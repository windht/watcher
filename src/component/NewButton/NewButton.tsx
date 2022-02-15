import {
  Button,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { useDirectory } from "hooks/directory";
import React, { useCallback, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { ROOT_ID } from "store/DirectoryStore";

type Props = {};

export const NewButton = (props: Props) => {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { createRequestInCollection, createFolderInCollection } =
    useDirectory();

  const handleCreateRequest = useCallback(() => {
    createRequestInCollection(ROOT_ID);
  }, [createRequestInCollection]);

  const handleCreateFolder = useCallback(() => {
    createFolderInCollection(ROOT_ID, folderName);
    setIsCreatingFolder(false);
    setFolderName("");
  }, [createFolderInCollection, folderName]);

  return (
    <>
      <Menu isLazy>
        <MenuButton mx={"10px"} as={Button} rightIcon={<FaChevronDown />}>
          New
        </MenuButton>
        <MenuList>
          <MenuItem onClick={handleCreateRequest}>New Request</MenuItem>
          <MenuItem
            onClick={() => {
              setIsCreatingFolder(true);
            }}
          >
            New Folder
          </MenuItem>
        </MenuList>
      </Menu>

      <Modal
        isOpen={isCreatingFolder}
        onClose={() => {
          setIsCreatingFolder(false);
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Folder</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Enter Folder Name"
              onChange={(event: any) => {
                setFolderName(event.target.value);
              }}
              value={folderName}
            />
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={() => {
                setIsCreatingFolder(false);
              }}
            >
              Close
            </Button>
            <Button
              disabled={!folderName}
              variant="ghost"
              onClick={handleCreateFolder}
            >
              Import
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
