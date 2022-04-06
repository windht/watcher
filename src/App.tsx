import React from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { RootContext, rootStore } from "./store/RootStore";
import { Routes } from "Routes";
import theme from "const/theme";
import { queryClient } from "util/query";
import { QueryClientProvider } from "react-query";
import "util/axios";
import { AppBoundary } from "component/AppBoundary";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChakraProvider theme={theme}>
        <AppBoundary>
          <RootContext.Provider value={rootStore}>
            <Routes />
          </RootContext.Provider>
        </AppBoundary>
      </ChakraProvider>
    </QueryClientProvider>
  );
}

export default App;
