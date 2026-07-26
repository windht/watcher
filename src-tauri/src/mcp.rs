use std::{
  collections::HashMap,
  sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
  },
  thread::{self, JoinHandle},
  time::{Duration, Instant},
};

use reqwest::blocking::Client;
use rusqlite::{OptionalExtension, params};
use serde::Deserialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Manager};
use tiny_http::{Header, Method, Request, Response, Server, StatusCode};

use crate::{
  models::{
    ApiRequest, CreatedRequest, HttpExecutionResult, KeyValueRow, McpServerStatus, RequestBody,
    TreeNode, Workspace,
  },
  storage::{self, AppState},
};

pub const DEFAULT_MCP_SERVER_PORT: u16 = 11532;
const MCP_PROTOCOL_VERSION: &str = "2025-06-18";

pub struct McpServerManager {
  state: Arc<Mutex<RuntimeState>>,
  control: Mutex<Option<ServerControl>>,
}

struct RuntimeState {
  running: bool,
  port: u16,
  last_error: Option<String>,
}

struct ServerControl {
  stop: Arc<AtomicBool>,
  join: JoinHandle<()>,
}

impl McpServerManager {
  pub fn new(port: u16) -> Self {
    Self {
      state: Arc::new(Mutex::new(RuntimeState {
        running: false,
        port,
        last_error: None,
      })),
      control: Mutex::new(None),
    }
  }

  pub fn start(&self, app: AppHandle, port: u16) -> Result<(), String> {
    let server = match Server::http(("127.0.0.1", port)) {
      Ok(server) => server,
      Err(error) => {
        let message = format!("Could not bind the Watcher MCP server to port {port}: {error}");
        let mut state = self.state.lock().expect("MCP runtime state lock poisoned");
        state.running = false;
        state.port = port;
        state.last_error = Some(message.clone());
        return Err(message);
      }
    };
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = stop.clone();
    let runtime = self.state.clone();
    let join = thread::spawn(move || run_server(server, app, port, thread_stop, runtime));
    *self.control.lock().expect("MCP control lock poisoned") = Some(ServerControl { stop, join });
    let mut state = self.state.lock().expect("MCP runtime state lock poisoned");
    state.running = true;
    state.port = port;
    state.last_error = None;
    Ok(())
  }

  pub fn restart(&self, app: AppHandle, port: u16) -> Result<McpServerStatus, String> {
    let previous_port = self.status().port;
    if previous_port == port && self.status().running {
      return Ok(self.status());
    }
    self.stop();
    if let Err(error) = self.start(app.clone(), port) {
      let _ = self.start(app, previous_port);
      return Err(error);
    }
    Ok(self.status())
  }

  pub fn status(&self) -> McpServerStatus {
    let state = self.state.lock().expect("MCP runtime state lock poisoned");
    McpServerStatus {
      running: state.running,
      port: state.port,
      endpoint: endpoint(state.port),
      last_error: state.last_error.clone(),
    }
  }

  fn stop(&self) {
    let control = self
      .control
      .lock()
      .expect("MCP control lock poisoned")
      .take();
    if let Some(control) = control {
      control.stop.store(true, Ordering::SeqCst);
      let _ = control.join.join();
    }
    self
      .state
      .lock()
      .expect("MCP runtime state lock poisoned")
      .running = false;
  }
}

fn endpoint(port: u16) -> String {
  format!("http://127.0.0.1:{port}/mcp")
}

fn run_server(
  server: Server,
  app: AppHandle,
  port: u16,
  stop: Arc<AtomicBool>,
  runtime: Arc<Mutex<RuntimeState>>,
) {
  while !stop.load(Ordering::SeqCst) {
    match server.recv_timeout(Duration::from_millis(200)) {
      Ok(Some(request)) => handle_request(request, &app, port),
      Ok(None) => {}
      Err(error) => {
        let mut state = runtime.lock().expect("MCP runtime state lock poisoned");
        state.running = false;
        state.last_error = Some(format!("Watcher MCP server stopped unexpectedly: {error}"));
        break;
      }
    }
  }
  runtime
    .lock()
    .expect("MCP runtime state lock poisoned")
    .running = false;
}

