//! Statistics migration foundations. Section and private endpoints are opt-in; snapshot orchestration is still pending.
pub mod handler;
pub mod model;
pub mod snapshot;
pub mod view;
use crate::{AppState, Error, visitors};
use serde_json::{Value, json};

pub async fn task(s: &AppState, group: &str, name: &str, day: &str) -> Result<Value, Error> {
    let sql = model::query(group, name, day)?;
    let rows = visitors::hogql(s, &sql).await?;
    model::project(group, name, day, &rows)
}
pub async fn counters(s: &AppState, day: &str, now: i64) -> Result<Value, Error> {
    model::check_day(day)?;
    let today = day == visitors::day(now);
    let mut commands = vec![
        vec!["GET".into(), format!("cv:open:{day}")],
        vec!["GET".into(), format!("cv:download:{day}")],
        vec!["GET".into(), "cv:open".into()],
        vec!["GET".into(), "cv:download".into()],
        vec!["HGETALL".into(), format!("cli:{day}")],
        vec!["HGETALL".into(), "cli:all".into()],
    ];
    if today {
        commands.push(vec!["HGETALL".into(), "lang_votes".into()]);
    }
    let rows = s.store.pipeline(commands).await?;
    model::counters(&rows, today, now)
}
pub async fn games(s: &AppState, day: &str) -> Result<Value, Error> {
    model::check_day(day)?;
    let mut keys = vec![format!("games:day:{day}"), "games:all".into()];
    keys.extend(model::GAMES.iter().map(|t| format!("games:type:{t}")));
    let rows = s
        .store
        .pipeline(
            keys.into_iter()
                .map(|k| vec!["HGETALL".into(), k])
                .collect(),
        )
        .await?;
    let best = s
        .store
        .command(vec!["GET".into(), "games:best".into()])
        .await?;
    let mut types = Vec::new();
    for (i, t) in model::GAMES.iter().enumerate() {
        let mut row = json!({"type":t});
        if let (Some(a), Some(b)) = (row.as_object_mut(), model::pairs(&rows[i + 2])?.as_object()) {
            a.extend(b.clone());
        }
        types.push(row);
    }
    Ok(
        json!({"today":model::pairs(&rows[0])?,"all":model::pairs(&rows[1])?,"types":types,"best":model::number(Some(&best))}),
    )
}
