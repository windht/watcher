mod mcp;
mod models;
mod storage;

use models::{
  ApiRequest, AppSettings, CreatedRequest, EnvironmentVariable, HistoryEntry, HttpExecutionResult,
  MoveNodeInput, TabSession, TreeNode, Workspace, WorkspaceSnapshot,
};
use rusqlite::{OptionalExtension, params};
use storage::{AppState, now_ms};
use tauri::Manager;
use uuid::Uuid;

type CommandResult<T> = Result<T, String>;

fn id(prefix: &str) -> String {
  format!("{prefix}_{}", Uuid::new_v4())
}

#[tauri::command]
fn get_snapshot(
  state: tauri::State<'_, AppState>,
  workspace_id: Option<String>,
) -> CommandResult<WorkspaceSnapshot> {
  state.with_connection(|connection| {
    let mut settings = storage::read_settings(connection)?;
    if let Some(workspace_id) = workspace_id {
      let exists: bool = connection
        .query_row(
          "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = ?1)",
          [&workspace_id],
          |row| row.get(0),
        )
        .map_err(storage::error)?;
      if exists {
        settings.selected_workspace_id = workspace_id;
        storage::write_settings(connection, &settings)?;
      }
    }
    let workspaces = storage::list_workspaces(connection)?;
    if !workspaces
      .iter()
      .any(|workspace| workspace.id == settings.selected_workspace_id)
    {
      settings.selected_workspace_id = workspaces
        .first()
        .map(|workspace| workspace.id.clone())
        .ok_or_else(|| "No local workspace is available.".to_string())?;
      storage::write_settings(connection, &settings)?;
    }
    let selected = settings.selected_workspace_id.clone();
    let selected_tab_id = connection
      .query_row(
        "SELECT selected_tab_id FROM tab_state WHERE workspace_id = ?1",
        [&selected],
        |row| row.get(0),
      )
      .optional()
      .map_err(storage::error)?
      .flatten();
    Ok(WorkspaceSnapshot {
      workspaces,
      selected_workspace_id: selected.clone(),
      nodes: storage::list_nodes(connection, &selected)?,
      requests: storage::list_requests(connection, &selected)?,
      environment_variables: storage::list_environment(connection, &selected)?,
      tabs: storage::list_tabs(connection, &selected)?,
      selected_tab_id,
      settings,
    })
  })
}

#[tauri::command]
fn create_workspace(state: tauri::State<'_, AppState>, name: String) -> CommandResult<Workspace> {
  let name = name.trim();
  if name.is_empty() {
    return Err("Workspace name cannot be empty.".into());
  }
  state.with_connection(|connection| {
    let workspace = Workspace {
      id: id("workspace"),
      name: name.to_string(),
      created_at: now_ms(),
    };
    connection
      .execute(
        "INSERT INTO workspaces (id, name, created_at) VALUES (?1, ?2, ?3)",
        params![workspace.id, workspace.name, workspace.created_at],
      )
      .map_err(storage::error)?;
    let mut settings = storage::read_settings(connection)?;
    settings.selected_workspace_id = workspace.id.clone();
    storage::write_settings(connection, &settings)?;
    Ok(workspace)
  })
}

#[tauri::command]
fn rename_workspace(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  name: String,
) -> CommandResult<()> {
  if name.trim().is_empty() {
    return Err("Workspace name cannot be empty.".into());
  }
  state.with_connection(|connection| {
    connection
      .execute(
        "UPDATE workspaces SET name = ?1 WHERE id = ?2",
        params![name.trim(), workspace_id],
      )
      .map_err(storage::error)?;
    Ok(())
  })
}

