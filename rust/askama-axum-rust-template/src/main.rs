mod data;
mod settings;
mod templates;

use data::{I18nData, PeopleData};
use rand::Rng;
use settings::Settings;
use templates::{HomeTemplate, PeopleTemplate, PersonTemplate, TerminalTemplate};

use askama::Template;
use axum::{
    extract::Path,
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use std::net::SocketAddr;

use tracing::{info, warn};
use tracing_subscriber::filter::EnvFilter;
use tracing_subscriber::FmtSubscriber;

#[macro_use]
extern crate lazy_static;
lazy_static! {
    static ref SETTINGS: Settings = match Settings::new() {
        Some(s) => s,
        _ => {
            warn!("Failed to parse settings, defaults will be used instead");
            Settings::from_str("").unwrap()
        }
    };
    static ref PEOPLE_DATA: PeopleData = PeopleData::load().expect("Failed to load people data");
    static ref I18N_DATA: I18nData = I18nData::load("nl").expect("Failed to load i18n data");
}

#[tokio::main]
async fn main() {
    // Initialize logging subsystem.
    let trace_sub = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::new("corvus_website=debug"))
        .finish();
    tracing::subscriber::set_global_default(trace_sub).unwrap();

    let app = Router::new()
        .route("/", get(handle_home))
        .route("/people", get(handle_people))
        .route("/people/:id", get(handle_person))
        .route("/terminal/manifesto", get(handle_terminal_manifesto))
        .route("/terminal/corvus-fact", get(handle_terminal_corvus_fact))
        .route("/terminal/magic", get(handle_terminal_magic))
        .route("/_assets/*path", get(handle_assets));

    let listen_addr: SocketAddr = format!("{}:{}", SETTINGS.ip, SETTINGS.port)
        .parse()
        .unwrap();

    info!("Listening on http://{}", listen_addr);

    axum::Server::bind(&listen_addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// Static assets
static MAIN_CSS: &str = include_str!("../assets/main.css");
static THEME_CSS: &str = include_str!("../assets/theme.css");
static TERMINAL_CSS: &str = include_str!("../assets/css/terminal.css");
static INTERACTIONS_CSS: &str = include_str!("../assets/css/interactions.css");
static HTMX_JS: &str = include_str!("../assets/htmx.min.js");
static FAVICON: &str = include_str!("../assets/favicon.svg");
static LOGO_PNG: &[u8] = include_bytes!("../assets/logo.png");

async fn handle_assets(Path(path): Path<String>) -> impl IntoResponse {
    let mut headers = HeaderMap::new();

    match path.as_str() {
        "main.css" => {
            headers.insert(header::CONTENT_TYPE, "text/css".parse().unwrap());
            (StatusCode::OK, headers, MAIN_CSS.as_bytes().to_vec())
        }
        "theme.css" => {
            headers.insert(header::CONTENT_TYPE, "text/css".parse().unwrap());
            (StatusCode::OK, headers, THEME_CSS.as_bytes().to_vec())
        }
        "css/terminal.css" => {
            headers.insert(header::CONTENT_TYPE, "text/css".parse().unwrap());
            (StatusCode::OK, headers, TERMINAL_CSS.as_bytes().to_vec())
        }
        "css/interactions.css" => {
            headers.insert(header::CONTENT_TYPE, "text/css".parse().unwrap());
            (
                StatusCode::OK,
                headers,
                INTERACTIONS_CSS.as_bytes().to_vec(),
            )
        }
        "htmx.min.js" => {
            headers.insert(
                header::CONTENT_TYPE,
                "application/javascript".parse().unwrap(),
            );
            (StatusCode::OK, headers, HTMX_JS.as_bytes().to_vec())
        }
        "favicon.svg" => {
            headers.insert(header::CONTENT_TYPE, "image/svg+xml".parse().unwrap());
            (StatusCode::OK, headers, FAVICON.as_bytes().to_vec())
        }
        "logo.png" => {
            headers.insert(header::CONTENT_TYPE, "image/png".parse().unwrap());
            (StatusCode::OK, headers, LOGO_PNG.to_vec())
        }
        _ => (StatusCode::NOT_FOUND, headers, Vec::new()),
    }
}

async fn handle_home() -> impl IntoResponse {
    let template = HomeTemplate {
        i18n: I18N_DATA.clone(),
        people_count: PEOPLE_DATA.members.len(),
    };

    match template.render() {
        Ok(html) => (StatusCode::OK, Html(html)),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Html("Template error".to_string()),
        ),
    }
}

async fn handle_people() -> impl IntoResponse {
    let template = PeopleTemplate {
        i18n: I18N_DATA.clone(),
        people: PEOPLE_DATA.clone(),
    };

    match template.render() {
        Ok(html) => (StatusCode::OK, Html(html)),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Html("Template error".to_string()),
        ),
    }
}

async fn handle_person(Path(id): Path<String>) -> impl IntoResponse {
    if let Some(person) = PEOPLE_DATA.find_person(&id) {
        let template = PersonTemplate {
            i18n: I18N_DATA.clone(),
            person: person.clone(),
        };

        match template.render() {
            Ok(html) => (StatusCode::OK, Html(html)),
            Err(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Html("Template error".to_string()),
            ),
        }
    } else {
        let error_message = format!(
            "<h1>{}</h1><p><a href=\"/people\">← Back to people</a></p>",
            I18N_DATA.people.not_found
        );
        (StatusCode::NOT_FOUND, Html(error_message))
    }
}

async fn handle_terminal_manifesto() -> impl IntoResponse {
    let template = TerminalTemplate {
        command: I18N_DATA.terminal.manifesto.command.clone(),
        output: I18N_DATA.terminal.manifesto.output.clone(),
    };

    match template.render() {
        Ok(html) => (StatusCode::OK, Html(html)),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Html("Template error".to_string()),
        ),
    }
}

async fn handle_terminal_magic() -> impl IntoResponse {
    let template = TerminalTemplate {
        command: I18N_DATA.terminal.magic.command.clone(),
        output: I18N_DATA.terminal.magic.output.clone(),
    };

    match template.render() {
        Ok(html) => (StatusCode::OK, Html(html)),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Html("Template error".to_string()),
        ),
    }
}

async fn handle_terminal_corvus_fact() -> impl IntoResponse {
    let mut rng = rand::thread_rng();
    let fact_index = rng.gen_range(0..I18N_DATA.terminal.corvus_facts.len());
    let fact = &I18N_DATA.terminal.corvus_facts[fact_index];

    let template = TerminalTemplate {
        command: fact.command.clone(),
        output: fact.output.clone(),
    };

    match template.render() {
        Ok(html) => (StatusCode::OK, Html(html)),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Html("Template error".to_string()),
        ),
    }
}