fn handle_request(mut request: Request, app: &AppHandle, port: u16) {
  if !origin_allowed(&request) {
    let _ = request.respond(json_response(
      StatusCode(403),
      json!({ "error": "forbidden origin" }),
    ));
    return;
  }
  if request.method() == &Method::Options {
    let _ = request.respond(empty_response(StatusCode(204)));
    return;
  }
  let response = match (request.method(), request.url()) {
    (&Method::Get, "/") | (&Method::Get, "/mcp") => json_response(
      StatusCode(200),
      json!({
        "name": "watcher",
        "version": env!("CARGO_PKG_VERSION"),
        "endpoint": endpoint(port),
        "transport": "streamable-http"
      }),
    ),
    (&Method::Post, "/") | (&Method::Post, "/mcp") => match handle_json_rpc(&mut request, app) {
      Ok(response) => response,
      Err(error) => json_response(
        StatusCode(200),
        json!({
          "jsonrpc": "2.0", "id": Value::Null,
          "error": { "code": -32603, "message": error }
        }),
      ),
    },
    _ => json_response(StatusCode(404), json!({ "error": "not found" })),
  };
  let _ = request.respond(response);
}

fn handle_json_rpc(
  request: &mut Request,
  app: &AppHandle,
) -> Result<Response<std::io::Cursor<Vec<u8>>>, String> {
  let mut body = String::new();
  request
    .as_reader()
    .read_to_string(&mut body)
    .map_err(storage::error)?;
  let payload: JsonRpcRequest = serde_json::from_str(&body).map_err(storage::error)?;
  let id = payload.id.clone().unwrap_or(Value::Null);
  if payload.id.is_none() {
    return Ok(empty_response(StatusCode(202)));
  }
  let response = match payload.method.as_str() {
    "initialize" => json!({
      "jsonrpc": "2.0", "id": id,
      "result": {
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": { "tools": {} },
        "serverInfo": { "name": "watcher", "version": env!("CARGO_PKG_VERSION") },
        "instructions": "Manage and execute Watcher API requests. All executions are recorded in Watcher History. Never pass credential values in tool arguments; use Watcher environment placeholders such as {{API_TOKEN}}."
      }
    }),
    "notifications/initialized" => return Ok(empty_response(StatusCode(202))),
    "ping" => json!({ "jsonrpc": "2.0", "id": id, "result": {} }),
    "tools/list" => {
      json!({ "jsonrpc": "2.0", "id": id, "result": { "tools": tool_definitions() } })
    }
    "tools/call" => {
      let params = payload
        .params
        .ok_or_else(|| "missing tools/call params".to_string())?;
      let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or_else(|| "missing tool name".to_string())?;
      let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
      json!({ "jsonrpc": "2.0", "id": id, "result": call_tool(name, arguments, app)? })
    }
    _ => {
      json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": "method not found" } })
    }
  };
  Ok(json_response(StatusCode(200), response))
}

fn tool_definitions() -> Vec<Value> {
  let empty = json!({ "type": "object", "properties": {}, "additionalProperties": false });
  let workspace_id =
    json!({ "type": "string", "description": "Workspace id from list_workspaces." });
  let node_id = json!({ "type": "string", "description": "Folder node id from list_folders." });
  let request_id = json!({ "type": "string", "description": "Request id from list_requests." });
  vec![
    tool("list_workspaces", "List Watcher workspaces.", empty.clone()),
    tool(
      "get_workspace",
      "Get one Watcher workspace.",
      object(
        json!({ "workspaceId": workspace_id.clone() }),
        &["workspaceId"],
      ),
    ),
    tool(
      "create_workspace",
      "Create a Watcher workspace.",
      object(
        json!({ "name": { "type": "string", "minLength": 1 } }),
        &["name"],
      ),
    ),
    tool(
      "update_workspace",
      "Rename a Watcher workspace.",
      object(
        json!({ "workspaceId": workspace_id.clone(), "name": { "type": "string", "minLength": 1 } }),
        &["workspaceId", "name"],
      ),
    ),
    tool(
      "delete_workspace",
      "Delete a workspace and its folders, requests, and history.",
      object(
        json!({ "workspaceId": workspace_id.clone() }),
        &["workspaceId"],
      ),
    ),
    tool(
      "list_folders",
      "List folders in a workspace.",
      object(
        json!({ "workspaceId": workspace_id.clone() }),
        &["workspaceId"],
      ),
    ),
    tool(
      "get_folder",
      "Get one folder.",
      object(json!({ "folderId": node_id.clone() }), &["folderId"]),
    ),
    tool(
      "create_folder",
      "Create a folder.",
      object(
        json!({
          "workspaceId": workspace_id.clone(), "parentId": { "type": ["string", "null"] }, "name": { "type": "string", "minLength": 1 }
        }),
        &["workspaceId", "name"],
      ),
    ),
    tool(
      "update_folder",
      "Rename or move a folder.",
      object(
        json!({
          "folderId": node_id.clone(), "name": { "type": "string", "minLength": 1 }, "parentId": { "type": ["string", "null"] }
        }),
        &["folderId"],
      ),
    ),
    tool(
      "delete_folder",
      "Delete a folder and all nested requests.",
      object(json!({ "folderId": node_id.clone() }), &["folderId"]),
    ),
    tool(
      "list_requests",
      "List saved requests in a workspace. Sensitive header values are always redacted.",
      object(
        json!({ "workspaceId": workspace_id.clone() }),
        &["workspaceId"],
      ),
    ),
    tool(
      "get_request",
      "Get one saved request. Sensitive header values are always redacted.",
      object(json!({ "requestId": request_id.clone() }), &["requestId"]),
    ),
    tool(
      "create_request",
      "Create a saved request. Credential header values must be Watcher {{environment}} placeholders, never raw secrets.",
      request_input_schema(false),
    ),
    tool(
      "update_request",
      "Update a saved request. Omitted fields remain unchanged.",
      request_input_schema(true),
    ),
    tool(
      "delete_request",
      "Delete a saved request.",
      object(json!({ "requestId": request_id.clone() }), &["requestId"]),
    ),
    tool(
      "send_request",
      "Execute one saved request and record its request and response in Watcher History.",
      object(json!({ "requestId": request_id.clone() }), &["requestId"]),
    ),
    tool(
      "send_requests",
      "Execute saved requests in order and record every response in Watcher History.",
      object(
        json!({
          "requestIds": { "type": "array", "minItems": 1, "items": request_id }
        }),
        &["requestIds"],
      ),
    ),
  ]
}

