//! Shared legacy Army identity and storage; production is explicitly opt-in.
#![deny(clippy::large_futures)]
pub mod auth;
pub mod copy;
pub mod discord;
pub mod discord_model;
pub mod handler;
pub mod jobs;
pub mod lifecycle;
pub mod mail;
pub mod model;
pub mod payments;
pub mod pidgy;
pub mod public;
pub mod referrals;
pub mod security;
pub mod service;
pub mod store;
pub mod transport;
pub mod webhooks;