#[tauri::command]
fn delete_workspace(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
) -> CommandResult<String> {
  state.with_connection(|connection| {
    let exists: bool = connection
      .query_row(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = ?1)",
        [&workspace_id],
        |row| row.get(0),
      )
      .map_err(storage::error)?;
    if !exists {
      return Err("Workspace not found.".into());
    }
    connection
      .execute("DELETE FROM workspaces WHERE id = ?1", [&workspace_id])
      .map_err(storage::error)?;
    let mut workspaces = storage::list_workspaces(connection)?;
    if workspaces.is_empty() {
      let workspace = Workspace {
        id: id("workspace"),
        name: "My Workspace".into(),
        created_at: now_ms(),
      };
      connection
        .execute(
          "INSERT INTO workspaces (id, name, created_at) VALUES (?1, ?2, ?3)",
          params![workspace.id, workspace.name, workspace.created_at],
        )
        .map_err(storage::error)?;
      workspaces.push(workspace);
    }
    let mut settings = storage::read_settings(connection)?;
    if settings.selected_workspace_id == workspace_id {
      settings.selected_workspace_id = workspaces[0].id.clone();
      storage::write_settings(connection, &settings)?;
    }
    Ok(settings.selected_workspace_id)
  })
}

fn next_position(
  connection: &rusqlite::Connection,
  workspace_id: &str,
  parent_id: Option<&str>,
) -> CommandResult<i64> {
  connection
    .query_row(
      "SELECT COALESCE(MAX(position), -1) + 1 FROM nodes
             WHERE workspace_id = ?1 AND parent_id IS ?2",
      params![workspace_id, parent_id],
      |row| row.get(0),
    )
    .map_err(storage::error)
}

#[tauri::command]
fn create_folder(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  parent_id: Option<String>,
  name: String,
) -> CommandResult<TreeNode> {
  state.with_connection(|connection| {
    storage::validate_parent(connection, &workspace_id, parent_id.as_deref())?;
    let node = TreeNode {
      id: id("folder"),
      workspace_id: workspace_id.clone(),
      parent_id: parent_id.clone(),
      kind: "folder".into(),
      request_id: None,
      name,
      position: next_position(connection, &workspace_id, parent_id.as_deref())?,
    };
    storage::insert_node(connection, &node)?;
    Ok(node)
  })
}

#[tauri::command]
fn create_request(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  parent_id: Option<String>,
) -> CommandResult<CreatedRequest> {
  state.with_connection(|connection| {
    storage::validate_parent(connection, &workspace_id, parent_id.as_deref())?;
    let transaction = connection.unchecked_transaction().map_err(storage::error)?;
    let request = ApiRequest::empty(id("request"), workspace_id.clone());
    storage::insert_request(&transaction, &request)?;
    let node = TreeNode {
      id: id("node"),
      workspace_id: workspace_id.clone(),
      parent_id: parent_id.clone(),
      kind: "request".into(),
      request_id: Some(request.id.clone()),
      name: request.name.clone(),
      position: next_position(&transaction, &workspace_id, parent_id.as_deref())?,
    };
    storage::insert_node(&transaction, &node)?;
    transaction.commit().map_err(storage::error)?;
    Ok(CreatedRequest { node, request })
  })
}

#[tauri::command]
fn rename_node(
  state: tauri::State<'_, AppState>,
  node_id: String,
  name: String,
) -> CommandResult<()> {
  if name.trim().is_empty() {
    return Err("Name cannot be empty.".into());
  }
  state.with_connection(|connection| {
    let transaction = connection.unchecked_transaction().map_err(storage::error)?;
    let request_id: Option<String> = transaction
      .query_row(
        "SELECT request_id FROM nodes WHERE id = ?1",
        [&node_id],
        |row| row.get(0),
      )
      .optional()
      .map_err(storage::error)?
      .flatten();
    transaction
      .execute(
        "UPDATE nodes SET name = ?1 WHERE id = ?2",
        params![name.trim(), node_id],
      )
      .map_err(storage::error)?;
    if let Some(request_id) = request_id {
      let raw: String = transaction
        .query_row(
          "SELECT data_json FROM requests WHERE id = ?1",
          [&request_id],
          |row| row.get(0),
        )
        .map_err(storage::error)?;
      let mut request: ApiRequest = serde_json::from_str(&raw).map_err(storage::error)?;
      request.name = name.trim().into();
      request.updated_at = now_ms();
      storage::insert_request(&transaction, &request)?;
    }
    transaction.commit().map_err(storage::error)?;
    Ok(())
  })
}

