import {
  Button,
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
} from "@chakra-ui/react";
import React, { useState } from "react";
import { ImportPostman } from "./ImportPostman";
import { ImportSwagger } from "./ImportSwagger";

export const ImportButton = () => {
  const [isImporting, setIsImporting] = useState(false);
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

          <Tabs isLazy>
            <TabList>
              <Tab>Swagger</Tab>
              <Tab>Postman</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <ImportSwagger />
              </TabPanel>
              <TabPanel>
                <ImportPostman />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalContent>
      </Modal>
    </>
  );
};
