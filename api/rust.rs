use tower::{ServiceBuilder, ServiceExt};
use vercel_runtime::{Error, axum::VercelLayer};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let app = corvus_server::app()?;
    let service = ServiceBuilder::new().layer(VercelLayer::new()).service(app);
    // VercelLayer converts bodies but discards the tuple's state. Preserve the actual
    // invocation's waitUntil collector in an extension before entering that layer.
    vercel_runtime::run(tower::service_fn(
        move |(state, mut req): (vercel_runtime::AppState, vercel_runtime::Request)| {
            req.extensions_mut().insert(state.clone());
            service.clone().oneshot((state, req))
        },
    ))
    .await
}