fn request_input_schema(update: bool) -> Value {
  let mut properties = json!({
    "workspaceId": { "type": "string" },
    "parentId": { "type": ["string", "null"] },
    "name": { "type": "string", "minLength": 1 },
    "method": { "type": "string" },
    "url": { "type": "string" },
    "params": { "type": "array", "items": key_value_schema() },
    "headers": { "type": "array", "items": key_value_schema() },
    "body": {
      "type": "object",
      "properties": {
        "mode": { "type": "string", "enum": ["none", "json", "text", "form-data"] },
        "raw": { "type": "string" },
        "formData": { "type": "array", "items": key_value_schema() }
      },
      "required": ["mode"],
      "additionalProperties": false
    }
  });
  if update {
    properties
      .as_object_mut()
      .expect("object")
      .insert("requestId".into(), json!({ "type": "string" }));
  }
  object(
    properties,
    if update {
      &["requestId"]
    } else {
      &["workspaceId", "name", "method", "url"]
    },
  )
}

fn key_value_schema() -> Value {
  json!({
    "type": "object",
    "properties": {
      "key": { "type": "string" }, "value": { "type": "string" },
      "active": { "type": "boolean" }, "description": { "type": "string" }
    },
    "required": ["key", "value"],
    "additionalProperties": false
  })
}

fn tool(name: &str, description: &str, input_schema: Value) -> Value {
  json!({ "name": name, "description": description, "inputSchema": input_schema })
}

fn object(properties: Value, required: &[&str]) -> Value {
  json!({ "type": "object", "properties": properties, "required": required, "additionalProperties": false })
}

