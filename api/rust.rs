use tower::ServiceBuilder;
use vercel_runtime::{Error, axum::VercelLayer};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let app = corvus_server::app()?;
    vercel_runtime::run(ServiceBuilder::new().layer(VercelLayer::new()).service(app)).await
}
