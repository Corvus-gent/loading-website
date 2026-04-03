use crate::data::{I18nData, PeopleData, Person};
use askama::Template;

#[derive(Template)]
#[template(path = "home.html")]
pub struct HomeTemplate {
    pub i18n: I18nData,
    pub people_count: usize,
}

#[derive(Template)]
#[template(path = "people.html")]
pub struct PeopleTemplate {
    pub i18n: I18nData,
    pub people: PeopleData,
}

#[derive(Template)]
#[template(path = "person.html")]
pub struct PersonTemplate {
    pub i18n: I18nData,
    pub person: Person,
}

#[derive(Template)]
#[template(path = "components/terminal/terminal.html")]
pub struct TerminalTemplate {
    pub command: String,
    pub output: String,
}
