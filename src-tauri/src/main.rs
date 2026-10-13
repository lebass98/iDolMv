// 릴리스 빌드에서 터미널 창이 뜨지 않게 함
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    idol_mv_lib::run()
}
