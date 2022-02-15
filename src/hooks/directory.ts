import { useCallback } from "react";
import { useStore } from "store/RootStore";

import cuid from "cuid";
import { ROOT_ID } from "store/DirectoryStore";
export const useDirectory = () => {
  const { directoryStore, requestStore } = useStore();

  const createRequestInCollection = useCallback(
    (parent = ROOT_ID) => {
      const request = requestStore.getNewRequest();
      directoryStore.createCollection({
        id: cuid(),
        text: request.name,
        droppable: false,
        parent,
        data: {
          type: "request",
          requestId: request.id,
        },
      });
    },
    [requestStore, directoryStore]
  );

  const createFolderInCollection = useCallback(
    (parent = ROOT_ID, folderName = "New Folder") => {
      directoryStore.createCollection({
        id: cuid(),
        text: folderName,
        droppable: true,
        parent,
        data: {
          type: "folder",
        },
      });
    },
    [directoryStore]
  );

  return {
    directory: directoryStore.directory,
    setDirectoryCollections: directoryStore.setDirectoryCollections,
    createRequestInCollection,
    createFolderInCollection,
  };
};
