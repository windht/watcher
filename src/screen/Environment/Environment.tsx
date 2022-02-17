import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { ParamsTable } from "component/ParamsTable";
import { Formik, FormikHelpers, Form } from "formik";
import { toJS } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useCallback, useMemo } from "react";
import { useStore } from "store/RootStore";

type Props = {};

export const Environment = observer((props: Props) => {
  const { directoryStore } = useStore();

  const handleSubmit = useCallback(
    async (values, { setSubmitting }: FormikHelpers<any>) => {
      console.log(values);
      directoryStore.updateDirectory({
        environmentVariables: values.environmentVariables,
      });
    },
    [directoryStore]
  );

  const environmentVariables = useMemo(() => {
    return toJS(directoryStore.directory.environmentVariables);
  }, [directoryStore.directory.environmentVariables]);

  return (
    <Box w="100%" padding={"20px"}>
      <Formik
        onSubmit={handleSubmit}
        enableReinitialize
        initialValues={{
          environmentVariables,
        }}
      >
        {({ dirty }) => (
          <Form>
            <Flex flexDir={"row"}>
              <Text mb="20px" fontSize={"xl"}>
                Environments
              </Text>
              <Flex flex={1}></Flex>
              {dirty && <Button type="submit">Save</Button>}
            </Flex>
            <ParamsTable
              columns={[
                {
                  key: "key",
                  label: "Variable",
                },
                {
                  key: "initial_value",
                  label: "Initial Value",
                },
                {
                  key: "current_value",
                  label: "Current Value",
                },
              ]}
              fieldName="environmentVariables"
            />
          </Form>
        )}
      </Formik>
    </Box>
  );
});
