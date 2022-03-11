import { Button, Center, Code, Text } from "@chakra-ui/react";
import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <Center w="full" h={"100vh"} flexDir="column">
      <Text mb="10px">Oops, something wrong happened</Text>
      <Code padding="20px" mb="20px">
        {error?.message || "Unkown Error"}
      </Code>
      <Button
        onClick={() => {
          resetErrorBoundary();
        }}
      >
        Reload To Save
      </Button>
    </Center>
  );
}

export const AppBoundary: React.FunctionComponent = ({ children }) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        window.location.reload();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};
