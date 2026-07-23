use crate::models::{
  ApiRequest, AppSettings, EnvironmentVariable, HistoryEntry, HttpExecutionResult, TabSession,
  TreeNode, Workspace,
};
use rusqlite::{Connection, params};
use std::{
  fs,
  path::Path,
  sync::Mutex,
  time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

pub struct AppState {
  connection: Mutex<Connection>,
}

impl AppState {
  pub fn open(app_data: &Path) -> Result<Self, Box<dyn std::error::Error>> {
    fs::create_dir_all(app_data)?;
    let connection = Connection::open(app_data.join("watcher-v1.sqlite3"))?;
    connection.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             CREATE TABLE IF NOT EXISTS workspaces (
               id TEXT PRIMARY KEY,
               name TEXT NOT NULL,
               created_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS requests (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               data_json TEXT NOT NULL,
               updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS nodes (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
               kind TEXT NOT NULL CHECK(kind IN ('folder', 'request')),
               request_id TEXT UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
               name TEXT NOT NULL,
               position INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS nodes_workspace_parent ON nodes(workspace_id, parent_id, position);
             CREATE TABLE IF NOT EXISTS environment_variables (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               active INTEGER NOT NULL,
               key TEXT NOT NULL,
               initial_value TEXT NOT NULL,
               current_value TEXT NOT NULL,
               position INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS history (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               request_json TEXT NOT NULL,
               response_json TEXT NOT NULL,
               created_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS history_workspace_created ON history(workspace_id, created_at DESC);
             CREATE TABLE IF NOT EXISTS tab_sessions (
               id TEXT PRIMARY KEY,
               workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
               request_id TEXT NOT NULL,
               position INTEGER NOT NULL,
               draft_json TEXT NOT NULL,
               dirty INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS tab_state (
               workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
               selected_tab_id TEXT
             );
             CREATE TABLE IF NOT EXISTS settings (
               id INTEGER PRIMARY KEY CHECK(id = 1),
               data_json TEXT NOT NULL
             );",
        )?;
    seed(&connection)?;
    Ok(Self {
      connection: Mutex::new(connection),
    })
  }

  pub fn with_connection<T>(
    &self,
    operation: impl FnOnce(&mut Connection) -> Result<T, String>,
  ) -> Result<T, String> {
    let mut connection = self
      .connection
      .lock()
      .map_err(|_| "The local database lock is poisoned.".to_string())?;
    operation(&mut connection)
  }
}

pub fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis() as i64
}

pub fn error(error: impl std::fmt::Display) -> String {
  error.to_string()
}

fn seed(connection: &Connection) -> Result<(), Box<dyn std::error::Error>> {
  let workspace_count: i64 =
    connection.query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))?;
  if workspace_count == 0 {
    let workspace_id = format!("workspace_{}", Uuid::new_v4());
    connection.execute(
      "INSERT INTO workspaces (id, name, created_at) VALUES (?1, 'My Workspace', ?2)",
      params![workspace_id, now_ms()],
    )?;
    let settings = AppSettings {
      selected_workspace_id: workspace_id,
      theme: "dark".into(),
      language: "en-US".into(),
      check_for_updates: true,
      expanded_node_ids: Vec::new(),
    };
    write_settings(connection, &settings).map_err(std::io::Error::other)?;
  }
  Ok(())
}

pub fn read_settings(connection: &Connection) -> Result<AppSettings, String> {
  let raw: String = connection
    .query_row("SELECT data_json FROM settings WHERE id = 1", [], |row| {
      row.get(0)
    })
    .map_err(error)?;
  serde_json::from_str(&raw).map_err(error)
}

pub fn write_settings(connection: &Connection, settings: &AppSettings) -> Result<(), String> {
  connection
    .execute(
      "INSERT INTO settings (id, data_json) VALUES (1, ?1)
             ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json",
      [serde_json::to_string(settings).map_err(error)?],
    )
    .map_err(error)?;
  Ok(())
}

pub fn list_workspaces(connection: &Connection) -> Result<Vec<Workspace>, String> {
  let mut statement = connection
    .prepare("SELECT id, name, created_at FROM workspaces ORDER BY created_at, name")
    .map_err(error)?;
  statement
    .query_map([], |row| {
      Ok(Workspace {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
      })
    })
    .map_err(error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(error)
}

pub fn list_nodes(connection: &Connection, workspace_id: &str) -> Result<Vec<TreeNode>, String> {
  let mut statement = connection
    .prepare(
      "SELECT id, workspace_id, parent_id, kind, request_id, name, position
             FROM nodes WHERE workspace_id = ?1 ORDER BY position, name",
    )
    .map_err(error)?;
  statement
    .query_map([workspace_id], |row| {
      Ok(TreeNode {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        parent_id: row.get(2)?,
        kind: row.get(3)?,
        request_id: row.get(4)?,
        name: row.get(5)?,
        position: row.get(6)?,
      })
    })
    .map_err(error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(error)
}

pub fn list_requests(
  connection: &Connection,
  workspace_id: &str,
) -> Result<Vec<ApiRequest>, String> {
  let mut statement = connection
    .prepare("SELECT data_json FROM requests WHERE workspace_id = ?1 ORDER BY updated_at DESC")
    .map_err(error)?;
  statement
    .query_map([workspace_id], |row| row.get::<_, String>(0))
    .map_err(error)?
    .map(|row| serde_json::from_str(&row.map_err(error)?).map_err(error))
    .collect()
}

pub fn list_environment(
  connection: &Connection,
  workspace_id: &str,
) -> Result<Vec<EnvironmentVariable>, String> {
  let mut statement = connection
    .prepare(
      "SELECT id, workspace_id, active, key, initial_value, current_value, position
             FROM environment_variables WHERE workspace_id = ?1 ORDER BY position",
    )
    .map_err(error)?;
  statement
    .query_map([workspace_id], |row| {
      Ok(EnvironmentVariable {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        active: row.get(2)?,
        key: row.get(3)?,
        initial_value: row.get(4)?,
        current_value: row.get(5)?,
        position: row.get(6)?,
      })
    })
    .map_err(error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(error)
}

pub fn list_tabs(connection: &Connection, workspace_id: &str) -> Result<Vec<TabSession>, String> {
  let mut statement = connection
    .prepare(
      "SELECT id, workspace_id, request_id, position, draft_json, dirty
             FROM tab_sessions WHERE workspace_id = ?1 ORDER BY position",
    )
    .map_err(error)?;
  let rows = statement
    .query_map([workspace_id], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, i64>(3)?,
        row.get::<_, String>(4)?,
        row.get::<_, bool>(5)?,
      ))
    })
    .map_err(error)?;
  rows
    .map(|row| {
      let (id, workspace_id, request_id, order, raw, dirty) = row.map_err(error)?;
      Ok(TabSession {
        id,
        workspace_id,
        request_id,
        order,
        draft: serde_json::from_str(&raw).map_err(error)?,
        dirty,
      })
    })
    .collect()
}

pub fn list_history(
  connection: &Connection,
  workspace_id: &str,
) -> Result<Vec<HistoryEntry>, String> {
  let mut statement = connection
    .prepare(
      "SELECT id, workspace_id, request_json, response_json, created_at
             FROM history WHERE workspace_id = ?1 ORDER BY created_at DESC LIMIT 500",
    )
    .map_err(error)?;
  let rows = statement
    .query_map([workspace_id], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, i64>(4)?,
      ))
    })
    .map_err(error)?;
  rows
    .map(|row| {
      let (id, workspace_id, request, response, created_at) = row.map_err(error)?;
      Ok(HistoryEntry {
        id,
        workspace_id,
        request: serde_json::from_str(&request).map_err(error)?,
        response: serde_json::from_str::<HttpExecutionResult>(&response).map_err(error)?,
        created_at,
      })
    })
    .collect()
}