fn call_tool(name: &str, arguments: Value, app: &AppHandle) -> Result<Value, String> {
  let state = app.state::<AppState>();
  let value = match name {
    "list_workspaces" => state
      .with_connection(|db| storage::list_workspaces(db))
      .map(|items| json!(items)),
    "get_workspace" => {
      let args: WorkspaceIdArgs = parse(arguments)?;
      state
        .with_connection(|db| find_workspace(db, &args.workspace_id))
        .map(|item| json!(item))
    }
    "create_workspace" => {
      let args: NameArgs = parse(arguments)?;
      create_workspace(&state, args.name).map(|item| json!(item))
    }
    "update_workspace" => {
      let args: UpdateWorkspaceArgs = parse(arguments)?;
      update_workspace(&state, args.workspace_id, args.name).map(|item| json!(item))
    }
    "delete_workspace" => {
      let args: WorkspaceIdArgs = parse(arguments)?;
      delete_workspace(&state, args.workspace_id)
    }
    "list_folders" => {
      let args: WorkspaceIdArgs = parse(arguments)?;
      state
        .with_connection(|db| storage::list_nodes(db, &args.workspace_id))
        .map(|nodes| {
          json!(
            nodes
              .into_iter()
              .filter(|node| node.kind == "folder")
              .collect::<Vec<_>>()
          )
        })
    }
    "get_folder" => {
      let args: FolderIdArgs = parse(arguments)?;
      state
        .with_connection(|db| find_folder(db, &args.folder_id))
        .map(|item| json!(item))
    }
    "create_folder" => {
      let args: CreateFolderArgs = parse(arguments)?;
      create_folder(&state, args).map(|item| json!(item))
    }
    "update_folder" => {
      let args: UpdateFolderArgs = parse(arguments)?;
      update_folder(&state, args).map(|item| json!(item))
    }
    "delete_folder" => {
      let args: FolderIdArgs = parse(arguments)?;
      delete_node(&state, &args.folder_id)
        .map(|_| json!({ "deleted": true, "folderId": args.folder_id }))
    }
    "list_requests" => {
      let args: WorkspaceIdArgs = parse(arguments)?;
      state
        .with_connection(|db| storage::list_requests(db, &args.workspace_id))
        .map(|items| json!(items.into_iter().map(redact_request).collect::<Vec<_>>()))
    }
    "get_request" => {
      let args: RequestIdArgs = parse(arguments)?;
      load_request(&state, &args.request_id)
        .map(redact_request)
        .map(|item| json!(item))
    }
    "create_request" => {
      let args: RequestInput = parse(arguments)?;
      create_request(&state, args)
        .map(|item| json!({ "node": item.node, "request": redact_request(item.request) }))
    }
    "update_request" => {
      let args: RequestInput = parse(arguments)?;
      update_request(&state, args)
        .map(redact_request)
        .map(|item| json!(item))
    }
    "delete_request" => {
      let args: RequestIdArgs = parse(arguments)?;
      delete_request(&state, &args.request_id)
        .map(|_| json!({ "deleted": true, "requestId": args.request_id }))
    }
    "send_request" => {
      let args: RequestIdArgs = parse(arguments)?;
      execute_saved_request(&state, &args.request_id)
    }
    "send_requests" => {
      let args: RequestIdsArgs = parse(arguments)?;
      args
        .request_ids
        .iter()
        .map(|id| execute_saved_request(&state, id))
        .collect::<Result<Vec<_>, _>>()
        .map(|items| json!(items))
    }
    _ => Err(format!("unknown tool name: {name}")),
  }?;
  Ok(text_result(
    serde_json::to_string_pretty(&value).map_err(storage::error)?,
  ))
}

fn create_workspace(state: &AppState, name: String) -> Result<Workspace, String> {
  let name = required_name(&name, "Workspace")?;
  state.with_connection(|db| {
    let workspace = Workspace {
      id: id("workspace"),
      name,
      created_at: storage::now_ms(),
    };
    db.execute(
      "INSERT INTO workspaces (id, name, created_at) VALUES (?1, ?2, ?3)",
      params![workspace.id, workspace.name, workspace.created_at],
    )
    .map_err(storage::error)?;
    let mut settings = storage::read_settings(db)?;
    settings.selected_workspace_id = workspace.id.clone();
    storage::write_settings(db, &settings)?;
    Ok(workspace)
  })
}

fn update_workspace(
  state: &AppState,
  workspace_id: String,
  name: String,
) -> Result<Workspace, String> {
  let name = required_name(&name, "Workspace")?;
  state.with_connection(|db| {
    find_workspace(db, &workspace_id)?;
    db.execute(
      "UPDATE workspaces SET name = ?1 WHERE id = ?2",
      params![name, workspace_id],
    )
    .map_err(storage::error)?;
    find_workspace(db, &workspace_id)
  })
}

fn delete_workspace(state: &AppState, workspace_id: String) -> Result<Value, String> {
  state.with_connection(|db| {
    find_workspace(db, &workspace_id)?;
    db.execute("DELETE FROM workspaces WHERE id = ?1", [&workspace_id]).map_err(storage::error)?;
    let mut workspaces = storage::list_workspaces(db)?;
    if workspaces.is_empty() {
      let workspace = Workspace { id: id("workspace"), name: "My Workspace".into(), created_at: storage::now_ms() };
      db.execute("INSERT INTO workspaces (id, name, created_at) VALUES (?1, ?2, ?3)", params![workspace.id, workspace.name, workspace.created_at]).map_err(storage::error)?;
      workspaces.push(workspace);
    }
    let mut settings = storage::read_settings(db)?;
    if settings.selected_workspace_id == workspace_id {
      settings.selected_workspace_id = workspaces[0].id.clone();
      storage::write_settings(db, &settings)?;
    }
    Ok(json!({ "deleted": true, "workspaceId": workspace_id, "selectedWorkspaceId": settings.selected_workspace_id }))
  })
}

fn find_workspace(db: &rusqlite::Connection, workspace_id: &str) -> Result<Workspace, String> {
  db.query_row(
    "SELECT id, name, created_at FROM workspaces WHERE id = ?1",
    [workspace_id],
    |row| {
      Ok(Workspace {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
      })
    },
  )
  .optional()
  .map_err(storage::error)?
  .ok_or_else(|| "Workspace not found.".into())
}

