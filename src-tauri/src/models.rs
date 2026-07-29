use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
  pub id: String,
  pub name: String,
  pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
  pub id: String,
  pub workspace_id: String,
  pub parent_id: Option<String>,
  pub kind: String,
  pub request_id: Option<String>,
  pub name: String,
  pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValueRow {
  pub id: String,
  pub active: bool,
  pub key: String,
  pub value: String,
  pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestBody {
  pub mode: String,
  pub raw: String,
  pub form_data: Vec<KeyValueRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RequestTransport {
  Http,
  Sse,
  Websocket,
}

impl Default for RequestTransport {
  fn default() -> Self {
    Self::Http
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeConfig {
  #[serde(default)]
  pub protocols: Vec<String>,
  #[serde(default)]
  pub message: String,
  #[serde(default = "default_realtime_message_format")]
  pub message_format: String,
}

impl Default for RealtimeConfig {
  fn default() -> Self {
    Self {
      protocols: Vec::new(),
      message: String::new(),
      message_format: default_realtime_message_format(),
    }
  }
}

fn default_realtime_message_format() -> String {
  "text".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequest {
  pub id: String,
  pub workspace_id: String,
  pub name: String,
  #[serde(default)]
  pub transport: RequestTransport,
  pub method: String,
  pub url: String,
  pub params: Vec<KeyValueRow>,
  pub headers: Vec<KeyValueRow>,
  pub body: RequestBody,
  #[serde(default)]
  pub realtime: RealtimeConfig,
  pub pre_request_script: String,
  pub post_response_script: String,
  pub updated_at: i64,
}

impl ApiRequest {
  pub fn empty(id: String, workspace_id: String) -> Self {
    Self {
      id,
      workspace_id,
      name: "New request".into(),
      transport: RequestTransport::Http,
      method: "GET".into(),
      url: String::new(),
      params: Vec::new(),
      headers: Vec::new(),
      body: RequestBody {
        mode: "none".into(),
        raw: String::new(),
        form_data: Vec::new(),
      },
      realtime: RealtimeConfig::default(),
      pre_request_script: String::new(),
      post_response_script: String::new(),
      updated_at: crate::storage::now_ms(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
  pub id: String,
  pub workspace_id: String,
  pub active: bool,
  pub key: String,
  pub initial_value: String,
  pub current_value: String,
  pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpExecutionResult {
  pub status: i64,
  pub status_text: String,
  pub headers: HashMap<String, String>,
  pub body: String,
  pub duration_ms: i64,
  pub size_bytes: i64,
  pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
  pub id: String,
  pub workspace_id: String,
  pub request: ApiRequest,
  pub response: HttpExecutionResult,
  pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabSession {
  pub id: String,
  pub workspace_id: String,
  pub request_id: String,
  pub order: i64,
  pub draft: ApiRequest,
  pub dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
  pub selected_workspace_id: String,
  pub theme: String,
  pub language: String,
  pub check_for_updates: bool,
  pub expanded_node_ids: Vec<String>,
  #[serde(default = "default_mcp_server_port")]
  pub mcp_server_port: u16,
}

fn default_mcp_server_port() -> u16 {
  crate::mcp::DEFAULT_MCP_SERVER_PORT
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatus {
  pub running: bool,
  pub port: u16,
  pub endpoint: String,
  pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
  pub workspaces: Vec<Workspace>,
  pub selected_workspace_id: String,
  pub nodes: Vec<TreeNode>,
  pub requests: Vec<ApiRequest>,
  pub environment_variables: Vec<EnvironmentVariable>,
  pub tabs: Vec<TabSession>,
  pub selected_tab_id: Option<String>,
  pub settings: AppSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveNodeInput {
  pub node_id: String,
  pub parent_id: Option<String>,
  pub position: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedRequest {
  pub node: TreeNode,
  pub request: ApiRequest,
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn legacy_requests_default_to_http_realtime_settings() {
    let request: ApiRequest = serde_json::from_value(json!({
      "id": "request_1",
      "workspaceId": "workspace_1",
      "name": "Legacy request",
      "method": "GET",
      "url": "https://example.com",
      "params": [],
      "headers": [],
      "body": { "mode": "none", "raw": "", "formData": [] },
      "preRequestScript": "",
      "postResponseScript": "",
      "updatedAt": 1
    }))
    .unwrap();

    assert_eq!(request.transport, RequestTransport::Http);
    assert!(request.realtime.protocols.is_empty());
    assert_eq!(request.realtime.message_format, "text");
  }
}
