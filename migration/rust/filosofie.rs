//! HTML responses for the philosophy application in a future Rust HTTP service.
//! Mount these paths as GET routes and serve reading.css as a static asset.

pub const APPLICATION_PAGES: [(&str, &str); 2] = [
    ("/cv/filosofie", include_str!("../../cv/filosofie/index.html")),
    (
        "/cv/filosofie/en",
        include_str!("../../cv/filosofie/en/index.html"),
    ),
];
