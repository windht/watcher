import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react";
import { http } from "@tauri-apps/api";
import React, { useCallback, useState } from "react";
import { ROOT_ID } from "store/DirectoryStore";
import { useStore } from "store/RootStore";
import { convert } from "util/importer";

type Props = {};

export const ImportButton = (props: Props) => {
  const { directoryStore, requestStore } = useStore();
  const [isImporting, setIsImporting] = useState(false);
  const [url, setUrl] = useState("");

  const handleImport = useCallback(async () => {
    try {
      console.log("Fetching");
      const { data } = await http.fetch(url, {
        method: "GET",
      });
      console.log(data);
      const convertedItems = await convert(data, "swagger");
      console.log(convertedItems);

      convertedItems.forEach((convertedItem) => {
        console.log("Converted Item", convertedItem);
        if (convertedItem.type === "folder") {
          directoryStore.createCollection({
            id: convertedItem.data.id,
            text: convertedItem.data.name,
            droppable: true,
            parent: ROOT_ID,
            data: {
              type: "folder",
            },
          });
        } else if (convertedItem.type === "request") {
          const {
            id,
            name,
            method,
            params,
            url,
            bodyType,
            data,
            headers,
            parent,
          } = convertedItem.data;
          requestStore.createNewRequest({
            id,
            name,
            method,
            params,
            url,
            bodyType,
            data,
            headers,
          });
          directoryStore.createCollection({
            id: id,
            text: name,
            droppable: false,
            parent: parent,
            data: {
              type: "request",
              requestId: id,
            },
          });
        }
      });
    } catch {}
  }, [url, requestStore, directoryStore]);

  return (
    <>
      <Button
        onClick={() => {
          setIsImporting(true);
        }}
      >
        Import
      </Button>

      <Modal
        isOpen={isImporting}
        onClose={() => {
          setIsImporting(false);
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Input
              placeholder="Enter Url"
              onChange={(event: any) => {
                setUrl(event.target.value);
              }}
              value={url}
            />
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={() => {
                setIsImporting(false);
              }}
            >
              Close
            </Button>
            <Button disabled={!url} variant="ghost" onClick={handleImport}>
              Import
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
