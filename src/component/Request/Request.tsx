import React, { useCallback, useMemo, useState } from "react";
import { Formik, FormikHelpers } from "formik";
import { EMPTY_REQUEST } from "const";
import RequestForm from "./RequestForm";
import { Box, Center, Flex, Spinner } from "@chakra-ui/react";
import { doRequest } from "util/request";
import { useMutation } from "react-query";
import { IRequest } from "store/RequestStore";
import { ResponseDisplay } from "./ResponseDisplay";
import { observer } from "mobx-react";
import { useStore } from "store/RootStore";
import { toJS } from "mobx";

type Props = {
  request: IRequest;
};

const RequestComponent = ({ request }: Props) => {
  const { historyStore, requestStore, directoryStore } = useStore();
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
        const response = await mutation.mutateAsync(values);
        console.log("Done", response);
        setResponse(response);
      } catch (err: any) {
        console.log(err.response);
        setResponse(
          err.response || {
            status: 500,
          }
        );
      } finally {
      }
    },
    [mutation]
  );

  const handleSubmit = useCallback(
    async (values, { setSubmitting }: FormikHelpers<any>) => {
      try {
        setResponse(undefined);
        setSubmitting(true);
        requestStore.updateRequest(values);
      } catch {
      } finally {
        setSubmitting(false);
      }
    },
    [requestStore]
  );

  return (
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
  );
};

export const Request = observer(() => {
  const { requestStore } = useStore();
  const { selectedRequest } = requestStore;

  const request = useMemo(() => {
    return toJS(selectedRequest);
  }, [selectedRequest]);

  return request ? (
    <RequestComponent key={request.id} request={request} />
  ) : (
    <Center w="full">No Request Selected</Center>
  );
});
