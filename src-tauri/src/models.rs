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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequest {
  pub id: String,
  pub workspace_id: String,
  pub name: String,
  pub method: String,
  pub url: String,
  pub params: Vec<KeyValueRow>,
  pub headers: Vec<KeyValueRow>,
  pub body: RequestBody,
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
      method: "GET".into(),
      url: String::new(),
      params: Vec::new(),
      headers: Vec::new(),
      body: RequestBody {
        mode: "none".into(),
        raw: String::new(),
        form_data: Vec::new(),
      },
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