fn create_folder(state: &AppState, args: CreateFolderArgs) -> Result<TreeNode, String> {
  let name = required_name(&args.name, "Folder")?;
  state.with_connection(|db| {
    storage::validate_parent(db, &args.workspace_id, args.parent_id.as_deref())?;
    let node = TreeNode {
      id: id("folder"),
      workspace_id: args.workspace_id.clone(),
      parent_id: args.parent_id.clone(),
      kind: "folder".into(),
      request_id: None,
      name,
      position: next_position(db, &args.workspace_id, args.parent_id.as_deref())?,
    };
    storage::insert_node(db, &node)?;
    Ok(node)
  })
}

fn update_folder(state: &AppState, args: UpdateFolderArgs) -> Result<TreeNode, String> {
  state.with_connection(|db| {
    let current = find_folder(db, &args.folder_id)?;
    let name = match args.name { Some(name) => required_name(&name, "Folder")?, None => current.name };
    let parent_id = args.parent_id.unwrap_or(current.parent_id);
    storage::validate_parent(db, &current.workspace_id, parent_id.as_deref())?;
    if parent_id.as_deref() == Some(args.folder_id.as_str()) { return Err("A folder cannot contain itself.".into()); }
    let creates_cycle: bool = match parent_id.as_deref() {
      Some(parent) => db.query_row(
        "WITH RECURSIVE descendants(id) AS (SELECT id FROM nodes WHERE parent_id = ?1 UNION ALL SELECT nodes.id FROM nodes JOIN descendants ON nodes.parent_id = descendants.id) SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ?2)",
        params![args.folder_id, parent], |row| row.get(0)).map_err(storage::error)?,
      None => false,
    };
    if creates_cycle { return Err("Moving this folder would create a cycle.".into()); }
    let position = next_position(db, &current.workspace_id, parent_id.as_deref())?;
    db.execute("UPDATE nodes SET name = ?1, parent_id = ?2, position = ?3 WHERE id = ?4", params![name, parent_id, position, args.folder_id]).map_err(storage::error)?;
    find_folder(db, &args.folder_id)
  })
}

fn find_folder(db: &rusqlite::Connection, folder_id: &str) -> Result<TreeNode, String> {
  db.query_row("SELECT id, workspace_id, parent_id, kind, request_id, name, position FROM nodes WHERE id = ?1 AND kind = 'folder'", [folder_id], |row| Ok(TreeNode {
    id: row.get(0)?, workspace_id: row.get(1)?, parent_id: row.get(2)?, kind: row.get(3)?,
    request_id: row.get(4)?, name: row.get(5)?, position: row.get(6)?
  })).optional().map_err(storage::error)?.ok_or_else(|| "Folder not found.".into())
}

fn create_request(state: &AppState, args: RequestInput) -> Result<CreatedRequest, String> {
  let workspace_id = args
    .workspace_id
    .clone()
    .ok_or_else(|| "workspaceId is required.".to_string())?;
  let name = required_name(args.name.as_deref().unwrap_or(""), "Request")?;
  validate_headers(args.headers.as_deref().unwrap_or(&[]))?;
  state.with_connection(|db| {
    storage::validate_parent(
      db,
      &workspace_id,
      args.parent_id.as_ref().and_then(|parent| parent.as_deref()),
    )?;
    let request = ApiRequest {
      id: id("request"),
      workspace_id: workspace_id.clone(),
      name: name.clone(),
      method: args.method.unwrap_or_else(|| "GET".into()).to_uppercase(),
      url: args.url.unwrap_or_default(),
      params: rows(args.params.unwrap_or_default()),
      headers: rows(args.headers.unwrap_or_default()),
      body: args.body.map(tool_body).unwrap_or_else(empty_body),
      pre_request_script: String::new(),
      post_response_script: String::new(),
      updated_at: storage::now_ms(),
    };
    let transaction = db.unchecked_transaction().map_err(storage::error)?;
    storage::insert_request(&transaction, &request)?;
    let parent_id = args.parent_id.flatten();
    let node = TreeNode {
      id: id("node"),
      workspace_id: workspace_id.clone(),
      parent_id: parent_id.clone(),
      kind: "request".into(),
      request_id: Some(request.id.clone()),
      name,
      position: next_position(&transaction, &workspace_id, parent_id.as_deref())?,
    };
    storage::insert_node(&transaction, &node)?;
    transaction.commit().map_err(storage::error)?;
    Ok(CreatedRequest { node, request })
  })
}

