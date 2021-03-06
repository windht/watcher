import { Button, Input, ModalBody, ModalFooter } from "@chakra-ui/react";
import { http } from "@tauri-apps/api";
import { useDirectoryUtil } from "hooks/directory";
import React, { useCallback, useState } from "react";
import { convert } from "util/importer";

type Props = {};

export const ImportSwagger = (props: Props) => {
  const { handleConvertedItems } = useDirectoryUtil();
  const [url, setUrl] = useState("");

  const handleImport = useCallback(async () => {
    try {
      const { data } = await http.fetch(url, {
        method: "GET",
      });
      const convertedItems = await convert(data, "swagger");
      console.log("Converted items");
      handleConvertedItems(convertedItems);
    } catch (err) {
      console.log(err);
    }
  }, [url, handleConvertedItems]);

  return (
    <>
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
        <Button disabled={!url} variant="ghost" onClick={handleImport}>
          Import
        </Button>
      </ModalFooter>
    </>
  );
};
