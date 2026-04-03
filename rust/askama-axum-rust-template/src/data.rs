use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Person {
    pub id: String,
    pub name: String,
    pub position: String,
    pub about: String,
    pub links: Vec<Link>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    #[serde(rename = "type")]
    pub link_type: String,
    pub href: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeopleData {
    pub members: Vec<Person>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nData {
    pub meta: MetaI18n,
    pub home: HomeI18n,
    pub people: PeopleI18n,
    pub footer: FooterI18n,
    pub terminal: TerminalI18n,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaI18n {
    pub title: String,
    #[serde(rename = "titlePeople")]
    pub title_people: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeI18n {
    pub tag: String,
    pub title: String,
    pub cta: CtaI18n,
    pub nav: NavI18n,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CtaI18n {
    pub title: String,
    pub subtitle1: String,
    pub subtitle2: String,
    pub slogan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavI18n {
    pub contact: String,
    pub people: String,
    pub manifesto: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeopleI18n {
    pub title: String,
    pub breadcrumb: String,
    pub sections: PeopleSectionsI18n,
    #[serde(rename = "notFound")]
    pub not_found: String,
    #[serde(rename = "noLinks")]
    pub no_links: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeopleSectionsI18n {
    pub about: String,
    pub contacts: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FooterI18n {
    pub email: String,
    pub copyright: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalI18n {
    pub manifesto: TerminalCommand,
    pub magic: TerminalCommand,
    #[serde(rename = "corvusFacts")]
    pub corvus_facts: Vec<TerminalCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCommand {
    pub command: String,
    pub output: String,
}

impl PeopleData {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let json_content = include_str!("../data/people.json");
        let people_data: PeopleData = serde_json::from_str(json_content)?;
        Ok(people_data)
    }

    pub fn find_person(&self, id: &str) -> Option<&Person> {
        self.members.iter().find(|person| person.id == id)
    }
}

impl I18nData {
    pub fn load(language: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let json_content = match language {
            "nl" => include_str!("../data/i18n/nl.json"),
            "en" => include_str!("../data/i18n/en.json"),
            _ => include_str!("../data/i18n/nl.json"), // Default to Dutch
        };
        let i18n_data: I18nData = serde_json::from_str(json_content)?;
        Ok(i18n_data)
    }
}