fn update_request(state: &AppState, args: RequestInput) -> Result<ApiRequest, String> {
  let request_id = args
    .request_id
    .clone()
    .ok_or_else(|| "requestId is required.".to_string())?;
  if let Some(headers) = args.headers.as_deref() {
    validate_headers(headers)?;
  }
  state.with_connection(|db| {
    let mut request = load_request_db(db, &request_id)?;
    if let Some(name) = args.name {
      request.name = required_name(&name, "Request")?;
    }
    if let Some(method) = args.method {
      request.method = method.to_uppercase();
    }
    if let Some(url) = args.url {
      request.url = url;
    }
    if let Some(params) = args.params {
      request.params = rows(params);
    }
    if let Some(headers) = args.headers {
      request.headers = rows(headers);
    }
    if let Some(body) = args.body {
      request.body = tool_body(body);
    }
    request.updated_at = storage::now_ms();
    let transaction = db.unchecked_transaction().map_err(storage::error)?;
    storage::insert_request(&transaction, &request)?;
    transaction
      .execute(
        "UPDATE nodes SET name = ?1 WHERE request_id = ?2",
        params![request.name, request.id],
      )
      .map_err(storage::error)?;
    if let Some(parent_id) = args.parent_id {
      storage::validate_parent(&transaction, &request.workspace_id, parent_id.as_deref())?;
      transaction
        .execute(
          "UPDATE nodes SET parent_id = ?1 WHERE request_id = ?2",
          params![parent_id, request.id],
        )
        .map_err(storage::error)?;
    }
    transaction.commit().map_err(storage::error)?;
    Ok(request)
  })
}

fn load_request(state: &AppState, request_id: &str) -> Result<ApiRequest, String> {
  state.with_connection(|db| load_request_db(db, request_id))
}

fn load_request_db(db: &rusqlite::Connection, request_id: &str) -> Result<ApiRequest, String> {
  let raw: Option<String> = db
    .query_row(
      "SELECT data_json FROM requests WHERE id = ?1",
      [request_id],
      |row| row.get(0),
    )
    .optional()
    .map_err(storage::error)?;
  serde_json::from_str(&raw.ok_or_else(|| "Request not found.".to_string())?)
    .map_err(storage::error)
}

fn delete_request(state: &AppState, request_id: &str) -> Result<(), String> {
  state.with_connection(|db| {
    let node_id: String = db
      .query_row(
        "SELECT id FROM nodes WHERE request_id = ?1",
        [request_id],
        |row| row.get(0),
      )
      .map_err(storage::error)?;
    delete_node_db(db, &node_id)
  })
}

fn delete_node(state: &AppState, node_id: &str) -> Result<(), String> {
  state.with_connection(|db| delete_node_db(db, node_id))
}

fn delete_node_db(db: &mut rusqlite::Connection, node_id: &str) -> Result<(), String> {
  let exists: bool = db
    .query_row(
      "SELECT EXISTS(SELECT 1 FROM nodes WHERE id = ?1)",
      [node_id],
      |row| row.get(0),
    )
    .map_err(storage::error)?;
  if !exists {
    return Err("Node not found.".into());
  }
  let transaction = db.unchecked_transaction().map_err(storage::error)?;
  let request_ids = {
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
    statement
      .query_map([node_id], |row| row.get::<_, String>(0))
      .map_err(storage::error)?
      .collect::<Result<Vec<_>, _>>()
      .map_err(storage::error)?
  };
  transaction.execute(
    "WITH RECURSIVE subtree(id) AS (SELECT id FROM nodes WHERE id = ?1 UNION ALL SELECT nodes.id FROM nodes JOIN subtree ON nodes.parent_id = subtree.id) DELETE FROM nodes WHERE id IN (SELECT id FROM subtree)",
    [node_id]).map_err(storage::error)?;
  for request_id in request_ids {
    transaction
      .execute("DELETE FROM requests WHERE id = ?1", [request_id])
      .map_err(storage::error)?;
  }
  transaction.commit().map_err(storage::error)
}

fn execute_saved_request(state: &AppState, request_id: &str) -> Result<Value, String> {
  let request = load_request(state, request_id)?;
  let variables =
    state.with_connection(|db| storage::list_environment(db, &request.workspace_id))?;
  let environment = variables
    .into_iter()
    .filter(|item| item.active && !item.key.is_empty())
    .map(|item| {
      (
        item.key,
        if item.current_value.is_empty() {
          item.initial_value
        } else {
          item.current_value
        },
      )
    })
    .collect::<HashMap<_, _>>();
  let response = execute_http(&request, &environment);
  state.with_connection(|db| {
    db.execute(
      "INSERT INTO history (id, workspace_id, request_json, response_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      params![id("history"), request.workspace_id, serde_json::to_string(&request).map_err(storage::error)?, serde_json::to_string(&response).map_err(storage::error)?, storage::now_ms()]
    ).map_err(storage::error)?;
    Ok(())
  })?;
  Ok(json!({
    "request": redact_request(request),
    "response": redact_response(response),
    "recordedInHistory": true
  }))
}