#[tauri::command]
fn move_node(state: tauri::State<'_, AppState>, input: MoveNodeInput) -> CommandResult<()> {
  state.with_connection(|connection| {
        let workspace_id: String = connection
            .query_row(
                "SELECT workspace_id FROM nodes WHERE id = ?1",
                [&input.node_id],
                |row| row.get(0),
            )
            .map_err(storage::error)?;
        storage::validate_parent(connection, &workspace_id, input.parent_id.as_deref())?;
        if input.parent_id.as_deref() == Some(input.node_id.as_str()) {
            return Err("A node cannot be its own parent.".into());
        }
        if let Some(parent_id) = input.parent_id.as_deref() {
            let creates_cycle: bool = connection
                .query_row(
                    "WITH RECURSIVE descendants(id) AS (
                       SELECT id FROM nodes WHERE parent_id = ?1
                       UNION ALL
                       SELECT nodes.id FROM nodes JOIN descendants ON nodes.parent_id = descendants.id
                     )
                     SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ?2)",
                    params![input.node_id, parent_id],
                    |row| row.get(0),
                )
                .map_err(storage::error)?;
            if creates_cycle {
                return Err("Moving this folder would create a cycle.".into());
            }
        }
        connection
            .execute(
                "UPDATE nodes SET parent_id = ?1, position = ?2 WHERE id = ?3",
                params![input.parent_id, input.position.max(0), input.node_id],
            )
            .map_err(storage::error)?;
        Ok(())
    })
}

#[tauri::command]
fn delete_node(state: tauri::State<'_, AppState>, node_id: String) -> CommandResult<()> {
  state.with_connection(|connection| {
        let transaction = connection.unchecked_transaction().map_err(storage::error)?;
        let request_ids: Vec<String> = {
            let mut statement = transaction
                .prepare(
                    "WITH RECURSIVE subtree(id, request_id) AS (
                       SELECT id, request_id FROM nodes WHERE id = ?1
                       UNION ALL
                       SELECT nodes.id, nodes.request_id FROM nodes JOIN subtree ON nodes.parent_id = subtree.id
                     )
                     SELECT request_id FROM subtree WHERE request_id IS NOT NULL",
                )
                .map_err(storage::error)?;
            let rows = statement
                .query_map([&node_id], |row| row.get::<_, String>(0))
                .map_err(storage::error)?;
            rows.collect::<Result<Vec<_>, _>>().map_err(storage::error)?
        };
        transaction
            .execute(
                "WITH RECURSIVE subtree(id) AS (
                   SELECT id FROM nodes WHERE id = ?1
                   UNION ALL
                   SELECT nodes.id FROM nodes JOIN subtree ON nodes.parent_id = subtree.id
                 )
                 DELETE FROM nodes WHERE id IN (SELECT id FROM subtree)",
                [&node_id],
            )
            .map_err(storage::error)?;
        for request_id in request_ids {
            transaction
                .execute("DELETE FROM requests WHERE id = ?1", [&request_id])
                .map_err(storage::error)?;
        }
        transaction.commit().map_err(storage::error)?;
        Ok(())
    })
}

#[tauri::command]
fn save_request(state: tauri::State<'_, AppState>, request: ApiRequest) -> CommandResult<()> {
  state.with_connection(|connection| {
    let transaction = connection.unchecked_transaction().map_err(storage::error)?;
    storage::insert_request(&transaction, &request)?;
    transaction
      .execute(
        "UPDATE nodes SET name = ?1 WHERE request_id = ?2",
        params![request.name, request.id],
      )
      .map_err(storage::error)?;
    transaction.commit().map_err(storage::error)?;
    Ok(())
  })
}

#[tauri::command]
fn save_environments(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  variables: Vec<EnvironmentVariable>,
) -> CommandResult<()> {
  state.with_connection(|connection| {
    let transaction = connection.unchecked_transaction().map_err(storage::error)?;
    transaction
      .execute(
        "DELETE FROM environment_variables WHERE workspace_id = ?1",
        [&workspace_id],
      )
      .map_err(storage::error)?;
    for variable in variables {
      if variable.workspace_id != workspace_id {
        return Err("Environment variable belongs to another workspace.".into());
      }
      transaction
        .execute(
          "INSERT INTO environment_variables
                     (id, workspace_id, active, key, initial_value, current_value, position)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
          params![
            variable.id,
            variable.workspace_id,
            variable.active,
            variable.key,
            variable.initial_value,
            variable.current_value,
            variable.position
          ],
        )
        .map_err(storage::error)?;
    }
    transaction.commit().map_err(storage::error)?;
    Ok(())
  })
}

