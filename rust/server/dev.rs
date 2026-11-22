#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port = std::env::var("RUST_DEV_PORT").unwrap_or_else(|_| "4488".into());
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}")).await?;
    println!("Corvus Rust local server: http://127.0.0.1:{port}");
    axum::serve(listener, corvus_server::app()?)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