fn execute_http(
  request: &ApiRequest,
  environment: &HashMap<String, String>,
) -> HttpExecutionResult {
  let started = Instant::now();
  let result = (|| -> Result<reqwest::blocking::Response, String> {
    let mut url =
      reqwest::Url::parse(&substitute(&request.url, environment)).map_err(storage::error)?;
    for row in active_rows(&request.params, environment) {
      url.query_pairs_mut().append_pair(&row.0, &row.1);
    }
    let client = Client::builder()
      .timeout(std::time::Duration::from_secs(30))
      .build()
      .map_err(storage::error)?;
    let method = reqwest::Method::from_bytes(request.method.as_bytes()).map_err(storage::error)?;
    let mut builder = client.request(method, url);
    for (key, value) in active_rows(&request.headers, environment) {
      builder = builder.header(&key, &value);
    }
    match request.body.mode.as_str() {
      "json" => {
        builder = builder
          .header("content-type", "application/json")
          .body(substitute(&request.body.raw, environment))
      }
      "text" => builder = builder.body(substitute(&request.body.raw, environment)),
      "form-data" => {
        let mut form = reqwest::blocking::multipart::Form::new();
        for (key, value) in active_rows(&request.body.form_data, environment) {
          form = form.text(key, value);
        }
        builder = builder.multipart(form);
      }
      _ => {}
    }
    builder.send().map_err(storage::error)
  })();
  match result {
    Ok(response) => {
      let status = response.status();
      let headers = response
        .headers()
        .iter()
        .map(|(key, value)| (key.to_string(), value.to_str().unwrap_or("").to_string()))
        .collect();
      let body = response.text().unwrap_or_default();
      HttpExecutionResult {
        status: status.as_u16() as i64,
        status_text: status.canonical_reason().unwrap_or("").into(),
        headers,
        size_bytes: body.len() as i64,
        body,
        duration_ms: started.elapsed().as_millis() as i64,
        error: None,
      }
    }
    Err(error) => HttpExecutionResult {
      status: 0,
      status_text: "Request failed".into(),
      headers: HashMap::new(),
      body: String::new(),
      duration_ms: started.elapsed().as_millis() as i64,
      size_bytes: 0,
      error: Some(error),
    },
  }
}

fn active_rows(
  rows: &[KeyValueRow],
  environment: &HashMap<String, String>,
) -> Vec<(String, String)> {
  rows
    .iter()
    .filter(|row| row.active && !row.key.is_empty())
    .map(|row| {
      (
        substitute(&row.key, environment),
        substitute(&row.value, environment),
      )
    })
    .collect()
}

fn substitute(value: &str, environment: &HashMap<String, String>) -> String {
  let mut output = value.to_string();
  for (key, value) in environment {
    output = output.replace(&format!("{{{{{key}}}}}"), value);
  }
  output
}

fn redact_request(mut request: ApiRequest) -> ApiRequest {
  for header in &mut request.headers {
    if sensitive_header(&header.key) && !header.value.is_empty() {
      header.value = "••••••••".into();
    }
  }
  request
}

fn redact_response(mut response: HttpExecutionResult) -> HttpExecutionResult {
  for (key, value) in &mut response.headers {
    if sensitive_header(key) {
      *value = "••••••••".into();
    }
  }
  if let Ok(mut body) = serde_json::from_str::<Value>(&response.body) {
    redact_json_value(&mut body);
    response.body = serde_json::to_string_pretty(&body).unwrap_or(response.body);
  }
  response
}

fn redact_json_value(value: &mut Value) {
  match value {
    Value::Array(items) => {
      for item in items {
        redact_json_value(item);
      }
    }
    Value::Object(object) => {
      for (key, item) in object {
        if sensitive_header(key) {
          *item = Value::String("••••••••".into());
        } else {
          redact_json_value(item);
        }
      }
    }
    _ => {}
  }
}

fn sensitive_header(name: &str) -> bool {
  let normalized = name.to_ascii_lowercase().replace(['-', '_'], "");
  normalized.contains("authorization")
    || normalized.contains("apikey")
    || normalized.contains("accesstoken")
    || normalized.contains("secret")
    || normalized == "token"
    || normalized.contains("cookie")
}

