import { IRequest } from "store/RequestStore";

export const EMPTY_REQUEST: IRequest = {
  id: "",
  url: "",
  method: "GET",
  headers: [],
  data: {
    mode: "raw",
    raw: "{}",
  },
  params: [],
  name: "New Request",
};

export const SUPABASE_URL = "https://duouupnfmefbrgpahird.supabase.co";
export const SUPABASE_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3V1cG5mbWVmYnJncGFoaXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDQ5MjgzMjksImV4cCI6MTk2MDUwNDMyOX0.T2_1SnFRcmyEc_1-RKm_ib3lMcD2eq12apdL99bhA6g";
