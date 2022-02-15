#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{Submenu, Menu, MenuItem};

fn main() {
  let my_app_menu = Menu::new()
    .add_native_item(MenuItem::Copy)
    .add_native_item(MenuItem::Paste)
    .add_native_item(MenuItem::SelectAll)
    .add_native_item(MenuItem::Cut)
    .add_native_item(MenuItem::Undo)
    .add_native_item(MenuItem::Redo);
    
  let menu = Menu::new()
     .add_submenu(Submenu::new("Edit", my_app_menu));

  tauri::Builder::default()
    .menu(menu)
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
