//! Anti-Power Patcher 应用入口
//!
//! 在 Windows 发布版本中隐藏控制台窗口

// 在 Windows 发布版本中隐藏控制台窗口，请勿删除！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// 程序入口点
fn main() {
    patcher_lib::run()
}
