import { useCallback } from "react";
import { useStore } from "store/RootStore";

import cuid from "cuid";
import { ICollection, ROOT_ID } from "store/DirectoryStore";
export const useDirectory = () => {
  const { directoryStore } = useStore();

  const createRequestInCollection = useCallback(
    (parent = ROOT_ID) => {
      directoryStore.createRequestInCollection(parent);
    },
    [directoryStore]
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

export const useDirectoryUtil = () => {
  const { directoryStore } = useStore();

  const removeItem = useCallback(
    (item: ICollection) => {
      if (item.data.type === "folder") {
        directoryStore.removeCollectionById(item.id);
        const children = directoryStore?.directory?.collections?.filter(
          (collection) => collection.parent === item.id
        );
        children.forEach(removeItem);
      } else if (item.data.requestId) {
        directoryStore.removeCollectionById(item.id);
      }
    },
    [directoryStore]
  );

  const handleConvertedItems = useCallback(
    (convertedItems: any[]) => {
      convertedItems.forEach((convertedItem) => {
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
          const { id, name, method, params, url, data, headers, parent } =
            convertedItem.data;
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
          directoryStore.addRequestToDirectory({
            id,
            name,
            method,
            params,
            url,
            data,
            headers,
          });
        }
      });
    },
    [directoryStore]
  );

  return {
    handleConvertedItems,
    removeItem,
  };
};
