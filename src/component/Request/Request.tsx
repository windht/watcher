import React, { useCallback, useEffect, useState } from "react";
import { Formik, FormikHelpers, useFormikContext } from "formik";
import { EMPTY_REQUEST } from "const";
import RequestForm from "./RequestForm";
import { Box, Center, Flex, Spinner } from "@chakra-ui/react";
import { doRequest } from "util/request";
import { useMutation } from "react-query";
import { IRequest } from "store/RequestStore";
import { ResponseDisplay } from "./ResponseDisplay";
import { useStore } from "store/RootStore";
import { TabContext } from "component/Tabs/context";

type Props = {
  request: IRequest;
  handleChange: (values: any) => void;
  handleSave: () => void;
  isDirty: boolean;
};

const FormObserver: React.FC<{
  onChange: (values: any) => void;
}> = ({ onChange }) => {
  const { values, touched, dirty } = useFormikContext();
  useEffect(() => {
    if (onChange && dirty) {
      onChange(values);
    }
  }, [values, onChange, touched, dirty]);

  return null;
};

export const RequestView = ({
  isDirty,
  request,
  handleChange,
  handleSave,
}: Props) => {
  const { historyStore, directoryStore } = useStore();
  const [response, setResponse] = useState<any>(undefined);

  const mutation = useMutation(
    (form: IRequest) => {
      historyStore.addHistory(request);
      return doRequest(
        form,
        directoryStore.directory.environmentVariables || []
      );
    },
    {
      mutationKey: "Request",
    }
  );

  const makeRequest = useCallback(
    async (values) => {
      try {
        await directoryStore.preRequestScript(values);
        const response = await mutation.mutateAsync(values);
        await directoryStore.afterRequestScript(values, response);

        setResponse(response);
      } catch (err: any) {
        console.log(err.response);
        setResponse(
          err.response || {
            status: 500,
            data: err.message,
          }
        );
      } finally {
      }
    },
    [mutation, directoryStore]
  );

  const handleSubmit = useCallback(
    async (values, { setSubmitting, resetForm }: FormikHelpers<any>) => {
      try {
        setResponse(undefined);
        setSubmitting(true);
        directoryStore.updateRequest(values);
        handleSave && handleSave();
      } catch {
      } finally {
        setSubmitting(false);
      }
    },
    [directoryStore, handleSave]
  );

  return (
    <TabContext.Provider
      value={{
        isDirty,
      }}
    >
      <Flex w="100%" h="100%" flexDir="column">
        <Formik
          enableReinitialize
          onSubmit={handleSubmit}
          initialValues={{
            ...EMPTY_REQUEST,
            ...request,
          }}
        >
          {({ handleSubmit }) => (
            <Box overflowY={"hidden"} flex={1} minH="0">
              <FormObserver onChange={handleChange} />
              <form style={{ height: "100%" }} onSubmit={handleSubmit}>
                <RequestForm makeRequest={makeRequest} />
              </form>
            </Box>
          )}
        </Formik>
        {mutation.isLoading && (
          <Center h="200px">
            <Spinner />
          </Center>
        )}
        {!mutation.isLoading && <ResponseDisplay response={response} />}
      </Flex>
    </TabContext.Provider>
  );
};