#[tauri::command]
fn save_tabs(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  tabs: Vec<TabSession>,
  selected_tab_id: Option<String>,
) -> CommandResult<()> {
  state.with_connection(|connection| {
        let transaction = connection.unchecked_transaction().map_err(storage::error)?;
        transaction
            .execute("DELETE FROM tab_sessions WHERE workspace_id = ?1", [&workspace_id])
            .map_err(storage::error)?;
        for tab in tabs {
            if tab.workspace_id != workspace_id {
                return Err("Tab belongs to another workspace.".into());
            }
            transaction
                .execute(
                    "INSERT INTO tab_sessions (id, workspace_id, request_id, position, draft_json, dirty)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        tab.id,
                        tab.workspace_id,
                        tab.request_id,
                        tab.order,
                        serde_json::to_string(&tab.draft).map_err(storage::error)?,
                        tab.dirty
                    ],
                )
                .map_err(storage::error)?;
        }
        transaction
            .execute(
                "INSERT INTO tab_state (workspace_id, selected_tab_id) VALUES (?1, ?2)
                 ON CONFLICT(workspace_id) DO UPDATE SET selected_tab_id = excluded.selected_tab_id",
                params![workspace_id, selected_tab_id],
            )
            .map_err(storage::error)?;
        transaction.commit().map_err(storage::error)?;
        Ok(())
    })
}

#[tauri::command]
fn record_history(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  request: ApiRequest,
  response: HttpExecutionResult,
) -> CommandResult<()> {
  state.with_connection(|connection| {
    connection
      .execute(
        "INSERT INTO history (id, workspace_id, request_json, response_json, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
          id("history"),
          workspace_id,
          serde_json::to_string(&request).map_err(storage::error)?,
          serde_json::to_string(&response).map_err(storage::error)?,
          now_ms()
        ],
      )
      .map_err(storage::error)?;
    Ok(())
  })
}

#[tauri::command]
fn list_history(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
) -> CommandResult<Vec<HistoryEntry>> {
  state.with_connection(|connection| storage::list_history(connection, &workspace_id))
}

#[tauri::command]
fn clear_history(state: tauri::State<'_, AppState>, workspace_id: String) -> CommandResult<()> {
  state.with_connection(|connection| {
    connection
      .execute(
        "DELETE FROM history WHERE workspace_id = ?1",
        [&workspace_id],
      )
      .map_err(storage::error)?;
    Ok(())
  })
}

#[tauri::command]
fn update_settings(state: tauri::State<'_, AppState>, settings: AppSettings) -> CommandResult<()> {
  state.with_connection(|connection| storage::write_settings(connection, &settings))
}

#[tauri::command]
fn import_items(
  state: tauri::State<'_, AppState>,
  workspace_id: String,
  nodes: Vec<TreeNode>,
  requests: Vec<ApiRequest>,
) -> CommandResult<()> {
  state.with_connection(|connection| {
    let transaction = connection.unchecked_transaction().map_err(storage::error)?;
    for request in requests {
      if request.workspace_id != workspace_id {
        return Err("Imported request belongs to another workspace.".into());
      }
      storage::insert_request(&transaction, &request)?;
    }
    for node in nodes {
      if node.workspace_id != workspace_id {
        return Err("Imported node belongs to another workspace.".into());
      }
      storage::insert_node(&transaction, &node)?;
    }
    transaction.commit().map_err(storage::error)?;
    Ok(())
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      let app_data = app.path().app_data_dir()?;
      app.manage(AppState::open(&app_data)?);
      if let Err(error) = mcp::start(app.handle().clone()) {
        eprintln!("Watcher MCP server did not start: {error}");
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_snapshot,
      create_workspace,
      rename_workspace,
      delete_workspace,
      create_folder,
      create_request,
      rename_node,
      move_node,
      delete_node,
      save_request,
      save_environments,
      save_tabs,
      record_history,
      list_history,
      clear_history,
      update_settings,
      import_items,
    ])
    .run(tauri::generate_context!())
    .expect("error while running Watcher");
}
