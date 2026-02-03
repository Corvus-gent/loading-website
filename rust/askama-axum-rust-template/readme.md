# Corvus Website - Rust Axum Implementation

This is a Rust implementation of the Corvus website using Axum web framework and Askama templating engine, converted from the v2 HTML + Vanilla JS version.

## ✅ Status: Working

The application successfully compiles and runs! All major features are implemented and functional.

## Features

- **Server-side rendered** home page with company information
- **People page** listing all team members  
- **Individual person pages** with detailed information and contact links
- **Internationalization** support (Dutch/English) - currently using Dutch
- **Responsive dark theme** with modern CSS
- **Static asset serving** for CSS, images, and favicon
- **Type-safe data handling** with Rust structs
- **Compile-time template validation** with Askama

## Project Structure

```
├── src/
│   ├── main.rs          # Main application entry point and routes
│   ├── data.rs          # Data structures for people and i18n
│   ├── templates.rs     # Template definitions
│   └── settings.rs      # Configuration settings
├── templates/
│   ├── base.html        # Base template for regular pages
│   ├── people-base.html # Base template for people pages (with body class)
│   ├── home.html        # Home page template
│   ├── people.html      # People list page template
│   └── person.html      # Individual person page template
├── assets/
│   ├── main.css         # Main stylesheet (from v2/css/main.css)
│   ├── theme.css        # Original theme CSS
│   ├── favicon.svg      # Favicon
│   └── logo.png         # Corvus logo
└── data/
    ├── people.json      # Team member data
    └── i18n/           # Internationalization files
        ├── nl.json      # Dutch translations
        └── en.json      # English translations
```

## Routes

- `GET /` - Home page
- `GET /people` - Team members list
- `GET /people/:id` - Individual person page (e.g., `/people/gabriel`)
- `GET /_assets/*` - Static assets (CSS, images, etc.)

## Data Structure

### People Data (`data/people.json`)
```json
{
  "members": [
    {
      "id": "gabriel",
      "name": "Francisco Gabriel Van Langenhove",
      "position": "Founder",
      "about": "Description...",
      "links": [
        {
          "type": "linkedin",
          "href": "https://linkedin.com/in/...",
          "text": "LinkedIn"
        }
      ]
    }
  ]
}
```

### Internationalization (`data/i18n/nl.json`)
```json
{
  "home": {
    "tag": "corvus.gent",
    "title": "corvus",
    "subtitle": "...",
    "description": "...",
    "slogan": "...",
    "loading": "Loading"
  },
  "people": { ... },
  "nav": { ... },
  "footer": { ... }
}
```

## Running the Application

### Prerequisites
- Rust (latest stable version)
- Cargo

### Development
```bash
# Navigate to the project directory
cd loading-website/rust/askama-axum-rust-template

# Run the development server
cargo run

# The server will start on http://0.0.0.0:8080
# View the site at http://localhost:8080
```

### Troubleshooting

**Port already in use error:**
```bash
# Kill any existing server process
pkill -f corvus-website
# Or find and kill the specific process
lsof -ti:8080 | xargs kill -9
```

**Template compilation errors:**
- Ensure all template files use proper Askama syntax
- Check that template paths match file names exactly
- Verify all referenced fields exist in struct definitions

### Production Build
```bash
# Build optimized binary
cargo build --release

# Run the production binary
./target/release/corvus-website
```

## Configuration

Create a `settings.toml` file to configure the server:

```toml
ip = "0.0.0.0"
port = 8080
```

## Migration from v2 (HTML + Vanilla JS)

This Rust implementation replaces the previous v2 implementation which used:
- Static HTML with JavaScript for dynamic content loading
- Client-side routing and component rendering
- JSON data fetching via JavaScript

**Benefits of the Rust implementation:**
- ⚡ **Server-side rendering** for better SEO and performance
- 🔒 **Type-safe data handling** with Rust structs and compile-time validation
- ✅ **Template validation** at compile time (no runtime template errors)
- 🚀 **Single binary deployment** with embedded assets
- 📦 **No JavaScript dependencies** for core functionality
- 🛡️ **Memory safety** and robust error handling
- 🎯 **Fast page loads** with pre-rendered HTML

## Dependencies

- **axum** - Web framework
- **tokio** - Async runtime
- **askama** - Template engine
- **serde** - Serialization/deserialization
- **tower-http** - HTTP middleware for static file serving
- **tracing** - Logging and observability

## Development Notes

- **Templates**: Use Askama syntax (similar to Jinja2/Django templates)
- **Static assets**: Embedded in binary using `include_str!` and `include_bytes!`
- **Data loading**: All JSON data loaded at startup via `lazy_static!` for optimal performance
- **Error handling**: Proper HTTP status codes and user-friendly error pages
- **I18n structure**: Matches the original v2 JSON structure exactly
- **Styling**: Preserved all original CSS from v2 with responsive design

### Key Files Modified from Original Template:
- `src/data.rs` - Data structures matching v2 JSON format
- `templates/` - All templates converted from v2 HTML structure  
- `assets/main.css` - Original v2 styling preserved
- `data/` - Original v2 JSON data files copied

## Testing the Application

Once running, you can test:

- **Home page**: http://localhost:8080/
- **People list**: http://localhost:8080/people  
- **Individual person**: http://localhost:8080/people/gabriel or http://localhost:8080/people/wisdom
- **Static assets**: http://localhost:8080/_assets/main.css

## Future Enhancements

- [ ] Language switching functionality (EN/NL toggle)
- [ ] Add content management system integration
- [ ] Implement response caching for better performance
- [ ] Add API endpoints for headless CMS usage
- [ ] Database integration for dynamic content updates
- [ ] Admin panel for content management
- [ ] Image optimization and CDN integration