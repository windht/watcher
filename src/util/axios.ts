import axios from "axios";

axios.interceptors.request.use((x: any) => {
  // to avoid overwriting if another interceptor
  // already defined the same object (meta)
  x.meta = x.meta || {};
  x.meta.requestStartedAt = new Date().getTime();
  return x;
});

axios.interceptors.response.use((x: any) => {
  console.log(
    `Execution time for: ${x.config.url} - ${
      new Date().getTime() - x.config.meta.requestStartedAt
    } ms`
  );
  return x;
});

axios.defaults.withCredentials = true;
