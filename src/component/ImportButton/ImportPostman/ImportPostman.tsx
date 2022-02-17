import { Button, Center, Text } from "@chakra-ui/react";
import { useDirectoryUtil } from "hooks/directory";
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { convert } from "util/importer";

type Props = {};

const readFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onabort = () => {
      reject();
      console.log("file reading was aborted");
    };
    reader.onerror = () => {
      reject();
      console.log("file reading has failed");
    };
    reader.onload = () => {
      // Do whatever you want with the file contents
      const binaryStr = reader.result;
      resolve(binaryStr as string);
    };
    reader.readAsText(file);
  });
};

export const ImportPostman = (props: Props) => {
  const { handleConvertedItems } = useDirectoryUtil();
  const [items, setItems] = useState<any>();

  const onDrop = useCallback(async (acceptedFiles: any[]) => {
    try {
      const rawData: string = await readFile(acceptedFiles[0]);
      const data = JSON.parse(rawData);
      console.log(data);
      const convertedItems = await convert(data, "postman");
      setItems(convertedItems);
    } catch (err) {
      console.log(err);
    }
  }, []);

  const confirmImport = useCallback(() => {
    handleConvertedItems(items);
  }, [items, handleConvertedItems]);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <>
      <Center
        w="100%"
        minH="100px"
        borderWidth={"1px"}
        borderColor="gray.200"
        borderStyle={"dashed"}
        borderRadius={"10px"}
        {...getRootProps()}
      >
        <input {...getInputProps()} />
        <Text>Drop/Click to upload Files</Text>
      </Center>

      {items && (
        <Center my="20px" w="100%" flexDir={"column"}>
          <Text mb="10px">{items.length} requests to import</Text>
          <Button onClick={confirmImport}>Import</Button>
        </Center>
      )}
    </>
  );
};
