import {
  Button,
  Flex,
  Input,
  InputGroup,
  InputRightAddon,
  Text,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { randomString } from "util/random";
import { FcRefresh } from "react-icons/fc";
import { SUPABASE_API_KEY, SUPABASE_URL } from "const";
import { v4 as uuidv4 } from "uuid";

type Props = {
  onUpdate: (syncSetting: any) => void;
};

export const Supabase = ({ onUpdate }: Props) => {
  const [secret, setSecret] = useState(randomString(20));

  const changeSecret = useCallback(() => {
    setSecret(randomString(20));
  }, []);

  const submit = useCallback(() => {
    onUpdate({
      uuid: uuidv4(),
      enabled: true,
      dataEncryptKey: secret,
      type: "supabase",
      data: {
        url: SUPABASE_URL,
        key: SUPABASE_API_KEY,
      },
    });
  }, [onUpdate, secret]);

  return (
    <Flex flexDirection={"column"}>
      <Text mb="8px">Sync Encrypt Secret</Text>
      <InputGroup size="sm">
        <Input value={secret} disabled size="sm" />
        <InputRightAddon
          onClick={changeSecret}
          children={<FcRefresh color="white" />}
        />
      </InputGroup>

      <Button mt="20px" onClick={submit}>
        Start Sync
      </Button>
    </Flex>
  );
};