fn validate_headers(headers: &[ToolRow]) -> Result<(), String> {
  for header in headers {
    if sensitive_header(&header.key)
      && !header.value.is_empty()
      && !header.value.trim().starts_with("{{")
    {
      return Err(format!(
        "Sensitive header '{}' must use a Watcher environment placeholder; raw credential values are not accepted from an AI tool.",
        header.key
      ));
    }
  }
  Ok(())
}

fn rows(items: Vec<ToolRow>) -> Vec<KeyValueRow> {
  items
    .into_iter()
    .map(|item| KeyValueRow {
      id: id("row"),
      active: item.active.unwrap_or(true),
      key: item.key,
      value: item.value,
      description: item.description.unwrap_or_default(),
    })
    .collect()
}

fn empty_body() -> RequestBody {
  RequestBody {
    mode: "none".into(),
    raw: String::new(),
    form_data: Vec::new(),
  }
}

fn tool_body(body: ToolBody) -> RequestBody {
  RequestBody {
    mode: body.mode,
    raw: body.raw.unwrap_or_default(),
    form_data: rows(body.form_data.unwrap_or_default()),
  }
}

fn next_position(
  db: &rusqlite::Connection,
  workspace_id: &str,
  parent_id: Option<&str>,
) -> Result<i64, String> {
  db.query_row(
    "SELECT COALESCE(MAX(position), -1) + 1 FROM nodes WHERE workspace_id = ?1 AND parent_id IS ?2",
    params![workspace_id, parent_id],
    |row| row.get(0),
  )
  .map_err(storage::error)
}

fn required_name(value: &str, kind: &str) -> Result<String, String> {
  let value = value.trim();
  if value.is_empty() {
    Err(format!("{kind} name cannot be empty."))
  } else {
    Ok(value.into())
  }
}

fn id(prefix: &str) -> String {
  format!("{prefix}_{}", uuid::Uuid::new_v4())
}
fn parse<T: for<'de> Deserialize<'de>>(value: Value) -> Result<T, String> {
  serde_json::from_value(value).map_err(storage::error)
}
fn text_result(message: String) -> Value {
  json!({ "content": [{ "type": "text", "text": message }] })
}

fn json_response(status: StatusCode, payload: Value) -> Response<std::io::Cursor<Vec<u8>>> {
  let mut response = Response::from_string(payload.to_string()).with_status_code(status);
  if let Ok(header) = Header::from_bytes("Content-Type", "application/json") {
    response.add_header(header);
  }
  add_cors(response)
}
fn empty_response(status: StatusCode) -> Response<std::io::Cursor<Vec<u8>>> {
  add_cors(Response::from_string("").with_status_code(status))
}
fn add_cors(
  mut response: Response<std::io::Cursor<Vec<u8>>>,
) -> Response<std::io::Cursor<Vec<u8>>> {
  for (name, value) in [
    ("Access-Control-Allow-Origin", "http://localhost"),
    (
      "Access-Control-Allow-Headers",
      "Content-Type, Origin, Accept",
    ),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
  ] {
    if let Ok(header) = Header::from_bytes(name, value) {
      response.add_header(header);
    }
  }
  response
}
fn origin_allowed(request: &Request) -> bool {
  request
    .headers()
    .iter()
    .find(|header| header.field.equiv("Origin"))
    .map(|header| header.value.as_str().to_string())
    .is_none_or(|origin| {
      origin.starts_with("http://localhost")
        || origin.starts_with("http://127.0.0.1")
        || origin == "tauri://localhost"
    })
}

#[derive(Deserialize)]
struct JsonRpcRequest {
  id: Option<Value>,
  method: String,
  params: Option<Value>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceIdArgs {
  workspace_id: String,
}
#[derive(Deserialize)]
struct NameArgs {
  name: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateWorkspaceArgs {
  workspace_id: String,
  name: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FolderIdArgs {
  folder_id: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateFolderArgs {
  workspace_id: String,
  parent_id: Option<String>,
  name: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateFolderArgs {
  folder_id: String,
  name: Option<String>,
  parent_id: Option<Option<String>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestIdArgs {
  request_id: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestIdsArgs {
  request_ids: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolRow {
  key: String,
  value: String,
  active: Option<bool>,
  description: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolBody {
  mode: String,
  raw: Option<String>,
  form_data: Option<Vec<ToolRow>>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestInput {
  request_id: Option<String>,
  workspace_id: Option<String>,
  parent_id: Option<Option<String>>,
  name: Option<String>,
  method: Option<String>,
  url: Option<String>,
  params: Option<Vec<ToolRow>>,
  headers: Option<Vec<ToolRow>>,
  body: Option<ToolBody>,
}