pub fn insert_request(connection: &Connection, request: &ApiRequest) -> Result<(), String> {
  connection
    .execute(
      "INSERT INTO requests (id, workspace_id, data_json, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
               workspace_id = excluded.workspace_id,
               data_json = excluded.data_json,
               updated_at = excluded.updated_at",
      params![
        request.id,
        request.workspace_id,
        serde_json::to_string(request).map_err(error)?,
        request.updated_at
      ],
    )
    .map_err(error)?;
  Ok(())
}

pub fn insert_node(connection: &Connection, node: &TreeNode) -> Result<(), String> {
  connection
    .execute(
      "INSERT INTO nodes (id, workspace_id, parent_id, kind, request_id, name, position)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      params![
        node.id,
        node.workspace_id,
        node.parent_id,
        node.kind,
        node.request_id,
        node.name,
        node.position
      ],
    )
    .map_err(error)?;
  Ok(())
}

pub fn validate_parent(
  connection: &Connection,
  workspace_id: &str,
  parent_id: Option<&str>,
) -> Result<(), String> {
  let Some(parent_id) = parent_id else {
    return Ok(());
  };
  let valid: bool = connection
    .query_row(
      "SELECT EXISTS(
               SELECT 1 FROM nodes WHERE id = ?1 AND workspace_id = ?2 AND kind = 'folder'
             )",
      params![parent_id, workspace_id],
      |row| row.get(0),
    )
    .map_err(error)?;
  if valid {
    Ok(())
  } else {
    Err("The destination must be a folder in the same workspace.".into())
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;

  #[test]
  fn seeds_and_isolates_a_workspace_database() {
    let directory = tempdir().unwrap();
    let state = AppState::open(directory.path()).unwrap();
    state
      .with_connection(|connection| {
        let workspaces = list_workspaces(connection)?;
        assert_eq!(workspaces.len(), 1);
        assert_eq!(
          read_settings(connection)?.selected_workspace_id,
          workspaces[0].id
        );
        Ok(())
      })
      .unwrap();
  }

  #[test]
  fn rejects_a_request_as_parent() {
    let directory = tempdir().unwrap();
    let state = AppState::open(directory.path()).unwrap();
    state
      .with_connection(|connection| {
        let workspace = list_workspaces(connection)?.remove(0);
        let request = ApiRequest::empty("request_test".into(), workspace.id.clone());
        insert_request(connection, &request)?;
        insert_node(
          connection,
          &TreeNode {
            id: "node_test".into(),
            workspace_id: workspace.id.clone(),
            parent_id: None,
            kind: "request".into(),
            request_id: Some(request.id),
            name: "Test".into(),
            position: 0,
          },
        )?;
        assert!(validate_parent(connection, &workspace.id, Some("node_test")).is_err());
        Ok(())
      })
      .unwrap();
  }
}
